#!/bin/bash

# Backup and Disaster Recovery Script
# Provides comprehensive backup and restore capabilities for production environment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Validate AWS credentials and region
validate_aws_config() {
    log "Validating AWS configuration..."
    
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS credentials not configured or invalid"
    fi
    
    if [ -z "${AWS_REGION:-}" ]; then
        error "AWS_REGION not set"
    fi
    
    log "AWS configuration validated"
}

# Create application backup
create_app_backup() {
    local backup_type="${1:-daily}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="madplan-${backup_type}-${timestamp}"
    
    log "Creating ${backup_type} backup: ${backup_name}"
    
    # Create backup directory structure
    local backup_dir="/tmp/${backup_name}"
    mkdir -p "${backup_dir}"/{app,config,logs}
    
    # Backup application files
    if [ -d "/opt/madplan" ]; then
        log "Backing up application files..."
        tar -czf "${backup_dir}/app/application.tar.gz" -C /opt/madplan . \
            --exclude="node_modules" \
            --exclude="*.log" \
            --exclude="tmp/*"
    fi
    
    # Backup configuration files
    log "Backing up configuration..."
    if [ -d "/etc/madplan" ]; then
        cp -r /etc/madplan/* "${backup_dir}/config/"
    fi
    
    # Backup environment variables (excluding secrets)
    env | grep "^MADPLAN_" | grep -v "PASSWORD\|SECRET\|KEY" > "${backup_dir}/config/env_vars.txt"
    
    # Backup logs (last 7 days)
    log "Backing up recent logs..."
    find /var/log/madplan -name "*.log" -mtime -7 -exec cp {} "${backup_dir}/logs/" \; 2>/dev/null || true
    
    # Create backup metadata
    cat > "${backup_dir}/metadata.json" << EOF
{
    "backup_name": "${backup_name}",
    "backup_type": "${backup_type}",
    "timestamp": "${timestamp}",
    "environment": "${ENVIRONMENT:-production}",
    "version": "$(cat /opt/madplan/package.json 2>/dev/null | jq -r .version || echo 'unknown')",
    "created_by": "${USER}",
    "hostname": "$(hostname)"
}
EOF
    
    # Create backup archive
    log "Creating backup archive..."
    tar -czf "/tmp/${backup_name}.tar.gz" -C /tmp "${backup_name}"
    
    # Upload to S3
    local s3_key="${backup_type}/$(date +%Y/%m/%d)/${backup_name}.tar.gz"
    log "Uploading backup to S3: s3://${BACKUP_BUCKET}/${s3_key}"
    
    aws s3 cp "/tmp/${backup_name}.tar.gz" "s3://${BACKUP_BUCKET}/${s3_key}" \
        --storage-class STANDARD_IA \
        --metadata backup-type="${backup_type}",environment="${ENVIRONMENT:-production}"
    
    # Cleanup local files
    rm -rf "${backup_dir}" "/tmp/${backup_name}.tar.gz"
    
    log "Backup completed successfully: ${backup_name}"
    
    # Send notification
    send_backup_notification "SUCCESS" "${backup_name}" "Backup created successfully"
}

# Database backup using AWS Backup or mongodump
create_database_backup() {
    local backup_type="${1:-daily}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    log "Creating database backup (${backup_type})..."
    
    if [ "${DB_TYPE:-mongodb}" = "mongodb" ]; then
        # MongoDB backup
        local backup_name="mongodb-${backup_type}-${timestamp}"
        local backup_dir="/tmp/${backup_name}"
        
        mkdir -p "${backup_dir}"
        
        # Use mongodump with authentication
        mongodump --host="${DB_HOST:-localhost}" \
                 --port="${DB_PORT:-27017}" \
                 --db="${DB_NAME:-madplan}" \
                 --username="${DB_USER}" \
                 --password="${DB_PASSWORD}" \
                 --out="${backup_dir}" \
                 --gzip \
                 --oplog
        
        # Create backup archive
        tar -czf "/tmp/${backup_name}.tar.gz" -C /tmp "${backup_name}"
        
        # Upload to S3
        local s3_key="database/${backup_type}/$(date +%Y/%m/%d)/${backup_name}.tar.gz"
        aws s3 cp "/tmp/${backup_name}.tar.gz" "s3://${BACKUP_BUCKET}/${s3_key}" \
            --storage-class STANDARD_IA
        
        # Cleanup
        rm -rf "${backup_dir}" "/tmp/${backup_name}.tar.gz"
        
        log "MongoDB backup completed: ${backup_name}"
    else
        # Use AWS Backup for RDS or other databases
        log "Triggering AWS Backup for database resources..."
        
        aws backup start-backup-job \
            --backup-vault-name "${BACKUP_VAULT_NAME}" \
            --resource-arn "${DB_RESOURCE_ARN}" \
            --iam-role-arn "${BACKUP_ROLE_ARN}" \
            --backup-options WindowsVSS=enabled
    fi
    
    send_backup_notification "SUCCESS" "database-${backup_type}-${timestamp}" "Database backup created successfully"
}

# Restore application from backup
restore_app_backup() {
    local backup_name="$1"
    local restore_path="${2:-/opt/madplan-restore}"
    
    log "Restoring application from backup: ${backup_name}"
    
    # Download backup from S3
    local temp_backup="/tmp/${backup_name}.tar.gz"
    
    # Find backup in S3
    local s3_key=$(aws s3api list-objects-v2 \
        --bucket "${BACKUP_BUCKET}" \
        --prefix "${backup_name}" \
        --query "Contents[0].Key" \
        --output text)
    
    if [ "${s3_key}" = "None" ]; then
        error "Backup not found: ${backup_name}"
    fi
    
    log "Downloading backup from S3: ${s3_key}"
    aws s3 cp "s3://${BACKUP_BUCKET}/${s3_key}" "${temp_backup}"
    
    # Extract backup
    mkdir -p "${restore_path}"
    tar -xzf "${temp_backup}" -C /tmp
    
    local backup_dir="/tmp/${backup_name}"
    
    # Restore application files
    if [ -d "${backup_dir}/app" ]; then
        log "Restoring application files..."
        mkdir -p "${restore_path}/app"
        tar -xzf "${backup_dir}/app/application.tar.gz" -C "${restore_path}/app"
    fi
    
    # Restore configuration
    if [ -d "${backup_dir}/config" ]; then
        log "Restoring configuration files..."
        cp -r "${backup_dir}/config" "${restore_path}/"
    fi
    
    # Restore logs
    if [ -d "${backup_dir}/logs" ]; then
        log "Restoring log files..."
        cp -r "${backup_dir}/logs" "${restore_path}/"
    fi
    
    # Show metadata
    if [ -f "${backup_dir}/metadata.json" ]; then
        log "Backup metadata:"
        cat "${backup_dir}/metadata.json" | jq .
    fi
    
    # Cleanup
    rm -rf "${temp_backup}" "${backup_dir}"
    
    log "Application restore completed to: ${restore_path}"
    
    # Instructions for activation
    cat << EOF

${BLUE}=== RESTORE COMPLETED ===${NC}

Application restored to: ${restore_path}

Next steps:
1. Review restored files: ls -la ${restore_path}
2. Update configuration if needed
3. Stop current application: systemctl stop madplan
4. Backup current installation: mv /opt/madplan /opt/madplan.backup
5. Move restored files: mv ${restore_path}/app /opt/madplan
6. Restore permissions: chown -R madplan:madplan /opt/madplan
7. Start application: systemctl start madplan
8. Verify functionality: systemctl status madplan

EOF
}

# Restore database from backup
restore_database_backup() {
    local backup_name="$1"
    local target_db="${2:-${DB_NAME}_restore}"
    
    log "Restoring database from backup: ${backup_name}"
    
    if [ "${DB_TYPE:-mongodb}" = "mongodb" ]; then
        # Download MongoDB backup
        local temp_backup="/tmp/${backup_name}.tar.gz"
        local s3_key=$(aws s3api list-objects-v2 \
            --bucket "${BACKUP_BUCKET}" \
            --prefix "database" \
            --query "Contents[?contains(Key, \`${backup_name}\`)].Key | [0]" \
            --output text)
        
        if [ "${s3_key}" = "None" ]; then
            error "Database backup not found: ${backup_name}"
        fi
        
        log "Downloading database backup from S3: ${s3_key}"
        aws s3 cp "s3://${BACKUP_BUCKET}/${s3_key}" "${temp_backup}"
        
        # Extract and restore
        local backup_dir="/tmp/${backup_name}"
        tar -xzf "${temp_backup}" -C /tmp
        
        log "Restoring MongoDB database to: ${target_db}"
        mongorestore --host="${DB_HOST:-localhost}" \
                    --port="${DB_PORT:-27017}" \
                    --db="${target_db}" \
                    --username="${DB_USER}" \
                    --password="${DB_PASSWORD}" \
                    --gzip \
                    --drop \
                    "${backup_dir}/${DB_NAME:-madplan}"
        
        # Cleanup
        rm -rf "${temp_backup}" "${backup_dir}"
        
        log "Database restore completed to: ${target_db}"
    else
        # AWS Backup restore
        log "Use AWS Console or CLI to restore from AWS Backup recovery point"
        log "aws backup start-restore-job --recovery-point-arn <recovery-point-arn> ..."
    fi
}

# Test backup integrity
test_backup_integrity() {
    local backup_name="$1"
    
    log "Testing backup integrity: ${backup_name}"
    
    # Download and extract backup
    local temp_backup="/tmp/${backup_name}.tar.gz"
    local s3_key=$(aws s3api list-objects-v2 \
        --bucket "${BACKUP_BUCKET}" \
        --prefix "${backup_name}" \
        --query "Contents[0].Key" \
        --output text)
    
    if [ "${s3_key}" = "None" ]; then
        error "Backup not found: ${backup_name}"
    fi
    
    aws s3 cp "s3://${BACKUP_BUCKET}/${s3_key}" "${temp_backup}"
    
    # Test archive integrity
    if tar -tzf "${temp_backup}" >/dev/null 2>&1; then
        log "✓ Archive integrity test passed"
    else
        error "✗ Archive integrity test failed"
    fi
    
    # Extract and test structure
    local backup_dir="/tmp/${backup_name}"
    tar -xzf "${temp_backup}" -C /tmp
    
    # Check required files
    local required_files=("metadata.json")
    for file in "${required_files[@]}"; do
        if [ -f "${backup_dir}/${file}" ]; then
            log "✓ Required file found: ${file}"
        else
            warn "✗ Required file missing: ${file}"
        fi
    done
    
    # Validate metadata
    if [ -f "${backup_dir}/metadata.json" ]; then
        if jq . "${backup_dir}/metadata.json" >/dev/null 2>&1; then
            log "✓ Metadata JSON is valid"
        else
            warn "✗ Metadata JSON is invalid"
        fi
    fi
    
    # Cleanup
    rm -rf "${temp_backup}" "${backup_dir}"
    
    log "Backup integrity test completed"
}

# List available backups
list_backups() {
    local backup_type="${1:-all}"
    
    log "Listing available backups (type: ${backup_type})..."
    
    local prefix=""
    if [ "${backup_type}" != "all" ]; then
        prefix="--prefix ${backup_type}/"
    fi
    
    aws s3api list-objects-v2 \
        --bucket "${BACKUP_BUCKET}" \
        ${prefix} \
        --query 'Contents[*].[Key,Size,LastModified]' \
        --output table
}

# Cleanup old backups
cleanup_old_backups() {
    local backup_type="${1:-daily}"
    local retention_days="${2:-30}"
    
    log "Cleaning up ${backup_type} backups older than ${retention_days} days..."
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "${retention_days} days ago" +%Y-%m-%d)
    
    # List and delete old backups
    aws s3api list-objects-v2 \
        --bucket "${BACKUP_BUCKET}" \
        --prefix "${backup_type}/" \
        --query "Contents[?LastModified<\`${cutoff_date}\`].[Key]" \
        --output text | while read key; do
        
        if [ ! -z "${key}" ] && [ "${key}" != "None" ]; then
            log "Deleting old backup: ${key}"
            aws s3 rm "s3://${BACKUP_BUCKET}/${key}"
        fi
    done
    
    log "Cleanup completed for ${backup_type} backups"
}

# Send backup notification
send_backup_notification() {
    local status="$1"
    local backup_name="$2"
    local message="$3"
    
    if [ ! -z "${SNS_TOPIC_ARN:-}" ]; then
        aws sns publish \
            --topic-arn "${SNS_TOPIC_ARN}" \
            --subject "Backup ${status}: ${backup_name}" \
            --message "${message} - Environment: ${ENVIRONMENT:-production}"
    fi
}

# Disaster recovery procedure
disaster_recovery() {
    local recovery_type="${1:-full}"
    
    log "Starting disaster recovery procedure (type: ${recovery_type})..."
    
    case "${recovery_type}" in
        "full")
            log "Performing full disaster recovery..."
            # This would involve:
            # 1. Provision new infrastructure
            # 2. Restore latest backups
            # 3. Update DNS
            # 4. Validate functionality
            log "Full DR requires manual intervention - see disaster recovery playbook"
            ;;
        "app-only")
            log "Performing application-only recovery..."
            # Find latest backup
            local latest_backup=$(aws s3api list-objects-v2 \
                --bucket "${BACKUP_BUCKET}" \
                --prefix "daily/" \
                --query 'reverse(sort_by(Contents, &LastModified))[0].Key' \
                --output text | sed 's|.*/||' | sed 's|\.tar\.gz||')
            
            if [ "${latest_backup}" != "None" ]; then
                restore_app_backup "${latest_backup}"
            else
                error "No recent backup found for application recovery"
            fi
            ;;
        "db-only")
            log "Performing database-only recovery..."
            local latest_db_backup=$(aws s3api list-objects-v2 \
                --bucket "${BACKUP_BUCKET}" \
                --prefix "database/daily/" \
                --query 'reverse(sort_by(Contents, &LastModified))[0].Key' \
                --output text | sed 's|.*/||' | sed 's|\.tar\.gz||')
            
            if [ "${latest_db_backup}" != "None" ]; then
                restore_database_backup "${latest_db_backup}"
            else
                error "No recent database backup found"
            fi
            ;;
        *)
            error "Unknown recovery type: ${recovery_type}. Use: full, app-only, db-only"
            ;;
    esac
    
    log "Disaster recovery procedure completed"
}

# Main function
main() {
    case "${1:-}" in
        "create-app")
            validate_aws_config
            create_app_backup "${2:-daily}"
            ;;
        "create-db")
            validate_aws_config
            create_database_backup "${2:-daily}"
            ;;
        "restore-app")
            if [ -z "${2:-}" ]; then
                error "Usage: $0 restore-app <backup-name> [restore-path]"
            fi
            validate_aws_config
            restore_app_backup "$2" "${3:-}"
            ;;
        "restore-db")
            if [ -z "${2:-}" ]; then
                error "Usage: $0 restore-db <backup-name> [target-db]"
            fi
            validate_aws_config
            restore_database_backup "$2" "${3:-}"
            ;;
        "test")
            if [ -z "${2:-}" ]; then
                error "Usage: $0 test <backup-name>"
            fi
            validate_aws_config
            test_backup_integrity "$2"
            ;;
        "list")
            validate_aws_config
            list_backups "${2:-all}"
            ;;
        "cleanup")
            validate_aws_config
            cleanup_old_backups "${2:-daily}" "${3:-30}"
            ;;
        "dr")
            validate_aws_config
            disaster_recovery "${2:-full}"
            ;;
        *)
            echo "Usage: $0 {create-app|create-db|restore-app|restore-db|test|list|cleanup|dr} [options]"
            echo ""
            echo "Commands:"
            echo "  create-app [daily|weekly|monthly]     - Create application backup"
            echo "  create-db [daily|weekly|monthly]      - Create database backup"
            echo "  restore-app <backup-name> [path]      - Restore application backup"
            echo "  restore-db <backup-name> [target-db]  - Restore database backup"
            echo "  test <backup-name>                    - Test backup integrity"
            echo "  list [daily|weekly|monthly|all]       - List available backups"
            echo "  cleanup [type] [retention-days]       - Cleanup old backups"
            echo "  dr [full|app-only|db-only]            - Disaster recovery"
            echo ""
            echo "Environment variables:"
            echo "  BACKUP_BUCKET       - S3 backup bucket name"
            echo "  BACKUP_VAULT_NAME   - AWS Backup vault name"
            echo "  SNS_TOPIC_ARN       - SNS topic for notifications"
            echo "  DB_HOST, DB_USER, DB_PASSWORD - Database connection"
            echo "  ENVIRONMENT         - Environment name (production, staging)"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
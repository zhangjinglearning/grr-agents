#!/bin/bash

# Configuration file for monitoring and backup scripts
# Set environment-specific values here

# AWS Configuration
export AWS_REGION="${AWS_REGION:-us-east-1}"
export DR_REGION="${DR_REGION:-us-west-2}"

# Backup Configuration
export BACKUP_BUCKET="${BACKUP_BUCKET:-madplan-backup-${ENVIRONMENT:-production}}"
export BACKUP_VAULT_NAME="${BACKUP_VAULT_NAME:-madplan-backup-vault}"
export BACKUP_ROLE_ARN="${BACKUP_ROLE_ARN:-arn:aws:iam::ACCOUNT:role/madplan-backup-role}"

# Database Configuration
export DB_TYPE="${DB_TYPE:-mongodb}"
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-27017}"
export DB_NAME="${DB_NAME:-madplan}"
export DB_USER="${DB_USER:-madplan_user}"
# Note: DB_PASSWORD should be set securely via environment or secrets manager
export DB_RESOURCE_ARN="${DB_RESOURCE_ARN:-}"

# Notification Configuration
export SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"
export SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Application Configuration
export APP_NAME="${APP_NAME:-madplan}"
export ENVIRONMENT="${ENVIRONMENT:-production}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"

# Backup Retention (days)
export DAILY_RETENTION_DAYS="${DAILY_RETENTION_DAYS:-30}"
export WEEKLY_RETENTION_DAYS="${WEEKLY_RETENTION_DAYS:-90}"
export MONTHLY_RETENTION_DAYS="${MONTHLY_RETENTION_DAYS:-365}"

# Backup Schedules (cron format)
export BACKUP_SCHEDULE_DAILY="${BACKUP_SCHEDULE_DAILY:-cron(0 2 * * ? *)}"    # 2 AM daily
export BACKUP_SCHEDULE_WEEKLY="${BACKUP_SCHEDULE_WEEKLY:-cron(0 1 ? * SUN *)}"  # 1 AM Sunday
export BACKUP_SCHEDULE_MONTHLY="${BACKUP_SCHEDULE_MONTHLY:-cron(0 0 1 * ? *)}"   # Midnight 1st of month

# Monitoring Configuration
export METRICS_NAMESPACE="${METRICS_NAMESPACE:-MadPlan/Production}"
export ALERT_EMAIL="${ALERT_EMAIL:-ops@madplan.com}"

# Performance Thresholds
export CPU_THRESHOLD="${CPU_THRESHOLD:-80}"
export MEMORY_THRESHOLD="${MEMORY_THRESHOLD:-85}"
export DISK_THRESHOLD="${DISK_THRESHOLD:-85}"
export API_RESPONSE_THRESHOLD_MS="${API_RESPONSE_THRESHOLD_MS:-500}"
export ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-1}"

# Security Configuration
export SECURITY_SCAN_ENABLED="${SECURITY_SCAN_ENABLED:-true}"
export VULNERABILITY_THRESHOLD="${VULNERABILITY_THRESHOLD:-HIGH}"

# Health Check Configuration
export HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-https://api.madplan.com/health}"
export HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"
export HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-60}"

# Load Balancer Configuration
export LB_DNS_NAME="${LB_DNS_NAME:-}"
export LB_ZONE_ID="${LB_ZONE_ID:-}"

# CDN Configuration
export CDN_DISTRIBUTION_ID="${CDN_DISTRIBUTION_ID:-}"
export CDN_DOMAIN_NAME="${CDN_DOMAIN_NAME:-}"

# Auto Scaling Configuration
export MIN_CAPACITY="${MIN_CAPACITY:-2}"
export MAX_CAPACITY="${MAX_CAPACITY:-10}"
export TARGET_CPU_UTILIZATION="${TARGET_CPU_UTILIZATION:-70}"

# Logging Configuration
export LOG_GROUP_NAME="${LOG_GROUP_NAME:-/aws/ec2/madplan}"
export LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"

# Disaster Recovery Configuration
export DR_MODE="${DR_MODE:-active-passive}"
export RTO_MINUTES="${RTO_MINUTES:-60}"  # Recovery Time Objective
export RPO_MINUTES="${RPO_MINUTES:-15}"  # Recovery Point Objective

# Validate required environment variables
validate_config() {
    local required_vars=(
        "AWS_REGION"
        "ENVIRONMENT"
        "APP_NAME"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            echo "ERROR: Required environment variable $var is not set"
            return 1
        fi
    done
    
    return 0
}

# Load environment-specific overrides if they exist
if [ -f "${SCRIPT_DIR}/config.${ENVIRONMENT}.sh" ]; then
    source "${SCRIPT_DIR}/config.${ENVIRONMENT}.sh"
fi

# Load secrets from AWS Secrets Manager or environment
load_secrets() {
    if command -v aws >/dev/null 2>&1; then
        # Try to load database password from Secrets Manager
        if [ ! -z "${DB_SECRET_ARN:-}" ]; then
            export DB_PASSWORD=$(aws secretsmanager get-secret-value \
                --secret-id "${DB_SECRET_ARN}" \
                --query SecretString \
                --output text | jq -r .password 2>/dev/null || echo "")
        fi
        
        # Load other secrets as needed
        if [ ! -z "${APP_SECRET_ARN:-}" ]; then
            local secrets=$(aws secretsmanager get-secret-value \
                --secret-id "${APP_SECRET_ARN}" \
                --query SecretString \
                --output text 2>/dev/null || echo "{}")
            
            # Export specific secrets
            export JWT_SECRET=$(echo "$secrets" | jq -r .jwt_secret 2>/dev/null || echo "")
            export API_KEY=$(echo "$secrets" | jq -r .api_key 2>/dev/null || echo "")
        fi
    fi
}

# Initialize configuration
init_config() {
    validate_config
    load_secrets
    
    # Create necessary directories
    mkdir -p /var/log/madplan
    mkdir -p /tmp/madplan-backups
    
    # Set permissions
    chmod 750 /var/log/madplan 2>/dev/null || true
    chmod 750 /tmp/madplan-backups 2>/dev/null || true
}

# Call init if script is sourced
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    init_config
fi
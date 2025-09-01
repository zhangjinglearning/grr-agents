#!/bin/bash

# health-check.sh - Comprehensive system health monitoring script
# Usage: ./health-check.sh [environment]

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/health-check.log"
ALERT_THRESHOLD=3  # Number of failures before alerting

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment-specific configurations
case $ENVIRONMENT in
  production)
    API_URL="https://api.madplan.com"
    DB_HOST="madplan-prod-cluster.xyz.mongodb.net"
    ;;
  staging)
    API_URL="https://api-staging.madplan.com"
    DB_HOST="madplan-staging-cluster.xyz.mongodb.net"
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# Logging function
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Health check functions
check_api_health() {
  echo -e "\n${BLUE}=== API Health Check ===${NC}"
  
  # Basic health endpoint
  if curl -f -s --max-time 10 "$API_URL/health" > /dev/null; then
    echo -e "✅ ${GREEN}API health endpoint: HEALTHY${NC}"
  else
    echo -e "❌ ${RED}API health endpoint: UNHEALTHY${NC}"
    return 1
  fi
  
  # Detailed health check
  local detailed_health
  detailed_health=$(curl -s --max-time 10 "$API_URL/health/detailed" 2>/dev/null || echo '{}')
  
  # Parse detailed health response
  if command -v jq >/dev/null 2>&1; then
    local db_status=$(echo "$detailed_health" | jq -r '.database.status // "unknown"')
    local redis_status=$(echo "$detailed_health" | jq -r '.redis.status // "unknown"')
    local uptime=$(echo "$detailed_health" | jq -r '.uptime // "unknown"')
    
    echo "  📊 Database: $db_status"
    echo "  📊 Redis: $redis_status"
    echo "  📊 Uptime: $uptime"
    
    if [[ "$db_status" != "healthy" || "$redis_status" != "healthy" ]]; then
      echo -e "⚠️ ${YELLOW}API dependencies have issues${NC}"
      return 1
    fi
  fi
  
  # Response time check
  local response_time
  response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 10 "$API_URL/api/boards" 2>/dev/null || echo "999")
  
  if (( $(echo "$response_time < 2.0" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "✅ ${GREEN}API response time: ${response_time}s${NC}"
  else
    echo -e "⚠️ ${YELLOW}API response time: ${response_time}s (>2s)${NC}"
  fi
}

check_database_health() {
  echo -e "\n${BLUE}=== Database Health Check ===${NC}"
  
  if ! command -v mongo >/dev/null 2>&1; then
    echo -e "⚠️ ${YELLOW}MongoDB client not available, skipping DB check${NC}"
    return 0
  fi
  
  # Basic connectivity
  if mongo --quiet --eval "db.adminCommand('ping')" "$DB_HOST/madplan" >/dev/null 2>&1; then
    echo -e "✅ ${GREEN}Database connectivity: HEALTHY${NC}"
  else
    echo -e "❌ ${RED}Database connectivity: FAILED${NC}"
    return 1
  fi
  
  # Replica set status
  local rs_status
  rs_status=$(mongo --quiet --eval "JSON.stringify(rs.status())" "$DB_HOST/madplan" 2>/dev/null || echo '{}')
  
  if command -v jq >/dev/null 2>&1; then
    local primary_count=$(echo "$rs_status" | jq '[.members[]? | select(.stateStr == "PRIMARY")] | length' 2>/dev/null || echo "0")
    local secondary_count=$(echo "$rs_status" | jq '[.members[]? | select(.stateStr == "SECONDARY")] | length' 2>/dev/null || echo "0")
    
    if [[ "$primary_count" == "1" && "$secondary_count" -ge "1" ]]; then
      echo -e "✅ ${GREEN}Replica set: 1 primary, $secondary_count secondary${NC}"
    else
      echo -e "⚠️ ${YELLOW}Replica set: $primary_count primary, $secondary_count secondary${NC}"
    fi
  fi
  
  # Query performance test
  local query_time
  query_time=$(mongo --quiet --eval "
    var start = new Date();
    db.boards.findOne();
    var end = new Date();
    print(end - start);
  " "$DB_HOST/madplan" 2>/dev/null || echo "999")
  
  if [[ "$query_time" -lt "100" ]]; then
    echo -e "✅ ${GREEN}Query performance: ${query_time}ms${NC}"
  else
    echo -e "⚠️ ${YELLOW}Query performance: ${query_time}ms (>100ms)${NC}"
  fi
}

check_load_balancer() {
  echo -e "\n${BLUE}=== Load Balancer Health Check ===${NC}"
  
  if ! command -v aws >/dev/null 2>&1; then
    echo -e "⚠️ ${YELLOW}AWS CLI not available, skipping LB check${NC}"
    return 0
  fi
  
  # Get target groups for the environment
  local target_groups
  target_groups=$(aws elbv2 describe-target-groups --names "madplan-${ENVIRONMENT}-tg" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
  
  if [[ -z "$target_groups" || "$target_groups" == "None" ]]; then
    echo -e "⚠️ ${YELLOW}Target group not found for $ENVIRONMENT${NC}"
    return 0
  fi
  
  # Check target health
  local healthy_targets
  local unhealthy_targets
  healthy_targets=$(aws elbv2 describe-target-health --target-group-arn "$target_groups" --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' --output text 2>/dev/null || echo "0")
  unhealthy_targets=$(aws elbv2 describe-target-health --target-group-arn "$target_groups" --query 'length(TargetHealthDescriptions[?TargetHealth.State!=`healthy`])' --output text 2>/dev/null || echo "0")
  
  if [[ "$healthy_targets" -gt "0" && "$unhealthy_targets" == "0" ]]; then
    echo -e "✅ ${GREEN}Load balancer: $healthy_targets healthy targets${NC}"
  elif [[ "$healthy_targets" -gt "0" ]]; then
    echo -e "⚠️ ${YELLOW}Load balancer: $healthy_targets healthy, $unhealthy_targets unhealthy${NC}"
  else
    echo -e "❌ ${RED}Load balancer: No healthy targets${NC}"
    return 1
  fi
}

check_cdn_status() {
  echo -e "\n${BLUE}=== CDN Health Check ===${NC}"
  
  # Check if static assets are accessible
  local cdn_url="https://madplan.com"
  if [[ "$ENVIRONMENT" == "staging" ]]; then
    cdn_url="https://staging.madplan.com"
  fi
  
  # Check main page load
  local status_code
  status_code=$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "$cdn_url" || echo "000")
  
  if [[ "$status_code" == "200" ]]; then
    echo -e "✅ ${GREEN}CDN main page: ACCESSIBLE${NC}"
  else
    echo -e "❌ ${RED}CDN main page: HTTP $status_code${NC}"
    return 1
  fi
  
  # Check static asset
  local asset_status
  asset_status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "$cdn_url/static/css/main.css" || echo "000")
  
  if [[ "$asset_status" == "200" ]]; then
    echo -e "✅ ${GREEN}CDN static assets: ACCESSIBLE${NC}"
  else
    echo -e "⚠️ ${YELLOW}CDN static assets: HTTP $asset_status${NC}"
  fi
}

check_ssl_certificates() {
  echo -e "\n${BLUE}=== SSL Certificate Check ===${NC}"
  
  local domain
  if [[ "$ENVIRONMENT" == "production" ]]; then
    domain="api.madplan.com"
  else
    domain="api-staging.madplan.com"
  fi
  
  # Check certificate expiration
  local cert_info
  cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
  
  if [[ -n "$cert_info" ]]; then
    local not_after
    not_after=$(echo "$cert_info" | grep 'notAfter' | cut -d= -f2)
    local expiry_date
    expiry_date=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
    local current_date
    current_date=$(date +%s)
    local days_until_expiry
    days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
    
    if [[ "$days_until_expiry" -gt "30" ]]; then
      echo -e "✅ ${GREEN}SSL certificate: Valid ($days_until_expiry days remaining)${NC}"
    elif [[ "$days_until_expiry" -gt "7" ]]; then
      echo -e "⚠️ ${YELLOW}SSL certificate: Warning ($days_until_expiry days remaining)${NC}"
    else
      echo -e "❌ ${RED}SSL certificate: Expires soon ($days_until_expiry days remaining)${NC}"
      return 1
    fi
  else
    echo -e "❌ ${RED}SSL certificate: Unable to verify${NC}"
    return 1
  fi
}

check_monitoring_systems() {
  echo -e "\n${BLUE}=== Monitoring Systems Check ===${NC}"
  
  # Check if monitoring endpoints are accessible
  local datadog_status
  datadog_status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "https://api.datadoghq.com/api/v1/validate" || echo "000")
  
  if [[ "$datadog_status" == "200" ]]; then
    echo -e "✅ ${GREEN}Datadog API: ACCESSIBLE${NC}"
  else
    echo -e "⚠️ ${YELLOW}Datadog API: HTTP $datadog_status${NC}"
  fi
  
  # Check Sentry status
  local sentry_status
  sentry_status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "https://sentry.io/api/0/" || echo "000")
  
  if [[ "$sentry_status" == "200" || "$sentry_status" == "401" ]]; then
    echo -e "✅ ${GREEN}Sentry API: ACCESSIBLE${NC}"
  else
    echo -e "⚠️ ${YELLOW}Sentry API: HTTP $sentry_status${NC}"
  fi
}

check_external_dependencies() {
  echo -e "\n${BLUE}=== External Dependencies Check ===${NC}"
  
  # List of external services to check
  local dependencies=(
    "https://api.github.com/status:GitHub API"
    "https://status.aws.amazon.com:AWS Status"
  )
  
  for dep in "${dependencies[@]}"; do
    local url=${dep%%:*}
    local name=${dep##*:}
    
    local status_code
    status_code=$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "$url" || echo "000")
    
    if [[ "$status_code" =~ ^2[0-9][0-9]$ ]]; then
      echo -e "✅ ${GREEN}$name: ACCESSIBLE${NC}"
    else
      echo -e "⚠️ ${YELLOW}$name: HTTP $status_code${NC}"
    fi
  done
}

send_alert() {
  local message=$1
  local severity=${2:-"warning"}
  
  log "ALERT [$severity]: $message"
  
  # Send Slack notification if webhook URL is configured
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local emoji="⚠️"
    if [[ "$severity" == "critical" ]]; then
      emoji="🚨"
    elif [[ "$severity" == "info" ]]; then
      emoji="ℹ️"
    fi
    
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$emoji Health Check Alert [$ENVIRONMENT]: $message\"}" \
      "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
  fi
}

generate_report() {
  local total_checks=$1
  local failed_checks=$2
  local health_percentage=$(( (total_checks - failed_checks) * 100 / total_checks ))
  
  echo -e "\n${BLUE}=== Health Check Summary ===${NC}"
  echo "Environment: $ENVIRONMENT"
  echo "Timestamp: $(date)"
  echo "Total Checks: $total_checks"
  echo "Failed Checks: $failed_checks"
  echo "Health Percentage: $health_percentage%"
  
  if [[ "$failed_checks" -eq 0 ]]; then
    echo -e "Overall Status: ${GREEN}HEALTHY ✅${NC}"
    log "Health check completed successfully - All systems healthy"
  elif [[ "$health_percentage" -ge 80 ]]; then
    echo -e "Overall Status: ${YELLOW}WARNING ⚠️${NC}"
    log "Health check completed with warnings - $failed_checks checks failed"
    send_alert "System health at $health_percentage% - $failed_checks checks failed" "warning"
  else
    echo -e "Overall Status: ${RED}CRITICAL ❌${NC}"
    log "Health check failed - $failed_checks critical issues detected"
    send_alert "System health critical at $health_percentage% - $failed_checks checks failed" "critical"
  fi
}

main() {
  echo -e "${BLUE}=== MadPlan Health Check - $ENVIRONMENT ===${NC}"
  echo "Started at: $(date)"
  
  local total_checks=0
  local failed_checks=0
  
  # Run all health checks
  local checks=(
    "check_api_health"
    "check_database_health"
    "check_load_balancer"
    "check_cdn_status"
    "check_ssl_certificates"
    "check_monitoring_systems"
    "check_external_dependencies"
  )
  
  for check in "${checks[@]}"; do
    if ! $check; then
      ((failed_checks++))
    fi
    ((total_checks++))
  done
  
  # Generate final report
  generate_report $total_checks $failed_checks
  
  # Exit with appropriate code
  if [[ "$failed_checks" -gt 3 ]]; then
    exit 2  # Critical
  elif [[ "$failed_checks" -gt 0 ]]; then
    exit 1  # Warning
  else
    exit 0  # Healthy
  fi
}

# Ensure required tools are available
command -v curl >/dev/null 2>&1 || { echo "❌ curl is required but not installed"; exit 1; }
command -v bc >/dev/null 2>&1 || { echo "⚠️ bc not available, response time checks may not work"; }

# Run main function
main "$@"
#!/bin/bash
# Custom Metrics Collector for MadPlan Application
# Collects business metrics and sends them to CloudWatch and Datadog

set -euo pipefail

# Configuration
CLOUDWATCH_NAMESPACE="${cloudwatch_namespace}"
DATADOG_API_KEY="${datadog_api_key}"
APPLICATION_ENDPOINT="${application_endpoint}"
ENVIRONMENT="${ENVIRONMENT:-production}"
REGION="${AWS_REGION:-us-east-1}"
LOG_FILE="/var/log/metrics-collector.log"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log "ERROR: $1"
    send_alert "metrics_collector_error" "$1" "high"
    exit 1
}

# Send alert function
send_alert() {
    local alert_type="$1"
    local message="$2"
    local severity="${3:-medium}"
    
    # Send to CloudWatch as custom metric
    aws cloudwatch put-metric-data \
        --namespace "MadPlan/Monitoring" \
        --metric-data MetricName="Alert",Value=1,Unit=Count,Dimensions="[{Name=AlertType,Value=$alert_type},{Name=Severity,Value=$severity}]" \
        --region "$REGION" 2>/dev/null || true
    
    log "ALERT [$severity]: $alert_type - $message"
}

# Collect application health metrics
collect_health_metrics() {
    log "Collecting application health metrics..."
    
    local health_url="$APPLICATION_ENDPOINT/api/health"
    local start_time=$(date +%s%3N)
    local response_code
    local response_time
    local health_status=0
    
    # Make health check request
    if response_code=$(curl -s -o /tmp/health_response.json -w "%{http_code}" --connect-timeout 10 --max-time 30 "$health_url"); then
        local end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
        
        if [[ "$response_code" == "200" ]]; then
            health_status=1
            log "Health check passed (${response_time}ms)"
        else
            log "Health check failed with status $response_code"
            send_alert "health_check_failed" "HTTP $response_code" "high"
        fi
    else
        log "Health check request failed"
        response_time=30000  # Timeout value
        send_alert "health_check_timeout" "Request timeout or connection error" "high"
    fi
    
    # Send metrics to CloudWatch
    send_cloudwatch_metric "HealthCheck" "$health_status" "None"
    send_cloudwatch_metric "ResponseTime" "$response_time" "Milliseconds"
    send_cloudwatch_metric "HTTPStatusCode" "$response_code" "None"
    
    # Send metrics to Datadog
    send_datadog_metric "health.check" "$health_status" "gauge"
    send_datadog_metric "health.response_time" "$response_time" "histogram"
}

# Collect business metrics from application API
collect_business_metrics() {
    log "Collecting business metrics..."
    
    local metrics_url="$APPLICATION_ENDPOINT/api/metrics"
    local temp_file="/tmp/business_metrics.json"
    
    # Fetch business metrics
    if curl -s --connect-timeout 10 --max-time 30 "$metrics_url" -o "$temp_file"; then
        if [[ -s "$temp_file" ]]; then
            # Parse and send metrics
            parse_business_metrics "$temp_file"
        else
            log "Empty response from business metrics endpoint"
        fi
    else
        log "Failed to fetch business metrics"
        send_alert "business_metrics_fetch_failed" "Could not retrieve business metrics" "medium"
    fi
    
    # Cleanup
    rm -f "$temp_file"
}

# Parse and send business metrics
parse_business_metrics() {
    local metrics_file="$1"
    
    # Extract metrics using jq
    if command -v jq &> /dev/null; then
        local active_users=$(jq -r '.activeUsers // 0' "$metrics_file")
        local total_boards=$(jq -r '.totalBoards // 0' "$metrics_file")
        local total_cards=$(jq -r '.totalCards // 0' "$metrics_file")
        local requests_per_minute=$(jq -r '.requestsPerMinute // 0' "$metrics_file")
        local error_rate=$(jq -r '.errorRate // 0' "$metrics_file")
        local avg_session_duration=$(jq -r '.avgSessionDuration // 0' "$metrics_file")
        
        # Send to CloudWatch
        send_cloudwatch_metric "ActiveUsers" "$active_users" "Count"
        send_cloudwatch_metric "TotalBoards" "$total_boards" "Count"
        send_cloudwatch_metric "TotalCards" "$total_cards" "Count"
        send_cloudwatch_metric "RequestsPerMinute" "$requests_per_minute" "Count/Second"
        send_cloudwatch_metric "ErrorRate" "$error_rate" "Percent"
        send_cloudwatch_metric "AvgSessionDuration" "$avg_session_duration" "Seconds"
        
        # Send to Datadog
        send_datadog_metric "business.active_users" "$active_users" "gauge"
        send_datadog_metric "business.total_boards" "$total_boards" "gauge"
        send_datadog_metric "business.total_cards" "$total_cards" "gauge"
        send_datadog_metric "business.requests_per_minute" "$requests_per_minute" "rate"
        send_datadog_metric "business.error_rate" "$error_rate" "gauge"
        send_datadog_metric "business.avg_session_duration" "$avg_session_duration" "histogram"
        
        log "Business metrics collected: $active_users active users, $total_boards boards, $total_cards cards"
        
        # Check for alerts
        if (( $(echo "$error_rate > 5" | bc -l) )); then
            send_alert "high_error_rate" "Error rate is ${error_rate}%" "high"
        fi
        
        if (( $(echo "$requests_per_minute > 1000" | bc -l) )); then
            send_alert "high_traffic" "Requests per minute: $requests_per_minute" "medium"
        fi
        
    else
        log "jq not available, using basic parsing"
        # Basic parsing without jq
        local active_users=$(grep -o '"activeUsers":[0-9]*' "$metrics_file" | cut -d':' -f2 || echo "0")
        send_cloudwatch_metric "ActiveUsers" "$active_users" "Count"
        send_datadog_metric "business.active_users" "$active_users" "gauge"
    fi
}

# Collect system metrics
collect_system_metrics() {
    log "Collecting system metrics..."
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' || echo "0")
    
    # Memory usage
    local memory_info=$(free -m)
    local total_memory=$(echo "$memory_info" | awk 'NR==2{print $2}')
    local used_memory=$(echo "$memory_info" | awk 'NR==2{print $3}')
    local memory_usage=$(echo "scale=2; $used_memory * 100 / $total_memory" | bc -l || echo "0")
    
    # Disk usage
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//' || echo "0")
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk -F, '{print $1}' | sed 's/^[ \t]*//' || echo "0")
    
    # Network connections
    local tcp_connections=$(netstat -an | grep -c ESTABLISHED || echo "0")
    
    # Send system metrics
    send_cloudwatch_metric "CPUUtilization" "$cpu_usage" "Percent"
    send_cloudwatch_metric "MemoryUtilization" "$memory_usage" "Percent"
    send_cloudwatch_metric "DiskUtilization" "$disk_usage" "Percent"
    send_cloudwatch_metric "LoadAverage" "$load_avg" "None"
    send_cloudwatch_metric "TCPConnections" "$tcp_connections" "Count"
    
    send_datadog_metric "system.cpu.usage" "$cpu_usage" "gauge"
    send_datadog_metric "system.memory.usage" "$memory_usage" "gauge"
    send_datadog_metric "system.disk.usage" "$disk_usage" "gauge"
    send_datadog_metric "system.load.average" "$load_avg" "gauge"
    send_datadog_metric "system.network.connections" "$tcp_connections" "gauge"
    
    log "System metrics: CPU ${cpu_usage}%, Memory ${memory_usage}%, Disk ${disk_usage}%"
    
    # System alerts
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        send_alert "high_cpu_usage" "CPU usage is ${cpu_usage}%" "medium"
    fi
    
    if (( $(echo "$memory_usage > 85" | bc -l) )); then
        send_alert "high_memory_usage" "Memory usage is ${memory_usage}%" "medium"
    fi
    
    if (( $(echo "$disk_usage > 90" | bc -l) )); then
        send_alert "high_disk_usage" "Disk usage is ${disk_usage}%" "high"
    fi
}

# Collect Docker container metrics
collect_container_metrics() {
    if ! command -v docker &> /dev/null; then
        log "Docker not available, skipping container metrics"
        return
    fi
    
    log "Collecting container metrics..."
    
    local running_containers=$(docker ps -q | wc -l || echo "0")
    local total_containers=$(docker ps -a -q | wc -l || echo "0")
    local failed_containers=$(docker ps -a --filter "status=exited" --filter "status=dead" -q | wc -l || echo "0")
    
    # Container resource usage
    if [[ "$running_containers" -gt 0 ]]; then
        # Get stats for all running containers
        local container_stats=$(docker stats --no-stream --format "table {{.CPUPerc}},{{.MemUsage}}" | tail -n +2 | head -10)
        
        # Calculate average CPU and memory usage
        local avg_cpu=0
        local avg_memory=0
        local container_count=0
        
        while IFS=, read -r cpu_perc mem_usage; do
            cpu_val=$(echo "$cpu_perc" | sed 's/%//')
            mem_val=$(echo "$mem_usage" | cut -d'/' -f1 | sed 's/[^0-9.]//g')
            
            avg_cpu=$(echo "$avg_cpu + $cpu_val" | bc -l)
            container_count=$((container_count + 1))
        done <<< "$container_stats"
        
        if [[ "$container_count" -gt 0 ]]; then
            avg_cpu=$(echo "scale=2; $avg_cpu / $container_count" | bc -l)
        fi
    fi
    
    # Send container metrics
    send_cloudwatch_metric "RunningContainers" "$running_containers" "Count"
    send_cloudwatch_metric "TotalContainers" "$total_containers" "Count"
    send_cloudwatch_metric "FailedContainers" "$failed_containers" "Count"
    
    send_datadog_metric "containers.running" "$running_containers" "gauge"
    send_datadog_metric "containers.total" "$total_containers" "gauge"
    send_datadog_metric "containers.failed" "$failed_containers" "gauge"
    
    if [[ -n "${avg_cpu:-}" ]] && [[ "$avg_cpu" != "0" ]]; then
        send_cloudwatch_metric "ContainerCPUAverage" "$avg_cpu" "Percent"
        send_datadog_metric "containers.cpu.average" "$avg_cpu" "gauge"
    fi
    
    log "Container metrics: $running_containers running, $failed_containers failed"
    
    # Container alerts
    if [[ "$failed_containers" -gt 0 ]]; then
        send_alert "failed_containers" "$failed_containers containers have failed" "medium"
    fi
    
    if [[ "$running_containers" -eq 0 ]]; then
        send_alert "no_running_containers" "No containers are running" "high"
    fi
}

# Send metric to CloudWatch
send_cloudwatch_metric() {
    local metric_name="$1"
    local value="$2"
    local unit="$3"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S)
    
    aws cloudwatch put-metric-data \
        --namespace "$CLOUDWATCH_NAMESPACE" \
        --metric-data MetricName="$metric_name",Value="$value",Unit="$unit",Timestamp="$timestamp" \
        --region "$REGION" \
        2>/dev/null || log "Failed to send CloudWatch metric: $metric_name"
}

# Send metric to Datadog
send_datadog_metric() {
    local metric_name="$1"
    local value="$2"
    local metric_type="$3"
    local timestamp=$(date +%s)
    
    if [[ -z "$DATADOG_API_KEY" || "$DATADOG_API_KEY" == "your-datadog-api-key" ]]; then
        return  # Skip if no API key configured
    fi
    
    local payload=$(cat <<EOF
{
    "series": [{
        "metric": "$metric_name",
        "points": [[$timestamp, $value]],
        "type": "$metric_type",
        "tags": ["environment:$ENVIRONMENT", "service:madplan-backend"]
    }]
}
EOF
    )
    
    curl -s -X POST \
        "https://api.datadoghq.com/api/v1/series" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -d "$payload" \
        >/dev/null 2>&1 || log "Failed to send Datadog metric: $metric_name"
}

# Performance test function
run_performance_test() {
    log "Running performance test..."
    
    local test_url="$APPLICATION_ENDPOINT/api/health"
    local concurrent_requests=10
    local total_requests=100
    
    # Use ab (Apache Bench) if available, otherwise use simple curl
    if command -v ab &> /dev/null; then
        local ab_result=$(ab -n $total_requests -c $concurrent_requests -q "$test_url" 2>/dev/null | grep "Requests per second" | awk '{print $4}' || echo "0")
        send_cloudwatch_metric "PerformanceTestRPS" "$ab_result" "Count/Second"
        send_datadog_metric "performance.test.rps" "$ab_result" "gauge"
        
        local avg_response_time=$(ab -n $total_requests -c $concurrent_requests -q "$test_url" 2>/dev/null | grep "Time per request" | head -1 | awk '{print $4}' || echo "0")
        send_cloudwatch_metric "PerformanceTestAvgTime" "$avg_response_time" "Milliseconds"
        send_datadog_metric "performance.test.avg_time" "$avg_response_time" "histogram"
        
        log "Performance test completed: ${ab_result} RPS, ${avg_response_time}ms avg"
    else
        # Simple performance test with curl
        local start_time=$(date +%s%3N)
        for ((i=1; i<=10; i++)); do
            curl -s "$test_url" >/dev/null &
        done
        wait
        local end_time=$(date +%s%3N)
        local total_time=$((end_time - start_time))
        local avg_time=$((total_time / 10))
        
        send_cloudwatch_metric "PerformanceTestSimple" "$avg_time" "Milliseconds"
        send_datadog_metric "performance.test.simple" "$avg_time" "histogram"
        
        log "Simple performance test: ${avg_time}ms average for 10 concurrent requests"
    fi
}

# Generate summary report
generate_summary() {
    log "Generating metrics collection summary..."
    
    local summary_file="/tmp/metrics_summary_$(date +%Y%m%d_%H%M%S).json"
    local collection_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    cat > "$summary_file" <<EOF
{
    "collection_time": "$collection_time",
    "environment": "$ENVIRONMENT",
    "region": "$REGION",
    "metrics_collected": {
        "health_check": true,
        "business_metrics": true,
        "system_metrics": true,
        "container_metrics": $(command -v docker &> /dev/null && echo "true" || echo "false"),
        "performance_test": true
    },
    "endpoints": {
        "health": "$APPLICATION_ENDPOINT/api/health",
        "metrics": "$APPLICATION_ENDPOINT/api/metrics"
    },
    "destinations": {
        "cloudwatch": "$CLOUDWATCH_NAMESPACE",
        "datadog": $([ -n "$DATADOG_API_KEY" ] && [ "$DATADOG_API_KEY" != "your-datadog-api-key" ] && echo "true" || echo "false")
    }
}
EOF
    
    # Send summary as custom metric
    send_cloudwatch_metric "MetricsCollectionCompleted" "1" "Count"
    send_datadog_metric "metrics.collection.completed" "1" "count"
    
    log "Metrics collection completed successfully"
    log "Summary saved to: $summary_file"
}

# Main execution
main() {
    log "Starting metrics collection run..."
    
    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        handle_error "AWS CLI not available"
    fi
    
    if ! command -v bc &> /dev/null; then
        handle_error "bc calculator not available"
    fi
    
    # Set up log rotation
    if [[ -f "$LOG_FILE" ]] && [[ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        touch "$LOG_FILE"
    fi
    
    # Run metric collection
    collect_health_metrics
    collect_business_metrics
    collect_system_metrics
    collect_container_metrics
    run_performance_test
    generate_summary
    
    log "Metrics collection run completed successfully"
}

# Error handling
trap 'handle_error "Unexpected error in metrics collection"' ERR

# Run main function
main "$@"
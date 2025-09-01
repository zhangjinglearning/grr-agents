#!/bin/bash

# MadPlan Production Monitoring Setup
# Comprehensive monitoring, alerting, and observability configuration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${ENVIRONMENT:-production}
DATADOG_API_KEY=${DATADOG_API_KEY:-}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check required tools
    local required_tools=("curl" "jq" "aws" "docker")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check environment variables
    if [[ -z "$DATADOG_API_KEY" ]]; then
        log_error "DATADOG_API_KEY environment variable is required"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    log_success "Prerequisites validation passed"
}

# Setup Datadog monitoring
setup_datadog() {
    log_info "Setting up Datadog monitoring..."
    
    # Create Datadog configuration directory
    mkdir -p "$SCRIPT_DIR/datadog"
    
    # Create Datadog dashboards
    create_datadog_dashboard() {
        local dashboard_name="$1"
        local dashboard_config="$2"
        
        log_info "Creating Datadog dashboard: $dashboard_name"
        
        curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: $DATADOG_API_KEY" \
            -d "@$dashboard_config" \
            -s -o /tmp/datadog_response.json
        
        if [[ $(jq -r '.id' /tmp/datadog_response.json) != "null" ]]; then
            log_success "Dashboard '$dashboard_name' created successfully"
        else
            log_error "Failed to create dashboard '$dashboard_name'"
            cat /tmp/datadog_response.json
        fi
    }
    
    # Application Performance Dashboard
    cat > "$SCRIPT_DIR/datadog/app-dashboard.json" << 'EOF'
{
  "title": "MadPlan - Application Performance",
  "description": "Comprehensive application performance monitoring for MadPlan",
  "widgets": [
    {
      "id": 1,
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:trace.express.request.duration{env:production,service:madplan-backend}.as_count()",
            "display_type": "line",
            "style": {
              "palette": "dog_classic",
              "line_type": "solid",
              "line_width": "normal"
            }
          }
        ],
        "title": "Response Time (P95)",
        "show_legend": true
      }
    },
    {
      "id": 2,
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "sum:trace.express.request.errors{env:production,service:madplan-backend}.as_rate()",
            "aggregator": "avg"
          }
        ],
        "title": "Error Rate (%)",
        "precision": 2
      }
    },
    {
      "id": 3,
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.cpu.user{env:production,service:madplan-backend}",
            "display_type": "line"
          }
        ],
        "title": "CPU Usage (%)"
      }
    },
    {
      "id": 4,
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.mem.pct_usable{env:production,service:madplan-backend}",
            "display_type": "line"
          }
        ],
        "title": "Memory Usage (%)"
      }
    }
  ],
  "layout_type": "ordered"
}
EOF
    
    # Infrastructure Dashboard
    cat > "$SCRIPT_DIR/datadog/infra-dashboard.json" << 'EOF'
{
  "title": "MadPlan - Infrastructure Monitoring",
  "description": "AWS infrastructure monitoring for MadPlan",
  "widgets": [
    {
      "id": 1,
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:aws.applicationelb.target_response_time.average{*}",
            "display_type": "line"
          }
        ],
        "title": "Load Balancer Response Time"
      }
    },
    {
      "id": 2,
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "avg:aws.applicationelb.healthy_host_count{*}"
          }
        ],
        "title": "Healthy Targets"
      }
    },
    {
      "id": 3,
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:aws.ec2.cpuutilization{*} by {instance-id}",
            "display_type": "line"
          }
        ],
        "title": "EC2 CPU Utilization by Instance"
      }
    },
    {
      "id": 4,
      "definition": {
        "type": "heatmap",
        "requests": [
          {
            "q": "avg:mongodb.atlas.database.collection.count{*} by {database,collection}"
          }
        ],
        "title": "MongoDB Collection Sizes"
      }
    }
  ],
  "layout_type": "ordered"
}
EOF
    
    # Business Metrics Dashboard
    cat > "$SCRIPT_DIR/datadog/business-dashboard.json" << 'EOF'
{
  "title": "MadPlan - Business Metrics",
  "description": "Key business metrics and user analytics for MadPlan",
  "widgets": [
    {
      "id": 1,
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "sum:madplan.users.active{*}.as_count()"
          }
        ],
        "title": "Daily Active Users"
      }
    },
    {
      "id": 2,
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:madplan.boards.created{*}.as_count()",
            "display_type": "bars"
          }
        ],
        "title": "Boards Created (Daily)"
      }
    },
    {
      "id": 3,
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "avg:madplan.session.duration{*}"
          }
        ],
        "title": "Average Session Duration (min)"
      }
    },
    {
      "id": 4,
      "definition": {
        "type": "toplist",
        "requests": [
          {
            "q": "top(sum:madplan.themes.usage{*} by {theme}, 10, 'sum', 'desc')"
          }
        ],
        "title": "Most Popular Themes"
      }
    }
  ],
  "layout_type": "ordered"
}
EOF
    
    # Create dashboards
    create_datadog_dashboard "Application Performance" "$SCRIPT_DIR/datadog/app-dashboard.json"
    create_datadog_dashboard "Infrastructure Monitoring" "$SCRIPT_DIR/datadog/infra-dashboard.json"
    create_datadog_dashboard "Business Metrics" "$SCRIPT_DIR/datadog/business-dashboard.json"
}

# Setup alerts and monitors
setup_alerts() {
    log_info "Setting up monitoring alerts..."
    
    # Create monitors
    create_monitor() {
        local monitor_name="$1"
        local monitor_config="$2"
        
        log_info "Creating monitor: $monitor_name"
        
        curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: $DATADOG_API_KEY" \
            -d "@$monitor_config" \
            -s -o /tmp/monitor_response.json
        
        if [[ $(jq -r '.id' /tmp/monitor_response.json) != "null" ]]; then
            log_success "Monitor '$monitor_name' created successfully"
        else
            log_error "Failed to create monitor '$monitor_name'"
            cat /tmp/monitor_response.json
        fi
    }
    
    # Application Down Monitor
    cat > "$SCRIPT_DIR/datadog/app-down-monitor.json" << EOF
{
  "name": "MadPlan - Application Down",
  "type": "service check",
  "query": "\"http.can_connect\".over(\"instance:madplan.com\").by(\"*\").last(2).count_by_status()",
  "message": "🚨 CRITICAL: MadPlan application is DOWN!\\n\\nThe application health check is failing. Immediate investigation required.\\n\\n@slack-alerts-critical @pagerduty-oncall",
  "tags": ["env:production", "service:madplan", "team:platform"],
  "multi": false,
  "options": {
    "thresholds": {
      "critical": 1,
      "warning": 1
    },
    "notify_no_data": true,
    "no_data_timeframe": 5,
    "notify_audit": false,
    "require_full_window": false,
    "new_host_delay": 300,
    "include_tags": true,
    "escalation_message": "",
    "evaluation_delay": 60
  }
}
EOF
    
    # High Error Rate Monitor
    cat > "$SCRIPT_DIR/datadog/error-rate-monitor.json" << EOF
{
  "name": "MadPlan - High Error Rate",
  "type": "metric alert",
  "query": "avg(last_5m):( sum:trace.express.request.errors{env:production,service:madplan-backend}.as_count() / sum:trace.express.request.hits{env:production,service:madplan-backend}.as_count() ) * 100 > 1",
  "message": "⚠️ WARNING: High error rate detected in MadPlan application\\n\\nError rate: {{value}}%\\nThreshold: > 1%\\n\\nRecent errors may indicate a problem with the application.\\n\\n@slack-alerts-warning",
  "tags": ["env:production", "service:madplan", "team:platform"],
  "options": {
    "thresholds": {
      "critical": 1,
      "warning": 0.5
    },
    "notify_no_data": false,
    "require_full_window": false,
    "new_host_delay": 300,
    "notify_audit": false,
    "include_tags": true,
    "evaluation_delay": 60
  }
}
EOF
    
    # High Response Time Monitor
    cat > "$SCRIPT_DIR/datadog/response-time-monitor.json" << EOF
{
  "name": "MadPlan - High Response Time",
  "type": "metric alert",
  "query": "avg(last_10m):p95:trace.express.request.duration{env:production,service:madplan-backend} > 1000",
  "message": "⚠️ WARNING: High response time detected\\n\\nP95 Response Time: {{value}}ms\\nThreshold: > 1000ms\\n\\nApplication may be experiencing performance issues.\\n\\n@slack-alerts-warning",
  "tags": ["env:production", "service:madplan", "team:platform"],
  "options": {
    "thresholds": {
      "critical": 1000,
      "warning": 500
    },
    "notify_no_data": false,
    "require_full_window": false,
    "evaluation_delay": 60
  }
}
EOF
    
    # Database Connection Monitor
    cat > "$SCRIPT_DIR/datadog/database-monitor.json" << EOF
{
  "name": "MadPlan - Database Connection Issues",
  "type": "log alert",
  "query": "logs(\"service:madplan-backend status:error \\\"database\\\" OR \\\"mongodb\\\" OR \\\"connection\\\"\").index(\"*\").rollup(\"count\").last(\"5m\") > 5",
  "message": "🔴 CRITICAL: Database connection issues detected\\n\\nMultiple database connection errors in the last 5 minutes.\\n\\nThis may indicate database connectivity or performance issues.\\n\\n@slack-alerts-critical @pagerduty-oncall",
  "tags": ["env:production", "service:madplan", "team:platform"],
  "options": {
    "thresholds": {
      "critical": 5
    },
    "notify_no_data": false,
    "evaluation_delay": 60
  }
}
EOF
    
    # Create monitors
    create_monitor "Application Down" "$SCRIPT_DIR/datadog/app-down-monitor.json"
    create_monitor "High Error Rate" "$SCRIPT_DIR/datadog/error-rate-monitor.json"
    create_monitor "High Response Time" "$SCRIPT_DIR/datadog/response-time-monitor.json"
    create_monitor "Database Connection Issues" "$SCRIPT_DIR/datadog/database-monitor.json"
}

# Setup CloudWatch dashboards and alarms
setup_cloudwatch() {
    log_info "Setting up CloudWatch monitoring..."
    
    # Create custom CloudWatch dashboard
    cat > /tmp/cloudwatch-dashboard.json << 'EOF'
{
    "widgets": [
        {
            "type": "metric",
            "x": 0,
            "y": 0,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "madplan-production-alb" ],
                    [ ".", "RequestCount", ".", "." ],
                    [ ".", "HTTPCode_Target_5XX_Count", ".", "." ],
                    [ ".", "HTTPCode_Target_4XX_Count", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "us-east-1",
                "title": "Load Balancer Metrics",
                "period": 300
            }
        },
        {
            "type": "metric",
            "x": 0,
            "y": 6,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "madplan-production-asg" ],
                    [ ".", "NetworkIn", ".", "." ],
                    [ ".", "NetworkOut", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "us-east-1",
                "title": "EC2 Metrics",
                "period": 300
            }
        }
    ]
}
EOF
    
    # Create CloudWatch dashboard
    aws cloudwatch put-dashboard \
        --dashboard-name "MadPlan-Production-Infrastructure" \
        --dashboard-body file:///tmp/cloudwatch-dashboard.json
    
    log_success "CloudWatch dashboard created"
    
    # Create CloudWatch alarms
    create_cloudwatch_alarm() {
        local alarm_name="$1"
        local metric_name="$2"
        local namespace="$3"
        local statistic="$4"
        local threshold="$5"
        local comparison="$6"
        local dimensions="$7"
        
        aws cloudwatch put-metric-alarm \
            --alarm-name "$alarm_name" \
            --alarm-description "MadPlan production monitoring alarm" \
            --metric-name "$metric_name" \
            --namespace "$namespace" \
            --statistic "$statistic" \
            --period 300 \
            --evaluation-periods 2 \
            --threshold "$threshold" \
            --comparison-operator "$comparison" \
            --dimensions "$dimensions" \
            --alarm-actions "arn:aws:sns:us-east-1:$(aws sts get-caller-identity --query Account --output text):madplan-alerts"
        
        log_success "Created CloudWatch alarm: $alarm_name"
    }
    
    # Create SNS topic for alerts
    aws sns create-topic --name madplan-alerts &> /dev/null || true
    
    # Create alarms
    create_cloudwatch_alarm \
        "MadPlan-High-CPU" \
        "CPUUtilization" \
        "AWS/EC2" \
        "Average" \
        80 \
        "GreaterThanThreshold" \
        "Name=AutoScalingGroupName,Value=madplan-production-asg"
    
    create_cloudwatch_alarm \
        "MadPlan-High-Response-Time" \
        "TargetResponseTime" \
        "AWS/ApplicationELB" \
        "Average" \
        1.0 \
        "GreaterThanThreshold" \
        "Name=LoadBalancer,Value=madplan-production-alb"
}

# Setup log aggregation and analysis
setup_logging() {
    log_info "Setting up log aggregation..."
    
    # Create log groups if they don't exist
    local log_groups=("/aws/ec2/madplan-production" "/aws/lambda/madplan-production" "/aws/ecs/madplan-production")
    
    for log_group in "${log_groups[@]}"; do
        aws logs create-log-group --log-group-name "$log_group" --retention-in-days 30 &> /dev/null || true
        log_success "Log group created: $log_group"
    done
    
    # Setup log insights queries
    cat > "$SCRIPT_DIR/log-insights-queries.sql" << 'EOF'
-- Top 10 slowest API requests
fields @timestamp, @message
| filter @message like /response_time/
| stats max(@duration) as max_duration by @requestId
| sort max_duration desc
| limit 10

-- Error analysis by endpoint
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() as error_count by endpoint
| sort error_count desc

-- User activity patterns
fields @timestamp, @message
| filter @message like /user_action/
| stats count() as action_count by user_id, action_type
| sort action_count desc
| limit 20
EOF
    
    log_success "Log aggregation setup completed"
}

# Setup synthetic monitoring
setup_synthetic_monitoring() {
    log_info "Setting up synthetic monitoring..."
    
    # Create Datadog synthetic tests
    cat > "$SCRIPT_DIR/datadog/synthetic-api-test.json" << 'EOF'
{
  "config": {
    "request": {
      "method": "GET",
      "url": "https://madplan.com/api/health",
      "timeout": 60
    },
    "assertions": [
      {
        "type": "statusCode",
        "operator": "is",
        "target": 200
      },
      {
        "type": "responseTime",
        "operator": "lessThan",
        "target": 2000
      },
      {
        "type": "body",
        "operator": "contains",
        "target": "healthy"
      }
    ]
  },
  "locations": ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"],
  "message": "MadPlan API health check failed from {{location}}. @slack-alerts-warning",
  "name": "MadPlan - API Health Check",
  "options": {
    "tick_every": 300,
    "min_failure_duration": 300,
    "min_location_failed": 1
  },
  "tags": ["env:production", "service:madplan"],
  "type": "api"
}
EOF
    
    curl -X POST "https://api.datadoghq.com/api/v1/synthetics/tests" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -d "@$SCRIPT_DIR/datadog/synthetic-api-test.json" \
        -s -o /tmp/synthetic_response.json
    
    if [[ $(jq -r '.public_id' /tmp/synthetic_response.json) != "null" ]]; then
        log_success "Synthetic API test created successfully"
    else
        log_error "Failed to create synthetic API test"
        cat /tmp/synthetic_response.json
    fi
}

# Setup custom metrics collection
setup_custom_metrics() {
    log_info "Setting up custom metrics collection..."
    
    # Create custom metrics collection script
    cat > "$SCRIPT_DIR/collect-business-metrics.js" << 'EOF'
#!/usr/bin/env node

const { StatsD } = require('node-statsd');
const mongoose = require('mongoose');

// Initialize StatsD client for Datadog
const statsd = new StatsD({
  host: 'localhost',
  port: 8125,
  prefix: 'madplan.'
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

async function collectBusinessMetrics() {
  try {
    // Daily Active Users
    const activeUsers = await mongoose.connection.db
      .collection('users')
      .countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
    
    statsd.gauge('users.active', activeUsers);
    
    // Boards created today
    const boardsToday = await mongoose.connection.db
      .collection('boards')
      .countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
    
    statsd.gauge('boards.created', boardsToday);
    
    // Cards created today
    const cardsToday = await mongoose.connection.db
      .collection('cards')
      .countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
    
    statsd.gauge('cards.created', cardsToday);
    
    // Theme usage
    const themeUsage = await mongoose.connection.db
      .collection('users')
      .aggregate([
        { $group: { _id: '$selectedTheme', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();
    
    themeUsage.forEach(theme => {
      statsd.gauge(`themes.usage`, theme.count, [`theme:${theme._id}`]);
    });
    
    console.log('Business metrics collected successfully');
  } catch (error) {
    console.error('Failed to collect business metrics:', error);
    statsd.increment('metrics.collection.errors');
  } finally {
    mongoose.connection.close();
    statsd.close();
  }
}

collectBusinessMetrics();
EOF
    
    chmod +x "$SCRIPT_DIR/collect-business-metrics.js"
    log_success "Custom metrics collection script created"
}

# Generate monitoring summary report
generate_summary() {
    log_info "Generating monitoring setup summary..."
    
    cat > "$SCRIPT_DIR/monitoring-summary.md" << EOF
# MadPlan Monitoring Setup Summary

## Deployed Components

### Datadog Dashboards
- ✅ Application Performance Dashboard
- ✅ Infrastructure Monitoring Dashboard  
- ✅ Business Metrics Dashboard

### Monitoring Alerts
- ✅ Application Down Monitor (Critical)
- ✅ High Error Rate Monitor (Warning)
- ✅ High Response Time Monitor (Warning)
- ✅ Database Connection Issues (Critical)

### CloudWatch Integration
- ✅ Custom CloudWatch Dashboard
- ✅ CloudWatch Alarms (CPU, Response Time)
- ✅ Log Groups with 30-day retention
- ✅ SNS Topic for alerts

### Synthetic Monitoring
- ✅ API Health Check from 3 global locations
- ✅ 5-minute monitoring intervals
- ✅ Response time and content validation

### Custom Metrics
- ✅ Business metrics collection script
- ✅ Daily active users tracking
- ✅ Feature usage analytics
- ✅ Performance metrics collection

## Access Information

### Datadog
- Dashboard URL: https://app.datadoghq.com/dashboard/
- API Documentation: https://docs.datadoghq.com/api/

### CloudWatch
- Console: https://console.aws.amazon.com/cloudwatch/
- Dashboard: MadPlan-Production-Infrastructure

### Logs
- Application Logs: /aws/ec2/madplan-production
- Infrastructure Logs: CloudWatch Log Groups

## Next Steps

1. Configure notification channels (Slack, PagerDuty)
2. Set up on-call rotation
3. Test alert notifications
4. Review and adjust alert thresholds
5. Schedule regular monitoring reviews

## Support

For monitoring issues or questions, contact:
- Platform Team: platform-team@madplan.com
- On-call Engineer: Via PagerDuty

Generated on: $(date)
EOF
    
    log_success "Monitoring summary generated: $SCRIPT_DIR/monitoring-summary.md"
}

# Main execution
main() {
    echo "🔍 MadPlan Production Monitoring Setup"
    echo "======================================"
    
    validate_prerequisites
    setup_datadog
    setup_alerts
    setup_cloudwatch
    setup_logging
    setup_synthetic_monitoring
    setup_custom_metrics
    generate_summary
    
    echo
    echo "======================================"
    log_success "🎉 Monitoring setup completed successfully!"
    echo
    echo "📊 View your dashboards:"
    echo "   - Datadog: https://app.datadoghq.com/dashboard/"
    echo "   - CloudWatch: https://console.aws.amazon.com/cloudwatch/"
    echo
    echo "📋 Review the summary: $SCRIPT_DIR/monitoring-summary.md"
    echo "🔔 Configure your notification channels in Datadog and AWS"
    echo
}

# Execute main function
main "$@"
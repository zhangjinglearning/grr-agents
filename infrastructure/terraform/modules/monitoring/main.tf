# Comprehensive Monitoring Module for MadPlan Infrastructure
# CloudWatch, Datadog, and custom metrics integration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
  }
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/application/${var.name_prefix}"
  retention_in_days = var.log_retention_days
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-app-logs"
    Type = "log-group"
    Component = "application"
  })
}

resource "aws_cloudwatch_log_group" "infrastructure" {
  name              = "/aws/infrastructure/${var.name_prefix}"
  retention_in_days = var.log_retention_days
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-infra-logs"
    Type = "log-group"
    Component = "infrastructure"
  })
}

resource "aws_cloudwatch_log_group" "security" {
  name              = "/aws/security/${var.name_prefix}"
  retention_in_days = var.security_log_retention_days
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-security-logs"
    Type = "log-group"
    Component = "security"
  })
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-overview"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.load_balancer_arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", var.autoscaling_group_name],
            ["AWS/EC2", "StatusCheckFailed", "AutoScalingGroupName", "."],
            ["AWS/EC2", "NetworkIn", "AutoScalingGroupName", "."],
            ["AWS/EC2", "NetworkOut", "AutoScalingGroupName", "."]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "EC2 Instance Metrics"
          period = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          query   = "SOURCE '/aws/application/${var.name_prefix}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100"
          region  = data.aws_region.current.name
          title   = "Recent Application Errors"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          metrics = [
            ["MadPlan/Application", "HealthCheck", "InstanceId", "ALL"],
            [".", "RunningContainers", ".", "."]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Application Health"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          metrics = [
            ["MadPlan/Business", "ActiveUsers"],
            [".", "RequestsPerMinute"],
            [".", "ErrorRate"]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Business Metrics"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.database_instance_id],
            [".", "CPUUtilization", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Database Performance"
          period = 300
        }
      }
    ]
  })
}

# CloudWatch Alarms - Application Performance
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.name_prefix}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High error rate detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]
  treat_missing_data = "notBreaching"

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  alarm_name          = "${var.name_prefix}-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2.0"
  alarm_description   = "High response time detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data = "notBreaching"

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "low_healthy_hosts" {
  alarm_name          = "${var.name_prefix}-low-healthy-hosts"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Low number of healthy hosts"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data = "breaching"

  dimensions = {
    TargetGroup  = var.target_group_arn_suffix
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = var.tags
}

# CloudWatch Alarms - Infrastructure
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.name_prefix}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "High CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data = "notBreaching"

  dimensions = {
    AutoScalingGroupName = var.autoscaling_group_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "${var.name_prefix}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "mem_used_percent"
  namespace           = "MadPlan/Application"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "High memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data = "notBreaching"

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "disk_space" {
  alarm_name          = "${var.name_prefix}-low-disk-space"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "used_percent"
  namespace           = "MadPlan/Application"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "Low disk space"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data = "notBreaching"

  tags = var.tags
}

# CloudWatch Alarms - Business Metrics
resource "aws_cloudwatch_metric_alarm" "application_down" {
  alarm_name          = "${var.name_prefix}-application-down"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheck"
  namespace           = "MadPlan/Application"
  period              = "60"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Application health check failing"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  treat_missing_data = "breaching"

  tags = var.tags
}

# SNS Topics for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alerts"
    Type = "sns-topic"
  })
}

resource "aws_sns_topic" "critical_alerts" {
  name = "${var.name_prefix}-critical-alerts"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-critical-alerts"
    Type = "sns-topic"
  })
}

# SNS Topic Subscriptions
resource "aws_sns_topic_subscription" "email_alerts" {
  count     = length(var.alert_email_recipients)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email_recipients[count.index]
}

resource "aws_sns_topic_subscription" "critical_email_alerts" {
  count     = length(var.critical_alert_email_recipients)
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.critical_alert_email_recipients[count.index]
}

# Slack webhook integration
resource "aws_sns_topic_subscription" "slack_alerts" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# Lambda function for custom alert processing
resource "aws_lambda_function" "alert_processor" {
  filename      = "alert_processor.zip"
  function_name = "${var.name_prefix}-alert-processor"
  role          = aws_iam_role.alert_processor.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  source_code_hash = data.archive_file.alert_processor.output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
      DATADOG_API_KEY   = var.datadog_api_key
      ENVIRONMENT       = var.environment
    }
  }

  tags = var.tags
}

data "archive_file" "alert_processor" {
  type        = "zip"
  output_path = "alert_processor.zip"
  source {
    content = templatefile("${path.module}/lambda/alert_processor.js", {
      slack_webhook_url = var.slack_webhook_url
      datadog_api_key   = var.datadog_api_key
    })
    filename = "index.js"
  }
}

# IAM Role for Alert Processor Lambda
resource "aws_iam_role" "alert_processor" {
  name = "${var.name_prefix}-alert-processor-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "alert_processor" {
  name = "${var.name_prefix}-alert-processor-policy"
  role = aws_iam_role.alert_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.alerts.arn,
          aws_sns_topic.critical_alerts.arn
        ]
      }
    ]
  })
}

# CloudWatch Events Rule for scheduled monitoring checks
resource "aws_cloudwatch_event_rule" "monitoring_check" {
  name                = "${var.name_prefix}-monitoring-check"
  description         = "Trigger monitoring checks"
  schedule_expression = "rate(5 minutes)"

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "monitoring_check" {
  rule      = aws_cloudwatch_event_rule.monitoring_check.name
  target_id = "${var.name_prefix}-monitoring-target"
  arn       = aws_lambda_function.alert_processor.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monitoring_check.arn
}

# Datadog Integration
resource "datadog_dashboard" "main" {
  count       = var.enable_datadog ? 1 : 0
  title       = "MadPlan Production Dashboard"
  description = "Comprehensive monitoring dashboard for MadPlan application"
  layout_type = "ordered"

  widget {
    timeseries_definition {
      title = "Application Performance"
      request {
        q = "avg:aws.applicationelb.request_count{service:madplan-backend}.as_count()"
        display_type = "line"
        style {
          palette = "dog_classic"
        }
      }
      request {
        q = "avg:aws.applicationelb.target_response_time{service:madplan-backend}"
        display_type = "line"
        style {
          palette = "warm"
        }
      }
    }
  }

  widget {
    query_value_definition {
      title = "Error Rate"
      request {
        q = "(sum:aws.applicationelb.httpcode_target_5xx_count{service:madplan-backend}.as_count() / sum:aws.applicationelb.request_count{service:madplan-backend}.as_count()) * 100"
        aggregator = "avg"
      }
      precision = 2
    }
  }

  widget {
    timeseries_definition {
      title = "Infrastructure Metrics"
      request {
        q = "avg:aws.ec2.cpuutilization{service:madplan-backend}"
        display_type = "line"
      }
      request {
        q = "avg:system.mem.pct_usable{service:madplan-backend}"
        display_type = "line"
      }
    }
  }

  widget {
    log_stream_definition {
      title = "Recent Errors"
      query = "service:madplan-backend status:error"
      columns = ["timestamp", "message", "level"]
      show_date_column = true
      show_message_column = true
      message_display = "expanded-md"
      sort {
        column = "timestamp"
        order = "desc"
      }
    }
  }
}

# Datadog Monitor - High Error Rate
resource "datadog_monitor" "high_error_rate" {
  count   = var.enable_datadog ? 1 : 0
  name    = "MadPlan - High Error Rate"
  type    = "metric alert"
  message = "Error rate is above threshold. @${var.slack_channel}"
  
  query = "avg(last_5m):( sum:aws.applicationelb.httpcode_target_5xx_count{service:madplan-backend}.as_count() / sum:aws.applicationelb.request_count{service:madplan-backend}.as_count() ) * 100 > 1"

  thresholds = {
    critical = 1.0
    warning  = 0.5
  }

  notify_no_data = true
  no_data_timeframe = 10

  tags = ["service:madplan-backend", "environment:${var.environment}"]
}

# Datadog Monitor - High Response Time
resource "datadog_monitor" "high_response_time" {
  count   = var.enable_datadog ? 1 : 0
  name    = "MadPlan - High Response Time"
  type    = "metric alert"
  message = "Response time is above threshold. @${var.slack_channel}"
  
  query = "avg(last_10m):avg:aws.applicationelb.target_response_time{service:madplan-backend} > 2"

  thresholds = {
    critical = 2.0
    warning  = 1.5
  }

  notify_no_data = false

  tags = ["service:madplan-backend", "environment:${var.environment}"]
}

# Datadog Synthetic Tests for external monitoring
resource "datadog_synthetics_test" "api_health" {
  count = var.enable_datadog ? 1 : 0
  type  = "api"
  name  = "MadPlan API Health Check"
  
  request_definition {
    method = "GET"
    url    = "${var.application_url}/api/health"
    timeout = 30
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = 200
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = 2000
  }

  locations = ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"]
  
  options_list {
    tick_every = 300
    retry {
      count    = 2
      interval = 300
    }
    monitor_options {
      renotify_interval = 0
    }
  }

  message = "MadPlan API health check failed. @${var.slack_channel}"
  
  tags = ["service:madplan-backend", "environment:${var.environment}", "type:health-check"]
}

# Custom Metrics Collection Script
resource "aws_s3_object" "metrics_collector" {
  bucket = var.monitoring_bucket
  key    = "scripts/metrics-collector.sh"
  
  content = templatefile("${path.module}/scripts/metrics-collector.sh", {
    cloudwatch_namespace = "MadPlan/Business"
    datadog_api_key     = var.datadog_api_key
    application_endpoint = var.application_url
  })
  
  content_type = "text/plain"
  
  tags = var.tags
}

# CloudWatch Insights Queries for Log Analysis
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.name_prefix}-error-analysis"
  
  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, @requestId
| filter @message like /ERROR/
| stats count() by bin(5m)
| sort @timestamp desc
EOF
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.name_prefix}-performance-analysis"
  
  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, @duration
| filter @message like /duration/
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
| sort @timestamp desc
EOF
}
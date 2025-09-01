# Outputs for Monitoring Module

# CloudWatch Resources
output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "log_group_names" {
  description = "CloudWatch Log Group names"
  value = {
    application    = aws_cloudwatch_log_group.application.name
    infrastructure = aws_cloudwatch_log_group.infrastructure.name
    security       = aws_cloudwatch_log_group.security.name
  }
}

output "log_group_arns" {
  description = "CloudWatch Log Group ARNs"
  value = {
    application    = aws_cloudwatch_log_group.application.arn
    infrastructure = aws_cloudwatch_log_group.infrastructure.arn
    security       = aws_cloudwatch_log_group.security.arn
  }
}

# SNS Topics
output "sns_topic_arns" {
  description = "SNS topic ARNs for alerts"
  value = {
    alerts          = aws_sns_topic.alerts.arn
    critical_alerts = aws_sns_topic.critical_alerts.arn
  }
}

output "sns_topic_names" {
  description = "SNS topic names"
  value = {
    alerts          = aws_sns_topic.alerts.name
    critical_alerts = aws_sns_topic.critical_alerts.name
  }
}

# Lambda Functions
output "alert_processor_function_name" {
  description = "Alert processor Lambda function name"
  value       = aws_lambda_function.alert_processor.function_name
}

output "alert_processor_function_arn" {
  description = "Alert processor Lambda function ARN"
  value       = aws_lambda_function.alert_processor.arn
}

# CloudWatch Alarms
output "cloudwatch_alarms" {
  description = "CloudWatch alarm names and ARNs"
  value = {
    high_error_rate = {
      name = aws_cloudwatch_metric_alarm.high_error_rate.alarm_name
      arn  = aws_cloudwatch_metric_alarm.high_error_rate.arn
    }
    high_response_time = {
      name = aws_cloudwatch_metric_alarm.high_response_time.alarm_name
      arn  = aws_cloudwatch_metric_alarm.high_response_time.arn
    }
    low_healthy_hosts = {
      name = aws_cloudwatch_metric_alarm.low_healthy_hosts.alarm_name
      arn  = aws_cloudwatch_metric_alarm.low_healthy_hosts.arn
    }
    high_cpu = {
      name = aws_cloudwatch_metric_alarm.high_cpu.alarm_name
      arn  = aws_cloudwatch_metric_alarm.high_cpu.arn
    }
    high_memory = {
      name = aws_cloudwatch_metric_alarm.high_memory.alarm_name
      arn  = aws_cloudwatch_metric_alarm.high_memory.arn
    }
    disk_space = {
      name = aws_cloudwatch_metric_alarm.disk_space.alarm_name
      arn  = aws_cloudwatch_metric_alarm.disk_space.arn
    }
    application_down = {
      name = aws_cloudwatch_metric_alarm.application_down.alarm_name
      arn  = aws_cloudwatch_metric_alarm.application_down.arn
    }
  }
}

# Datadog Resources (conditional outputs)
output "datadog_dashboard_url" {
  description = "URL to the Datadog dashboard"
  value       = var.enable_datadog ? "https://app.datadoghq.com/dashboard/${datadog_dashboard.main[0].id}" : null
}

output "datadog_monitors" {
  description = "Datadog monitor IDs"
  value = var.enable_datadog ? {
    high_error_rate    = datadog_monitor.high_error_rate[0].id
    high_response_time = datadog_monitor.high_response_time[0].id
  } : null
}

output "datadog_synthetic_test_ids" {
  description = "Datadog synthetic test IDs"
  value = var.enable_datadog ? {
    api_health = datadog_synthetics_test.api_health[0].id
  } : null
}

# CloudWatch Insights
output "log_insights_queries" {
  description = "CloudWatch Logs Insights query definitions"
  value = {
    error_analysis = {
      name = aws_cloudwatch_query_definition.error_analysis.name
      id   = aws_cloudwatch_query_definition.error_analysis.query_definition_id
    }
    performance_analysis = {
      name = aws_cloudwatch_query_definition.performance_analysis.name
      id   = aws_cloudwatch_query_definition.performance_analysis.query_definition_id
    }
  }
}

# Monitoring Configuration
output "monitoring_endpoints" {
  description = "Monitoring and observability endpoints"
  value = {
    cloudwatch_console = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}"
    logs_insights      = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#logsV2:logs-insights"
    x_ray_console      = "https://${data.aws_region.current.name}.console.aws.amazon.com/xray/home?region=${data.aws_region.current.name}"
    datadog_dashboard  = var.enable_datadog ? "https://app.datadoghq.com/dashboard/${datadog_dashboard.main[0].id}" : null
  }
}

# Metrics Namespaces
output "metrics_namespaces" {
  description = "CloudWatch metrics namespaces used"
  value = {
    application    = "MadPlan/Application"
    business       = var.business_metrics_namespace
    infrastructure = "AWS/EC2"
    load_balancer  = "AWS/ApplicationELB"
    database       = "AWS/RDS"
  }
}

# Alert Configuration Summary
output "alert_configuration" {
  description = "Summary of alert configuration"
  value = {
    email_recipients = {
      standard = var.alert_email_recipients
      critical = var.critical_alert_email_recipients
    }
    slack_integration = {
      enabled = var.slack_webhook_url != ""
      channel = var.slack_channel
    }
    thresholds = {
      error_rate    = "${var.error_rate_threshold}%"
      response_time = "${var.response_time_threshold}s"
      cpu_usage     = "${var.cpu_threshold}%"
      memory_usage  = "${var.memory_threshold}%"
      disk_usage    = "${var.disk_threshold}%"
    }
  }
}

# Monitoring Scripts
output "monitoring_scripts" {
  description = "S3 locations of monitoring scripts"
  value = {
    metrics_collector = "s3://${var.monitoring_bucket}/${aws_s3_object.metrics_collector.key}"
  }
}

# Cost Monitoring
output "cost_monitoring" {
  description = "Cost monitoring configuration"
  value = var.enable_cost_monitoring ? {
    enabled       = true
    budget_limit  = var.monthly_budget_limit
    alert_enabled = true
  } : null
}

# Health Check Configuration
output "health_checks" {
  description = "Health check endpoints and configuration"
  value = {
    application_endpoint = "${var.application_url}/api/health"
    synthetic_tests = var.enable_datadog ? {
      locations = var.synthetic_monitoring_locations
      frequency = "5 minutes"
    } : null
  }
}

# Custom Metrics Configuration
output "custom_metrics_config" {
  description = "Custom metrics configuration summary"
  value = var.custom_metrics
}

# Security Monitoring
output "security_monitoring" {
  description = "Security monitoring configuration"
  value = var.enable_security_monitoring ? {
    log_group    = aws_cloudwatch_log_group.security.name
    retention    = var.security_log_retention_days
    alert_threshold = var.security_alert_threshold
  } : null
}

# Performance Monitoring
output "performance_monitoring" {
  description = "Performance monitoring configuration"
  value = {
    detailed_monitoring = var.enable_detailed_monitoring
    x_ray_enabled      = var.enable_x_ray_tracing
    x_ray_sampling     = var.x_ray_sampling_rate
    container_insights = var.enable_container_insights
  }
}

# Notification Channels Summary
output "notification_channels" {
  description = "Configured notification channels"
  value = {
    email = {
      enabled = length(var.alert_email_recipients) > 0
      count   = length(var.alert_email_recipients)
    }
    slack = {
      enabled = var.slack_webhook_url != ""
      channel = var.slack_channel
    }
    sns_topics = {
      standard = aws_sns_topic.alerts.name
      critical = aws_sns_topic.critical_alerts.name
    }
  }
}
# Variables for Monitoring Module

variable "name_prefix" {
  description = "Prefix for all monitoring resources"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

# CloudWatch Configuration
variable "log_retention_days" {
  description = "CloudWatch logs retention in days"
  type        = number
  default     = 30
}

variable "security_log_retention_days" {
  description = "Security logs retention in days"
  type        = number
  default     = 90
}

# Infrastructure References
variable "load_balancer_arn_suffix" {
  description = "Load balancer ARN suffix for CloudWatch metrics"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target group ARN suffix for CloudWatch metrics"
  type        = string
}

variable "autoscaling_group_name" {
  description = "Auto Scaling Group name for monitoring"
  type        = string
}

variable "database_instance_id" {
  description = "Database instance ID for monitoring"
  type        = string
  default     = ""
}

# Application Configuration
variable "application_url" {
  description = "Application URL for health checks and monitoring"
  type        = string
}

variable "monitoring_bucket" {
  description = "S3 bucket for monitoring scripts and data"
  type        = string
}

# Alert Configuration
variable "alert_email_recipients" {
  description = "Email addresses for alert notifications"
  type        = list(string)
  default     = []
}

variable "critical_alert_email_recipients" {
  description = "Email addresses for critical alert notifications"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
}

variable "slack_channel" {
  description = "Slack channel for notifications"
  type        = string
  default     = "#alerts"
}

# Datadog Configuration
variable "enable_datadog" {
  description = "Enable Datadog integration"
  type        = bool
  default     = false
}

variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog application key"
  type        = string
  default     = ""
  sensitive   = true
}

# Monitoring Thresholds
variable "error_rate_threshold" {
  description = "Error rate threshold for alerts (percentage)"
  type        = number
  default     = 1.0
}

variable "response_time_threshold" {
  description = "Response time threshold for alerts (seconds)"
  type        = number
  default     = 2.0
}

variable "cpu_threshold" {
  description = "CPU utilization threshold for alerts (percentage)"
  type        = number
  default     = 80
}

variable "memory_threshold" {
  description = "Memory utilization threshold for alerts (percentage)"
  type        = number
  default     = 85
}

variable "disk_threshold" {
  description = "Disk utilization threshold for alerts (percentage)"
  type        = number
  default     = 90
}

# Business Metrics Configuration
variable "enable_business_metrics" {
  description = "Enable business metrics collection"
  type        = bool
  default     = true
}

variable "business_metrics_namespace" {
  description = "CloudWatch namespace for business metrics"
  type        = string
  default     = "MadPlan/Business"
}

# Performance Monitoring
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "synthetic_monitoring_locations" {
  description = "Locations for Datadog synthetic monitoring"
  type        = list(string)
  default     = ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"]
}

# Log Analysis Configuration
variable "enable_log_insights" {
  description = "Enable CloudWatch Logs Insights queries"
  type        = bool
  default     = true
}

variable "log_analysis_retention" {
  description = "Log analysis data retention in days"
  type        = number
  default     = 7
}

# Security Monitoring
variable "enable_security_monitoring" {
  description = "Enable security-specific monitoring and alerts"
  type        = bool
  default     = true
}

variable "security_alert_threshold" {
  description = "Number of security events that trigger an alert"
  type        = number
  default     = 5
}

# Cost Monitoring
variable "enable_cost_monitoring" {
  description = "Enable cost monitoring and budgets"
  type        = bool
  default     = true
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit for cost alerts (USD)"
  type        = number
  default     = 500
}

# Custom Metrics Configuration
variable "custom_metrics" {
  description = "Custom application metrics configuration"
  type = map(object({
    namespace   = string
    metric_name = string
    unit        = string
    dimensions  = map(string)
  }))
  default = {}
}

# Advanced Monitoring Features
variable "enable_x_ray_tracing" {
  description = "Enable AWS X-Ray distributed tracing"
  type        = bool
  default     = false
}

variable "x_ray_sampling_rate" {
  description = "X-Ray sampling rate (0.0 to 1.0)"
  type        = number
  default     = 0.1
}

variable "enable_container_insights" {
  description = "Enable Container Insights for ECS/EKS"
  type        = bool
  default     = false
}

# Notification Configuration
variable "notification_channels" {
  description = "Notification channels configuration"
  type = object({
    email = object({
      enabled    = bool
      addresses  = list(string)
    })
    slack = object({
      enabled     = bool
      webhook_url = string
      channel     = string
    })
    sns = object({
      enabled = bool
      topics  = list(string)
    })
    pagerduty = object({
      enabled      = bool
      service_key  = string
    })
  })
  default = {
    email = {
      enabled   = false
      addresses = []
    }
    slack = {
      enabled     = false
      webhook_url = ""
      channel     = "#alerts"
    }
    sns = {
      enabled = false
      topics  = []
    }
    pagerduty = {
      enabled     = false
      service_key = ""
    }
  }
}
# Variables for MadPlan Infrastructure as Code
# Terraform variable definitions for all environments

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "madplan"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# AWS Configuration
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"

  validation {
    condition = can(regex("^[a-z0-9-]+$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "default"
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid CIDR block."
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway instead of one per AZ"
  type        = bool
  default     = false
}

# Compute Configuration
variable "instance_type" {
  description = "EC2 instance type for application servers"
  type        = string
  default     = "t3.medium"

  validation {
    condition = can(regex("^[a-z0-9]+\\.[a-z0-9]+$", var.instance_type))
    error_message = "Instance type must be a valid EC2 instance type."
  }
}

variable "key_pair_name" {
  description = "Name of the AWS Key Pair for EC2 instances"
  type        = string
  default     = ""
}

variable "app_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000

  validation {
    condition     = var.app_port > 0 && var.app_port < 65536
    error_message = "Application port must be between 1 and 65535."
  }
}

# Auto-scaling Configuration
variable "min_capacity" {
  description = "Minimum number of instances in ASG"
  type        = number
  default     = 2

  validation {
    condition     = var.min_capacity >= 1
    error_message = "Minimum capacity must be at least 1."
  }
}

variable "max_capacity" {
  description = "Maximum number of instances in ASG"
  type        = number
  default     = 10

  validation {
    condition     = var.max_capacity >= 1
    error_message = "Maximum capacity must be at least 1."
  }
}

variable "desired_capacity" {
  description = "Desired number of instances in ASG"
  type        = number
  default     = 2

  validation {
    condition     = var.desired_capacity >= 1
    error_message = "Desired capacity must be at least 1."
  }
}

# Database Configuration
variable "mongodb_instance_size" {
  description = "MongoDB Atlas cluster instance size"
  type        = string
  default     = "M10"

  validation {
    condition = contains(["M10", "M20", "M30", "M40", "M50", "M60", "M80"], var.mongodb_instance_size)
    error_message = "MongoDB instance size must be a valid Atlas cluster tier."
  }
}

variable "mongodb_disk_size_gb" {
  description = "MongoDB cluster disk size in GB"
  type        = number
  default     = 100

  validation {
    condition     = var.mongodb_disk_size_gb >= 10 && var.mongodb_disk_size_gb <= 4096
    error_message = "MongoDB disk size must be between 10 and 4096 GB."
  }
}

variable "mongodb_backup_enabled" {
  description = "Enable automated backups for MongoDB"
  type        = bool
  default     = true
}

# Domain and SSL Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.domain_name))
    error_message = "Domain name must be a valid domain."
  }
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate in ACM"
  type        = string
  default     = ""
}

variable "create_certificate" {
  description = "Create SSL certificate automatically"
  type        = bool
  default     = true
}

# CDN Configuration
variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for the domain"
  type        = string
}

variable "enable_cdn" {
  description = "Enable CDN for static assets"
  type        = bool
  default     = true
}

variable "cdn_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"

  validation {
    condition = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cdn_price_class)
    error_message = "CDN price class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

# Monitoring Configuration
variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_app_key" {
  description = "Datadog application key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period in days"
  type        = number
  default     = 30

  validation {
    condition = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

# Security Configuration
variable "enable_waf" {
  description = "Enable AWS WAF for web application firewall"
  type        = bool
  default     = true
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Allow all by default, restrict in production

  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be valid."
  }
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = false
}

# Alerting Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Alert email must be a valid email address."
  }
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  sensitive   = true
  default     = ""
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Backup retention days must be between 1 and 35."
  }
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for database"
  type        = bool
  default     = false
}

# Cost Control
variable "budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 200

  validation {
    condition     = var.budget_limit > 0
    error_message = "Budget limit must be greater than 0."
  }
}

variable "enable_cost_alerts" {
  description = "Enable cost monitoring alerts"
  type        = bool
  default     = true
}

# Performance Configuration
variable "enable_performance_insights" {
  description = "Enable performance insights for database"
  type        = bool
  default     = true
}

variable "performance_insights_retention" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7

  validation {
    condition = contains([7, 31, 62, 93, 124, 155, 186, 217, 248, 279, 310, 341, 372, 403, 434, 465, 496, 527, 558, 589, 620, 651, 682, 713, 731], var.performance_insights_retention)
    error_message = "Performance Insights retention must be a valid value."
  }
}

# Feature Flags
variable "enable_logging" {
  description = "Enable comprehensive logging"
  type        = bool
  default     = true
}

variable "enable_metrics" {
  description = "Enable custom metrics collection"
  type        = bool
  default     = true
}

variable "enable_tracing" {
  description = "Enable distributed tracing"
  type        = bool
  default     = true
}

# Environment-specific Overrides
variable "environment_config" {
  description = "Environment-specific configuration overrides"
  type = object({
    instance_type         = optional(string)
    min_capacity         = optional(number)
    max_capacity         = optional(number)
    desired_capacity     = optional(number)
    mongodb_instance_size = optional(string)
    enable_deletion_protection = optional(bool)
    log_retention_days   = optional(number)
    backup_retention_days = optional(number)
  })
  default = {}
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Local values for derived variables
locals {
  # Environment-specific configurations
  env_config = {
    development = {
      instance_type              = "t3.micro"
      min_capacity              = 1
      max_capacity              = 2
      desired_capacity          = 1
      mongodb_instance_size     = "M10"
      enable_deletion_protection = false
      log_retention_days        = 7
      backup_retention_days     = 3
      enable_detailed_monitoring = false
    }
    staging = {
      instance_type              = "t3.small"
      min_capacity              = 1
      max_capacity              = 4
      desired_capacity          = 2
      mongodb_instance_size     = "M10"
      enable_deletion_protection = false
      log_retention_days        = 14
      backup_retention_days     = 7
      enable_detailed_monitoring = true
    }
    production = {
      instance_type              = "t3.medium"
      min_capacity              = 2
      max_capacity              = 10
      desired_capacity          = 3
      mongodb_instance_size     = "M30"
      enable_deletion_protection = true
      log_retention_days        = 30
      backup_retention_days     = 30
      enable_detailed_monitoring = true
    }
  }

  # Merge environment config with overrides
  final_config = merge(
    local.env_config[var.environment],
    var.environment_config
  )

  # Common tags for all resources
  common_tags = merge(
    {
      Project      = var.project_name
      Environment  = var.environment
      ManagedBy    = "Terraform"
      Owner        = "DevOps"
      CostCenter   = "Engineering"
      Backup       = "required"
      Monitoring   = "enabled"
      CreatedDate  = formatdate("YYYY-MM-DD", timestamp())
    },
    var.additional_tags
  )
}
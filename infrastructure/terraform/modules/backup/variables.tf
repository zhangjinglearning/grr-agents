# Backup Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "madplan"
}

variable "environment" {
  description = "Environment (production, staging, development)"
  type        = string
  default     = "production"
}

# Backup Scheduling
variable "backup_schedule_daily" {
  description = "Cron expression for daily backups"
  type        = string
  default     = "cron(0 2 * * ? *)"  # 2 AM UTC daily
}

variable "backup_schedule_weekly" {
  description = "Cron expression for weekly backups"
  type        = string
  default     = "cron(0 3 ? * SUN *)"  # 3 AM UTC on Sundays
}

variable "backup_schedule_monthly" {
  description = "Cron expression for monthly backups"
  type        = string
  default     = "cron(0 4 1 * ? *)"  # 4 AM UTC on 1st of each month
}

# Retention Policies
variable "daily_retention_days" {
  description = "Number of days to retain daily backups"
  type        = number
  default     = 30
}

variable "weekly_retention_days" {
  description = "Number of days to retain weekly backups"
  type        = number
  default     = 90
}

variable "monthly_retention_days" {
  description = "Number of days to retain monthly backups"
  type        = number
  default     = 365
}

variable "version_retention_days" {
  description = "Number of days to retain non-current versions"
  type        = number
  default     = 30
}

# Resource ARNs for backup
variable "ec2_instance_arns" {
  description = "List of EC2 instance ARNs to backup"
  type        = list(string)
  default     = []
}

variable "ebs_volume_arns" {
  description = "List of EBS volume ARNs to backup"
  type        = list(string)
  default     = []
}

variable "rds_instance_arns" {
  description = "List of RDS instance ARNs to backup"
  type        = list(string)
  default     = []
}

# Cross-region backup configuration
variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = true
}

variable "dr_region" {
  description = "Disaster recovery region"
  type        = string
  default     = "us-west-2"
}

# Notification settings
variable "notification_emails" {
  description = "List of email addresses for backup notifications"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for backup notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# Backup validation settings
variable "enable_backup_validation" {
  description = "Enable automated backup validation"
  type        = bool
  default     = true
}

variable "validation_schedule" {
  description = "Cron expression for backup validation"
  type        = string
  default     = "cron(0 6 * * ? *)"  # 6 AM UTC daily
}

# Encryption settings
variable "enable_backup_encryption" {
  description = "Enable backup encryption"
  type        = bool
  default     = true
}

variable "kms_key_deletion_window" {
  description = "KMS key deletion window in days"
  type        = number
  default     = 7
}

# Point-in-time recovery settings
variable "enable_pitr" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "pitr_retention_days" {
  description = "Point-in-time recovery retention period in days"
  type        = number
  default     = 7
}

# Application-specific backup settings
variable "database_backup_settings" {
  description = "Database-specific backup configuration"
  type = object({
    enabled                = bool
    backup_window         = string
    maintenance_window    = string
    retention_period      = number
    copy_tags_to_snapshot = bool
    delete_automated_backups = bool
  })
  default = {
    enabled                = true
    backup_window         = "03:00-05:00"
    maintenance_window    = "sun:05:00-sun:06:00"
    retention_period      = 30
    copy_tags_to_snapshot = true
    delete_automated_backups = false
  }
}

variable "application_data_paths" {
  description = "Application data paths to backup"
  type        = list(string)
  default = [
    "/var/lib/docker/volumes",
    "/opt/madplan/data",
    "/var/log/madplan"
  ]
}

# Disaster recovery settings
variable "rto_minutes" {
  description = "Recovery Time Objective in minutes"
  type        = number
  default     = 60
}

variable "rpo_minutes" {
  description = "Recovery Point Objective in minutes"
  type        = number
  default     = 15
}

# Cost optimization
variable "enable_intelligent_tiering" {
  description = "Enable S3 Intelligent Tiering for backups"
  type        = bool
  default     = true
}

variable "backup_storage_class" {
  description = "Default storage class for backups"
  type        = string
  default     = "STANDARD"
  
  validation {
    condition = contains([
      "STANDARD",
      "STANDARD_IA",
      "ONEZONE_IA",
      "REDUCED_REDUNDANCY",
      "GLACIER",
      "DEEP_ARCHIVE"
    ], var.backup_storage_class)
    error_message = "Storage class must be a valid S3 storage class."
  }
}

# Monitoring and alerting
variable "enable_backup_monitoring" {
  description = "Enable comprehensive backup monitoring"
  type        = bool
  default     = true
}

variable "alert_on_backup_failure" {
  description = "Send alerts on backup failures"
  type        = bool
  default     = true
}

variable "alert_on_backup_success" {
  description = "Send alerts on backup success"
  type        = bool
  default     = false
}

# Compliance and governance
variable "backup_compliance_mode" {
  description = "Backup compliance mode (governance or compliance)"
  type        = string
  default     = "governance"
  
  validation {
    condition     = contains(["governance", "compliance"], var.backup_compliance_mode)
    error_message = "Compliance mode must be either 'governance' or 'compliance'."
  }
}

variable "legal_hold_enabled" {
  description = "Enable legal hold on backups"
  type        = bool
  default     = false
}

# Testing and validation
variable "enable_restore_testing" {
  description = "Enable automated restore testing"
  type        = bool
  default     = false
}

variable "restore_test_schedule" {
  description = "Schedule for automated restore testing"
  type        = string
  default     = "cron(0 8 ? * MON *)"  # 8 AM UTC on Mondays
}

# Tagging
variable "additional_tags" {
  description = "Additional tags to apply to backup resources"
  type        = map(string)
  default     = {}
}
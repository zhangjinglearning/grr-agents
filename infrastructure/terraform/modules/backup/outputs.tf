# Backup Module Outputs

# S3 Bucket Information
output "backup_bucket_primary" {
  description = "Primary backup S3 bucket information"
  value = {
    id   = aws_s3_bucket.backup_primary.id
    arn  = aws_s3_bucket.backup_primary.arn
    domain_name = aws_s3_bucket.backup_primary.bucket_domain_name
  }
}

output "backup_bucket_dr" {
  description = "Disaster recovery backup S3 bucket information"
  value = {
    id   = aws_s3_bucket.backup_dr.id
    arn  = aws_s3_bucket.backup_dr.arn
    domain_name = aws_s3_bucket.backup_dr.bucket_domain_name
  }
}

# KMS Key Information
output "backup_kms_key" {
  description = "KMS key for backup encryption"
  value = {
    id     = aws_kms_key.backup.key_id
    arn    = aws_kms_key.backup.arn
    alias  = aws_kms_alias.backup.name
  }
}

output "backup_kms_key_dr" {
  description = "KMS key for DR backup encryption"
  value = {
    id     = aws_kms_key.backup_dr.key_id
    arn    = aws_kms_key.backup_dr.arn
    alias  = aws_kms_alias.backup_dr.name
  }
}

# AWS Backup Vault Information
output "backup_vault_primary" {
  description = "Primary AWS Backup vault information"
  value = {
    name = aws_backup_vault.main.name
    arn  = aws_backup_vault.main.arn
    kms_key_id = aws_backup_vault.main.kms_key_id
  }
}

output "backup_vault_dr" {
  description = "DR AWS Backup vault information"
  value = {
    name = aws_backup_vault.dr.name
    arn  = aws_backup_vault.dr.arn
    kms_key_id = aws_backup_vault.dr.kms_key_id
  }
}

# Backup Plan Information
output "backup_plan" {
  description = "AWS Backup plan information"
  value = {
    id   = aws_backup_plan.main.id
    arn  = aws_backup_plan.main.arn
    name = aws_backup_plan.main.name
    rules = [
      {
        name = "daily_backups"
        schedule = var.backup_schedule_daily
        retention_days = var.daily_retention_days
      },
      {
        name = "weekly_backups"
        schedule = var.backup_schedule_weekly
        retention_days = var.weekly_retention_days
      },
      {
        name = "monthly_backups"
        schedule = var.backup_schedule_monthly
        retention_days = var.monthly_retention_days
      }
    ]
  }
}

# IAM Role Information
output "backup_role_arn" {
  description = "IAM role ARN for AWS Backup service"
  value = aws_iam_role.backup.arn
}

output "replication_role_arn" {
  description = "IAM role ARN for S3 replication"
  value = aws_iam_role.replication.arn
}

# SNS Topic Information
output "backup_notifications_topic" {
  description = "SNS topic for backup notifications"
  value = {
    arn  = aws_sns_topic.backup_notifications.arn
    name = aws_sns_topic.backup_notifications.name
  }
}

# CloudWatch Alarms
output "backup_alarms" {
  description = "CloudWatch alarms for backup monitoring"
  value = {
    backup_job_failed = {
      name = aws_cloudwatch_metric_alarm.backup_job_failed.alarm_name
      arn  = aws_cloudwatch_metric_alarm.backup_job_failed.arn
    }
    backup_job_expired = {
      name = aws_cloudwatch_metric_alarm.backup_job_expired.alarm_name
      arn  = aws_cloudwatch_metric_alarm.backup_job_expired.arn
    }
  }
}

# Lambda Function Information
output "backup_validator_function" {
  description = "Backup validator Lambda function information"
  value = {
    name = aws_lambda_function.backup_validator.function_name
    arn  = aws_lambda_function.backup_validator.arn
  }
}

# Backup Selection Information
output "backup_selections" {
  description = "AWS Backup selections"
  value = {
    ec2 = {
      name = aws_backup_selection.ec2.name
      plan_id = aws_backup_selection.ec2.plan_id
    }
    ebs = length(var.ebs_volume_arns) > 0 ? {
      name = aws_backup_selection.ebs[0].name
      plan_id = aws_backup_selection.ebs[0].plan_id
    } : null
  }
}

# Disaster Recovery Information
output "disaster_recovery_config" {
  description = "Disaster recovery configuration"
  value = {
    enabled = var.enable_cross_region_backup
    dr_region = var.dr_region
    rto_minutes = var.rto_minutes
    rpo_minutes = var.rpo_minutes
    replication_enabled = var.enable_cross_region_backup
  }
}

# Backup Validation Information
output "backup_validation_config" {
  description = "Backup validation configuration"
  value = {
    enabled = var.enable_backup_validation
    schedule = var.validation_schedule
    function_name = aws_lambda_function.backup_validator.function_name
  }
}

# Lifecycle and Retention Information
output "backup_lifecycle_config" {
  description = "Backup lifecycle and retention configuration"
  value = {
    daily_retention_days = var.daily_retention_days
    weekly_retention_days = var.weekly_retention_days
    monthly_retention_days = var.monthly_retention_days
    version_retention_days = var.version_retention_days
    storage_transitions = {
      standard_ia_days = 30
      glacier_days = 90
      deep_archive_days = 365
    }
  }
}

# Cost Optimization Information
output "cost_optimization_config" {
  description = "Backup cost optimization settings"
  value = {
    intelligent_tiering_enabled = var.enable_intelligent_tiering
    default_storage_class = var.backup_storage_class
    lifecycle_rules_enabled = true
    compression_enabled = true
  }
}

# Security Configuration
output "backup_security_config" {
  description = "Backup security configuration"
  value = {
    encryption_enabled = var.enable_backup_encryption
    kms_encryption = true
    cross_region_encryption = true
    compliance_mode = var.backup_compliance_mode
    legal_hold_enabled = var.legal_hold_enabled
  }
}

# Monitoring Configuration
output "backup_monitoring_config" {
  description = "Backup monitoring configuration"
  value = {
    monitoring_enabled = var.enable_backup_monitoring
    cloudwatch_alarms = {
      failed_jobs = aws_cloudwatch_metric_alarm.backup_job_failed.alarm_name
      expired_jobs = aws_cloudwatch_metric_alarm.backup_job_expired.alarm_name
    }
    notification_topic = aws_sns_topic.backup_notifications.arn
    validation_function = aws_lambda_function.backup_validator.function_name
  }
}

# Backup Commands and Procedures
output "backup_procedures" {
  description = "Backup and recovery procedures"
  value = {
    manual_backup_command = "aws backup start-backup-job --backup-vault-name ${aws_backup_vault.main.name} --resource-arn <RESOURCE_ARN> --iam-role-arn ${aws_iam_role.backup.arn}"
    restore_command = "aws backup start-restore-job --recovery-point-arn <RECOVERY_POINT_ARN> --resource-type <RESOURCE_TYPE> --iam-role-arn ${aws_iam_role.backup.arn}"
    list_backups_command = "aws backup list-recovery-points --backup-vault-name ${aws_backup_vault.main.name}"
    validation_command = "aws lambda invoke --function-name ${aws_lambda_function.backup_validator.function_name} response.json"
  }
}

# Health Check Information
output "backup_health_check" {
  description = "Backup system health check information"
  value = {
    primary_vault_status = "active"
    dr_vault_status = "active"
    replication_status = var.enable_cross_region_backup ? "enabled" : "disabled"
    last_validation_schedule = var.validation_schedule
    backup_schedules = {
      daily = var.backup_schedule_daily
      weekly = var.backup_schedule_weekly
      monthly = var.backup_schedule_monthly
    }
  }
}

# Application Integration Information
output "application_integration" {
  description = "Information for application integration"
  value = {
    s3_backup_bucket = aws_s3_bucket.backup_primary.id
    kms_key_id = aws_kms_key.backup.key_id
    sns_topic_arn = aws_sns_topic.backup_notifications.arn
    backup_role_arn = aws_iam_role.backup.arn
    environment_variables = {
      BACKUP_BUCKET_NAME = aws_s3_bucket.backup_primary.id
      BACKUP_KMS_KEY_ID = aws_kms_key.backup.key_id
      BACKUP_VAULT_NAME = aws_backup_vault.main.name
      DR_REGION = var.dr_region
    }
  }
}
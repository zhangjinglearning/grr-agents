# Backup and Disaster Recovery Infrastructure
# Implements comprehensive backup strategies and disaster recovery capabilities

locals {
  backup_tags = {
    Environment = var.environment
    Project     = "madplan"
    Component   = "backup"
    ManagedBy   = "terraform"
  }
}

# S3 bucket for application backups
resource "aws_s3_bucket" "backup_primary" {
  bucket = "${var.name_prefix}-backup-${var.environment}"
  
  tags = merge(local.backup_tags, {
    Name = "${var.name_prefix}-backup-primary"
    Type = "primary-backup"
  })
}

# Cross-region backup bucket for disaster recovery
resource "aws_s3_bucket" "backup_dr" {
  provider = aws.dr_region
  bucket   = "${var.name_prefix}-backup-dr-${var.environment}"
  
  tags = merge(local.backup_tags, {
    Name = "${var.name_prefix}-backup-dr"
    Type = "disaster-recovery-backup"
  })
}

# Versioning for backup buckets
resource "aws_s3_bucket_versioning" "backup_primary" {
  bucket = aws_s3_bucket.backup_primary.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "backup_dr" {
  provider = aws.dr_region
  bucket   = aws_s3_bucket.backup_dr.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption for backup buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_primary" {
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backup.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_dr" {
  provider = aws.dr_region
  bucket   = aws_s3_bucket.backup_dr.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backup_dr.arn
    }
    bucket_key_enabled = true
  }
}

# KMS keys for backup encryption
resource "aws_kms_key" "backup" {
  description             = "KMS key for ${var.name_prefix} backup encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow backup service access"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = local.backup_tags
}

resource "aws_kms_key" "backup_dr" {
  provider                = aws.dr_region
  description             = "KMS key for ${var.name_prefix} DR backup encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })
  
  tags = local.backup_tags
}

# KMS key aliases
resource "aws_kms_alias" "backup" {
  name          = "alias/${var.name_prefix}-backup"
  target_key_id = aws_kms_key.backup.key_id
}

resource "aws_kms_alias" "backup_dr" {
  provider      = aws.dr_region
  name          = "alias/${var.name_prefix}-backup-dr"
  target_key_id = aws_kms_key.backup_dr.key_id
}

# Cross-region replication
resource "aws_s3_bucket_replication_configuration" "backup_replication" {
  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    id     = "backup-replication"
    status = "Enabled"
    
    destination {
      bucket        = aws_s3_bucket.backup_dr.arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = aws_kms_key.backup_dr.arn
      }
    }
  }
  
  depends_on = [aws_s3_bucket_versioning.backup_primary]
}

# IAM role for S3 replication
resource "aws_iam_role" "replication" {
  name = "${var.name_prefix}-backup-replication"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.backup_tags
}

resource "aws_iam_role_policy" "replication" {
  name = "${var.name_prefix}-backup-replication"
  role = aws_iam_role.replication.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup_primary.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.backup_primary.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.backup_dr.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.backup.arn,
          aws_kms_key.backup_dr.arn
        ]
      }
    ]
  })
}

# Lifecycle policies for backup retention
resource "aws_s3_bucket_lifecycle_configuration" "backup_primary" {
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    id     = "backup_lifecycle"
    status = "Enabled"
    
    # Daily backups retention
    expiration {
      days = var.daily_retention_days
    }
    
    # Non-current version expiration
    noncurrent_version_expiration {
      noncurrent_days = var.version_retention_days
    }
    
    # Incomplete multipart upload cleanup
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
    
    # Transition to IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    # Transition to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    # Transition to Deep Archive after 365 days
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
  }
  
  rule {
    id     = "weekly_backup_lifecycle"
    status = "Enabled"
    
    filter {
      prefix = "weekly/"
    }
    
    expiration {
      days = var.weekly_retention_days
    }
  }
  
  rule {
    id     = "monthly_backup_lifecycle"
    status = "Enabled"
    
    filter {
      prefix = "monthly/"
    }
    
    expiration {
      days = var.monthly_retention_days
    }
  }
}

# AWS Backup vault
resource "aws_backup_vault" "main" {
  name        = "${var.name_prefix}-backup-vault"
  kms_key_id  = aws_kms_key.backup.arn
  
  tags = local.backup_tags
}

# AWS Backup vault for DR region
resource "aws_backup_vault" "dr" {
  provider   = aws.dr_region
  name       = "${var.name_prefix}-backup-vault-dr"
  kms_key_id = aws_kms_key.backup_dr.arn
  
  tags = local.backup_tags
}

# Backup plan for EBS volumes and RDS
resource "aws_backup_plan" "main" {
  name = "${var.name_prefix}-backup-plan"
  
  # Daily backups
  rule {
    rule_name         = "daily_backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = var.backup_schedule_daily
    start_window      = 60
    completion_window = 300
    
    lifecycle {
      cold_storage_after = 30
      delete_after      = var.daily_retention_days
    }
    
    recovery_point_tags = local.backup_tags
    
    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      lifecycle {
        cold_storage_after = 30
        delete_after      = var.daily_retention_days
      }
    }
  }
  
  # Weekly backups
  rule {
    rule_name         = "weekly_backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = var.backup_schedule_weekly
    start_window      = 60
    completion_window = 300
    
    lifecycle {
      cold_storage_after = 7
      delete_after      = var.weekly_retention_days
    }
    
    recovery_point_tags = merge(local.backup_tags, {
      BackupType = "weekly"
    })
    
    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      lifecycle {
        cold_storage_after = 7
        delete_after      = var.weekly_retention_days
      }
    }
  }
  
  # Monthly backups
  rule {
    rule_name         = "monthly_backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = var.backup_schedule_monthly
    start_window      = 60
    completion_window = 300
    
    lifecycle {
      cold_storage_after = 1
      delete_after      = var.monthly_retention_days
    }
    
    recovery_point_tags = merge(local.backup_tags, {
      BackupType = "monthly"
    })
    
    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      lifecycle {
        cold_storage_after = 1
        delete_after      = var.monthly_retention_days
      }
    }
  }
  
  tags = local.backup_tags
}

# IAM role for AWS Backup
resource "aws_iam_role" "backup" {
  name = "${var.name_prefix}-backup-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.backup_tags
}

# Attach AWS managed backup policies
resource "aws_iam_role_policy_attachment" "backup_service" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

# Backup selection for EC2 instances
resource "aws_backup_selection" "ec2" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "${var.name_prefix}-ec2-backup"
  plan_id      = aws_backup_plan.main.id
  
  resources = var.ec2_instance_arns
  
  condition {
    string_equals {
      key   = "aws:ResourceTag/Environment"
      value = var.environment
    }
  }
  
  condition {
    string_equals {
      key   = "aws:ResourceTag/BackupEnabled"
      value = "true"
    }
  }
}

# Backup selection for EBS volumes
resource "aws_backup_selection" "ebs" {
  count = length(var.ebs_volume_arns) > 0 ? 1 : 0
  
  iam_role_arn = aws_iam_role.backup.arn
  name         = "${var.name_prefix}-ebs-backup"
  plan_id      = aws_backup_plan.main.id
  
  resources = var.ebs_volume_arns
}

# SNS topic for backup notifications
resource "aws_sns_topic" "backup_notifications" {
  name = "${var.name_prefix}-backup-notifications"
  
  tags = local.backup_tags
}

# SNS topic policy
resource "aws_sns_topic_policy" "backup_notifications" {
  arn = aws_sns_topic.backup_notifications.arn
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = "sns:Publish"
        Resource = aws_sns_topic.backup_notifications.arn
      }
    ]
  })
}

# CloudWatch alarms for backup monitoring
resource "aws_cloudwatch_metric_alarm" "backup_job_failed" {
  alarm_name          = "${var.name_prefix}-backup-job-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "NumberOfBackupJobsFailed"
  namespace           = "AWS/Backup"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Backup job failed"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  
  dimensions = {
    BackupVaultName = aws_backup_vault.main.name
  }
  
  tags = local.backup_tags
}

resource "aws_cloudwatch_metric_alarm" "backup_job_expired" {
  alarm_name          = "${var.name_prefix}-backup-job-expired"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "NumberOfBackupJobsExpired"
  namespace           = "AWS/Backup"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Backup job expired"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  
  dimensions = {
    BackupVaultName = aws_backup_vault.main.name
  }
  
  tags = local.backup_tags
}

# Lambda function for backup validation
resource "aws_lambda_function" "backup_validator" {
  filename         = "backup-validator.zip"
  function_name    = "${var.name_prefix}-backup-validator"
  role            = aws_iam_role.backup_validator.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 300
  
  source_code_hash = data.archive_file.backup_validator.output_base64sha256
  
  environment {
    variables = {
      BACKUP_VAULT_NAME = aws_backup_vault.main.name
      SNS_TOPIC_ARN     = aws_sns_topic.backup_notifications.arn
      ENVIRONMENT       = var.environment
    }
  }
  
  tags = local.backup_tags
}

# Create the backup validator Lambda code
data "archive_file" "backup_validator" {
  type        = "zip"
  output_path = "backup-validator.zip"
  
  source {
    content = <<EOF
import json
import boto3
import os
from datetime import datetime, timedelta

def handler(event, context):
    backup_client = boto3.client('backup')
    sns_client = boto3.client('sns')
    
    vault_name = os.environ['BACKUP_VAULT_NAME']
    sns_topic = os.environ['SNS_TOPIC_ARN']
    
    try:
        # Check for recent successful backups
        response = backup_client.list_recovery_points(
            BackupVaultName=vault_name,
            MaxResults=10
        )
        
        recent_backups = []
        cutoff_time = datetime.now() - timedelta(days=2)
        
        for recovery_point in response.get('RecoveryPoints', []):
            created_date = recovery_point['CreationDate'].replace(tzinfo=None)
            if created_date > cutoff_time and recovery_point['Status'] == 'COMPLETED':
                recent_backups.append(recovery_point)
        
        if len(recent_backups) == 0:
            # Send alert for missing recent backups
            message = f"No successful backups found in the last 48 hours for vault {vault_name}"
            sns_client.publish(
                TopicArn=sns_topic,
                Subject=f"Backup Validation Alert - {os.environ['ENVIRONMENT']}",
                Message=message
            )
            
        return {
            'statusCode': 200,
            'body': json.dumps({
                'vault': vault_name,
                'recent_backups': len(recent_backups),
                'status': 'healthy' if len(recent_backups) > 0 else 'unhealthy'
            })
        }
        
    except Exception as e:
        error_message = f"Backup validation failed: {str(e)}"
        sns_client.publish(
            TopicArn=sns_topic,
            Subject=f"Backup Validation Error - {os.environ['ENVIRONMENT']}",
            Message=error_message
        )
        
        return {
            'statusCode': 500,
            'body': json.dumps({'error': error_message})
        }
EOF
    filename = "index.py"
  }
}

# IAM role for backup validator Lambda
resource "aws_iam_role" "backup_validator" {
  name = "${var.name_prefix}-backup-validator-role"
  
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
  
  tags = local.backup_tags
}

resource "aws_iam_role_policy" "backup_validator" {
  name = "${var.name_prefix}-backup-validator-policy"
  role = aws_iam_role.backup_validator.id
  
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
          "backup:ListRecoveryPoints",
          "backup:DescribeBackupVault"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_notifications.arn
      }
    ]
  })
}

# EventBridge rule to trigger backup validation
resource "aws_cloudwatch_event_rule" "backup_validation" {
  name        = "${var.name_prefix}-backup-validation"
  description = "Trigger backup validation daily"
  
  schedule_expression = "cron(0 6 * * ? *)"  # 6 AM UTC daily
  
  tags = local.backup_tags
}

resource "aws_cloudwatch_event_target" "backup_validation" {
  rule      = aws_cloudwatch_event_rule.backup_validation.name
  target_id = "BackupValidationTarget"
  arn       = aws_lambda_function.backup_validator.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup_validator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.backup_validation.arn
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
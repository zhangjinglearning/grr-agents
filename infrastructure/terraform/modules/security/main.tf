# Security Hardening and Compliance Infrastructure
# Implements end-to-end encryption, authentication, and comprehensive security controls

locals {
  security_tags = {
    Environment = var.environment
    Project     = "madplan"
    Component   = "security"
    ManagedBy   = "terraform"
    Compliance  = "GDPR,SOC2,ISO27001"
  }
}

# KMS keys for different encryption contexts
resource "aws_kms_key" "application_data" {
  description             = "KMS key for ${var.name_prefix} application data encryption"
  deletion_window_in_days = var.kms_deletion_window_days
  enable_key_rotation    = true
  multi_region           = var.enable_multi_region_keys
  
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
        Sid    = "Allow application services"
        Effect = "Allow"
        Principal = {
          AWS = var.application_role_arns
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "s3.${var.aws_region}.amazonaws.com",
              "rds.${var.aws_region}.amazonaws.com",
              "secretsmanager.${var.aws_region}.amazonaws.com"
            ]
          }
        }
      }
    ]
  })
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-application-data-key"
    KeyType = "application-data"
  })
}

resource "aws_kms_key" "user_data" {
  description             = "KMS key for ${var.name_prefix} user data encryption"
  deletion_window_in_days = var.kms_deletion_window_days
  enable_key_rotation    = true
  multi_region           = var.enable_multi_region_keys
  
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
        Sid    = "Allow user data encryption services"
        Effect = "Allow"
        Principal = {
          AWS = var.application_role_arns
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:EncryptionContext:DataType" = "user-data"
          }
        }
      }
    ]
  })
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-user-data-key"
    KeyType = "user-data"
  })
}

resource "aws_kms_key" "audit_logs" {
  description             = "KMS key for ${var.name_prefix} audit logs encryption"
  deletion_window_in_days = var.kms_deletion_window_days
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
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudTrail"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-audit-logs-key"
    KeyType = "audit-logs"
  })
}

# KMS key aliases
resource "aws_kms_alias" "application_data" {
  name          = "alias/${var.name_prefix}-application-data"
  target_key_id = aws_kms_key.application_data.key_id
}

resource "aws_kms_alias" "user_data" {
  name          = "alias/${var.name_prefix}-user-data"
  target_key_id = aws_kms_key.user_data.key_id
}

resource "aws_kms_alias" "audit_logs" {
  name          = "alias/${var.name_prefix}-audit-logs"
  target_key_id = aws_kms_key.audit_logs.key_id
}

# AWS Secrets Manager for secure credential storage
resource "aws_secretsmanager_secret" "database_credentials" {
  name                    = "${var.name_prefix}/${var.environment}/database"
  description             = "Database credentials for ${var.name_prefix}"
  kms_key_id              = aws_kms_key.application_data.arn
  recovery_window_in_days = var.secret_recovery_window_days
  
  replica {
    region = var.dr_region
    kms_key_id = var.enable_multi_region_keys ? aws_kms_key.application_data.arn : null
  }
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-database-credentials"
  })
}

resource "aws_secretsmanager_secret" "jwt_secrets" {
  name                    = "${var.name_prefix}/${var.environment}/jwt"
  description             = "JWT signing keys for ${var.name_prefix}"
  kms_key_id              = aws_kms_key.application_data.arn
  recovery_window_in_days = var.secret_recovery_window_days
  
  replica {
    region = var.dr_region
    kms_key_id = var.enable_multi_region_keys ? aws_kms_key.application_data.arn : null
  }
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-jwt-secrets"
  })
}

resource "aws_secretsmanager_secret" "api_keys" {
  name                    = "${var.name_prefix}/${var.environment}/api-keys"
  description             = "Third-party API keys for ${var.name_prefix}"
  kms_key_id              = aws_kms_key.application_data.arn
  recovery_window_in_days = var.secret_recovery_window_days
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-api-keys"
  })
}

# Secret versions with initial values
resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    host     = var.database_host
    port     = var.database_port
    database = var.database_name
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secrets" {
  secret_id = aws_secretsmanager_secret.jwt_secrets.id
  secret_string = jsonencode({
    access_token_secret  = var.jwt_access_secret
    refresh_token_secret = var.jwt_refresh_secret
    algorithm           = "RS256"
    access_expiry       = "15m"
    refresh_expiry      = "7d"
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# AWS WAF for DDoS protection and rate limiting
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.name_prefix}-web-acl"
  description = "WAF rules for ${var.name_prefix} application"
  scope       = "CLOUDFRONT"
  
  default_action {
    allow {}
  }
  
  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "RateLimitRule"
      sampled_requests_enabled    = true
    }
  }
  
  # Geo blocking rule
  rule {
    name     = "GeoBlockingRule"
    priority = 2
    
    action {
      block {}
    }
    
    statement {
      geo_match_statement {
        country_codes = var.blocked_countries
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "GeoBlockingRule"
      sampled_requests_enabled    = true
    }
  }
  
  # IP reputation rule
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 3
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "AWSManagedRulesAmazonIpReputationList"
      sampled_requests_enabled    = true
    }
  }
  
  # Core rule set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 4
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        
        # Exclude rules that might interfere with normal operation
        excluded_rule {
          name = "SizeRestrictions_BODY"
        }
        excluded_rule {
          name = "GenericRFI_BODY"
        }
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled    = true
    }
  }
  
  # SQL injection rule
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 5
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled    = true
    }
  }
  
  tags = local.security_tags
}

# CloudTrail for comprehensive audit logging
resource "aws_s3_bucket" "cloudtrail_logs" {
  bucket = "${var.name_prefix}-cloudtrail-${var.environment}"
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-cloudtrail-logs"
  })
}

resource "aws_s3_bucket_versioning" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.audit_logs.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id
  
  rule {
    id     = "cloudtrail_lifecycle"
    status = "Enabled"
    
    expiration {
      days = var.audit_log_retention_days
    }
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

resource "aws_s3_bucket_policy" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail_logs.arn
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail_logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

resource "aws_cloudtrail" "main" {
  name           = "${var.name_prefix}-cloudtrail"
  s3_bucket_name = aws_s3_bucket.cloudtrail_logs.id
  s3_key_prefix  = "cloudtrail-logs"
  
  event_selector {
    read_write_type                 = "All"
    include_management_events       = true
    exclude_management_event_sources = []
    
    data_resource {
      type   = "AWS::S3::Object"
      values = ["arn:aws:s3:::*/*"]
    }
    
    data_resource {
      type   = "AWS::Lambda::Function"
      values = ["arn:aws:lambda:*:*:function:*"]
    }
  }
  
  insight_selector {
    insight_type = "ApiCallRateInsight"
  }
  
  kms_key_id                = aws_kms_key.audit_logs.arn
  include_global_service_events = true
  is_multi_region_trail     = var.enable_multi_region_trail
  enable_logging            = true
  
  tags = local.security_tags
}

# Security Hub for centralized security findings
resource "aws_securityhub_account" "main" {
  enable_default_standards = true
}

# Config for compliance monitoring
resource "aws_config_configuration_recorder" "main" {
  name     = "${var.name_prefix}-config-recorder"
  role_arn = aws_iam_role.config.arn
  
  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  name           = "${var.name_prefix}-config-delivery"
  s3_bucket_name = aws_s3_bucket.config_logs.bucket
}

resource "aws_s3_bucket" "config_logs" {
  bucket = "${var.name_prefix}-config-logs-${var.environment}"
  
  tags = merge(local.security_tags, {
    Name = "${var.name_prefix}-config-logs"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "config_logs" {
  bucket = aws_s3_bucket.config_logs.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.audit_logs.arn
    }
  }
}

# IAM role for AWS Config
resource "aws_iam_role" "config" {
  name = "${var.name_prefix}-config-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.security_tags
}

resource "aws_iam_role_policy_attachment" "config" {
  role       = aws_iam_role.config.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigServiceRolePolicy"
}

# Custom config rules for compliance
resource "aws_config_config_rule" "s3_bucket_encryption" {
  name = "${var.name_prefix}-s3-bucket-server-side-encryption-enabled"
  
  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
  }
  
  depends_on = [aws_config_configuration_recorder.main]
}

resource "aws_config_config_rule" "root_access_key_check" {
  name = "${var.name_prefix}-root-access-key-check"
  
  source {
    owner             = "AWS"
    source_identifier = "ROOT_ACCESS_KEY_CHECK"
  }
  
  depends_on = [aws_config_configuration_recorder.main]
}

# GuardDuty for threat detection
resource "aws_guardduty_detector" "main" {
  enable = true
  
  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }
  
  tags = local.security_tags
}

# CloudWatch Logs for centralized logging
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/application/${var.name_prefix}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.audit_logs.arn
  
  tags = local.security_tags
}

resource "aws_cloudwatch_log_group" "security_logs" {
  name              = "/aws/security/${var.name_prefix}"
  retention_in_days = var.audit_log_retention_days
  kms_key_id        = aws_kms_key.audit_logs.arn
  
  tags = merge(local.security_tags, {
    LogType = "security"
  })
}

# SNS topic for security alerts
resource "aws_sns_topic" "security_alerts" {
  name              = "${var.name_prefix}-security-alerts"
  kms_master_key_id = aws_kms_key.audit_logs.arn
  
  tags = local.security_tags
}

# EventBridge rules for security events
resource "aws_cloudwatch_event_rule" "security_events" {
  name        = "${var.name_prefix}-security-events"
  description = "Capture security events for ${var.name_prefix}"
  
  event_pattern = jsonencode({
    source = ["aws.guardduty", "aws.securityhub"]
    detail-type = [
      "GuardDuty Finding",
      "Security Hub Findings - Imported"
    ]
  })
  
  tags = local.security_tags
}

resource "aws_cloudwatch_event_target" "security_alerts" {
  rule      = aws_cloudwatch_event_rule.security_events.name
  target_id = "SecurityAlertsTarget"
  arn       = aws_sns_topic.security_alerts.arn
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
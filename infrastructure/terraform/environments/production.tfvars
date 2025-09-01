# Production Environment Variables for MadPlan Infrastructure
# Terraform variables for production deployment

# Project Configuration
project_name = "madplan"
environment  = "production"

# AWS Configuration
aws_region  = "us-east-1"
aws_profile = "production"

# Networking Configuration
vpc_cidr             = "10.0.0.0/16"
enable_nat_gateway   = true
single_nat_gateway   = false  # Use multiple NAT gateways for HA

# Compute Configuration (Production-sized)
instance_type    = "t3.medium"
key_pair_name    = "madplan-production-key"  # Must exist in AWS
app_port         = 3000

# Auto-scaling Configuration (Production scale)
min_capacity     = 2
max_capacity     = 10
desired_capacity = 3

# Database Configuration (Production MongoDB Atlas)
mongodb_instance_size   = "M30"      # Production-grade MongoDB Atlas cluster
mongodb_disk_size_gb    = 200        # 200GB storage for production
mongodb_backup_enabled  = true

# Domain and SSL Configuration
domain_name           = "madplan.com"                    # Replace with actual domain
ssl_certificate_arn   = ""                               # Will be auto-created
create_certificate    = true

# CDN Configuration (Production Cloudflare)
cloudflare_api_token  = "your-cloudflare-api-token"     # Set via environment variable
cloudflare_zone_id    = "your-cloudflare-zone-id"       # Set via environment variable
enable_cdn            = true
cdn_price_class       = "PriceClass_All"                # Global distribution

# Monitoring Configuration (Production Datadog)
datadog_api_key             = "your-datadog-api-key"    # Set via environment variable
datadog_app_key             = "your-datadog-app-key"    # Set via environment variable
enable_detailed_monitoring  = true
log_retention_days          = 30

# Security Configuration (Production hardened)
enable_waf                 = true
allowed_cidr_blocks        = ["0.0.0.0/0"]              # Restrict in production
enable_deletion_protection = true

# Alerting Configuration
alert_email         = "alerts@madplan.com"              # Replace with actual email
slack_webhook_url   = "your-slack-webhook-url"          # Set via environment variable

# Backup Configuration (Production retention)
backup_retention_days           = 30
enable_point_in_time_recovery  = true

# Cost Control (Production budget)
budget_limit      = 500  # $500/month production budget
enable_cost_alerts = true

# Performance Configuration
enable_performance_insights      = true
performance_insights_retention   = 31    # 31 days retention

# Feature Flags (Production)
enable_logging = true
enable_metrics = true
enable_tracing = true

# Environment-specific Overrides (Production optimized)
environment_config = {
  instance_type              = "t3.medium"
  min_capacity              = 2
  max_capacity              = 10
  desired_capacity          = 3
  mongodb_instance_size     = "M30"
  enable_deletion_protection = true
  log_retention_days        = 30
  backup_retention_days     = 30
}

# Additional Tags for Production
additional_tags = {
  CostCenter      = "Engineering"
  BusinessUnit    = "Product"
  DataClass       = "Confidential"
  Compliance      = "Required"
  Backup          = "Daily"
  Monitoring      = "24x7"
  SLA             = "99.9%"
  Support         = "Premium"
  Owner           = "Platform Team"
  Contact         = "platform-team@madplan.com"
  
  # Operational tags
  MaintenanceWindow = "Sunday-02:00-04:00-UTC"
  AutoScaling      = "Enabled"
  LoadBalancing    = "Enabled"
  HighAvailability = "Multi-AZ"
  
  # Security tags
  SecurityLevel    = "High"
  Encryption      = "Required"
  AccessLogging   = "Enabled"
  VulnScanning    = "Weekly"
  
  # Compliance tags
  DataRetention   = "7-years"
  PIIData         = "Yes"
  GDPR            = "Applicable"
  SOC2            = "Required"
}
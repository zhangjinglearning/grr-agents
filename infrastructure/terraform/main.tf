# Infrastructure as Code for MadPlan
# Main Terraform configuration for production deployment

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket         = "madplan-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Configure providers
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MadPlan"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
      CostCenter  = "Engineering"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
  api_url = "https://api.datadoghq.com/"
}

# Local values for configuration
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }

  # AZ configuration
  availability_zones = data.aws_availability_zones.available.names

  # CIDR blocks
  vpc_cidr = var.vpc_cidr
  
  # Subnets
  public_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 8, 1),
    cidrsubnet(local.vpc_cidr, 8, 2),
    cidrsubnet(local.vpc_cidr, 8, 3)
  ]
  
  private_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 8, 11),
    cidrsubnet(local.vpc_cidr, 8, 12),
    cidrsubnet(local.vpc_cidr, 8, 13)
  ]

  database_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 8, 21),
    cidrsubnet(local.vpc_cidr, 8, 22),
    cidrsubnet(local.vpc_cidr, 8, 23)
  ]
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# Module imports
module "networking" {
  source = "./modules/networking"

  name_prefix            = local.name_prefix
  vpc_cidr              = local.vpc_cidr
  availability_zones    = local.availability_zones
  public_subnet_cidrs   = local.public_subnet_cidrs
  private_subnet_cidrs  = local.private_subnet_cidrs
  database_subnet_cidrs = local.database_subnet_cidrs
  
  tags = local.common_tags
}

module "compute" {
  source = "./modules/compute"

  name_prefix        = local.name_prefix
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  private_subnet_ids = module.networking.private_subnet_ids

  # Application configuration
  app_port                    = var.app_port
  min_capacity               = var.min_capacity
  max_capacity               = var.max_capacity
  desired_capacity           = var.desired_capacity
  instance_type              = var.instance_type
  key_pair_name              = var.key_pair_name

  # Load balancer configuration
  enable_deletion_protection = var.environment == "production"
  health_check_path          = "/api/health"
  health_check_interval      = 30
  health_check_timeout       = 5
  healthy_threshold          = 2
  unhealthy_threshold        = 3

  # Auto-scaling configuration
  scale_up_threshold         = 70
  scale_down_threshold       = 20
  scale_up_cooldown          = 300
  scale_down_cooldown        = 300

  tags = local.common_tags

  depends_on = [module.networking]
}

module "database" {
  source = "./modules/database"

  name_prefix             = local.name_prefix
  vpc_id                 = module.networking.vpc_id
  database_subnet_ids    = module.networking.database_subnet_ids
  allowed_security_groups = [module.compute.app_security_group_id]

  # MongoDB Atlas configuration
  mongodb_cluster_name    = "${local.name_prefix}-cluster"
  mongodb_instance_size   = var.mongodb_instance_size
  mongodb_disk_size_gb   = var.mongodb_disk_size_gb
  mongodb_backup_enabled = var.environment == "production"
  mongodb_pit_enabled    = var.environment == "production"

  # Backup configuration
  backup_retention_days = var.environment == "production" ? 30 : 7

  tags = local.common_tags

  depends_on = [module.networking]
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix    = local.name_prefix
  environment    = var.environment
  
  # Resources to monitor
  vpc_id                = module.networking.vpc_id
  load_balancer_arn     = module.compute.load_balancer_arn
  target_group_arn      = module.compute.target_group_arn
  autoscaling_group_name = module.compute.autoscaling_group_name

  # Datadog configuration
  datadog_api_key = var.datadog_api_key
  datadog_app_key = var.datadog_app_key

  # Alert configuration
  enable_alerts          = true
  alert_email           = var.alert_email
  slack_webhook_url     = var.slack_webhook_url

  tags = local.common_tags

  depends_on = [module.compute, module.database]
}

module "cdn" {
  source = "./modules/cdn"

  name_prefix = local.name_prefix
  environment = var.environment

  # Origin configuration
  origin_domain_name = module.compute.load_balancer_dns_name
  
  # Cloudflare configuration
  domain_name        = var.domain_name
  cloudflare_zone_id = var.cloudflare_zone_id

  # CDN settings
  enable_compression    = true
  enable_brotli        = true
  cache_level          = "aggressive"
  browser_cache_ttl    = 14400  # 4 hours
  edge_cache_ttl       = 7200   # 2 hours

  tags = local.common_tags

  depends_on = [module.compute]
}

module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  environment = var.environment

  # VPC configuration
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  # SSL/TLS configuration
  domain_name     = var.domain_name
  certificate_arn = var.ssl_certificate_arn

  # WAF configuration
  enable_waf           = true
  enable_rate_limiting = true
  rate_limit_requests  = var.environment == "production" ? 2000 : 5000
  rate_limit_window    = 300  # 5 minutes

  # Security groups
  app_security_group_id      = module.compute.app_security_group_id
  database_security_group_id = module.database.security_group_id

  tags = local.common_tags

  depends_on = [module.networking, module.compute, module.database]
}

# Outputs
output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment = var.environment
    region      = var.aws_region
    
    networking = {
      vpc_id              = module.networking.vpc_id
      vpc_cidr           = module.networking.vpc_cidr
      public_subnets     = module.networking.public_subnet_ids
      private_subnets    = module.networking.private_subnet_ids
      database_subnets   = module.networking.database_subnet_ids
      nat_gateway_ips    = module.networking.nat_gateway_ips
    }
    
    compute = {
      load_balancer_dns      = module.compute.load_balancer_dns_name
      load_balancer_zone_id  = module.compute.load_balancer_zone_id
      autoscaling_group_name = module.compute.autoscaling_group_name
      launch_template_id     = module.compute.launch_template_id
    }
    
    database = {
      cluster_endpoint       = module.database.cluster_endpoint
      connection_string_name = module.database.connection_string_secret_name
      backup_policy         = module.database.backup_policy
    }
    
    monitoring = {
      dashboard_url    = module.monitoring.dashboard_url
      log_group_name   = module.monitoring.log_group_name
      metric_namespace = module.monitoring.metric_namespace
    }
    
    cdn = {
      distribution_domain = module.cdn.distribution_domain
      distribution_id     = module.cdn.distribution_id
      cache_behavior      = module.cdn.cache_behavior_summary
    }
    
    security = {
      waf_web_acl_id     = module.security.waf_web_acl_id
      ssl_certificate    = module.security.ssl_certificate_status
      security_policies  = module.security.security_policy_summary
    }
  }
}

output "deployment_endpoints" {
  description = "Key endpoints for the deployed application"
  value = {
    application_url  = "https://${var.domain_name}"
    api_endpoint    = "https://${var.domain_name}/api"
    graphql_endpoint = "https://${var.domain_name}/graphql"
    health_check    = "https://${var.domain_name}/api/health"
    admin_dashboard = "https://${var.domain_name}/admin"
  }
}

output "operational_info" {
  description = "Information for operations team"
  value = {
    ssh_access = "Use Systems Manager Session Manager for secure access"
    log_access = "CloudWatch Logs: ${module.monitoring.log_group_name}"
    monitoring = "Datadog Dashboard: ${module.monitoring.dashboard_url}"
    
    scaling_info = {
      min_instances = var.min_capacity
      max_instances = var.max_capacity
      current_desired = var.desired_capacity
    }
    
    backup_info = {
      retention_days = var.environment == "production" ? 30 : 7
      automated = true
      point_in_time_recovery = var.environment == "production"
    }
  }
}
# Database Module Variables

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

variable "mongodb_org_id" {
  description = "MongoDB Atlas organization ID"
  type        = string
}

# Cluster Configuration
variable "cluster_instance_type" {
  description = "Instance type for primary cluster"
  type        = string
  default     = "M30"  # General purpose, 2 vCPU, 8 GB RAM
}

variable "replica_instance_type" {
  description = "Instance type for read replica clusters"
  type        = string
  default     = "M20"  # General purpose, 2 vCPU, 4 GB RAM
}

variable "disk_size_gb" {
  description = "Disk size in GB for primary cluster"
  type        = number
  default     = 100
}

variable "replica_disk_size_gb" {
  description = "Disk size in GB for read replica clusters"
  type        = number
  default     = 50
}

variable "mongodb_version" {
  description = "MongoDB version"
  type        = string
  default     = "7.0"
}

variable "oplog_size_mb" {
  description = "Oplog size in MB"
  type        = number
  default     = 2048
}

# Regional Configuration
variable "primary_region" {
  description = "Primary AWS region for the cluster"
  type        = string
  default     = "US_EAST_1"
}

variable "secondary_region" {
  description = "Secondary AWS region for disaster recovery"
  type        = string
  default     = "US_WEST_2"
}

variable "enable_read_replicas" {
  description = "Enable read replica clusters"
  type        = bool
  default     = true
}

variable "read_replica_regions" {
  description = "List of regions for read replica clusters"
  type        = list(string)
  default     = ["EU_WEST_1", "AP_SOUTHEAST_1"]
}

variable "replica_node_count" {
  description = "Number of read-only nodes per replica cluster"
  type        = number
  default     = 2
}

# Database Users
variable "app_username" {
  description = "Application database username"
  type        = string
  default     = "madplan_app"
  sensitive   = true
}

variable "app_password" {
  description = "Application database password"
  type        = string
  sensitive   = true
}

variable "readonly_password" {
  description = "Read-only user password"
  type        = string
  sensitive   = true
}

variable "analytics_username" {
  description = "Analytics database username"
  type        = string
  default     = "madplan_analytics"
  sensitive   = true
}

variable "analytics_password" {
  description = "Analytics database password"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Primary database name"
  type        = string
  default     = "madplan"
}

# Network Configuration
variable "vpc_id" {
  description = "VPC ID for private endpoint"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block for network access"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for VPC endpoint"
  type        = list(string)
}

variable "app_security_group_ids" {
  description = "List of security group IDs that need database access"
  type        = list(string)
}

variable "app_server_ips" {
  description = "List of application server IP addresses for access"
  type        = list(string)
  default     = []
}

# Backup Configuration
variable "backup_hour" {
  description = "Hour of day for backup (UTC)"
  type        = number
  default     = 3
}

variable "backup_minute" {
  description = "Minute of hour for backup"
  type        = number
  default     = 30
}

variable "restore_window_days" {
  description = "Number of days for point-in-time restore window"
  type        = number
  default     = 7
}

# Data Lake Configuration
variable "enable_data_lake" {
  description = "Enable MongoDB Data Lake for analytics"
  type        = bool
  default     = false
}

# Monitoring and Alerting
variable "alert_email" {
  description = "Email address for database alerts"
  type        = string
}

variable "slack_channel" {
  description = "Slack channel for alerts"
  type        = string
  default     = ""
}

variable "slack_token" {
  description = "Slack API token for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "connection_threshold" {
  description = "Alert threshold for number of connections"
  type        = number
  default     = 80
}

variable "replication_lag_threshold" {
  description = "Alert threshold for replication lag in seconds"
  type        = number
  default     = 10
}

# Performance Configuration
variable "enable_auto_scaling" {
  description = "Enable auto-scaling for compute and storage"
  type        = bool
  default     = true
}

variable "enable_performance_advisor" {
  description = "Enable MongoDB Performance Advisor"
  type        = bool
  default     = true
}

variable "enable_profiler" {
  description = "Enable database profiler"
  type        = bool
  default     = false
}

# Security Configuration
variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "tls_protocol_version" {
  description = "Minimum TLS protocol version"
  type        = string
  default     = "TLS1_2"
}

variable "enable_database_auditing" {
  description = "Enable database auditing"
  type        = bool
  default     = true
}

# Connection Pool Configuration
variable "max_connections_per_instance" {
  description = "Maximum connections per instance"
  type        = number
  default     = 500
}

variable "connection_pool_settings" {
  description = "Connection pool settings for applications"
  type = object({
    min_pool_size      = number
    max_pool_size      = number
    max_idle_time_ms   = number
    wait_queue_timeout_ms = number
  })
  default = {
    min_pool_size      = 10
    max_pool_size      = 100
    max_idle_time_ms   = 300000  # 5 minutes
    wait_queue_timeout_ms = 30000   # 30 seconds
  }
}

# Index Configuration
variable "default_indexes" {
  description = "Default indexes to create"
  type = list(object({
    collection = string
    fields     = list(string)
    options    = map(any)
  }))
  default = [
    {
      collection = "boards"
      fields     = ["userId", "createdAt"]
      options    = { background = true }
    },
    {
      collection = "cards"
      fields     = ["boardId", "listId", "position"]
      options    = { background = true }
    },
    {
      collection = "lists"
      fields     = ["boardId", "position"]
      options    = { background = true }
    }
  ]
}

# Maintenance Configuration
variable "maintenance_window" {
  description = "Maintenance window configuration"
  type = object({
    day_of_week = number  # 1=Sunday, 7=Saturday
    hour_of_day = number  # Hour in UTC (0-23)
    auto_defer  = bool
  })
  default = {
    day_of_week = 1     # Sunday
    hour_of_day = 4     # 4 AM UTC
    auto_defer  = true
  }
}

# Tagging
variable "default_tags" {
  description = "Default tags to apply to all resources"
  type        = map(string)
  default = {
    Environment = "production"
    Project     = "madplan"
    ManagedBy   = "terraform"
    Component   = "database"
  }
}

variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
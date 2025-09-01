# Database Module Outputs

# Project Information
output "project_id" {
  description = "MongoDB Atlas project ID"
  value       = mongodbatlas_project.main.id
}

output "project_name" {
  description = "MongoDB Atlas project name"
  value       = mongodbatlas_project.main.name
}

# Primary Cluster Information
output "primary_cluster_id" {
  description = "Primary cluster ID"
  value       = mongodbatlas_cluster.primary.cluster_id
}

output "primary_cluster_name" {
  description = "Primary cluster name"
  value       = mongodbatlas_cluster.primary.name
}

output "primary_cluster_state" {
  description = "Primary cluster state"
  value       = mongodbatlas_cluster.primary.state_name
}

# Connection Strings
output "primary_connection_strings" {
  description = "Primary cluster connection strings"
  value = {
    standard     = mongodbatlas_cluster.primary.connection_strings[0].standard
    standard_srv = mongodbatlas_cluster.primary.connection_strings[0].standard_srv
    private      = length(mongodbatlas_cluster.primary.connection_strings[0].private_endpoint) > 0 ? mongodbatlas_cluster.primary.connection_strings[0].private_endpoint[0].srv_connection_string : ""
  }
  sensitive = true
}

# Read Replica Information
output "read_replica_clusters" {
  description = "Read replica cluster information"
  value = var.enable_read_replicas ? {
    for idx, cluster in mongodbatlas_cluster.read_replica : 
    cluster.name => {
      cluster_id = cluster.cluster_id
      region     = var.read_replica_regions[idx]
      state      = cluster.state_name
      connection_strings = {
        standard     = cluster.connection_strings[0].standard
        standard_srv = cluster.connection_strings[0].standard_srv
      }
    }
  } : {}
  sensitive = true
}

output "read_replica_count" {
  description = "Number of read replica clusters"
  value       = var.enable_read_replicas ? length(mongodbatlas_cluster.read_replica) : 0
}

# Database Users
output "database_users" {
  description = "Database user information"
  value = {
    app_user = {
      username      = mongodbatlas_database_user.app_user.username
      auth_database = mongodbatlas_database_user.app_user.auth_database_name
      roles         = mongodbatlas_database_user.app_user.roles
    }
    readonly_user = var.enable_read_replicas ? {
      username      = mongodbatlas_database_user.readonly_user[0].username
      auth_database = mongodbatlas_database_user.readonly_user[0].auth_database_name
      roles         = mongodbatlas_database_user.readonly_user[0].roles
    } : null
    analytics_user = {
      username      = mongodbatlas_database_user.analytics_user.username
      auth_database = mongodbatlas_database_user.analytics_user.auth_database_name
      roles         = mongodbatlas_database_user.analytics_user.roles
    }
  }
}

# Network Configuration
output "private_endpoint_id" {
  description = "Private endpoint ID for VPC connectivity"
  value       = mongodbatlas_privatelink_endpoint.primary.private_link_id
}

output "vpc_endpoint_id" {
  description = "AWS VPC endpoint ID"
  value       = aws_vpc_endpoint.mongodb_primary.id
}

output "security_group_id" {
  description = "Security group ID for MongoDB access"
  value       = aws_security_group.mongodb.id
}

# Backup Information
output "backup_policy" {
  description = "Backup policy configuration"
  value = {
    reference_hour   = mongodbatlas_cloud_backup_schedule.primary.reference_hour_of_day
    reference_minute = mongodbatlas_cloud_backup_schedule.primary.reference_minute_of_hour
    restore_window   = mongodbatlas_cloud_backup_schedule.primary.restore_window_days
    policy_items = {
      hourly  = mongodbatlas_cloud_backup_schedule.primary.policy_item_hourly
      daily   = mongodbatlas_cloud_backup_schedule.primary.policy_item_daily
      weekly  = mongodbatlas_cloud_backup_schedule.primary.policy_item_weekly
      monthly = mongodbatlas_cloud_backup_schedule.primary.policy_item_monthly
    }
  }
}

# Data Lake Information
output "data_lake_name" {
  description = "Data Lake name"
  value       = var.enable_data_lake ? mongodbatlas_data_lake.analytics[0].name : null
}

output "data_lake_s3_bucket" {
  description = "S3 bucket for Data Lake storage"
  value       = var.enable_data_lake ? aws_s3_bucket.data_lake[0].id : null
}

# Monitoring and Alerting
output "alert_configurations" {
  description = "Alert configuration IDs"
  value = {
    high_connections = mongodbatlas_alert_configuration.high_connections.alert_configuration_id
    high_cpu        = mongodbatlas_alert_configuration.high_cpu.alert_configuration_id
    replication_lag = var.enable_read_replicas ? mongodbatlas_alert_configuration.replication_lag[0].alert_configuration_id : null
  }
}

# Performance and Scaling Information
output "cluster_configuration" {
  description = "Cluster configuration summary"
  value = {
    primary = {
      instance_type        = var.cluster_instance_type
      disk_size_gb        = var.disk_size_gb
      mongodb_version     = var.mongodb_version
      auto_scaling_enabled = var.enable_auto_scaling
      regions = {
        primary   = var.primary_region
        secondary = var.secondary_region
      }
    }
    replicas = var.enable_read_replicas ? {
      instance_type = var.replica_instance_type
      disk_size_gb  = var.replica_disk_size_gb
      node_count    = var.replica_node_count
      regions       = var.read_replica_regions
    } : null
  }
}

# Connection Pool Configuration for Applications
output "connection_pool_settings" {
  description = "Recommended connection pool settings for applications"
  value = {
    primary_cluster = {
      connection_string = mongodbatlas_cluster.primary.connection_strings[0].standard_srv
      min_pool_size     = var.connection_pool_settings.min_pool_size
      max_pool_size     = var.connection_pool_settings.max_pool_size
      max_idle_time_ms  = var.connection_pool_settings.max_idle_time_ms
      wait_queue_timeout_ms = var.connection_pool_settings.wait_queue_timeout_ms
      read_preference   = "primary"
    }
    read_replicas = var.enable_read_replicas ? [
      for idx, cluster in mongodbatlas_cluster.read_replica : {
        connection_string = cluster.connection_strings[0].standard_srv
        min_pool_size     = max(2, var.connection_pool_settings.min_pool_size / 2)
        max_pool_size     = max(10, var.connection_pool_settings.max_pool_size / 2)
        max_idle_time_ms  = var.connection_pool_settings.max_idle_time_ms
        wait_queue_timeout_ms = var.connection_pool_settings.wait_queue_timeout_ms
        read_preference   = "secondary"
        region           = var.read_replica_regions[idx]
      }
    ] : []
  }
  sensitive = true
}

# Security Configuration
output "security_settings" {
  description = "Security configuration summary"
  value = {
    tls_enabled           = true
    tls_minimum_version   = var.tls_protocol_version
    encryption_at_rest    = var.enable_encryption_at_rest
    database_auditing     = var.enable_database_auditing
    private_endpoint      = true
    ip_access_list_count  = length(var.app_server_ips) + 1
  }
}

# Cost Optimization Information
output "cost_optimization" {
  description = "Cost optimization settings and recommendations"
  value = {
    auto_scaling = {
      compute_enabled = var.enable_auto_scaling
      disk_enabled    = true
    }
    instance_sizes = {
      primary_cluster = var.cluster_instance_type
      read_replicas   = var.replica_instance_type
    }
    backup_retention = {
      hourly_days   = 2
      daily_days    = 7
      weekly_weeks  = 4
      monthly_months = 12
    }
    recommendations = [
      "Consider using smaller instance types for read replicas if read workload is light",
      "Monitor connection pool utilization to optimize pool sizes",
      "Use read replicas for analytics queries to reduce load on primary",
      "Schedule maintenance during low-usage periods"
    ]
  }
}

# Environment-specific URLs for Applications
output "application_config" {
  description = "Configuration values for application deployment"
  value = {
    database_urls = {
      primary = "mongodb+srv://${var.app_username}:${var.app_password}@${split("://", mongodbatlas_cluster.primary.connection_strings[0].standard_srv)[1]}/${var.database_name}?retryWrites=true&w=majority"
      readonly = var.enable_read_replicas ? "mongodb+srv://${var.app_username}_readonly:${var.readonly_password}@${split("://", mongodbatlas_cluster.read_replica[0].connection_strings[0].standard_srv)[1]}/${var.database_name}?readPreference=secondary" : null
      analytics = "mongodb+srv://${var.analytics_username}:${var.analytics_password}@${split("://", mongodbatlas_cluster.primary.connection_strings[0].standard_srv)[1]}/analytics?retryWrites=true&w=majority"
    }
    connection_options = {
      maxPoolSize       = var.connection_pool_settings.max_pool_size
      minPoolSize       = var.connection_pool_settings.min_pool_size
      maxIdleTimeMS     = var.connection_pool_settings.max_idle_time_ms
      waitQueueTimeoutMS = var.connection_pool_settings.wait_queue_timeout_ms
      serverSelectionTimeoutMS = 5000
      socketTimeoutMS   = 0
      bufferMaxEntries  = 0
    }
  }
  sensitive = true
}

# Health Check Endpoints
output "health_check_info" {
  description = "Information for database health checks"
  value = {
    primary_cluster = {
      name = mongodbatlas_cluster.primary.name
      state = mongodbatlas_cluster.primary.state_name
      monitoring_enabled = true
    }
    connection_test_query = "db.adminCommand('ping')"
    replica_lag_threshold = var.replication_lag_threshold
  }
}
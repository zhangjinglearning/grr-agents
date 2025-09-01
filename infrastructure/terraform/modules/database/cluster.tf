# MongoDB Atlas Cluster Configuration with Read Replicas
# Implements database clustering and read replicas for scalability

# MongoDB Atlas Project
resource "mongodbatlas_project" "main" {
  name   = "${var.name_prefix}-project"
  org_id = var.mongodb_org_id
  
  # Project-level IP access list
  is_collect_database_specific_statistics_enabled = true
  is_data_explorer_enabled                        = true
  is_performance_advisor_enabled                  = true
  is_realtime_performance_panel_enabled          = true
  is_schema_advisor_enabled                       = true
}

# Primary cluster for read-write operations
resource "mongodbatlas_cluster" "primary" {
  project_id = mongodbatlas_project.main.id
  name       = "${var.name_prefix}-primary-cluster"
  
  # Cluster configuration
  cluster_type                      = "REPLICASET"
  replication_specs {
    num_shards = 1
    regions_config {
      region_name     = var.primary_region
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 0
    }
    
    # Additional region for disaster recovery
    regions_config {
      region_name     = var.secondary_region
      electable_nodes = 2
      priority        = 6
      read_only_nodes = 1
    }
  }
  
  # Instance configuration
  provider_name               = "AWS"
  backing_provider_name      = "AWS"
  provider_instance_size_name = var.cluster_instance_type
  provider_region_name       = var.primary_region
  
  # Storage configuration
  provider_disk_type_name = "P1"
  disk_size_gb           = var.disk_size_gb
  provider_auto_scaling_compute_enabled = true
  provider_auto_scaling_compute_scale_down_enabled = true
  
  # Auto-scaling configuration
  auto_scaling_disk_gb_enabled = true
  
  # Advanced configuration
  advanced_configuration {
    fail_index_key_too_long              = false
    javascript_enabled                   = true
    minimum_enabled_tls_protocol        = "TLS1_2"
    no_table_scan                       = false
    oplog_size_mb                       = var.oplog_size_mb
    sample_size_bi_connector            = 5000
    sample_refresh_interval_bi_connector = 300
    
    # Performance optimizations
    default_read_concern                 = "available"
    default_write_concern               = "majority"
    oplog_min_retention_hours           = 48
    
    # Security settings
    tls_cipher_config_mode = "CUSTOM"
  }
  
  # Backup configuration
  backup_enabled                 = true
  pit_enabled                   = true
  cloud_backup                  = true
  auto_scaling_disk_gb_enabled = true
  
  # MongoDB version
  mongo_db_major_version = var.mongodb_version
  
  # Maintenance window
  paused = false
  
  tags = merge(var.default_tags, {
    Name     = "${var.name_prefix}-primary-cluster"
    Role     = "primary"
    ReadWrite = "true"
  })
}

# Read replica clusters for read scaling
resource "mongodbatlas_cluster" "read_replica" {
  count = var.enable_read_replicas ? length(var.read_replica_regions) : 0
  
  project_id = mongodbatlas_project.main.id
  name       = "${var.name_prefix}-replica-${var.read_replica_regions[count.index]}"
  
  cluster_type = "REPLICASET"
  replication_specs {
    num_shards = 1
    regions_config {
      region_name     = var.read_replica_regions[count.index]
      electable_nodes = 0
      priority        = 0
      read_only_nodes = var.replica_node_count
    }
  }
  
  provider_name               = "AWS"
  backing_provider_name      = "AWS"
  provider_instance_size_name = var.replica_instance_type
  provider_region_name       = var.read_replica_regions[count.index]
  
  # Smaller disk for read replicas
  provider_disk_type_name = "P1"
  disk_size_gb           = var.replica_disk_size_gb
  
  # Link to primary cluster for replication
  backup_enabled = false  # Backups handled by primary
  pit_enabled   = false
  
  # MongoDB version (must match primary)
  mongo_db_major_version = var.mongodb_version
  
  tags = merge(var.default_tags, {
    Name     = "${var.name_prefix}-replica-${var.read_replica_regions[count.index]}"
    Role     = "read-replica"
    ReadOnly = "true"
    Region   = var.read_replica_regions[count.index]
  })
  
  depends_on = [mongodbatlas_cluster.primary]
}

# Database users with appropriate permissions
resource "mongodbatlas_database_user" "app_user" {
  username           = var.app_username
  password           = var.app_password
  project_id         = mongodbatlas_project.main.id
  auth_database_name = "admin"
  
  roles {
    role_name     = "readWrite"
    database_name = var.database_name
  }
  
  # Additional role for analytics collections
  roles {
    role_name     = "read"
    database_name = "analytics"
  }
  
  scopes {
    name = mongodbatlas_cluster.primary.name
    type = "CLUSTER"
  }
  
  labels {
    key   = "environment"
    value = var.environment
  }
  
  labels {
    key   = "role"
    value = "application"
  }
}

# Read-only user for read replicas
resource "mongodbatlas_database_user" "readonly_user" {
  count = var.enable_read_replicas ? 1 : 0
  
  username           = "${var.app_username}_readonly"
  password           = var.readonly_password
  project_id         = mongodbatlas_project.main.id
  auth_database_name = "admin"
  
  roles {
    role_name     = "read"
    database_name = var.database_name
  }
  
  roles {
    role_name     = "read"
    database_name = "analytics"
  }
  
  # Apply to all read replicas
  dynamic "scopes" {
    for_each = mongodbatlas_cluster.read_replica
    content {
      name = scopes.value.name
      type = "CLUSTER"
    }
  }
  
  labels {
    key   = "environment"
    value = var.environment
  }
  
  labels {
    key   = "role"
    value = "readonly"
  }
}

# Analytics user with specific permissions
resource "mongodbatlas_database_user" "analytics_user" {
  username           = var.analytics_username
  password           = var.analytics_password
  project_id         = mongodbatlas_project.main.id
  auth_database_name = "admin"
  
  roles {
    role_name     = "readWrite"
    database_name = "analytics"
  }
  
  roles {
    role_name     = "read"
    database_name = var.database_name
  }
  
  scopes {
    name = mongodbatlas_cluster.primary.name
    type = "CLUSTER"
  }
  
  labels {
    key   = "environment"
    value = var.environment
  }
  
  labels {
    key   = "role"
    value = "analytics"
  }
}

# Network access configuration
resource "mongodbatlas_project_ip_access_list" "vpc_access" {
  project_id = mongodbatlas_project.main.id
  cidr_block = var.vpc_cidr
  comment    = "VPC access for ${var.environment}"
}

resource "mongodbatlas_project_ip_access_list" "app_servers" {
  count = length(var.app_server_ips)
  
  project_id = mongodbatlas_project.main.id
  ip_address = var.app_server_ips[count.index]
  comment    = "Application server ${count.index + 1}"
}

# Private endpoint for secure connectivity
resource "mongodbatlas_privatelink_endpoint" "primary" {
  project_id    = mongodbatlas_project.main.id
  provider_name = "AWS"
  region        = var.primary_region
}

resource "aws_vpc_endpoint" "mongodb_primary" {
  vpc_id              = var.vpc_id
  service_name        = mongodbatlas_privatelink_endpoint.primary.endpoint_service_name
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.mongodb.id]
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = "*"
        Action = [
          "mongodb:*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = merge(var.default_tags, {
    Name = "${var.name_prefix}-mongodb-endpoint"
  })
}

resource "mongodbatlas_privatelink_endpoint_service" "primary" {
  project_id          = mongodbatlas_privatelink_endpoint.primary.project_id
  endpoint_service_id = mongodbatlas_privatelink_endpoint.primary.endpoint_service_name
  private_link_id     = mongodbatlas_privatelink_endpoint.primary.private_link_id
  provider_name       = "AWS"
  
  depends_on = [aws_vpc_endpoint.mongodb_primary]
}

# Security group for MongoDB access
resource "aws_security_group" "mongodb" {
  name_prefix = "${var.name_prefix}-mongodb-"
  vpc_id      = var.vpc_id
  description = "Security group for MongoDB Atlas private endpoint"
  
  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = var.app_security_group_ids
  }
  
  ingress {
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.default_tags, {
    Name = "${var.name_prefix}-mongodb-sg"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# Data Lake for analytics
resource "mongodbatlas_data_lake" "analytics" {
  count = var.enable_data_lake ? 1 : 0
  
  project_id = mongodbatlas_project.main.id
  name       = "${var.name_prefix}-analytics-lake"
  
  aws {
    role_id                   = mongodbatlas_cloud_provider_access_setup.data_lake[0].aws_config[0].atlas_aws_account_arn
    test_s3_bucket           = aws_s3_bucket.data_lake[0].id
    external_id              = mongodbatlas_cloud_provider_access_setup.data_lake[0].aws_config[0].atlas_assumed_role_external_id
  }
  
  data_process_region {
    cloud_provider = "AWS"
    region         = var.primary_region
  }
}

# S3 bucket for Data Lake
resource "aws_s3_bucket" "data_lake" {
  count = var.enable_data_lake ? 1 : 0
  
  bucket = "${var.name_prefix}-analytics-data-lake"
  
  tags = merge(var.default_tags, {
    Name = "${var.name_prefix}-analytics-data-lake"
  })
}

resource "aws_s3_bucket_versioning" "data_lake" {
  count = var.enable_data_lake ? 1 : 0
  
  bucket = aws_s3_bucket.data_lake[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake" {
  count = var.enable_data_lake ? 1 : 0
  
  bucket = aws_s3_bucket.data_lake[0].id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Cloud provider access for Data Lake
resource "mongodbatlas_cloud_provider_access_setup" "data_lake" {
  count = var.enable_data_lake ? 1 : 0
  
  project_id    = mongodbatlas_project.main.id
  provider_name = "AWS"
}

# Backup policy configuration
resource "mongodbatlas_cloud_backup_schedule" "primary" {
  project_id   = mongodbatlas_project.main.id
  cluster_name = mongodbatlas_cluster.primary.name
  
  reference_hour_of_day    = var.backup_hour
  reference_minute_of_hour = var.backup_minute
  restore_window_days      = var.restore_window_days
  
  # Policy items for different retention periods
  policy_item_hourly {
    frequency_interval = 6        # Every 6 hours
    retention_unit     = "days"
    retention_value    = 2        # Keep for 2 days
  }
  
  policy_item_daily {
    frequency_interval = 1        # Every day
    retention_unit     = "days"
    retention_value    = 7        # Keep for 1 week
  }
  
  policy_item_weekly {
    frequency_interval = 1        # Every week
    retention_unit     = "weeks"
    retention_value    = 4        # Keep for 4 weeks
  }
  
  policy_item_monthly {
    frequency_interval = 1        # Every month
    retention_unit     = "months"
    retention_value    = 12       # Keep for 1 year
  }
}

# Performance monitoring and alerting
resource "mongodbatlas_alert_configuration" "high_connections" {
  project_id = mongodbatlas_project.main.id
  
  event_type = "OUTSIDE_METRIC_THRESHOLD"
  enabled    = true
  
  matcher {
    field_name = "HOSTNAME_AND_PORT"
    operator   = "EQUALS"
    value      = mongodbatlas_cluster.primary.connection_strings[0].standard_srv
  }
  
  metric_threshold_config {
    metric_name = "CONNECTIONS"
    operator    = "GREATER_THAN"
    threshold   = var.connection_threshold
    units       = "RAW"
    mode        = "AVERAGE"
  }
  
  notification {
    type_name     = "EMAIL"
    email_address = var.alert_email
    delay_min     = 5
  }
  
  notification {
    type_name   = "SLACK"
    channel_name = var.slack_channel
    api_token   = var.slack_token
    delay_min   = 0
  }
}

resource "mongodbatlas_alert_configuration" "high_cpu" {
  project_id = mongodbatlas_project.main.id
  
  event_type = "OUTSIDE_METRIC_THRESHOLD"
  enabled    = true
  
  matcher {
    field_name = "HOSTNAME_AND_PORT"
    operator   = "EQUALS"
    value      = mongodbatlas_cluster.primary.connection_strings[0].standard_srv
  }
  
  metric_threshold_config {
    metric_name = "NORMALIZED_SYSTEM_CPU_USER"
    operator    = "GREATER_THAN"
    threshold   = 80.0
    units       = "RAW"
    mode        = "AVERAGE"
  }
  
  notification {
    type_name     = "EMAIL"
    email_address = var.alert_email
    delay_min     = 10
  }
}

resource "mongodbatlas_alert_configuration" "replication_lag" {
  count = var.enable_read_replicas ? 1 : 0
  
  project_id = mongodbatlas_project.main.id
  
  event_type = "OUTSIDE_METRIC_THRESHOLD"
  enabled    = true
  
  metric_threshold_config {
    metric_name = "OPLOG_SLAVE_LAG_MASTER_TIME"
    operator    = "GREATER_THAN"
    threshold   = var.replication_lag_threshold
    units       = "SECONDS"
    mode        = "AVERAGE"
  }
  
  notification {
    type_name     = "EMAIL"
    email_address = var.alert_email
    delay_min     = 5
  }
}
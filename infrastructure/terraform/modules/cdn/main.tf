# CDN Configuration for Static Asset Delivery and Global Performance
# Implements CloudFront distribution with S3 origin and edge locations

locals {
  s3_origin_id = "madplan-s3-origin"
  alb_origin_id = "madplan-alb-origin"
  
  default_tags = {
    Environment = var.environment
    Project     = "madplan"
    ManagedBy   = "terraform"
    Component   = "cdn"
  }
}

# S3 bucket for static assets
resource "aws_s3_bucket" "assets" {
  bucket = "${var.name_prefix}-static-assets"
  
  tags = merge(local.default_tags, {
    Name = "${var.name_prefix}-static-assets"
  })
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  rule {
    id     = "old_versions_cleanup"
    status = "Enabled"
    
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
  
  rule {
    id     = "temp_files_cleanup"
    status = "Enabled"
    
    filter {
      prefix = "temp/"
    }
    
    expiration {
      days = 1
    }
  }
}

# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${var.name_prefix}-assets-oac"
  description                       = "OAC for ${var.name_prefix} static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
  
  depends_on = [aws_cloudfront_distribution.main]
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  comment             = "${var.name_prefix} CDN Distribution"
  default_root_object = "index.html"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = var.price_class
  
  # S3 origin for static assets
  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
    
    # Custom headers for better cache control
    custom_header {
      name  = "X-Origin-Type"
      value = "s3"
    }
  }
  
  # ALB origin for API endpoints
  dynamic "origin" {
    for_each = var.alb_domain_name != "" ? [1] : []
    
    content {
      domain_name = var.alb_domain_name
      origin_id   = local.alb_origin_id
      
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
      
      custom_header {
        name  = "X-Origin-Type"
        value = "alb"
      }
    }
  }
  
  # Default cache behavior for static assets
  default_cache_behavior {
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = local.s3_origin_id
    compress                 = true
    viewer_protocol_policy   = "redirect-to-https"
    cache_policy_id          = aws_cloudfront_cache_policy.static_assets.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3.id
    
    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }
  
  # API cache behavior
  dynamic "ordered_cache_behavior" {
    for_each = var.alb_domain_name != "" ? [1] : []
    
    content {
      path_pattern             = "/api/*"
      allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods           = ["GET", "HEAD", "OPTIONS"]
      target_origin_id         = local.alb_origin_id
      compress                 = true
      viewer_protocol_policy   = "redirect-to-https"
      cache_policy_id          = aws_cloudfront_cache_policy.api.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
      
      response_headers_policy_id = aws_cloudfront_response_headers_policy.api.id
    }
  }
  
  # SPA routing behavior
  ordered_cache_behavior {
    path_pattern           = "/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.s3_origin_id
    compress              = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id       = aws_cloudfront_cache_policy.spa.id
    
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }
  
  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }
  
  # SSL configuration
  viewer_certificate {
    acm_certificate_arn            = var.ssl_certificate_arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
    cloudfront_default_certificate = var.ssl_certificate_arn == "" ? true : false
  }
  
  # Custom domain aliases
  aliases = var.domain_aliases
  
  # Logging configuration
  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    include_cookies = false
    prefix          = "cloudfront-logs/"
  }
  
  # Custom error responses for SPA
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }
  
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }
  
  tags = merge(local.default_tags, {
    Name = "${var.name_prefix}-cloudfront-distribution"
  })
}

# Cache policies
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "${var.name_prefix}-static-assets-cache"
  comment     = "Cache policy for static assets (CSS, JS, images)"
  default_ttl = 86400   # 1 day
  max_ttl     = 31536000 # 1 year
  min_ttl     = 0
  
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["v", "version", "hash"]
      }
    }
    
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept", "Accept-Encoding"]
      }
    }
    
    cookies_config {
      cookie_behavior = "none"
    }
  }
}

resource "aws_cloudfront_cache_policy" "api" {
  name        = "${var.name_prefix}-api-cache"
  comment     = "Cache policy for API endpoints"
  default_ttl = 0      # No caching by default
  max_ttl     = 86400  # Max 1 day
  min_ttl     = 0
  
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    
    query_strings_config {
      query_string_behavior = "all"
    }
    
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = [
          "Authorization",
          "Accept",
          "Accept-Encoding",
          "Content-Type",
          "User-Agent",
          "X-Requested-With"
        ]
      }
    }
    
    cookies_config {
      cookie_behavior = "all"
    }
  }
}

resource "aws_cloudfront_cache_policy" "spa" {
  name        = "${var.name_prefix}-spa-cache"
  comment     = "Cache policy for SPA routes"
  default_ttl = 3600   # 1 hour
  max_ttl     = 86400  # 1 day
  min_ttl     = 0
  
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    
    query_strings_config {
      query_string_behavior = "none"
    }
    
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept", "Accept-Encoding"]
      }
    }
    
    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# Response headers policies
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.name_prefix}-security-headers"
  comment = "Security headers for web application"
  
  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      override                   = false
    }
    
    content_type_options {
      override = false
    }
    
    frame_options {
      frame_option = "DENY"
      override     = false
    }
    
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = false
    }
  }
  
  custom_headers_config {
    items {
      header   = "X-Content-Security-Policy"
      value    = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';"
      override = false
    }
    
    items {
      header   = "X-Permitted-Cross-Domain-Policies"
      value    = "none"
      override = false
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "api" {
  name    = "${var.name_prefix}-api-headers"
  comment = "Headers for API responses"
  
  cors_config {
    access_control_allow_credentials = true
    access_control_max_age_sec      = 600
    
    access_control_allow_headers {
      items = [
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With"
      ]
    }
    
    access_control_allow_methods {
      items = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
    }
    
    access_control_allow_origins {
      items = var.cors_allowed_origins
    }
    
    origin_override = false
  }
}

# Data sources for AWS managed policies
data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# S3 bucket for CloudFront logs
resource "aws_s3_bucket" "logs" {
  bucket = "${var.name_prefix}-cloudfront-logs"
  
  tags = merge(local.default_tags, {
    Name = "${var.name_prefix}-cloudfront-logs"
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  
  rule {
    id     = "log_retention"
    status = "Enabled"
    
    expiration {
      days = 90
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudWatch alarms for CDN monitoring
resource "aws_cloudwatch_metric_alarm" "origin_latency_high" {
  alarm_name          = "${var.name_prefix}-cloudfront-origin-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "OriginLatency"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000"  # 5 seconds
  alarm_description   = "CloudFront origin latency is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  
  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }
  
  tags = local.default_tags
}

resource "aws_cloudwatch_metric_alarm" "error_rate_high" {
  alarm_name          = "${var.name_prefix}-cloudfront-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"  # 5%
  alarm_description   = "CloudFront 4xx error rate is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  
  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }
  
  tags = local.default_tags
}

resource "aws_cloudfront_monitoring_subscription" "main" {
  distribution_id = aws_cloudfront_distribution.main.id
  
  monitoring_subscription {
    realtime_metrics_subscription_config {
      realtime_metrics_subscription_status = "Enabled"
    }
  }
}

# Lambda@Edge function for advanced routing (optional)
resource "aws_lambda_function" "edge_router" {
  count = var.enable_edge_routing ? 1 : 0
  
  filename         = "edge-router.zip"
  function_name    = "${var.name_prefix}-edge-router"
  role            = aws_iam_role.lambda_edge[0].arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 5
  publish         = true
  
  source_code_hash = data.archive_file.edge_router[0].output_base64sha256
  
  tags = local.default_tags
}

# Create the Lambda@Edge function code
data "archive_file" "edge_router" {
  count = var.enable_edge_routing ? 1 : 0
  
  type        = "zip"
  output_path = "edge-router.zip"
  
  source {
    content = <<EOF
exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;
    
    // Handle SPA routing
    if (uri.match(/^\/[^.]*$/)) {
        request.uri = '/index.html';
    }
    
    // Security headers
    if (request.headers['x-forwarded-proto'] && 
        request.headers['x-forwarded-proto'][0].value === 'http') {
        return {
            status: '301',
            statusDescription: 'Moved Permanently',
            headers: {
                location: [{
                    key: 'Location',
                    value: `https://$${request.headers.host[0].value}$${request.uri}`
                }]
            }
        };
    }
    
    return request;
};
EOF
    filename = "index.js"
  }
}

# IAM role for Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  count = var.enable_edge_routing ? 1 : 0
  
  name = "${var.name_prefix}-lambda-edge-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
  
  tags = local.default_tags
}

resource "aws_iam_role_policy_attachment" "lambda_edge" {
  count = var.enable_edge_routing ? 1 : 0
  
  role       = aws_iam_role.lambda_edge[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
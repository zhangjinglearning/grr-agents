# Production CDN Configuration
# CloudFront distribution with global edge locations for optimal performance

module "cdn" {
  source = "../../modules/cdn"
  
  name_prefix = "madplan-prod"
  environment = "production"
  
  # Domain configuration
  domain_aliases = [
    "madplan.com",
    "www.madplan.com"
  ]
  
  # SSL certificate (should be in us-east-1 for CloudFront)
  ssl_certificate_arn = var.ssl_certificate_arn
  
  # ALB integration for API endpoints
  alb_domain_name = module.networking.alb_dns_name
  
  # Performance settings
  price_class         = "PriceClass_200"  # US, Europe, Asia, Middle East, Africa
  compression_enabled = true
  http_version       = "http2"
  ipv6_enabled       = true
  
  # Security settings
  security_headers_enabled = true
  hsts_max_age            = 31536000  # 1 year
  enable_waf              = true
  
  # CORS configuration for API
  cors_allowed_origins = [
    "https://madplan.com",
    "https://www.madplan.com",
    "https://app.madplan.com"
  ]
  
  # Geographic restrictions (if needed)
  geo_restriction_type      = "none"
  geo_restriction_locations = []
  
  # Monitoring and alerting
  alarm_topic_arn           = module.monitoring.sns_topic_arn
  enable_detailed_monitoring = true
  enable_real_time_logs     = true
  
  # Performance thresholds
  alarm_thresholds = {
    origin_latency_ms    = 3000  # 3 seconds
    error_rate_4xx       = 5     # 5%
    error_rate_5xx       = 1     # 1%
    cache_hit_rate       = 85    # 85%
    requests_per_minute  = 50000 # 50k requests/min
  }
  
  # Advanced features
  enable_edge_routing = true  # Lambda@Edge for SPA routing
  
  # Custom cache behaviors for different content types
  cache_behaviors = [
    {
      path_pattern           = "/static/css/*"
      target_origin_id       = "madplan-s3-origin"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      compress              = true
      viewer_protocol_policy = "redirect-to-https"
      min_ttl               = 31536000  # 1 year
      default_ttl           = 31536000  # 1 year
      max_ttl               = 31536000  # 1 year
      forward_query_string  = false
      forward_headers       = ["Accept", "Accept-Encoding"]
      forward_cookies       = "none"
    },
    {
      path_pattern           = "/static/js/*"
      target_origin_id       = "madplan-s3-origin"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      compress              = true
      viewer_protocol_policy = "redirect-to-https"
      min_ttl               = 31536000  # 1 year
      default_ttl           = 31536000  # 1 year
      max_ttl               = 31536000  # 1 year
      forward_query_string  = false
      forward_headers       = ["Accept", "Accept-Encoding"]
      forward_cookies       = "none"
    },
    {
      path_pattern           = "/static/media/*"
      target_origin_id       = "madplan-s3-origin"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      compress              = true
      viewer_protocol_policy = "redirect-to-https"
      min_ttl               = 2592000   # 30 days
      default_ttl           = 2592000   # 30 days
      max_ttl               = 31536000  # 1 year
      forward_query_string  = false
      forward_headers       = ["Accept", "Accept-Encoding"]
      forward_cookies       = "none"
    },
    {
      path_pattern           = "/api/health"
      target_origin_id       = "madplan-alb-origin"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      compress              = true
      viewer_protocol_policy = "redirect-to-https"
      min_ttl               = 0
      default_ttl           = 30    # 30 seconds
      max_ttl               = 300   # 5 minutes
      forward_query_string  = false
      forward_headers       = ["Host", "User-Agent"]
      forward_cookies       = "none"
    }
  ]
  
  # Custom error responses for SPA
  custom_error_responses = [
    {
      error_code            = 403
      response_code         = 200
      response_page_path    = "/index.html"
      error_caching_min_ttl = 300
    },
    {
      error_code            = 404
      response_code         = 200
      response_page_path    = "/index.html"
      error_caching_min_ttl = 300
    },
    {
      error_code            = 500
      response_code         = 503
      response_page_path    = "/503.html"
      error_caching_min_ttl = 60
    }
  ]
  
  # Content Security Policy for production
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.google-analytics.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.madplan.com https://www.google-analytics.com",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ])
  
  # Log retention
  log_retention_days = 90
  
  # Additional tags
  additional_tags = {
    Backup      = "required"
    Monitoring  = "enhanced"
    CostCenter  = "infrastructure"
    Owner       = "platform-team"
  }
}

# CloudWatch dashboard for CDN monitoring
resource "aws_cloudwatch_dashboard" "cdn" {
  dashboard_name = "madplan-prod-cdn-dashboard"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", module.cdn.distribution_id],
            [".", "BytesDownloaded", ".", "."],
            [".", "BytesUploaded", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "Request Volume and Data Transfer"
          view   = "timeSeries"
          stacked = false
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", module.cdn.distribution_id],
            [".", "5xxErrorRate", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"
          title  = "Error Rates"
          view   = "timeSeries"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/CloudFront", "OriginLatency", "DistributionId", module.cdn.distribution_id],
            [".", "CacheHitRate", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"
          title  = "Performance Metrics"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", module.cdn.distribution_id, { "stat": "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "Requests by Edge Location"
          view   = "map"
        }
      }
    ]
  })
  
  tags = {
    Environment = "production"
    Project     = "madplan"
    Component   = "cdn-monitoring"
  }
}

# Route 53 records for custom domains
resource "aws_route53_record" "main" {
  count = length(module.cdn.distribution_domain_name) > 0 ? 1 : 0
  
  zone_id = var.hosted_zone_id
  name    = "madplan.com"
  type    = "A"
  
  alias {
    name                   = module.cdn.distribution_domain_name
    zone_id                = module.cdn.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  count = length(module.cdn.distribution_domain_name) > 0 ? 1 : 0
  
  zone_id = var.hosted_zone_id
  name    = "www.madplan.com"
  type    = "A"
  
  alias {
    name                   = module.cdn.distribution_domain_name
    zone_id                = module.cdn.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

# AAAA records for IPv6 support
resource "aws_route53_record" "main_ipv6" {
  count = length(module.cdn.distribution_domain_name) > 0 ? 1 : 0
  
  zone_id = var.hosted_zone_id
  name    = "madplan.com"
  type    = "AAAA"
  
  alias {
    name                   = module.cdn.distribution_domain_name
    zone_id                = module.cdn.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_ipv6" {
  count = length(module.cdn.distribution_domain_name) > 0 ? 1 : 0
  
  zone_id = var.hosted_zone_id
  name    = "www.madplan.com"
  type    = "AAAA"
  
  alias {
    name                   = module.cdn.distribution_domain_name
    zone_id                = module.cdn.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}
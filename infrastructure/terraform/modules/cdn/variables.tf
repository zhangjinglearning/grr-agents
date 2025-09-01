# CDN Module Variables

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

variable "domain_aliases" {
  description = "List of domain aliases for CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate for custom domains"
  type        = string
  default     = ""
}

variable "alb_domain_name" {
  description = "Domain name of the Application Load Balancer for API endpoints"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "geo_restriction_type" {
  description = "Type of geo restriction (none, whitelist, blacklist)"
  type        = string
  default     = "none"
}

variable "geo_restriction_locations" {
  description = "List of country codes for geo restriction"
  type        = list(string)
  default     = []
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"]
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "enable_edge_routing" {
  description = "Enable Lambda@Edge for advanced routing"
  type        = bool
  default     = false
}

variable "enable_waf" {
  description = "Enable AWS WAF for additional security"
  type        = bool
  default     = true
}

variable "enable_real_time_logs" {
  description = "Enable CloudFront real-time logs"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain CloudFront logs"
  type        = number
  default     = 90
}

variable "cache_behaviors" {
  description = "Additional cache behaviors for specific paths"
  type = list(object({
    path_pattern           = string
    target_origin_id      = string
    allowed_methods       = list(string)
    cached_methods        = list(string)
    compress              = bool
    viewer_protocol_policy = string
    min_ttl               = number
    default_ttl           = number
    max_ttl               = number
    forward_query_string  = bool
    forward_headers       = list(string)
    forward_cookies       = string
  }))
  default = []
}

variable "custom_error_responses" {
  description = "Custom error response configurations"
  type = list(object({
    error_code            = number
    response_code         = number
    response_page_path    = string
    error_caching_min_ttl = number
  }))
  default = []
}

variable "origin_access_logging" {
  description = "Enable origin access logging"
  type        = bool
  default     = true
}

variable "web_acl_id" {
  description = "AWS WAF Web ACL ID to associate with the distribution"
  type        = string
  default     = ""
}

# Performance optimization variables
variable "compression_enabled" {
  description = "Enable compression for the distribution"
  type        = bool
  default     = true
}

variable "http_version" {
  description = "HTTP version for the distribution (http1.1 or http2)"
  type        = string
  default     = "http2"
}

variable "ipv6_enabled" {
  description = "Enable IPv6 for the distribution"
  type        = bool
  default     = true
}

# Security variables
variable "security_headers_enabled" {
  description = "Enable security headers"
  type        = bool
  default     = true
}

variable "hsts_max_age" {
  description = "HSTS max age in seconds"
  type        = number
  default     = 63072000
}

variable "content_security_policy" {
  description = "Content Security Policy header value"
  type        = string
  default     = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';"
}

# Monitoring variables
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "alarm_thresholds" {
  description = "Thresholds for CloudWatch alarms"
  type = object({
    origin_latency_ms    = number
    error_rate_4xx       = number
    error_rate_5xx       = number
    cache_hit_rate       = number
    requests_per_minute  = number
  })
  default = {
    origin_latency_ms    = 5000
    error_rate_4xx       = 5
    error_rate_5xx       = 1
    cache_hit_rate       = 80
    requests_per_minute  = 10000
  }
}

# Tagging variables
variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
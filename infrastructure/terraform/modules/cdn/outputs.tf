# CDN Module Outputs

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "distribution_status" {
  description = "CloudFront distribution status"
  value       = aws_cloudfront_distribution.main.status
}

output "assets_bucket_id" {
  description = "S3 assets bucket ID"
  value       = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  description = "S3 assets bucket ARN"
  value       = aws_s3_bucket.assets.arn
}

output "assets_bucket_domain_name" {
  description = "S3 assets bucket domain name"
  value       = aws_s3_bucket.assets.bucket_domain_name
}

output "assets_bucket_regional_domain_name" {
  description = "S3 assets bucket regional domain name"
  value       = aws_s3_bucket.assets.bucket_regional_domain_name
}

output "logs_bucket_id" {
  description = "S3 logs bucket ID"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "S3 logs bucket ARN"
  value       = aws_s3_bucket.logs.arn
}

output "cache_policy_static_assets_id" {
  description = "Cache policy ID for static assets"
  value       = aws_cloudfront_cache_policy.static_assets.id
}

output "cache_policy_api_id" {
  description = "Cache policy ID for API endpoints"
  value       = aws_cloudfront_cache_policy.api.id
}

output "cache_policy_spa_id" {
  description = "Cache policy ID for SPA routing"
  value       = aws_cloudfront_cache_policy.spa.id
}

output "response_headers_policy_security_id" {
  description = "Response headers policy ID for security headers"
  value       = aws_cloudfront_response_headers_policy.security.id
}

output "response_headers_policy_api_id" {
  description = "Response headers policy ID for API responses"
  value       = aws_cloudfront_response_headers_policy.api.id
}

output "origin_access_control_id" {
  description = "Origin Access Control ID"
  value       = aws_cloudfront_origin_access_control.assets.id
}

# Lambda@Edge outputs (conditional)
output "lambda_edge_function_arn" {
  description = "Lambda@Edge function ARN"
  value       = var.enable_edge_routing ? aws_lambda_function.edge_router[0].qualified_arn : null
}

output "lambda_edge_function_version" {
  description = "Lambda@Edge function version"
  value       = var.enable_edge_routing ? aws_lambda_function.edge_router[0].version : null
}

# CloudWatch alarm outputs
output "origin_latency_alarm_arn" {
  description = "Origin latency CloudWatch alarm ARN"
  value       = aws_cloudwatch_metric_alarm.origin_latency_high.arn
}

output "error_rate_alarm_arn" {
  description = "Error rate CloudWatch alarm ARN"
  value       = aws_cloudwatch_metric_alarm.error_rate_high.arn
}

# URLs and endpoints
output "cdn_urls" {
  description = "CDN URLs for different content types"
  value = {
    main_domain    = var.domain_aliases != [] ? "https://${var.domain_aliases[0]}" : "https://${aws_cloudfront_distribution.main.domain_name}"
    cloudfront     = "https://${aws_cloudfront_distribution.main.domain_name}"
    static_assets  = "https://${aws_cloudfront_distribution.main.domain_name}/static/"
    api_endpoint   = var.alb_domain_name != "" ? "https://${aws_cloudfront_distribution.main.domain_name}/api/" : null
  }
}

# Performance and monitoring outputs
output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL for CDN monitoring"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=${var.name_prefix}-cdn-dashboard"
}

output "distribution_metrics" {
  description = "Key metrics for monitoring"
  value = {
    distribution_id = aws_cloudfront_distribution.main.id
    metrics_namespace = "AWS/CloudFront"
    key_metrics = [
      "Requests",
      "BytesDownloaded",
      "BytesUploaded",
      "4xxErrorRate",
      "5xxErrorRate",
      "OriginLatency",
      "CacheHitRate"
    ]
  }
}

# Configuration summary
output "configuration_summary" {
  description = "Summary of CDN configuration"
  value = {
    distribution_id     = aws_cloudfront_distribution.main.id
    price_class        = var.price_class
    ipv6_enabled       = var.ipv6_enabled
    compression_enabled = var.compression_enabled
    http_version       = var.http_version
    origins_count      = var.alb_domain_name != "" ? 2 : 1
    cache_behaviors    = length(var.cache_behaviors) + 2  # default + API + SPA
    custom_domains     = length(var.domain_aliases)
    ssl_enabled        = var.ssl_certificate_arn != ""
    waf_enabled        = var.enable_waf
    edge_routing       = var.enable_edge_routing
    real_time_logs     = var.enable_real_time_logs
  }
}

# Deployment information
output "deployment_commands" {
  description = "Commands to deploy assets to CDN"
  value = {
    aws_cli_sync = "aws s3 sync ./build s3://${aws_s3_bucket.assets.id}/ --delete --cache-control 'max-age=31536000'"
    invalidation = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.main.id} --paths '/*'"
    upload_with_versioning = "aws s3 cp ./build s3://${aws_s3_bucket.assets.id}/ --recursive --cache-control 'max-age=31536000' --metadata-directive REPLACE"
  }
}

# Security information
output "security_headers" {
  description = "Applied security headers"
  value = {
    hsts_enabled = var.security_headers_enabled
    csp_enabled  = var.security_headers_enabled
    frame_options = "DENY"
    content_type_options = "nosniff"
    referrer_policy = "strict-origin-when-cross-origin"
  }
}
#!/bin/bash

# deploy-to-cdn.sh - Deploy frontend assets to CDN with optimization
# Usage: ./deploy-to-cdn.sh [environment] [--skip-build] [--invalidate-all]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT=${1:-production}
SKIP_BUILD=${2:-false}
INVALIDATE_ALL=${3:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Environment-specific configuration
case $ENVIRONMENT in
  production)
    S3_BUCKET="madplan-prod-static-assets"
    DISTRIBUTION_ID="E1234567890ABC"  # Replace with actual distribution ID
    DOMAIN="https://madplan.com"
    ;;
  staging)
    S3_BUCKET="madplan-staging-static-assets"
    DISTRIBUTION_ID="E0987654321XYZ"  # Replace with actual distribution ID
    DOMAIN="https://staging.madplan.com"
    ;;
  *)
    echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
    echo "Usage: $0 [production|staging] [--skip-build] [--invalidate-all]"
    exit 1
    ;;
esac

# Logging function
log() {
  echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check dependencies
check_dependencies() {
  local missing_deps=()
  
  # Check for required tools
  command -v node >/dev/null 2>&1 || missing_deps+=("node")
  command -v npm >/dev/null 2>&1 || missing_deps+=("npm")
  command -v aws >/dev/null 2>&1 || missing_deps+=("aws-cli")
  command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
  
  if [ ${#missing_deps[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing dependencies: ${missing_deps[*]}${NC}"
    exit 1
  fi
  
  # Check AWS credentials
  if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Dependencies check passed${NC}"
}

# Build optimization
optimize_build() {
  log "${BLUE}🔧 Optimizing build for CDN deployment...${NC}"
  
  # Set build environment variables for optimization
  export REACT_APP_CDN_URL="$DOMAIN"
  export GENERATE_SOURCEMAP=false
  export INLINE_RUNTIME_CHUNK=false
  export IMAGE_INLINE_SIZE_LIMIT=0
  
  # Production optimizations
  if [ "$ENVIRONMENT" = "production" ]; then
    export NODE_ENV=production
    export REACT_APP_ENVIRONMENT=production
    export REACT_APP_API_URL="https://api.madplan.com"
  else
    export NODE_ENV=staging
    export REACT_APP_ENVIRONMENT=staging
    export REACT_APP_API_URL="https://api-staging.madplan.com"
  fi
  
  log "Environment variables set for $ENVIRONMENT"
}

# Build the application
build_application() {
  if [ "$SKIP_BUILD" = "--skip-build" ]; then
    log "${YELLOW}⏭️ Skipping build step${NC}"
    return
  fi
  
  log "${BLUE}🏗️ Building application...${NC}"
  
  cd "$PROJECT_ROOT"
  
  # Clean previous build
  rm -rf build/
  
  # Install dependencies if needed
  if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
    log "Installing dependencies..."
    npm ci
  fi
  
  # Run build with optimizations
  npm run build
  
  # Verify build output
  if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo -e "${RED}❌ Build failed - no build output found${NC}"
    exit 1
  fi
  
  log "${GREEN}✅ Build completed successfully${NC}"
}

# Optimize assets for CDN
optimize_assets() {
  log "${BLUE}⚡ Optimizing assets for CDN...${NC}"
  
  cd "$PROJECT_ROOT/build"
  
  # Add cache control headers based on file type
  find . -name "*.html" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
    --cache-control "max-age=0, no-cache, no-store, must-revalidate" \
    --content-type "text/html" --dryrun \; 2>/dev/null || true
    
  find . -name "*.js" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
    --cache-control "max-age=31536000, immutable" \
    --content-type "application/javascript" --dryrun \; 2>/dev/null || true
    
  find . -name "*.css" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
    --cache-control "max-age=31536000, immutable" \
    --content-type "text/css" --dryrun \; 2>/dev/null || true
    
  find . -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
    --cache-control "max-age=2592000" --dryrun \; 2>/dev/null || true
}

# Deploy to S3 with optimized settings
deploy_to_s3() {
  log "${BLUE}📦 Deploying to S3 bucket: $S3_BUCKET${NC}"
  
  cd "$PROJECT_ROOT/build"
  
  # Sync files with appropriate cache headers
  
  # HTML files - no cache
  log "Uploading HTML files..."
  find . -name "*.html" -type f | while read -r file; do
    aws s3 cp "$file" "s3://$S3_BUCKET/$file" \
      --cache-control "max-age=0, no-cache, no-store, must-revalidate" \
      --content-type "text/html" \
      --metadata-directive REPLACE
  done
  
  # JavaScript files - long cache
  log "Uploading JavaScript files..."
  find . -name "*.js" -type f | while read -r file; do
    aws s3 cp "$file" "s3://$S3_BUCKET/$file" \
      --cache-control "max-age=31536000, immutable" \
      --content-type "application/javascript" \
      --metadata-directive REPLACE
  done
  
  # CSS files - long cache
  log "Uploading CSS files..."
  find . -name "*.css" -type f | while read -r file; do
    aws s3 cp "$file" "s3://$S3_BUCKET/$file" \
      --cache-control "max-age=31536000, immutable" \
      --content-type "text/css" \
      --metadata-directive REPLACE
  done
  
  # Image files - medium cache
  log "Uploading image files..."
  find . \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" \) -type f | while read -r file; do
    # Determine content type
    case "$file" in
      *.png) content_type="image/png" ;;
      *.jpg|*.jpeg) content_type="image/jpeg" ;;
      *.gif) content_type="image/gif" ;;
      *.svg) content_type="image/svg+xml" ;;
      *.ico) content_type="image/x-icon" ;;
      *) content_type="application/octet-stream" ;;
    esac
    
    aws s3 cp "$file" "s3://$S3_BUCKET/$file" \
      --cache-control "max-age=2592000" \
      --content-type "$content_type" \
      --metadata-directive REPLACE
  done
  
  # Font files - long cache
  log "Uploading font files..."
  find . \( -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.eot" \) -type f | while read -r file; do
    case "$file" in
      *.woff) content_type="font/woff" ;;
      *.woff2) content_type="font/woff2" ;;
      *.ttf) content_type="font/ttf" ;;
      *.eot) content_type="application/vnd.ms-fontobject" ;;
      *) content_type="application/octet-stream" ;;
    esac
    
    aws s3 cp "$file" "s3://$S3_BUCKET/$file" \
      --cache-control "max-age=31536000, immutable" \
      --content-type "$content_type" \
      --metadata-directive REPLACE
  done
  
  # Other files - default cache
  log "Uploading other files..."
  find . -type f ! \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" -o -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.eot" \) | while read -r file; do
    aws s3 cp "$file" "s3://$S3_BUCKET/$file" \
      --cache-control "max-age=86400" \
      --metadata-directive REPLACE
  done
  
  # Set website configuration if needed
  aws s3 website "s3://$S3_BUCKET" \
    --index-document index.html \
    --error-document index.html || true
  
  log "${GREEN}✅ Deployment to S3 completed${NC}"
}

# Invalidate CloudFront cache
invalidate_cache() {
  log "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
  
  local paths_to_invalidate
  
  if [ "$INVALIDATE_ALL" = "--invalidate-all" ]; then
    paths_to_invalidate="/*"
    log "Invalidating all paths"
  else
    # Smart invalidation - only invalidate changed files
    paths_to_invalidate="/index.html /static/css/* /static/js/* /manifest.json /service-worker.js"
    log "Invalidating specific paths: $paths_to_invalidate"
  fi
  
  local invalidation_id
  invalidation_id=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths $paths_to_invalidate \
    --query 'Invalidation.Id' \
    --output text)
  
  if [ -n "$invalidation_id" ]; then
    log "Invalidation created with ID: $invalidation_id"
    log "Waiting for invalidation to complete..."
    
    # Wait for invalidation to complete (with timeout)
    local timeout=300  # 5 minutes
    local elapsed=0
    local status="InProgress"
    
    while [ "$status" = "InProgress" ] && [ $elapsed -lt $timeout ]; do
      sleep 10
      elapsed=$((elapsed + 10))
      
      status=$(aws cloudfront get-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --id "$invalidation_id" \
        --query 'Invalidation.Status' \
        --output text 2>/dev/null || echo "InProgress")
      
      if [ $((elapsed % 30)) -eq 0 ]; then
        log "Invalidation status: $status (${elapsed}s elapsed)"
      fi
    done
    
    if [ "$status" = "Completed" ]; then
      log "${GREEN}✅ Cache invalidation completed${NC}"
    else
      log "${YELLOW}⚠️ Cache invalidation still in progress${NC}"
    fi
  else
    echo -e "${RED}❌ Failed to create cache invalidation${NC}"
    exit 1
  fi
}

# Verify deployment
verify_deployment() {
  log "${BLUE}🔍 Verifying deployment...${NC}"
  
  # Check if main page loads
  local response_code
  response_code=$(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN" || echo "000")
  
  if [ "$response_code" = "200" ]; then
    log "${GREEN}✅ Main page accessible${NC}"
  else
    log "${YELLOW}⚠️ Main page returned HTTP $response_code${NC}"
  fi
  
  # Check if assets are cached properly
  local cache_control
  cache_control=$(curl -s -I "$DOMAIN/static/css/" | grep -i "cache-control" || echo "")
  
  if [ -n "$cache_control" ]; then
    log "Cache control header: $cache_control"
  fi
  
  # Check CloudFront headers
  local cf_cache
  cf_cache=$(curl -s -I "$DOMAIN" | grep -i "x-cache" || echo "")
  
  if [ -n "$cf_cache" ]; then
    log "CloudFront cache status: $cf_cache"
  fi
  
  log "${GREEN}✅ Deployment verification completed${NC}"
}

# Cleanup old assets (optional)
cleanup_old_assets() {
  log "${BLUE}🧹 Cleaning up old assets...${NC}"
  
  # Remove old versions (keep last 5 versions of versioned files)
  aws s3api list-object-versions \
    --bucket "$S3_BUCKET" \
    --query 'Versions[?IsLatest==`false`].[Key,VersionId]' \
    --output text | head -n -5 | while read -r key version_id; do
    if [ -n "$key" ] && [ -n "$version_id" ]; then
      aws s3api delete-object \
        --bucket "$S3_BUCKET" \
        --key "$key" \
        --version-id "$version_id" >/dev/null 2>&1 || true
    fi
  done
  
  log "${GREEN}✅ Cleanup completed${NC}"
}

# Generate deployment report
generate_report() {
  log "${BLUE}📊 Generating deployment report...${NC}"
  
  local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).json"
  
  cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date --iso-8601)",
    "environment": "$ENVIRONMENT",
    "domain": "$DOMAIN",
    "s3_bucket": "$S3_BUCKET",
    "distribution_id": "$DISTRIBUTION_ID",
    "build_skipped": $([ "$SKIP_BUILD" = "--skip-build" ] && echo "true" || echo "false"),
    "invalidation_type": $([ "$INVALIDATE_ALL" = "--invalidate-all" ] && echo "\"full\"" || echo "\"smart\"")
  },
  "assets": {
    "total_files": $(find "$PROJECT_ROOT/build" -type f 2>/dev/null | wc -l || echo "0"),
    "total_size": "$(du -sh "$PROJECT_ROOT/build" 2>/dev/null | cut -f1 || echo "unknown")",
    "html_files": $(find "$PROJECT_ROOT/build" -name "*.html" -type f 2>/dev/null | wc -l || echo "0"),
    "js_files": $(find "$PROJECT_ROOT/build" -name "*.js" -type f 2>/dev/null | wc -l || echo "0"),
    "css_files": $(find "$PROJECT_ROOT/build" -name "*.css" -type f 2>/dev/null | wc -l || echo "0"),
    "image_files": $(find "$PROJECT_ROOT/build" \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" \) -type f 2>/dev/null | wc -l || echo "0")
  },
  "verification": {
    "main_page_status": $(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN" 2>/dev/null || echo "\"unknown\""),
    "cdn_enabled": true
  }
}
EOF
  
  log "Deployment report saved to: $report_file"
  
  # Display summary
  echo -e "\n${BLUE}=== Deployment Summary ===${NC}"
  echo "Environment: $ENVIRONMENT"
  echo "Domain: $DOMAIN"
  echo "S3 Bucket: $S3_BUCKET"
  echo "Distribution ID: $DISTRIBUTION_ID"
  echo "Timestamp: $(date)"
  echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
}

# Main execution flow
main() {
  log "${BLUE}🚀 Starting CDN deployment for $ENVIRONMENT...${NC}"
  
  # Pre-flight checks
  check_dependencies
  
  # Build and optimize
  optimize_build
  build_application
  
  # Deploy to CDN
  deploy_to_s3
  invalidate_cache
  
  # Post-deployment
  verify_deployment
  cleanup_old_assets
  generate_report
  
  log "${GREEN}🎉 CDN deployment completed successfully!${NC}"
}

# Handle script arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
# MadPlan Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying and managing the MadPlan application infrastructure using Terraform, focusing on production-ready deployment with monitoring, security, and scalability.

## 🏗️ Architecture Overview

MadPlan uses a modern, scalable cloud architecture:

- **Frontend**: Vue 3 application deployed on Vercel
- **Backend**: NestJS API with auto-scaling EC2 instances behind ALB
- **Database**: MongoDB Atlas with automated backups
- **CDN**: Cloudflare for global content delivery
- **Monitoring**: Datadog for APM, CloudWatch for infrastructure
- **CI/CD**: GitHub Actions with blue-green deployments

## 📋 Prerequisites

### Required Tools
- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [AWS CLI](https://aws.amazon.com/cli/) >= 2.0
- [Docker](https://docker.com/) >= 20.0
- [Node.js](https://nodejs.org/) >= 20.0
- [Git](https://git-scm.com/) >= 2.30

### Required Accounts & Access
- AWS account with administrative access
- MongoDB Atlas account
- Cloudflare account with API access
- Datadog account for monitoring
- GitHub repository access
- Domain name registered and managed

### Environment Variables
Set these environment variables before deployment:

```bash
# AWS Configuration
export AWS_PROFILE=production
export AWS_REGION=us-east-1

# Terraform Backend
export TF_VAR_backend_bucket=madplan-terraform-state
export TF_VAR_backend_region=us-east-1

# MongoDB Atlas
export TF_VAR_mongodb_public_key=your-atlas-public-key
export TF_VAR_mongodb_private_key=your-atlas-private-key
export TF_VAR_mongodb_project_id=your-atlas-project-id

# Cloudflare
export TF_VAR_cloudflare_api_token=your-cloudflare-api-token
export TF_VAR_cloudflare_zone_id=your-cloudflare-zone-id

# Datadog
export TF_VAR_datadog_api_key=your-datadog-api-key
export TF_VAR_datadog_app_key=your-datadog-app-key

# Alerting
export TF_VAR_alert_email=alerts@madplan.com
export TF_VAR_slack_webhook_url=your-slack-webhook-url
```

## 🚀 Deployment Process

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/madplan.git
cd madplan/infrastructure/terraform

# Initialize Terraform
terraform init

# Create workspace for production
terraform workspace new production
terraform workspace select production
```

### 2. Plan Deployment

```bash
# Review the deployment plan
terraform plan -var-file="environments/production.tfvars" -out=production.tfplan

# Review plan output carefully
terraform show production.tfplan
```

### 3. Deploy Infrastructure

```bash
# Apply the infrastructure
terraform apply production.tfplan

# Note: Deployment takes approximately 15-20 minutes
# Monitor progress and address any issues
```

### 4. Post-Deployment Verification

```bash
# Verify infrastructure deployment
terraform output

# Check application health
curl -f https://madplan.com/api/health

# Verify monitoring dashboards
open https://app.datadoghq.com/dashboard/your-dashboard-id
```

## 📊 Monitoring & Observability

### Health Checks

The deployment includes comprehensive health monitoring:

- **Application Health**: `/api/health` endpoint
- **Load Balancer**: ELB health checks every 30 seconds
- **Database**: MongoDB Atlas monitoring
- **Infrastructure**: CloudWatch + Datadog integration

### Key Metrics to Monitor

#### Application Metrics
- Response time (target: <200ms P95)
- Error rate (target: <0.1%)
- Throughput (requests per second)
- Memory usage (target: <80%)
- CPU usage (target: <70%)

#### Infrastructure Metrics
- EC2 instance health
- Load balancer request count
- Database connections
- Cache hit ratio (Redis)
- CDN cache efficiency

### Alerting Rules

Critical alerts are configured for:

```yaml
Critical (PagerDuty + Slack):
  - Application down (5xx errors > 1%)
  - Database connection failures
  - Load balancer unhealthy targets > 50%
  - High error rate (>1% for 5 minutes)
  - SSL certificate expiry (< 30 days)

Warning (Slack):
  - High response time (>500ms P95)
  - Memory usage > 80%
  - CPU usage > 80%
  - Disk usage > 85%
  - Cache hit rate < 90%

Info (Slack):
  - Deployment completed
  - Auto-scaling events
  - Backup completed
```

## 🔐 Security Configuration

### SSL/TLS Configuration
- Automatic SSL certificate provisioning via Let's Encrypt
- TLS 1.2+ enforcement on all connections
- HSTS headers enabled
- SSL certificate auto-renewal

### WAF (Web Application Firewall)
- Rate limiting: 2000 requests per 5 minutes per IP
- SQL injection protection
- XSS attack prevention
- Bot detection and mitigation

### Network Security
- VPC with private/public subnet separation
- Security groups with minimal required access
- NACLs for additional network-level protection
- VPC Flow Logs enabled

### Data Protection
- Encryption at rest for all storage
- Encryption in transit for all communications
- Regular security scanning via Snyk
- Automated vulnerability patching

## 📈 Scaling Configuration

### Auto-Scaling Parameters

```yaml
Production Configuration:
  Min Instances: 2
  Max Instances: 10
  Desired Capacity: 3
  
  Scale Up Triggers:
    - CPU > 70% for 5 minutes
    - Memory > 80% for 5 minutes
    - Request count > 1000/minute
  
  Scale Down Triggers:
    - CPU < 20% for 10 minutes
    - Memory < 40% for 10 minutes
    - Request count < 100/minute
```

### Database Scaling
- MongoDB Atlas M30 cluster (production)
- Auto-scaling enabled
- Read replicas in multiple regions
- Automated backup with 30-day retention

## 🔄 Backup & Disaster Recovery

### Backup Strategy

#### Database Backups
- **Frequency**: Continuous (MongoDB Atlas)
- **Retention**: 30 days for production
- **Point-in-time Recovery**: Available
- **Cross-region**: Enabled

#### Application Data
- **Configuration**: Stored in Terraform state
- **Logs**: 30-day retention in CloudWatch
- **Metrics**: 13-month retention in Datadog

### Disaster Recovery Plan

#### RTO (Recovery Time Objective): 1 hour
#### RPO (Recovery Point Objective): 5 minutes

**Recovery Steps:**

1. **Database Recovery** (if needed)
   ```bash
   # Restore from point-in-time backup
   # Contact MongoDB Atlas support if needed
   ```

2. **Infrastructure Recovery**
   ```bash
   # Re-deploy infrastructure
   cd infrastructure/terraform
   terraform workspace select production
   terraform apply -var-file="environments/production.tfvars"
   ```

3. **Application Recovery**
   ```bash
   # Trigger new deployment
   gh workflow run "Backend CI/CD Pipeline" --ref main
   ```

4. **Verification**
   ```bash
   # Verify all services are operational
   curl -f https://madplan.com/api/health
   ```

## 🛠️ Operations Procedures

### Regular Maintenance

#### Weekly Tasks
- [ ] Review monitoring dashboards
- [ ] Check error rates and logs
- [ ] Verify backup completion
- [ ] Update security patches
- [ ] Review cost optimization

#### Monthly Tasks
- [ ] Capacity planning review
- [ ] Security audit
- [ ] Performance optimization
- [ ] Dependency updates
- [ ] DR testing

### Deployment Procedures

#### Standard Deployment
```bash
# 1. Create release branch
git checkout -b release/v1.2.0

# 2. Update version numbers
# Edit package.json versions

# 3. Create GitHub release
gh release create v1.2.0 --generate-notes

# 4. Monitor deployment
# GitHub Actions will automatically deploy
```

#### Hotfix Deployment
```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-fix

# 2. Make minimal required changes
# Focus only on critical fix

# 3. Test thoroughly
npm test
npm run test:e2e

# 4. Create emergency release
gh release create v1.2.1 --notes "Critical hotfix: description"
```

#### Rollback Procedure
```bash
# 1. Identify last known good version
gh release list

# 2. Rollback database if needed
# Use MongoDB Atlas point-in-time recovery

# 3. Rollback application
# GitHub Actions supports automatic rollback

# 4. Verify rollback success
curl -f https://madplan.com/api/health
```

## 📞 Support & Troubleshooting

### Emergency Contacts
- **Platform Team**: platform-team@madplan.com
- **On-Call Engineer**: +1-555-0123 (PagerDuty)
- **DevOps Lead**: devops-lead@madplan.com

### Common Issues

#### Application Not Responding
```bash
# Check load balancer health
aws elbv2 describe-target-health --target-group-arn <arn>

# Check EC2 instance status
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production"

# Check application logs
aws logs tail /aws/ec2/madplan-production
```

#### Database Connection Issues
```bash
# Check MongoDB Atlas status
# Login to Atlas console

# Check security group rules
aws ec2 describe-security-groups --group-ids <db-sg-id>

# Check connection from application
docker exec madplan-backend npm run test:connection
```

#### High Error Rate
```bash
# Check application logs
docker logs madplan-backend --since 1h

# Check Datadog error tracking
open https://app.datadoghq.com/apm/services

# Review recent deployments
gh run list --limit 10
```

### Performance Optimization

#### Database Optimization
- Monitor slow queries in Atlas
- Review index usage
- Consider read replicas for read-heavy operations
- Optimize connection pooling

#### Application Optimization
- Enable Redis caching
- Implement GraphQL query optimization
- Use CDN for static assets
- Optimize Docker image size

## 📝 Compliance & Governance

### Data Protection
- GDPR compliance implemented
- Data retention policies enforced
- User data export/deletion available
- Privacy controls enabled

### Audit Requirements
- All infrastructure changes tracked in Terraform
- Application deployments logged in GitHub
- Database access logged in Atlas
- Security events monitored in Datadog

### Change Management
- All changes require peer review
- Production deployments require approval
- Emergency changes documented post-deployment
- Regular security and compliance reviews

## 📚 Additional Resources

### Documentation
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Datadog APM Guide](https://docs.datadoghq.com/tracing/)

### Training Resources
- AWS Solutions Architect certification
- Terraform Associate certification
- Docker & Kubernetes training
- MongoDB Developer certification

---

**Document Version**: 1.0  
**Last Updated**: $(date +"%Y-%m-%d")  
**Next Review**: $(date -d "+3 months" +"%Y-%m-%d")
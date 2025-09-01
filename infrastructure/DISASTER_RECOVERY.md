# Disaster Recovery Playbook

This document provides comprehensive disaster recovery procedures for the MadPlan production environment.

## Overview

**Recovery Time Objective (RTO)**: 60 minutes  
**Recovery Point Objective (RPO)**: 15 minutes  
**DR Strategy**: Active-Passive with Cross-Region Replication

## Emergency Contact Information

| Role | Name | Phone | Email | Backup Contact |
|------|------|-------|-------|----------------|
| On-Call Engineer | Primary | +1-XXX-XXX-XXXX | oncall@madplan.com | Secondary |
| DevOps Lead | Lead Name | +1-XXX-XXX-XXXX | devops@madplan.com | Manager |
| Security Officer | Security Lead | +1-XXX-XXX-XXXX | security@madplan.com | CISO |
| Business Continuity | BC Manager | +1-XXX-XXX-XXXX | bc@madplan.com | CTO |

## Disaster Scenarios and Response

### Scenario 1: Complete Regional Outage

**Indicators:**
- All services in primary region unavailable
- AWS status page shows regional issues
- Multiple availability zones affected

**Response Steps:**

1. **Assessment (0-5 minutes)**
   ```bash
   # Check AWS status
   curl -s https://status.aws.amazon.com/
   
   # Verify outage scope
   aws ec2 describe-regions --region us-east-1
   aws ec2 describe-availability-zones --region us-east-1
   ```

2. **Activate DR Region (5-15 minutes)**
   ```bash
   # Switch to DR region
   export AWS_REGION=us-west-2
   
   # Verify DR infrastructure
   cd infrastructure/terraform
   terraform plan -var-file=environments/production-dr.tfvars
   
   # Scale up DR resources
   aws autoscaling update-auto-scaling-group \
     --auto-scaling-group-name madplan-asg-dr \
     --min-size 2 --desired-capacity 4 --max-size 10
   ```

3. **Database Failover (10-20 minutes)**
   ```bash
   # For MongoDB Atlas
   # Use Atlas UI to promote DR cluster to primary
   
   # For self-managed MongoDB
   # Restore from latest backup
   ./monitoring/scripts/backup-restore.sh restore-db mongodb-daily-latest
   ```

4. **DNS Cutover (15-25 minutes)**
   ```bash
   # Update Route 53 records
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456789 \
     --change-batch file://dns-failover.json
   ```

5. **Verification (20-30 minutes)**
   ```bash
   # Test application health
   curl -f https://api.madplan.com/health
   
   # Verify database connectivity
   mongosh --host dr-cluster.madplan.com
   
   # Check key user flows
   ./monitoring/scripts/health-check.sh --comprehensive
   ```

### Scenario 2: Database Corruption/Failure

**Indicators:**
- Database connection failures
- Data integrity errors
- Replica lag exceeding thresholds

**Response Steps:**

1. **Immediate Assessment (0-5 minutes)**
   ```bash
   # Check database status
   mongosh --host primary.madplan.com --eval "rs.status()"
   
   # Review recent logs
   tail -n 100 /var/log/mongodb/mongod.log
   
   # Check backup status
   ./monitoring/scripts/backup-restore.sh list daily
   ```

2. **Isolate and Stop Writes (5-10 minutes)**
   ```bash
   # Enable read-only mode
   kubectl patch deployment madplan-api \
     -p '{"spec":{"template":{"metadata":{"annotations":{"config.alpha.kubernetes.io/reload":"true"}},"spec":{"containers":[{"name":"api","env":[{"name":"READ_ONLY_MODE","value":"true"}]}]}}}}'
   
   # Stop background jobs
   kubectl scale deployment madplan-workers --replicas=0
   ```

3. **Database Recovery (10-40 minutes)**
   ```bash
   # Option A: Point-in-time recovery (if available)
   aws backup start-restore-job \
     --recovery-point-arn "arn:aws:backup:us-east-1:123456789:recovery-point:xxxxx" \
     --metadata OriginalSize=100GB,DatabaseType=MongoDB
   
   # Option B: Latest backup restoration
   ./monitoring/scripts/backup-restore.sh restore-db mongodb-daily-latest madplan_restored
   
   # Option C: Replica promotion
   mongosh --host secondary.madplan.com --eval "rs.stepDown()"
   ```

4. **Data Validation (35-45 minutes)**
   ```bash
   # Verify data integrity
   mongosh madplan_restored --eval "
     db.boards.count();
     db.users.count();
     db.cards.count();
   "
   
   # Check recent transactions
   ./scripts/validate-data-integrity.sh
   ```

5. **Service Restoration (40-60 minutes)**
   ```bash
   # Update database connection strings
   kubectl set env deployment/madplan-api DATABASE_URL=mongodb://restored-cluster/madplan
   
   # Disable read-only mode
   kubectl patch deployment madplan-api \
     -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","env":[{"name":"READ_ONLY_MODE","value":"false"}]}]}}}}'
   
   # Scale workers back up
   kubectl scale deployment madplan-workers --replicas=3
   ```

### Scenario 3: Application Failure/Corruption

**Indicators:**
- Application crashes or failures
- Code deployment issues
- Corrupted application files

**Response Steps:**

1. **Stop Traffic (0-2 minutes)**
   ```bash
   # Remove from load balancer
   aws elbv2 deregister-targets \
     --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/madplan-api/xxxxx \
     --targets Id=i-1234567890abcdef0
   
   # Or scale down to zero
   kubectl scale deployment madplan-api --replicas=0
   ```

2. **Identify Latest Good Backup (2-5 minutes)**
   ```bash
   # List recent application backups
   ./monitoring/scripts/backup-restore.sh list daily
   
   # Check application logs for last successful operation
   tail -n 500 /var/log/madplan/application.log
   ```

3. **Restore Application (5-25 minutes)**
   ```bash
   # Restore from backup
   ./monitoring/scripts/backup-restore.sh restore-app madplan-daily-20231201_120000
   
   # Or rollback deployment
   kubectl rollout undo deployment/madplan-api --to-revision=2
   ```

4. **Verification and Traffic Restoration (20-35 minutes)**
   ```bash
   # Test restored application
   curl -f http://localhost:3000/health
   
   # Re-register with load balancer
   aws elbv2 register-targets \
     --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/madplan-api/xxxxx \
     --targets Id=i-1234567890abcdef0
   
   # Or scale back up
   kubectl scale deployment madplan-api --replicas=3
   ```

### Scenario 4: Security Breach

**Indicators:**
- Unusual traffic patterns
- Unauthorized access alerts
- Data exfiltration warnings

**Response Steps:**

1. **Immediate Containment (0-5 minutes)**
   ```bash
   # Enable emergency security group
   aws ec2 authorize-security-group-ingress \
     --group-id sg-emergency \
     --protocol tcp --port 443 \
     --source-group sg-trusted-only
   
   # Revoke suspicious API keys
   ./scripts/revoke-api-keys.sh --suspicious
   
   # Enable enhanced logging
   aws logs put-retention-policy \
     --log-group-name /aws/ec2/madplan \
     --retention-in-days 90
   ```

2. **Assessment and Investigation (5-20 minutes)**
   ```bash
   # Review security logs
   aws logs filter-log-events \
     --log-group-name /aws/waf/madplan \
     --start-time $(date -d '1 hour ago' +%s)000
   
   # Check for data access
   mongosh madplan --eval "db.audit_log.find().sort({timestamp:-1}).limit(100)"
   
   # Review network traffic
   aws ec2 describe-flow-logs --filter Name=resource-id,Values=vpc-12345
   ```

3. **System Hardening (15-30 minutes)**
   ```bash
   # Force password reset for all users
   ./scripts/force-password-reset.sh --all-users
   
   # Rotate all secrets
   aws secretsmanager rotate-secret --secret-id madplan/prod/database
   aws secretsmanager rotate-secret --secret-id madplan/prod/jwt
   
   # Update security groups
   terraform apply -var-file=environments/security-lockdown.tfvars
   ```

4. **Communication and Recovery (25-60 minutes)**
   ```bash
   # Notify affected users
   ./scripts/send-security-notification.sh
   
   # Document incident
   ./scripts/create-incident-report.sh --type security --severity high
   
   # Gradual service restoration
   # (Only after thorough security review)
   ```

## Recovery Procedures

### Database Recovery

1. **MongoDB Point-in-Time Recovery**
   ```bash
   # Stop application
   kubectl scale deployment madplan-api --replicas=0
   
   # Create recovery instance
   aws ec2 run-instances \
     --image-id ami-recovery \
     --instance-type r5.2xlarge \
     --key-name recovery-key \
     --security-group-ids sg-database
   
   # Mount backup volume
   aws ec2 attach-volume \
     --volume-id vol-backup \
     --instance-id i-recovery \
     --device /dev/sdf
   
   # Restore from backup
   mongorestore --host localhost:27017 \
     --db madplan \
     --gzip \
     --drop \
     /mnt/backup/madplan
   
   # Replay oplog to desired point
   mongorestore --host localhost:27017 \
     --db madplan \
     --oplogReplay \
     --oplogLimit "$(date -d '15 minutes ago' +%s):1" \
     /mnt/backup/oplog.bson
   ```

2. **Application State Recovery**
   ```bash
   # Clear Redis cache
   redis-cli FLUSHALL
   
   # Rebuild search indexes
   curl -X POST https://api.madplan.com/admin/reindex
   
   # Verify user sessions
   ./scripts/validate-sessions.sh
   ```

### Infrastructure Recovery

1. **Terraform State Recovery**
   ```bash
   # Recover state from S3 backup
   aws s3 cp s3://madplan-terraform-state-backup/terraform.tfstate terraform.tfstate
   
   # Import existing resources
   terraform import aws_instance.web i-1234567890abcdef0
   terraform import aws_rds_instance.database madplan-prod-db
   
   # Plan and apply
   terraform plan -var-file=environments/production.tfvars
   terraform apply -var-file=environments/production.tfvars
   ```

2. **DNS and CDN Recovery**
   ```bash
   # Update DNS records
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456789 \
     --change-batch file://dns-recovery.json
   
   # Invalidate CDN cache
   aws cloudfront create-invalidation \
     --distribution-id E123456789 \
     --paths "/*"
   
   # Update CDN origins
   aws cloudfront update-distribution \
     --id E123456789 \
     --distribution-config file://cdn-config.json
   ```

## Testing and Validation

### Monthly DR Drill Checklist

- [ ] Test backup integrity
- [ ] Verify failover procedures
- [ ] Test database recovery
- [ ] Validate DNS switching
- [ ] Test communication procedures
- [ ] Review and update documentation
- [ ] Train team on procedures

### Recovery Validation Steps

1. **Application Health**
   ```bash
   # Health check endpoints
   curl -f https://api.madplan.com/health
   curl -f https://api.madplan.com/health/database
   curl -f https://api.madplan.com/health/redis
   
   # Performance validation
   ab -n 1000 -c 10 https://api.madplan.com/api/boards
   ```

2. **Data Integrity**
   ```bash
   # Run data validation scripts
   ./scripts/validate-data-integrity.sh
   
   # Check referential integrity
   mongosh madplan --eval "
     db.boards.find({owner: {\$exists: false}}).count();
     db.cards.find({board_id: {\$exists: false}}).count();
   "
   ```

3. **User Functionality**
   ```bash
   # Test key user flows
   ./tests/e2e/disaster-recovery.spec.js
   
   # Verify authentication
   curl -X POST https://api.madplan.com/auth/login \
     -d '{"email":"test@example.com","password":"test"}'
   ```

## Post-Recovery Actions

1. **Incident Documentation**
   - Root cause analysis
   - Timeline of events
   - Actions taken
   - Lessons learned

2. **System Improvements**
   - Update monitoring thresholds
   - Improve alerting
   - Enhance backup procedures
   - Update runbooks

3. **Team Communication**
   - Post-mortem meeting
   - Update procedures
   - Additional training
   - Documentation updates

## Monitoring and Alerting

### Critical Alerts
- Service unavailability > 1 minute
- Database connection failures
- Backup failures
- Security incidents
- Performance degradation > 50%

### Monitoring Dashboards
- [Production Dashboard](https://cloudwatch.amazonaws.com/dashboard/production)
- [Database Metrics](https://cloudwatch.amazonaws.com/dashboard/database)
- [Security Events](https://cloudwatch.amazonaws.com/dashboard/security)
- [Backup Status](https://cloudwatch.amazonaws.com/dashboard/backup)

## Contact Information

**Escalation Path:**
1. On-Call Engineer (immediate)
2. DevOps Lead (within 15 minutes)
3. Engineering Manager (within 30 minutes)
4. CTO (within 1 hour)

**External Contacts:**
- AWS Support: +1-206-266-4064 (Premium Support)
- MongoDB Atlas Support: Via console or phone
- CDN Provider Support: Via dashboard

---

**Last Updated:** $(date)  
**Next Review Date:** $(date -d '+3 months')  
**Document Owner:** DevOps Team
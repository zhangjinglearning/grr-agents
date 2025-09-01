# Service Recovery Runbook

## Quick Reference

### Emergency Commands
```bash
# Check all services
./scripts/health-check.sh

# Restart API service
./scripts/restart-service.sh api

# Database failover
./scripts/db-failover.sh

# Rollback deployment
./scripts/rollback.sh production
```

## API Service Recovery

### Symptoms
- HTTP 5xx errors increasing
- Response times >5 seconds
- Health check failures
- Memory/CPU exhaustion

### Diagnosis Steps
1. **Check Service Status**:
   ```bash
   curl -f https://api.madplan.com/health
   curl -s https://api.madplan.com/health/detailed | jq '.'
   ```

2. **Review Metrics**:
   ```bash
   # Check error rate (last 10 minutes)
   aws logs filter-log-events \
     --log-group-name /aws/ec2/madplan-api \
     --start-time $(date -d '10 minutes ago' +%s)000 \
     --filter-pattern "ERROR"
   ```

3. **Check Resource Usage**:
   ```bash
   # CPU and memory usage
   aws cloudwatch get-metric-statistics \
     --namespace AWS/EC2 \
     --metric-name CPUUtilization \
     --start-time $(date -d '30 minutes ago' --iso-8601) \
     --end-time $(date --iso-8601) \
     --period 300 \
     --statistics Average
   ```

### Recovery Actions

#### Level 1: Quick Fixes
1. **Restart Unhealthy Instances**:
   ```bash
   # Identify unhealthy instances
   aws elbv2 describe-target-health --target-group-arn <arn>
   
   # Restart specific instance
   aws ec2 reboot-instances --instance-ids i-1234567890abcdef0
   ```

2. **Clear Cache**:
   ```bash
   # Redis cache flush
   redis-cli FLUSHALL
   
   # Application cache clear
   curl -X POST https://api.madplan.com/cache/clear \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

#### Level 2: Scale Resources
1. **Scale Up Auto Scaling Group**:
   ```bash
   aws autoscaling update-auto-scaling-group \
     --auto-scaling-group-name madplan-api-asg \
     --desired-capacity 6 \
     --max-size 10
   ```

2. **Database Connection Pool Tuning**:
   ```bash
   # Increase connection pool size temporarily
   mongo madplan --eval "
     db.adminCommand({
       setParameter: 1,
       maxIncomingConnections: 1000
     })
   "
   ```

#### Level 3: Rollback
1. **Application Rollback**:
   ```bash
   ./scripts/rollback.sh production
   
   # Verify rollback
   curl -s https://api.madplan.com/version
   ```

2. **Database Migration Rollback** (if needed):
   ```bash
   npm run migrate:down
   ```

## Database Recovery

### MongoDB Replica Set Issues

#### Primary Node Failure
1. **Check Replica Set Status**:
   ```bash
   mongo --eval "rs.status()"
   ```

2. **Force Election** (if automatic failover fails):
   ```bash
   mongo --eval "rs.stepDown(60)"
   ```

3. **Verify New Primary**:
   ```bash
   mongo --eval "rs.isMaster()"
   ```

#### Split Brain or Network Partition
1. **Reconfigure Replica Set**:
   ```bash
   mongo --eval "
     var config = rs.config();
     config.members[2].priority = 0;
     rs.reconfig(config, {force: true});
   "
   ```

### Database Performance Issues

#### High CPU/Memory Usage
1. **Identify Slow Queries**:
   ```bash
   mongo --eval "
     db.setProfilingLevel(2, {slowms: 100});
     db.system.profile.find().sort({ts: -1}).limit(10);
   "
   ```

2. **Kill Long-Running Operations**:
   ```bash
   mongo --eval "
     db.currentOp({'active': true, 'secs_running': {\$gt: 300}})
       .inprog.forEach(function(op) { db.killOp(op.opid); });
   "
   ```

#### Lock Contention
1. **Check Current Operations**:
   ```bash
   mongo --eval "db.currentOp()"
   ```

2. **Release Locks**:
   ```bash
   mongo --eval "db.fsyncUnlock()"
   ```

### Data Corruption Recovery
1. **Stop Application**:
   ```bash
   aws autoscaling update-auto-scaling-group \
     --auto-scaling-group-name madplan-api-asg \
     --desired-capacity 0
   ```

2. **Repair Database**:
   ```bash
   mongod --repair --dbpath /data/db
   ```

3. **Point-in-Time Recovery** (if repair fails):
   ```bash
   ./scripts/restore-backup.sh $(date -d '1 hour ago' +%Y%m%d%H%M)
   ```

## Load Balancer Recovery

### Health Check Failures
1. **Check Target Group Health**:
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn arn:aws:elasticloadbalancing:...
   ```

2. **Update Health Check Settings**:
   ```bash
   aws elbv2 modify-target-group \
     --target-group-arn arn:aws:elasticloadbalancing:... \
     --health-check-interval-seconds 10 \
     --healthy-threshold-count 2
   ```

### SSL Certificate Issues
1. **Check Certificate Expiration**:
   ```bash
   aws acm list-certificates --certificate-statuses ISSUED
   ```

2. **Update Listener Certificate**:
   ```bash
   aws elbv2 modify-listener \
     --listener-arn arn:aws:elasticloadbalancing:... \
     --certificates CertificateArn=arn:aws:acm:...
   ```

## CDN and Static Assets

### CloudFront Distribution Issues
1. **Check Distribution Status**:
   ```bash
   aws cloudfront get-distribution --id E1234567890123
   ```

2. **Invalidate Cache**:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id E1234567890123 \
     --paths "/*"
   ```

3. **Failover to S3 Direct**:
   ```bash
   # Update DNS to point to S3 bucket directly
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456789 \
     --change-batch file://failover-to-s3.json
   ```

## External Service Dependencies

### Third-Party API Failures

#### Implement Circuit Breaker
```bash
# Enable circuit breaker in application
curl -X POST https://api.madplan.com/config/circuit-breaker \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "failureThreshold": 5}'
```

#### Fallback to Cached Data
```bash
# Enable cached response mode
curl -X POST https://api.madplan.com/config/cache-mode \
  -H "Content-Type: application/json" \
  -d '{"fallbackEnabled": true, "ttl": 3600}'
```

## Security Incident Response

### Suspected Security Breach
1. **Immediate Actions**:
   ```bash
   # Block suspicious IP addresses
   aws ec2 authorize-security-group-ingress \
     --group-id sg-12345678 \
     --protocol tcp --port 443 \
     --source-group sg-87654321
   
   # Enable detailed logging
   aws logs put-retention-policy \
     --log-group-name /aws/ec2/madplan-api \
     --retention-in-days 90
   ```

2. **Isolate Affected Systems**:
   ```bash
   # Remove from load balancer
   aws elbv2 deregister-targets \
     --target-group-arn arn:aws:elasticloadbalancing:... \
     --targets Id=i-1234567890abcdef0
   ```

### DDoS Attack
1. **Enable AWS Shield**:
   ```bash
   aws shield create-protection \
     --name madplan-api-protection \
     --resource-arn arn:aws:elasticloadbalancing:...
   ```

2. **Rate Limiting**:
   ```bash
   # Update rate limiting rules
   aws wafv2 update-web-acl \
     --scope CLOUDFRONT \
     --id 12345678-1234-1234-1234-123456789012 \
     --default-action Allow={} \
     --rules file://rate-limit-rules.json
   ```

## Monitoring Service Recovery

### Datadog Agent Issues
1. **Restart Agent**:
   ```bash
   sudo systemctl restart datadog-agent
   sudo systemctl status datadog-agent
   ```

2. **Check Agent Status**:
   ```bash
   sudo datadog-agent status
   ```

### CloudWatch Agent
1. **Restart CloudWatch Agent**:
   ```bash
   sudo systemctl restart amazon-cloudwatch-agent
   ```

2. **Reconfigure Agent**:
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json -s
   ```

## Communication During Incidents

### Slack Notifications
```bash
# Send incident alert
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 API Service Degraded - Investigating"}' \
  $SLACK_WEBHOOK_URL
```

### Status Page Updates
```bash
# Update status page (if using external service)
curl -X PATCH https://api.statuspage.io/v1/pages/$PAGE_ID/incidents/$INCIDENT_ID \
  -H "Authorization: OAuth $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"incident": {"status": "investigating", "message": "API response times degraded"}}'
```

## Recovery Verification

### Health Check Script
```bash
#!/bin/bash
# health-check-complete.sh

echo "=== Complete System Health Check ==="

# API Health
echo "Checking API health..."
curl -f https://api.madplan.com/health || echo "❌ API unhealthy"

# Database Health
echo "Checking database..."
mongo --quiet --eval "db.adminCommand('ismaster').ismaster" && echo "✅ DB healthy" || echo "❌ DB unhealthy"

# Load Balancer
echo "Checking load balancer..."
aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN \
  | jq -r '.TargetHealthDescriptions[] | select(.TargetHealth.State != "healthy") | "❌ Unhealthy target: " + .Target.Id'

# Core Web Vitals
echo "Checking frontend performance..."
curl -s "https://api.madplan.com/metrics/web-vitals/health" | jq '.status' | grep -q "healthy" && echo "✅ Performance healthy" || echo "⚠️ Performance issues"

echo "=== Health Check Complete ==="
```

### Performance Validation
```bash
#!/bin/bash
# performance-check.sh

echo "=== Performance Validation ==="

# API Response Time
response_time=$(curl -o /dev/null -s -w '%{time_total}' https://api.madplan.com/api/boards)
if (( $(echo "$response_time < 1.0" | bc -l) )); then
  echo "✅ API response time: ${response_time}s"
else
  echo "⚠️ API response time: ${response_time}s (>1s)"
fi

# Database Query Performance
mongo --quiet --eval "
  var start = new Date();
  db.boards.find().limit(10).toArray();
  var end = new Date();
  var duration = end - start;
  if (duration < 100) {
    print('✅ DB query time: ' + duration + 'ms');
  } else {
    print('⚠️ DB query time: ' + duration + 'ms (>100ms)');
  }
"

echo "=== Performance Validation Complete ==="
```

## Disaster Recovery Procedures

### Full System Recovery
1. **Activate DR Environment**:
   ```bash
   # Switch DNS to DR region
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456789 \
     --change-batch file://dr-failover.json
   ```

2. **Restore from Backup**:
   ```bash
   # Restore database from latest backup
   ./scripts/restore-backup.sh latest
   
   # Sync application state
   ./scripts/sync-app-state.sh
   ```

3. **Validate DR Environment**:
   ```bash
   ./scripts/health-check.sh dr-environment
   ```

### Rollback to Previous State
1. **Application Rollback**:
   ```bash
   git checkout $LAST_KNOWN_GOOD_COMMIT
   ./scripts/deploy.sh production --force
   ```

2. **Database Rollback**:
   ```bash
   ./scripts/restore-backup.sh $(date -d '2 hours ago' +%Y%m%d%H%M)
   ```

3. **Verify Rollback**:
   ```bash
   ./scripts/health-check-complete.sh
   ```

## Post-Recovery Actions

### Log Collection
```bash
#!/bin/bash
# collect-incident-logs.sh

INCIDENT_ID=$1
START_TIME=$2
END_TIME=$3

mkdir -p logs/incident-$INCIDENT_ID

# Collect application logs
aws logs filter-log-events \
  --log-group-name /aws/ec2/madplan-api \
  --start-time $START_TIME \
  --end-time $END_TIME > logs/incident-$INCIDENT_ID/application.log

# Collect system metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --start-time $START_TIME \
  --end-time $END_TIME > logs/incident-$INCIDENT_ID/cpu-metrics.json

echo "Logs collected in logs/incident-$INCIDENT_ID/"
```

### Recovery Report Template
```markdown
# Recovery Report - [INCIDENT_ID]

## Summary
- **Start Time**: [UTC]
- **End Time**: [UTC]
- **Duration**: [Duration]
- **Services Affected**: [List]

## Recovery Actions Taken
1. [Action 1 with timestamp]
2. [Action 2 with timestamp]
3. [Action 3 with timestamp]

## Verification Results
- [ ] API health check passing
- [ ] Database connectivity verified
- [ ] Performance within SLA
- [ ] Error rates normalized

## Lessons Learned
- **Detection**: How was the issue detected?
- **Response**: What worked well?
- **Improvements**: What could be improved?

## Next Steps
- [ ] Post-mortem scheduled
- [ ] Monitoring improvements identified
- [ ] Documentation updates needed
```
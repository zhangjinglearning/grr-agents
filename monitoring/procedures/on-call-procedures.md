# On-Call Procedures and Incident Response

## Overview

This document defines the on-call procedures, escalation paths, and incident response workflows for the MadPlan production environment.

## On-Call Schedule

### Primary On-Call
- **Duration**: 1 week rotations
- **Coverage**: 24/7 availability
- **Response Time SLA**: 15 minutes for P0/P1, 1 hour for P2

### Secondary On-Call
- **Role**: Backup for primary on-call
- **Coverage**: Escalation path when primary unavailable
- **Response Time SLA**: 30 minutes after escalation

## Incident Severity Levels

### P0 - Critical (Sev 1)
- **Definition**: Complete service outage or data loss
- **Examples**: 
  - Database completely unavailable
  - Authentication system down
  - Critical security breach
- **Response Time**: 15 minutes
- **Escalation**: Immediate to management
- **Communication**: All stakeholders within 30 minutes

### P1 - High (Sev 2)
- **Definition**: Major feature unavailable or severe performance degradation
- **Examples**:
  - API response times >5 seconds
  - Board/task functionality broken
  - Payment system issues
- **Response Time**: 15 minutes
- **Escalation**: 1 hour if no progress
- **Communication**: Stakeholders within 1 hour

### P2 - Medium (Sev 3)
- **Definition**: Minor feature issues or moderate performance impact
- **Examples**:
  - Non-critical API endpoints slow
  - UI rendering issues
  - Non-essential integrations down
- **Response Time**: 1 hour
- **Escalation**: 4 hours if no progress
- **Communication**: Daily standup or Slack updates

### P3 - Low (Sev 4)
- **Definition**: Cosmetic issues or minimal impact
- **Examples**:
  - Typos in UI
  - Non-critical logging errors
  - Documentation issues
- **Response Time**: Next business day
- **Escalation**: Weekly review
- **Communication**: Ticket tracking only

## Alert Routing and Escalation

### Primary Alert Channels
1. **PagerDuty** (if available) or **Phone/SMS**
2. **Slack** (#incidents channel)
3. **Email** (backup)

### Escalation Matrix
```
P0/P1 Alert → Primary On-Call (15min) → Secondary On-Call (30min) → Team Lead (45min) → Engineering Manager (60min)

P2 Alert → Primary On-Call (1hr) → Secondary On-Call (4hr) → Team Lead (8hr)

P3 Alert → Ticket Creation → Next Business Day Review
```

## Incident Response Procedures

### Step 1: Acknowledge and Assess (0-5 minutes)
1. **Acknowledge Alert**: Confirm receipt via PagerDuty/Slack
2. **Initial Assessment**: 
   - Check monitoring dashboards
   - Verify service health endpoints
   - Assess scope and impact
3. **Severity Classification**: Assign P0-P3 based on impact
4. **Communication**: Post initial status in #incidents

### Step 2: Investigate and Diagnose (5-30 minutes)
1. **Gather Information**:
   - Check recent deployments/changes
   - Review error logs and metrics
   - Examine database performance
   - Verify third-party service status
2. **Create Incident Ticket**: Use template below
3. **Start War Room**: For P0/P1 incidents
4. **Update Stakeholders**: Provide 15-minute updates for P0/P1

### Step 3: Mitigation and Resolution (30 minutes - 4 hours)
1. **Immediate Mitigation**:
   - Rollback recent deployments if needed
   - Scale resources if capacity issue
   - Failover to backup systems
   - Disable problematic features
2. **Root Cause Analysis**:
   - Identify underlying cause
   - Document findings in incident ticket
3. **Permanent Fix**:
   - Implement proper solution
   - Verify fix in staging
   - Deploy with monitoring

### Step 4: Communication and Documentation (Ongoing)
1. **Status Updates**:
   - P0/P1: Every 15-30 minutes
   - P2: Every 2-4 hours
   - P3: Daily or as needed
2. **Resolution Notification**: All affected stakeholders
3. **Post-Incident Review**: Schedule within 48 hours for P0/P1

## Incident Ticket Template

```markdown
# Incident Report - [YYYY-MM-DD] [Brief Description]

## Incident Details
- **Incident ID**: INC-[YYYY-MM-DD]-[###]
- **Severity**: P[0-3]
- **Start Time**: [UTC timestamp]
- **End Time**: [UTC timestamp]
- **Duration**: [HH:MM]
- **Status**: Investigating/Mitigating/Resolved

## Impact Assessment
- **Affected Services**: 
- **User Impact**: 
- **Business Impact**: 
- **Data Loss**: Yes/No

## Timeline
- **[HH:MM]** - Alert triggered
- **[HH:MM]** - Incident acknowledged
- **[HH:MM]** - Investigation started
- **[HH:MM]** - Mitigation implemented
- **[HH:MM]** - Issue resolved

## Root Cause Analysis
- **Primary Cause**: 
- **Contributing Factors**: 
- **Detection Method**: Monitoring/User Report/Internal

## Mitigation Actions
1. **Immediate Actions**: 
2. **Temporary Workaround**: 
3. **Permanent Fix**: 

## Prevention Measures
- **Short-term**: 
- **Long-term**: 
- **Monitoring Improvements**: 
- **Process Changes**: 

## Lessons Learned
- **What Went Well**: 
- **Areas for Improvement**: 
- **Action Items**: [Assign owners and due dates]
```

## Runbooks by Service

### API Service Issues
1. **Check Health Endpoints**:
   ```bash
   curl -f https://api.madplan.com/health
   curl -f https://api.madplan.com/health/detailed
   ```

2. **Check Application Metrics**:
   - Datadog Dashboard: "API Performance Overview"
   - Key Metrics: Response time, error rate, throughput

3. **Database Connectivity**:
   ```bash
   # Check MongoDB connection
   mongo --eval "db.adminCommand('ismaster')"
   
   # Check connection pool status
   curl -s https://api.madplan.com/health/detailed | jq '.database'
   ```

4. **Common Fixes**:
   - Restart unhealthy instances
   - Scale up if CPU/memory high
   - Clear Redis cache if data inconsistency

### Database Issues
1. **MongoDB Health Check**:
   ```bash
   # Check replica set status
   mongo --eval "rs.status()"
   
   # Check database locks
   mongo --eval "db.currentOp()"
   ```

2. **Performance Issues**:
   - Check slow query log
   - Monitor connection pool metrics
   - Verify index usage

3. **Recovery Procedures**:
   - Failover to secondary replica
   - Point-in-time recovery from backup
   - Data integrity verification

### Frontend Issues
1. **CDN Status**: Check CloudFront distribution
2. **Asset Delivery**: Verify static asset accessibility
3. **Performance**: Check Core Web Vitals metrics
4. **Rollback**: Revert to previous deployment

### Third-Party Dependencies
1. **External APIs**:
   - Check status pages
   - Verify API keys and rate limits
   - Test connectivity and response times

2. **Monitoring Services**:
   - Datadog status page
   - Sentry status page
   - CloudWatch service health

## Communication Templates

### Initial Alert Template
```
🚨 **Incident Alert - P[X]** 🚨

**Service**: [Service Name]
**Impact**: [Brief description]
**Status**: Investigating
**ETA**: [If known]
**Updates**: Will provide updates every [X] minutes

#incident #p[x]
```

### Update Template
```
📊 **Incident Update - [Time]** 📊

**Status**: [Investigating/Mitigating/Resolved]
**Progress**: [What's been done]
**Next Steps**: [What's next]
**ETA**: [If known]

#incident #update
```

### Resolution Template
```
✅ **Incident Resolved - [Time]** ✅

**Duration**: [HH:MM]
**Root Cause**: [Brief description]
**Fix Applied**: [What was done]
**Post-Mortem**: [When scheduled]

Thank you for your patience.

#incident #resolved
```

## Post-Incident Process

### Post-Mortem Meeting (Required for P0/P1)
1. **Schedule**: Within 48 hours of resolution
2. **Attendees**: 
   - Incident responders
   - Service owners
   - Engineering management
3. **Agenda**:
   - Timeline review
   - Root cause analysis
   - Action item assignment
   - Process improvements

### Action Item Tracking
- **Owner Assignment**: Each action item has clear owner
- **Due Dates**: Specific timelines for completion
- **Follow-up**: Weekly review in team meetings
- **Closure**: Verification and documentation

### Learning and Improvement
1. **Runbook Updates**: Based on incident learnings
2. **Monitoring Improvements**: Better detection and alerting
3. **Process Refinement**: Update procedures based on experience
4. **Training**: Share knowledge across team

## Tools and Resources

### Monitoring and Alerting
- **Datadog**: https://app.datadoghq.com
- **CloudWatch**: AWS Console → CloudWatch
- **Sentry**: https://sentry.io
- **Application Health**: https://api.madplan.com/health

### Communication
- **Slack**: #incidents, #engineering
- **Email**: engineering-alerts@company.com
- **PagerDuty**: [If implemented]

### Documentation
- **Runbooks**: `/monitoring/runbooks/`
- **Architecture Diagrams**: `/docs/architecture/`
- **Deployment Procedures**: `/.github/workflows/`

### Access and Credentials
- **AWS Console**: [Access instructions]
- **MongoDB Atlas**: [Access instructions]
- **Datadog**: [Access instructions]
- **Sentry**: [Access instructions]

## On-Call Handoff Checklist

### Weekly Handoff Process
1. **Review Active Incidents**: Status and next steps
2. **Check Monitoring Health**: Verify all alerts working
3. **Review Recent Changes**: Deployments and configuration updates
4. **Update Contact Information**: Ensure current phone/email
5. **Test Alert Routing**: Verify notifications working
6. **Knowledge Transfer**: Share any ongoing issues or concerns

### Emergency Contact Information
- **Primary On-Call**: [Phone/Email]
- **Secondary On-Call**: [Phone/Email]
- **Engineering Manager**: [Phone/Email]
- **DevOps Lead**: [Phone/Email]
- **Security Team**: [Phone/Email]

## Metrics and Reporting

### Incident Metrics (Monthly)
- **MTTR** (Mean Time To Recovery)
- **MTTD** (Mean Time To Detection)
- **Incident Volume** by severity
- **False Positive Rate**
- **Customer Impact Hours**

### On-Call Quality Metrics
- **Response Time Compliance**
- **Escalation Rate**
- **Resolution Time by Severity**
- **Post-Mortem Completion Rate**

### Continuous Improvement
- **Monthly Review**: Incident trends and patterns
- **Quarterly Assessment**: Process effectiveness
- **Annual Planning**: Tool and process improvements
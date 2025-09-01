import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudWatchLogs } from 'aws-sdk';
import { SNS } from 'aws-sdk';

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  clientInfo: {
    ip: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    origin?: string;
    referer?: string;
  };
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface AuditLog {
  id?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  clientInfo?: {
    ip: string;
    userAgent: string;
    sessionId?: string;
  };
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

/**
 * Comprehensive audit and security logging service
 * Handles all security events and compliance logging
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private cloudWatchLogs: CloudWatchLogs;
  private sns: SNS;

  constructor(
    private configService: ConfigService,
    @InjectModel('AuditLog') private auditLogModel: Model<AuditLog>,
    @InjectModel('SecurityEvent') private securityEventModel: Model<SecurityEvent>,
  ) {
    this.initializeAWSServices();
  }

  /**
   * Initialize AWS services for logging and alerting
   */
  private initializeAWSServices() {
    const region = this.configService.get('AWS_REGION');
    
    this.cloudWatchLogs = new CloudWatchLogs({ region });
    this.sns = new SNS({ region });
  }

  /**
   * Log security events with automatic alerting
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Add timestamp if not provided
      if (!event.timestamp) {
        event.timestamp = new Date();
      }

      // Store in database for compliance
      const securityEvent = new this.securityEventModel(event);
      await securityEvent.save();

      // Log to CloudWatch
      await this.logToCloudWatch('security', event);

      // Send alerts based on severity
      await this.handleSecurityAlert(event);

      this.logger.log(`Security event logged: ${event.type}`, {
        severity: event.severity,
        clientIp: event.clientInfo.ip,
        userId: event.clientInfo.userId,
      });

    } catch (error) {
      this.logger.error('Failed to log security event', error, {
        eventType: event.type,
        severity: event.severity,
      });
    }
  }

  /**
   * Log user actions for compliance and audit trail
   */
  async logAuditEvent(auditLog: AuditLog): Promise<void> {
    try {
      // Add timestamp if not provided
      if (!auditLog.timestamp) {
        auditLog.timestamp = new Date();
      }

      // Store in database
      const log = new this.auditLogModel(auditLog);
      await log.save();

      // Log to CloudWatch for compliance
      await this.logToCloudWatch('audit', auditLog);

      // Check for sensitive operations requiring additional logging
      if (this.isSensitiveOperation(auditLog.action)) {
        await this.logSensitiveOperation(auditLog);
      }

    } catch (error) {
      this.logger.error('Failed to log audit event', error, {
        action: auditLog.action,
        resource: auditLog.resource,
        userId: auditLog.userId,
      });
    }
  }

  /**
   * Log authentication events
   */
  async logAuthenticationEvent(
    type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'mfa_challenge' | 'mfa_success' | 'mfa_failed',
    userId?: string,
    clientInfo?: any,
    details?: Record<string, any>
  ): Promise<void> {
    const severity = this.getAuthEventSeverity(type);
    
    await this.logSecurityEvent({
      type: `auth_${type}`,
      severity,
      clientInfo: clientInfo || { ip: 'unknown', userAgent: 'unknown' },
      metadata: {
        userId,
        authEvent: type,
        ...details,
      },
    });

    // Also log as audit event for compliance
    await this.logAuditEvent({
      userId,
      action: type,
      resource: 'authentication',
      details,
      clientInfo,
      timestamp: new Date(),
      success: !type.includes('failed'),
      errorMessage: type.includes('failed') ? details?.error : undefined,
    });
  }

  /**
   * Log data access events (GDPR compliance)
   */
  async logDataAccessEvent(
    userId: string,
    dataType: string,
    operation: 'read' | 'create' | 'update' | 'delete' | 'export',
    resourceId?: string,
    clientInfo?: any,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: `data_${operation}`,
      resource: dataType,
      resourceId,
      details: {
        dataType,
        operation,
        ...details,
      },
      clientInfo,
      timestamp: new Date(),
      success: true,
    });

    // Special handling for PII access
    if (this.isPIIData(dataType)) {
      await this.logSecurityEvent({
        type: 'pii_access',
        severity: 'medium',
        clientInfo: clientInfo || { ip: 'unknown', userAgent: 'unknown' },
        metadata: {
          userId,
          dataType,
          operation,
          resourceId,
        },
      });
    }
  }

  /**
   * Log permission changes
   */
  async logPermissionChangeEvent(
    adminUserId: string,
    targetUserId: string,
    action: 'grant' | 'revoke' | 'modify',
    permissions: string[],
    clientInfo?: any,
    reason?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'permission_change',
      severity: 'high',
      clientInfo: clientInfo || { ip: 'unknown', userAgent: 'unknown' },
      metadata: {
        adminUserId,
        targetUserId,
        action,
        permissions,
        reason,
      },
    });

    await this.logAuditEvent({
      userId: adminUserId,
      action: `permission_${action}`,
      resource: 'user_permissions',
      resourceId: targetUserId,
      details: {
        permissions,
        reason,
      },
      clientInfo,
      timestamp: new Date(),
      success: true,
    });
  }

  /**
   * Log configuration changes
   */
  async logConfigurationChangeEvent(
    userId: string,
    component: string,
    changes: Record<string, { before: any; after: any }>,
    clientInfo?: any
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'configuration_change',
      severity: 'high',
      clientInfo: clientInfo || { ip: 'unknown', userAgent: 'unknown' },
      metadata: {
        userId,
        component,
        changesCount: Object.keys(changes).length,
        changes: this.sanitizeConfigChanges(changes),
      },
    });

    await this.logAuditEvent({
      userId,
      action: 'configuration_update',
      resource: component,
      details: {
        changes: this.sanitizeConfigChanges(changes),
      },
      clientInfo,
      timestamp: new Date(),
      success: true,
    });
  }

  /**
   * Get security events for analysis
   */
  async getSecurityEvents(
    filters: {
      type?: string;
      severity?: string;
      userId?: string;
      ip?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<SecurityEvent[]> {
    const query: any = {};

    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;
    if (filters.userId) query['clientInfo.userId'] = filters.userId;
    if (filters.ip) query['clientInfo.ip'] = filters.ip;
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return this.securityEventModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100)
      .exec();
  }

  /**
   * Get audit logs for compliance reporting
   */
  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<AuditLog[]> {
    const query: any = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = new RegExp(filters.action, 'i');
    if (filters.resource) query.resource = filters.resource;
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return this.auditLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100)
      .exec();
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    framework: 'GDPR' | 'SOC2' | 'ISO27001' = 'GDPR'
  ): Promise<any> {
    const securityEvents = await this.getSecurityEvents({
      startDate,
      endDate,
      limit: 10000,
    });

    const auditLogs = await this.getAuditLogs({
      startDate,
      endDate,
      limit: 10000,
    });

    const report = {
      framework,
      period: { startDate, endDate },
      summary: {
        totalSecurityEvents: securityEvents.length,
        totalAuditLogs: auditLogs.length,
        criticalEvents: securityEvents.filter(e => e.severity === 'critical').length,
        highSeverityEvents: securityEvents.filter(e => e.severity === 'high').length,
        authenticationEvents: securityEvents.filter(e => e.type.startsWith('auth_')).length,
        dataAccessEvents: auditLogs.filter(l => l.action.startsWith('data_')).length,
        permissionChanges: securityEvents.filter(e => e.type === 'permission_change').length,
      },
      eventBreakdown: this.analyzeEvents(securityEvents, auditLogs),
      complianceChecks: this.performComplianceChecks(securityEvents, auditLogs, framework),
      generatedAt: new Date(),
    };

    return report;
  }

  /**
   * Log to CloudWatch for centralized logging
   */
  private async logToCloudWatch(logGroup: string, data: any): Promise<void> {
    try {
      const logGroupName = `/aws/${logGroup}/${this.configService.get('APP_NAME', 'madplan')}`;
      const logStreamName = `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2)}`;

      // Ensure log group exists
      await this.ensureLogGroupExists(logGroupName);

      // Create log stream if it doesn't exist
      try {
        await this.cloudWatchLogs.createLogStream({
          logGroupName,
          logStreamName,
        }).promise();
      } catch (error) {
        // Log stream might already exist, ignore error
      }

      // Send log event
      await this.cloudWatchLogs.putLogEvents({
        logGroupName,
        logStreamName,
        logEvents: [{
          timestamp: Date.now(),
          message: JSON.stringify({
            ...data,
            environment: this.configService.get('NODE_ENV'),
            application: this.configService.get('APP_NAME'),
          }),
        }],
      }).promise();

    } catch (error) {
      this.logger.error('Failed to log to CloudWatch', error);
    }
  }

  /**
   * Ensure CloudWatch log group exists
   */
  private async ensureLogGroupExists(logGroupName: string): Promise<void> {
    try {
      await this.cloudWatchLogs.createLogGroup({
        logGroupName,
        kmsKeyId: this.configService.get('AWS_LOGS_KMS_KEY_ARN'),
      }).promise();
    } catch (error) {
      // Log group might already exist, ignore error if that's the case
      if (error.code !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  /**
   * Handle security alerts based on event severity
   */
  private async handleSecurityAlert(event: SecurityEvent): Promise<void> {
    const alertConfig = this.configService.get('security.security_monitoring.alerts');
    
    if (!alertConfig || !alertConfig.events.includes(event.type.replace('_', ''))) {
      return;
    }

    // Send SNS notification for high/critical events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.sendSecurityAlert(event);
    }

    // Log to security log group
    await this.logToCloudWatch('security', {
      ...event,
      alert: true,
      severity: event.severity,
    });
  }

  /**
   * Send security alert via SNS
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const topicArn = this.configService.get('AWS_SNS_TOPIC_SECURITY_ALERTS');
      
      if (!topicArn) {
        this.logger.warn('Security alert topic ARN not configured');
        return;
      }

      const message = {
        eventType: event.type,
        severity: event.severity,
        timestamp: event.timestamp,
        clientInfo: event.clientInfo,
        metadata: event.metadata,
        environment: this.configService.get('NODE_ENV'),
        application: this.configService.get('APP_NAME'),
      };

      await this.sns.publish({
        TopicArn: topicArn,
        Subject: `Security Alert: ${event.type} (${event.severity})`,
        Message: JSON.stringify(message, null, 2),
      }).promise();

    } catch (error) {
      this.logger.error('Failed to send security alert', error);
    }
  }

  /**
   * Get severity for authentication events
   */
  private getAuthEventSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'failed_login':
      case 'mfa_failed':
        return 'medium';
      case 'password_change':
      case 'mfa_challenge':
        return 'low';
      case 'login':
      case 'logout':
      case 'mfa_success':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Check if operation is sensitive and requires additional logging
   */
  private isSensitiveOperation(action: string): boolean {
    const sensitiveActions = [
      'permission_grant',
      'permission_revoke',
      'data_delete',
      'data_export',
      'configuration_update',
      'user_delete',
      'admin_action',
    ];

    return sensitiveActions.some(sensitive => action.includes(sensitive));
  }

  /**
   * Log sensitive operations with additional security measures
   */
  private async logSensitiveOperation(auditLog: AuditLog): Promise<void> {
    await this.logSecurityEvent({
      type: 'sensitive_operation',
      severity: 'high',
      clientInfo: auditLog.clientInfo || { ip: 'unknown', userAgent: 'unknown' },
      metadata: {
        action: auditLog.action,
        resource: auditLog.resource,
        resourceId: auditLog.resourceId,
        userId: auditLog.userId,
      },
    });
  }

  /**
   * Check if data type contains PII
   */
  private isPIIData(dataType: string): boolean {
    const piiTypes = ['user', 'profile', 'email', 'personal', 'contact', 'address', 'payment'];
    return piiTypes.some(type => dataType.toLowerCase().includes(type));
  }

  /**
   * Sanitize configuration changes to remove sensitive data
   */
  private sanitizeConfigChanges(changes: Record<string, { before: any; after: any }>): Record<string, { before: any; after: any }> {
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'credential'];
    const sanitized = { ...changes };

    Object.keys(sanitized).forEach(key => {
      const isSensitive = sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive));
      
      if (isSensitive) {
        sanitized[key] = {
          before: '[REDACTED]',
          after: '[REDACTED]',
        };
      }
    });

    return sanitized;
  }

  /**
   * Analyze events for compliance reporting
   */
  private analyzeEvents(securityEvents: SecurityEvent[], auditLogs: AuditLog[]): any {
    return {
      securityEventTypes: this.groupBy(securityEvents, 'type'),
      severityDistribution: this.groupBy(securityEvents, 'severity'),
      auditActionTypes: this.groupBy(auditLogs, 'action'),
      resourceTypes: this.groupBy(auditLogs, 'resource'),
      dailyActivity: this.groupByDay(auditLogs),
    };
  }

  /**
   * Perform compliance checks based on framework
   */
  private performComplianceChecks(
    securityEvents: SecurityEvent[],
    auditLogs: AuditLog[],
    framework: string
  ): any {
    const checks = {
      auditTrailComplete: auditLogs.length > 0,
      securityMonitoring: securityEvents.length > 0,
      dataAccessLogged: auditLogs.some(log => log.action.startsWith('data_')),
      authenticationLogged: securityEvents.some(event => event.type.startsWith('auth_')),
      adminActionsLogged: auditLogs.some(log => log.action.includes('admin')),
      encryptionEvents: securityEvents.some(event => event.type.includes('encryption')),
    };

    return {
      framework,
      checks,
      complianceScore: Object.values(checks).filter(Boolean).length / Object.keys(checks).length,
      recommendations: this.generateRecommendations(checks),
    };
  }

  /**
   * Generate compliance recommendations
   */
  private generateRecommendations(checks: Record<string, boolean>): string[] {
    const recommendations: string[] = [];

    Object.entries(checks).forEach(([check, passed]) => {
      if (!passed) {
        recommendations.push(`Improve ${check.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      }
    });

    return recommendations;
  }

  /**
   * Group array of objects by property
   */
  private groupBy(array: any[], property: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const key = item[property] || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Group audit logs by day
   */
  private groupByDay(auditLogs: AuditLog[]): Record<string, number> {
    return auditLogs.reduce((groups, log) => {
      const day = log.timestamp.toISOString().split('T')[0];
      groups[day] = (groups[day] || 0) + 1;
      return groups;
    }, {});
  }
}
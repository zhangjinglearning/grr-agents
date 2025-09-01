import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand } from '@aws-sdk/client-cloudwatch-logs';

export interface AuditLogEntry {
  eventId: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'success' | 'failure' | 'denied';
  details?: Record<string, any>;
  riskScore?: number;
  compliance?: {
    gdpr?: boolean;
    sox?: boolean;
    iso27001?: boolean;
  };
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  deviceInfo?: {
    type?: string;
    os?: string;
    browser?: string;
  };
}

export interface SecurityEvent {
  eventType: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'admin_action' | 'security_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, any>;
}

export interface ComplianceReport {
  reportId: string;
  reportType: 'gdpr' | 'sox' | 'iso27001' | 'custom';
  periodStart: Date;
  periodEnd: Date;
  totalEvents: number;
  criticalEvents: number;
  complianceScore: number;
  violations: any[];
  recommendations: string[];
}

@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);
  private readonly cloudWatchClient: CloudWatchLogsClient;
  private readonly logGroupName: string;
  private readonly securityLogGroupName: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel('AuditLog') private readonly auditLogModel: Model<AuditLogEntry>,
  ) {
    this.cloudWatchClient = new CloudWatchLogsClient({
      region: this.configService.get('aws.region', 'us-east-1'),
    });
    
    this.logGroupName = this.configService.get('logging.auditLogGroup', '/aws/application/madplan');
    this.securityLogGroupName = this.configService.get('logging.securityLogGroup', '/aws/security/madplan');
  }

  /**
   * Log user authentication events
   */
  async logAuthenticationEvent(
    userId: string,
    userEmail: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset' | 'mfa_failed' | 'mfa_success' | 'mfa_setup' | 'mfa_verification_failed' | 'mfa_enabled',
    outcome: 'success' | 'failure',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      userEmail,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      action: `auth.${action}`,
      resource: 'user_authentication',
      resourceId: userId,
      outcome,
      details: {
        loginMethod: metadata.loginMethod,
        mfaUsed: metadata.mfaUsed,
        deviceFingerprint: metadata.deviceFingerprint,
        ...metadata
      },
      riskScore: this.calculateRiskScore(action, metadata),
      compliance: {
        gdpr: true,
        sox: action.includes('password') || action === 'login',
        iso27001: true
      },
      geolocation: metadata.geolocation,
      deviceInfo: metadata.deviceInfo
    };

    await Promise.all([
      this.saveAuditLog(auditEntry),
      this.sendToCloudWatch(auditEntry, 'authentication'),
    ]);

    // Trigger security alerts for suspicious activities
    if (outcome === 'failure' || auditEntry.riskScore > 7) {
      await this.triggerSecurityAlert(auditEntry);
    }
  }

  /**
   * Log authorization events
   */
  async logAuthorizationEvent(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    outcome: 'success' | 'failure' | 'denied',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      action: `authz.${action}`,
      resource,
      resourceId,
      outcome,
      details: {
        requiredRole: metadata.requiredRole,
        userRoles: metadata.userRoles,
        permissions: metadata.permissions,
        ...metadata
      },
      riskScore: this.calculateAuthorizationRiskScore(action, resource, outcome, metadata),
      compliance: {
        gdpr: this.isGdprRelevant(resource, action),
        sox: this.isSoxRelevant(resource, action),
        iso27001: true
      }
    };

    await Promise.all([
      this.saveAuditLog(auditEntry),
      this.sendToCloudWatch(auditEntry, 'authorization'),
    ]);

    if (outcome === 'denied' || auditEntry.riskScore > 6) {
      await this.triggerSecurityAlert(auditEntry);
    }
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    userId: string,
    action: 'read' | 'search' | 'export' | 'view',
    resource: string,
    resourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      action: `data.${action}`,
      resource,
      resourceId,
      outcome: 'success',
      details: {
        dataType: metadata.dataType,
        recordCount: metadata.recordCount,
        queryParameters: metadata.queryParameters,
        sensitiveData: metadata.sensitiveData,
        ...metadata
      },
      riskScore: this.calculateDataAccessRiskScore(action, metadata),
      compliance: {
        gdpr: true,
        sox: this.isSoxRelevant(resource, action),
        iso27001: true
      }
    };

    await Promise.all([
      this.saveAuditLog(auditEntry),
      this.sendToCloudWatch(auditEntry, 'data_access'),
    ]);

    // Alert on bulk data access or sensitive data access
    if (metadata.recordCount > 1000 || metadata.sensitiveData || auditEntry.riskScore > 5) {
      await this.triggerSecurityAlert(auditEntry);
    }
  }

  /**
   * Log data modification events
   */
  async logDataModification(
    userId: string,
    action: 'create' | 'update' | 'delete' | 'bulk_update' | 'bulk_delete',
    resource: string,
    resourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      action: `data.${action}`,
      resource,
      resourceId,
      outcome: metadata.outcome || 'success',
      details: {
        previousValues: metadata.previousValues,
        newValues: metadata.newValues,
        changedFields: metadata.changedFields,
        recordCount: metadata.recordCount,
        cascadeEffects: metadata.cascadeEffects,
        ...metadata
      },
      riskScore: this.calculateDataModificationRiskScore(action, metadata),
      compliance: {
        gdpr: true,
        sox: this.isSoxRelevant(resource, action),
        iso27001: true
      }
    };

    await Promise.all([
      this.saveAuditLog(auditEntry),
      this.sendToCloudWatch(auditEntry, 'data_modification'),
    ]);

    // Alert on bulk operations or high-risk modifications
    if (action.includes('bulk') || action === 'delete' || auditEntry.riskScore > 6) {
      await this.triggerSecurityAlert(auditEntry);
    }
  }

  /**
   * Log administrative actions
   */
  async logAdminAction(
    adminUserId: string,
    action: string,
    targetResource: string,
    targetId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId: adminUserId,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      action: `admin.${action}`,
      resource: targetResource,
      resourceId: targetId,
      outcome: metadata.outcome || 'success',
      details: {
        adminRole: metadata.adminRole,
        targetUser: metadata.targetUser,
        configurationChanges: metadata.configurationChanges,
        systemImpact: metadata.systemImpact,
        approvalRequired: metadata.approvalRequired,
        approvedBy: metadata.approvedBy,
        ...metadata
      },
      riskScore: 8, // Admin actions are always high risk
      compliance: {
        gdpr: true,
        sox: true,
        iso27001: true
      }
    };

    await Promise.all([
      this.saveAuditLog(auditEntry),
      this.sendToCloudWatch(auditEntry, 'admin_action'),
    ]);

    // Always alert on admin actions
    await this.triggerSecurityAlert(auditEntry);
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(
    userId: string | undefined,
    violationType: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      action: `security.${violationType}`,
      resource: 'security_policy',
      outcome: 'failure',
      details: {
        violationType,
        description,
        detectionMethod: metadata.detectionMethod,
        severity: metadata.severity,
        automaticResponse: metadata.automaticResponse,
        ...metadata
      },
      riskScore: 10, // Security violations are maximum risk
      compliance: {
        gdpr: true,
        sox: true,
        iso27001: true
      }
    };

    await Promise.all([
      this.saveAuditLog(auditEntry),
      this.sendToCloudWatch(auditEntry, 'security_violation'),
    ]);

    // Always trigger critical security alert
    await this.triggerCriticalSecurityAlert(auditEntry);
  }

  /**
   * Generate compliance reports
   */
  async generateComplianceReport(
    reportType: 'gdpr' | 'sox' | 'iso27001',
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const reportId = this.generateEventId();
    
    const query = {
      timestamp: { $gte: startDate, $lte: endDate },
      [`compliance.${reportType}`]: true
    };

    const auditLogs = await this.auditLogModel.find(query).exec();
    const totalEvents = auditLogs.length;
    const criticalEvents = auditLogs.filter(log => log.riskScore >= 8).length;
    
    // Calculate compliance score (0-100)
    const complianceScore = this.calculateComplianceScore(auditLogs, reportType);
    
    // Identify violations and generate recommendations
    const violations = this.identifyComplianceViolations(auditLogs, reportType);
    const recommendations = this.generateComplianceRecommendations(violations, reportType);

    const report: ComplianceReport = {
      reportId,
      reportType,
      periodStart: startDate,
      periodEnd: endDate,
      totalEvents,
      criticalEvents,
      complianceScore,
      violations,
      recommendations
    };

    // Save report for audit trail
    await this.saveComplianceReport(report);
    
    return report;
  }

  /**
   * Search audit logs with advanced filtering
   */
  async searchAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      outcome?: string;
      riskScoreMin?: number;
      riskScoreMax?: number;
    },
    pagination: { page: number; limit: number } = { page: 1, limit: 100 }
  ): Promise<{ logs: AuditLogEntry[]; total: number; page: number; totalPages: number }> {
    const query: any = {};
    
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = new RegExp(filters.action, 'i');
    if (filters.resource) query.resource = new RegExp(filters.resource, 'i');
    if (filters.outcome) query.outcome = filters.outcome;
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }
    
    if (filters.riskScoreMin !== undefined || filters.riskScoreMax !== undefined) {
      query.riskScore = {};
      if (filters.riskScoreMin !== undefined) query.riskScore.$gte = filters.riskScoreMin;
      if (filters.riskScoreMax !== undefined) query.riskScore.$lte = filters.riskScoreMax;
    }

    const total = await this.auditLogModel.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);
    const skip = (pagination.page - 1) * pagination.limit;
    
    const logs = await this.auditLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .exec();

    return {
      logs,
      total,
      page: pagination.page,
      totalPages
    };
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    filters: any,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<{ data: any; fileName: string }> {
    const { logs } = await this.searchAuditLogs(filters, { page: 1, limit: 10000 });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `audit-logs-export-${timestamp}.${format}`;
    
    let data: any;
    
    switch (format) {
      case 'csv':
        data = this.convertToCSV(logs);
        break;
      case 'xml':
        data = this.convertToXML(logs);
        break;
      case 'json':
      default:
        data = JSON.stringify(logs, null, 2);
        break;
    }
    
    // Log the export action
    await this.logAdminAction(
      'system',
      'audit_export',
      'audit_logs',
      'export',
      {
        format,
        recordCount: logs.length,
        filters,
        exportedBy: 'compliance_system'
      }
    );
    
    return { data, fileName };
  }

  // Private helper methods

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveAuditLog(auditEntry: AuditLogEntry): Promise<void> {
    try {
      const auditLog = new this.auditLogModel(auditEntry);
      await auditLog.save();
    } catch (error) {
      this.logger.error('Failed to save audit log to database', error.stack);
      // Continue execution - audit logs should not break the main application
    }
  }

  private async sendToCloudWatch(auditEntry: AuditLogEntry, logStream: string): Promise<void> {
    try {
      const logGroupName = auditEntry.action.includes('security') ? 
        this.securityLogGroupName : this.logGroupName;

      const logStreamName = `${logStream}-${new Date().toISOString().split('T')[0]}`;
      
      // Create log stream if it doesn't exist
      try {
        await this.cloudWatchClient.send(new CreateLogStreamCommand({
          logGroupName,
          logStreamName
        }));
      } catch (error) {
        // Stream might already exist, ignore
      }
      
      const logEvent = {
        timestamp: auditEntry.timestamp.getTime(),
        message: JSON.stringify(auditEntry)
      };
      
      await this.cloudWatchClient.send(new PutLogEventsCommand({
        logGroupName,
        logStreamName,
        logEvents: [logEvent]
      }));
      
    } catch (error) {
      this.logger.error('Failed to send audit log to CloudWatch', error.stack);
      // Continue execution - CloudWatch failures should not break the main application
    }
  }

  private calculateRiskScore(action: string, metadata: any): number {
    let score = 0;
    
    // Base score by action type
    if (action === 'login_failed') score += 3;
    if (action === 'password_change') score += 2;
    if (action === 'login') score += 1;
    
    // Risk factors
    if (metadata.newLocation) score += 2;
    if (metadata.newDevice) score += 2;
    if (metadata.multipleFailedAttempts) score += 4;
    if (!metadata.mfaUsed && action === 'login') score += 3;
    if (metadata.suspiciousUserAgent) score += 2;
    
    return Math.min(score, 10);
  }

  private calculateAuthorizationRiskScore(action: string, resource: string, outcome: string, metadata: any): number {
    let score = 0;
    
    if (outcome === 'denied') score += 5;
    if (action.includes('admin')) score += 3;
    if (resource.includes('user') || resource.includes('role')) score += 2;
    if (metadata.privilegeEscalation) score += 4;
    
    return Math.min(score, 10);
  }

  private calculateDataAccessRiskScore(action: string, metadata: any): number {
    let score = 0;
    
    if (action === 'export') score += 3;
    if (metadata.recordCount > 1000) score += 2;
    if (metadata.recordCount > 10000) score += 4;
    if (metadata.sensitiveData) score += 3;
    if (metadata.offHours) score += 2;
    
    return Math.min(score, 10);
  }

  private calculateDataModificationRiskScore(action: string, metadata: any): number {
    let score = 0;
    
    if (action === 'delete') score += 4;
    if (action.includes('bulk')) score += 3;
    if (metadata.recordCount > 100) score += 2;
    if (metadata.recordCount > 1000) score += 4;
    if (metadata.cascadeEffects) score += 2;
    
    return Math.min(score, 10);
  }

  async logDataPrivacyEvent(
    eventType: 'data_access' | 'data_export' | 'data_deletion' | 'consent_given' | 'consent_withdrawn',
    userId: string,
    details: {
      dataType?: string;
      requestId?: string;
      legalBasis?: string;
      metadata?: Record<string, any>;
      consentId?: string;
    },
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      pageUrl?: string;
      campaignId?: string;
      consentMethod?: 'explicit' | 'implied' | 'opt_in' | 'opt_out';
      endpoint?: string;
    },
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      action: `${eventType}`,
      resource: 'data_privacy',
      outcome: 'success',
      details: {
        ...details,
        ...metadata,
      },
      riskScore: this.calculateRiskScore('data_privacy', eventType),
      compliance: {
        gdpr: true,
      },
    };

    await this.saveAuditLog(auditEntry);
  }

  async logSecurityEvent(
    eventType: 'login_attempt' | 'password_change' | 'permission_change' | 'suspicious_activity' | 'security_breach',
    userId: string,
    details: {
      success?: boolean;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
      incidentId?: string;
      playbookId?: string;
      period?: string;
      severity?: string;
      oldStatus?: string;
      actionId?: string;
      evidenceId?: string;
      category?: string;
      playbookName?: string;
      totalIncidents?: number;
      affectedSystems?: string[];
      newStatus?: string;
      actionType?: string;
      evidenceType?: string;
      stepsCount?: number;
      actionsCreated?: number;
      notes?: string;
      action?: string;
      location?: string;
    },
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      action: `${eventType}`,
      resource: 'security',
      outcome: details.success ? 'success' : 'failure',
      details,
      riskScore: this.calculateRiskScore('security', eventType),
    };

    await this.saveAuditLog(auditEntry);
  }

  async logComplianceEvent(
    eventType: 'policy_violation' | 'audit_check' | 'compliance_review' | 'data_breach_notification',
    userId: string,
    details: {
      policyId?: string;
      violationType?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, any>;
      reportPeriod?: string;
      complianceScore?: number;
    },
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      userId,
      action: `${eventType}`,
      resource: 'compliance',
      outcome: 'success',
      details,
      riskScore: this.calculateRiskScore('compliance', eventType),
    };

    await this.saveAuditLog(auditEntry);
  }

  private isGdprRelevant(resource: string, action: string): boolean {
    const gdprResources = ['user', 'profile', 'contact', 'address', 'email'];
    const gdprActions = ['read', 'update', 'delete', 'export', 'anonymize'];
    
    return gdprResources.some(r => resource.includes(r)) || 
           gdprActions.some(a => action.includes(a));
  }

  private isSoxRelevant(resource: string, action: string): boolean {
    const soxResources = ['financial', 'audit', 'config', 'user', 'role'];
    const soxActions = ['create', 'update', 'delete', 'admin'];
    
    return soxResources.some(r => resource.includes(r)) || 
           soxActions.some(a => action.includes(a));
  }

  private async triggerSecurityAlert(auditEntry: AuditLogEntry): Promise<void> {
    // Implementation would integrate with SNS, Slack, or other alerting systems
    this.logger.warn(`Security alert triggered for event: ${auditEntry.eventId}`, {
      action: auditEntry.action,
      userId: auditEntry.userId,
      riskScore: auditEntry.riskScore
    });
  }

  private async triggerCriticalSecurityAlert(auditEntry: AuditLogEntry): Promise<void> {
    // Implementation would integrate with immediate alerting systems
    this.logger.error(`CRITICAL security alert for event: ${auditEntry.eventId}`, {
      action: auditEntry.action,
      userId: auditEntry.userId,
      details: auditEntry.details
    });
  }

  private calculateComplianceScore(logs: AuditLogEntry[], reportType: string): number {
    // Implementation of compliance scoring algorithm
    const totalLogs = logs.length;
    const violationLogs = logs.filter(log => log.riskScore >= 8).length;
    
    return totalLogs > 0 ? Math.max(0, 100 - (violationLogs / totalLogs) * 100) : 100;
  }

  private identifyComplianceViolations(logs: AuditLogEntry[], reportType: string): any[] {
    // Implementation of violation identification logic
    return logs.filter(log => log.riskScore >= 8);
  }

  private generateComplianceRecommendations(violations: any[], reportType: string): string[] {
    // Implementation of recommendation generation
    const recommendations = [];
    
    if (violations.length > 0) {
      recommendations.push('Review and strengthen access controls');
      recommendations.push('Implement additional monitoring for high-risk activities');
      recommendations.push('Provide additional security training for users');
    }
    
    return recommendations;
  }

  private async saveComplianceReport(report: ComplianceReport): Promise<void> {
    // Save compliance report to database
    this.logger.log(`Compliance report generated: ${report.reportId}`, {
      reportType: report.reportType,
      complianceScore: report.complianceScore,
      totalEvents: report.totalEvents
    });
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    // Implementation of CSV conversion
    const headers = ['eventId', 'timestamp', 'userId', 'action', 'resource', 'outcome', 'riskScore'];
    const csvRows = [headers.join(',')];
    
    logs.forEach(log => {
      const row = headers.map(header => log[header] || '').join(',');
      csvRows.push(row);
    });
    
    return csvRows.join('\n');
  }

  private convertToXML(logs: AuditLogEntry[]): string {
    // Implementation of XML conversion
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<auditLogs>\n';
    
    logs.forEach(log => {
      xml += '  <log>\n';
      xml += `    <eventId>${log.eventId}</eventId>\n`;
      xml += `    <timestamp>${log.timestamp.toISOString()}</timestamp>\n`;
      xml += `    <userId>${log.userId || ''}</userId>\n`;
      xml += `    <action>${log.action}</action>\n`;
      xml += `    <resource>${log.resource}</resource>\n`;
      xml += `    <outcome>${log.outcome}</outcome>\n`;
      xml += `    <riskScore>${log.riskScore}</riskScore>\n`;
      xml += '  </log>\n';
    });
    
    xml += '</auditLogs>';
    return xml;
  }
}
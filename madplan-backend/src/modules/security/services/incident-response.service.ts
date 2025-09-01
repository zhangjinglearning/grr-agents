import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AuditLoggingService } from './audit-logging.service';
import { EncryptionService } from './encryption.service';

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'data_breach' | 'unauthorized_access' | 'malware' | 'ddos' | 'phishing' | 'insider_threat' | 'system_compromise' | 'other';
  status: 'new' | 'investigating' | 'contained' | 'resolved' | 'closed';
  reportedAt: Date;
  detectedAt?: Date;
  containedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  
  // Incident Details
  affectedSystems: string[];
  affectedUsers: number;
  affectedData: {
    types: string[];
    recordCount: number;
    classification: 'public' | 'internal' | 'confidential' | 'restricted';
    containsPII: boolean;
    containsFinancial: boolean;
    containsHealthData: boolean;
  };
  
  // Response Team
  incidentCommander: string;
  responseTeam: string[];
  externalContactsNotified: string[];
  
  // Timeline
  timeline: IncidentTimelineEntry[];
  
  // Impact Assessment
  impact: {
    confidentiality: 'none' | 'low' | 'medium' | 'high';
    integrity: 'none' | 'low' | 'medium' | 'high';
    availability: 'none' | 'low' | 'medium' | 'high';
    businessImpact: string;
    estimatedCost: number;
    reputationImpact: 'none' | 'low' | 'medium' | 'high';
  };
  
  // Technical Details
  attackVector: string;
  vulnerabilityExploited?: string;
  indicators: {
    ips: string[];
    domains: string[];
    hashes: string[];
    userAgents: string[];
    other: Record<string, string[]>;
  };
  
  // Response Actions
  containmentActions: ResponseAction[];
  eradicationActions: ResponseAction[];
  recoveryActions: ResponseAction[];
  
  // Compliance and Legal
  requiresRegulatorNotification: boolean;
  regulatorNotificationDeadline?: Date;
  regulatorNotificationSent?: Date;
  requiresUserNotification: boolean;
  userNotificationDeadline?: Date;
  userNotificationSent?: Date;
  legalCounselInvolved: boolean;
  lawEnforcementInvolved: boolean;
  
  // Documentation
  evidenceCollected: EvidenceItem[];
  lessonsLearned: string[];
  recommendations: string[];
  postIncidentReportUrl?: string;
  
  metadata: {
    createdBy: string;
    lastModifiedBy: string;
    lastModifiedAt: Date;
    tags: string[];
    relatedIncidents: string[];
  };
}

export interface IncidentTimelineEntry {
  timestamp: Date;
  action: string;
  description: string;
  performedBy: string;
  evidence?: string[];
  impact?: string;
}

export interface ResponseAction {
  id: string;
  action: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // minutes
  actualTime?: number; // minutes
  startedAt?: Date;
  completedAt?: Date;
  blockedReason?: string;
  evidence?: string[];
  notes?: string;
}

export interface EvidenceItem {
  id: string;
  type: 'log_file' | 'screenshot' | 'network_capture' | 'disk_image' | 'memory_dump' | 'document' | 'other';
  name: string;
  description: string;
  collectedBy: string;
  collectedAt: Date;
  location: string; // secure storage location
  hash: string;
  chainOfCustody: ChainOfCustodyEntry[];
  metadata: Record<string, any>;
}

export interface ChainOfCustodyEntry {
  timestamp: Date;
  action: 'collected' | 'transferred' | 'analyzed' | 'stored' | 'destroyed';
  performedBy: string;
  location: string;
  hash: string;
  notes?: string;
}

export interface IncidentPlaybook {
  id: string;
  name: string;
  category: SecurityIncident['category'];
  severity: SecurityIncident['severity'];
  description: string;
  triggerConditions: string[];
  responseSteps: PlaybookStep[];
  stakeholders: string[];
  escalationCriteria: string[];
  communicationTemplates: Record<string, string>;
  lastUpdated: Date;
  version: string;
}

export interface PlaybookStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  category: 'detection' | 'analysis' | 'containment' | 'eradication' | 'recovery' | 'communication';
  estimatedTime: number; // minutes
  assignedRole: string;
  requiredTools: string[];
  successCriteria: string[];
  outputs: string[];
  dependencies: string[];
}

@Injectable()
export class IncidentResponseService {
  private readonly logger = new Logger(IncidentResponseService.name);

  constructor(
    @InjectModel('SecurityIncident') private incidentModel: Model<SecurityIncident>,
    @InjectModel('IncidentPlaybook') private playbookModel: Model<IncidentPlaybook>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditLoggingService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Create new security incident
   */
  async createIncident(
    incidentData: Partial<SecurityIncident>,
    reportedBy: string
  ): Promise<SecurityIncident> {
    try {
      const incident: SecurityIncident = {
        id: await this.generateIncidentId(),
        title: incidentData.title || 'Untitled Security Incident',
        description: incidentData.description || '',
        severity: incidentData.severity || 'medium',
        category: incidentData.category || 'other',
        status: 'new',
        reportedAt: new Date(),
        detectedAt: incidentData.detectedAt,
        
        affectedSystems: incidentData.affectedSystems || [],
        affectedUsers: incidentData.affectedUsers || 0,
        affectedData: incidentData.affectedData || {
          types: [],
          recordCount: 0,
          classification: 'internal',
          containsPII: false,
          containsFinancial: false,
          containsHealthData: false,
        },
        
        incidentCommander: reportedBy,
        responseTeam: [reportedBy],
        externalContactsNotified: [],
        
        timeline: [{
          timestamp: new Date(),
          action: 'incident_created',
          description: 'Security incident created and logged',
          performedBy: reportedBy,
        }],
        
        impact: incidentData.impact || {
          confidentiality: 'none',
          integrity: 'none',
          availability: 'none',
          businessImpact: '',
          estimatedCost: 0,
          reputationImpact: 'none',
        },
        
        attackVector: incidentData.attackVector || 'unknown',
        vulnerabilityExploited: incidentData.vulnerabilityExploited,
        indicators: incidentData.indicators || {
          ips: [],
          domains: [],
          hashes: [],
          userAgents: [],
          other: {},
        },
        
        containmentActions: [],
        eradicationActions: [],
        recoveryActions: [],
        
        requiresRegulatorNotification: this.assessRegulatorNotificationRequirement(incidentData),
        requiresUserNotification: this.assessUserNotificationRequirement(incidentData),
        legalCounselInvolved: false,
        lawEnforcementInvolved: false,
        
        evidenceCollected: [],
        lessonsLearned: [],
        recommendations: [],
        
        metadata: {
          createdBy: reportedBy,
          lastModifiedBy: reportedBy,
          lastModifiedAt: new Date(),
          tags: [],
          relatedIncidents: [],
        },
      };

      // Set notification deadlines if required
      if (incident.requiresRegulatorNotification) {
        incident.regulatorNotificationDeadline = this.calculateRegulatorDeadline(incident);
      }
      if (incident.requiresUserNotification) {
        incident.userNotificationDeadline = this.calculateUserNotificationDeadline(incident);
      }

      const savedIncident = await this.incidentModel.create(incident);

      // Auto-assign appropriate playbook
      await this.assignPlaybook(incident.id, incident.category, incident.severity);

      // Send immediate notifications
      await this.sendInitialNotifications(incident);

      // Log incident creation
      await this.auditService.logSecurityEvent(
        reportedBy,
        'security_incident_created',
        'incident_management',
        'success',
        {
          incidentId: incident.id,
          severity: incident.severity,
          category: incident.category,
          affectedSystems: incident.affectedSystems,
        }
      );

      this.logger.warn(`Security incident created: ${incident.id} - ${incident.title}`, {
        incidentId: incident.id,
        severity: incident.severity,
        category: incident.category,
        reportedBy,
      });

      return savedIncident;

    } catch (error) {
      this.logger.error('Failed to create security incident', error.stack);
      throw new Error('Security incident creation failed');
    }
  }

  /**
   * Update incident status and timeline
   */
  async updateIncidentStatus(
    incidentId: string,
    newStatus: SecurityIncident['status'],
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    try {
      const incident = await this.incidentModel.findOne({ id: incidentId });
      if (!incident) {
        throw new Error('Incident not found');
      }

      const updateData: any = {
        status: newStatus,
        'metadata.lastModifiedBy': updatedBy,
        'metadata.lastModifiedAt': new Date(),
      };

      // Set status timestamps
      switch (newStatus) {
        case 'contained':
          updateData.containedAt = new Date();
          break;
        case 'resolved':
          updateData.resolvedAt = new Date();
          break;
        case 'closed':
          updateData.closedAt = new Date();
          break;
      }

      // Add timeline entry
      const timelineEntry: IncidentTimelineEntry = {
        timestamp: new Date(),
        action: `status_changed_to_${newStatus}`,
        description: `Incident status changed to ${newStatus}${notes ? ': ' + notes : ''}`,
        performedBy: updatedBy,
      };

      await this.incidentModel.updateOne(
        { id: incidentId },
        {
          ...updateData,
          $push: { timeline: timelineEntry },
        }
      );

      // Trigger status-specific actions
      await this.handleStatusChange(incidentId, newStatus, updatedBy);

      // Log status change
      await this.auditService.logSecurityEvent(
        updatedBy,
        'incident_status_changed',
        'incident_management',
        'success',
        {
          incidentId,
          oldStatus: incident.status,
          newStatus,
          notes,
        }
      );

    } catch (error) {
      this.logger.error('Failed to update incident status', error.stack);
      throw error;
    }
  }

  /**
   * Add response action to incident
   */
  async addResponseAction(
    incidentId: string,
    actionData: Omit<ResponseAction, 'id'>,
    addedBy: string
  ): Promise<ResponseAction> {
    try {
      const action: ResponseAction = {
        id: await this.generateActionId(),
        ...actionData,
      };

      const actionType = this.categorizeAction(action.action);
      const updateField = `${actionType}Actions`;

      await this.incidentModel.updateOne(
        { id: incidentId },
        {
          $push: { [updateField]: action },
          $push: {
            timeline: {
              timestamp: new Date(),
              action: 'response_action_added',
              description: `Added ${actionType} action: ${action.action}`,
              performedBy: addedBy,
            },
          },
          'metadata.lastModifiedBy': addedBy,
          'metadata.lastModifiedAt': new Date(),
        }
      );

      // Log action addition
      await this.auditService.logSecurityEvent(
        addedBy,
        'incident_action_added',
        'incident_management',
        'success',
        {
          incidentId,
          actionId: action.id,
          actionType,
          action: action.action,
        }
      );

      return action;

    } catch (error) {
      this.logger.error('Failed to add response action', error.stack);
      throw error;
    }
  }

  /**
   * Collect evidence for incident
   */
  async collectEvidence(
    incidentId: string,
    evidenceData: Omit<EvidenceItem, 'id' | 'collectedAt' | 'chainOfCustody'>,
    collectedBy: string
  ): Promise<EvidenceItem> {
    try {
      const evidence: EvidenceItem = {
        id: await this.generateEvidenceId(),
        collectedAt: new Date(),
        chainOfCustody: [{
          timestamp: new Date(),
          action: 'collected',
          performedBy: collectedBy,
          location: evidenceData.location,
          hash: evidenceData.hash,
          notes: 'Evidence collected and secured',
        }],
        ...evidenceData,
      };

      await this.incidentModel.updateOne(
        { id: incidentId },
        {
          $push: {
            evidenceCollected: evidence,
            timeline: {
              timestamp: new Date(),
              action: 'evidence_collected',
              description: `Evidence collected: ${evidence.name}`,
              performedBy: collectedBy,
              evidence: [evidence.id],
            },
          },
          'metadata.lastModifiedBy': collectedBy,
          'metadata.lastModifiedAt': new Date(),
        }
      );

      // Secure evidence storage
      await this.secureEvidenceStorage(evidence);

      // Log evidence collection
      await this.auditService.logSecurityEvent(
        collectedBy,
        'incident_evidence_collected',
        'evidence_management',
        'success',
        {
          incidentId,
          evidenceId: evidence.id,
          evidenceType: evidence.type,
          location: evidence.location,
        }
      );

      return evidence;

    } catch (error) {
      this.logger.error('Failed to collect evidence', error.stack);
      throw error;
    }
  }

  /**
   * Generate incident response playbook
   */
  async createPlaybook(
    playbookData: Omit<IncidentPlaybook, 'id' | 'lastUpdated' | 'version'>,
    createdBy: string
  ): Promise<IncidentPlaybook> {
    try {
      const playbook: IncidentPlaybook = {
        id: await this.generatePlaybookId(),
        lastUpdated: new Date(),
        version: '1.0',
        ...playbookData,
      };

      const savedPlaybook = await this.playbookModel.create(playbook);

      // Log playbook creation
      await this.auditService.logSecurityEvent(
        createdBy,
        'incident_playbook_created',
        'incident_management',
        'success',
        {
          playbookId: playbook.id,
          category: playbook.category,
          stepsCount: playbook.responseSteps.length,
        }
      );

      return savedPlaybook;

    } catch (error) {
      this.logger.error('Failed to create incident playbook', error.stack);
      throw error;
    }
  }

  /**
   * Execute playbook for incident
   */
  async executePlaybook(
    incidentId: string,
    playbookId: string,
    executedBy: string
  ): Promise<void> {
    try {
      const [incident, playbook] = await Promise.all([
        this.incidentModel.findOne({ id: incidentId }),
        this.playbookModel.findOne({ id: playbookId }),
      ]);

      if (!incident || !playbook) {
        throw new Error('Incident or playbook not found');
      }

      // Generate response actions from playbook steps
      const responseActions: ResponseAction[] = playbook.responseSteps.map(step => ({
        id: `${step.id}_${Date.now()}`,
        action: step.title,
        description: step.description,
        assignedTo: this.assignStepToTeamMember(step.assignedRole, incident.responseTeam),
        status: 'pending',
        priority: this.determinePriority(step.category, incident.severity),
        estimatedTime: step.estimatedTime,
      }));

      // Add containment actions
      const containmentActions = responseActions.filter(
        action => this.categorizeAction(action.action) === 'containment'
      );
      const eradicationActions = responseActions.filter(
        action => this.categorizeAction(action.action) === 'eradication'
      );
      const recoveryActions = responseActions.filter(
        action => this.categorizeAction(action.action) === 'recovery'
      );

      await this.incidentModel.updateOne(
        { id: incidentId },
        {
          $push: {
            containmentActions: { $each: containmentActions },
            eradicationActions: { $each: eradicationActions },
            recoveryActions: { $each: recoveryActions },
            timeline: {
              timestamp: new Date(),
              action: 'playbook_executed',
              description: `Playbook "${playbook.name}" executed, ${responseActions.length} actions created`,
              performedBy: executedBy,
            },
          },
          'metadata.lastModifiedBy': executedBy,
          'metadata.lastModifiedAt': new Date(),
        }
      );

      // Log playbook execution
      await this.auditService.logSecurityEvent(
        executedBy,
        'incident_playbook_executed',
        'incident_management',
        'success',
        {
          incidentId,
          playbookId,
          playbookName: playbook.name,
          actionsCreated: responseActions.length,
        }
      );

    } catch (error) {
      this.logger.error('Failed to execute playbook', error.stack);
      throw error;
    }
  }

  /**
   * Generate incident metrics and reports
   */
  async generateIncidentMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalIncidents: number;
    incidentsByCategory: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
    averageResolutionTime: number;
    complianceMetrics: {
      regulatorNotificationCompliance: number;
      userNotificationCompliance: number;
      timeToContainment: number;
    };
    trends: any;
  }> {
    try {
      const incidents = await this.incidentModel.find({
        reportedAt: { $gte: startDate, $lte: endDate },
      });

      const metrics = {
        totalIncidents: incidents.length,
        incidentsByCategory: this.aggregateByField(incidents, 'category'),
        incidentsBySeverity: this.aggregateByField(incidents, 'severity'),
        averageResolutionTime: this.calculateAverageResolutionTime(incidents),
        complianceMetrics: {
          regulatorNotificationCompliance: this.calculateNotificationCompliance(
            incidents.filter(i => i.requiresRegulatorNotification),
            'regulatorNotificationSent',
            'regulatorNotificationDeadline'
          ),
          userNotificationCompliance: this.calculateNotificationCompliance(
            incidents.filter(i => i.requiresUserNotification),
            'userNotificationSent',
            'userNotificationDeadline'
          ),
          timeToContainment: this.calculateAverageTimeToContainment(incidents),
        },
        trends: this.analyzeTrends(incidents),
      };

      // Log metrics generation
      await this.auditService.logSecurityEvent(
        'system',
        'incident_metrics_generated',
        'reporting',
        'success',
        {
          period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          totalIncidents: metrics.totalIncidents,
        }
      );

      return metrics;

    } catch (error) {
      this.logger.error('Failed to generate incident metrics', error.stack);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async generateIncidentId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `INC-${timestamp}-${random}`.toUpperCase();
  }

  private async generateActionId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `ACT-${timestamp}-${random}`.toUpperCase();
  }

  private async generateEvidenceId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `EVD-${timestamp}-${random}`.toUpperCase();
  }

  private async generatePlaybookId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `PBK-${timestamp}-${random}`.toUpperCase();
  }

  private assessRegulatorNotificationRequirement(incidentData: Partial<SecurityIncident>): boolean {
    // Implementation would assess based on jurisdiction and incident type
    return incidentData.affectedData?.containsPII || 
           incidentData.severity === 'critical' ||
           (incidentData.affectedUsers || 0) > 100;
  }

  private assessUserNotificationRequirement(incidentData: Partial<SecurityIncident>): boolean {
    return incidentData.affectedData?.containsPII || 
           incidentData.affectedData?.containsFinancial ||
           incidentData.severity === 'high' || 
           incidentData.severity === 'critical';
  }

  private calculateRegulatorDeadline(incident: SecurityIncident): Date {
    // GDPR: 72 hours for data breaches
    return new Date(incident.reportedAt.getTime() + 72 * 60 * 60 * 1000);
  }

  private calculateUserNotificationDeadline(incident: SecurityIncident): Date {
    // Generally within 30 days
    return new Date(incident.reportedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  private categorizeAction(action: string): 'containment' | 'eradication' | 'recovery' {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('contain') || actionLower.includes('isolate') || actionLower.includes('block')) {
      return 'containment';
    }
    if (actionLower.includes('remove') || actionLower.includes('patch') || actionLower.includes('clean')) {
      return 'eradication';
    }
    return 'recovery';
  }

  private aggregateByField(incidents: SecurityIncident[], field: string): Record<string, number> {
    return incidents.reduce((acc, incident) => {
      const value = incident[field];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateAverageResolutionTime(incidents: SecurityIncident[]): number {
    const resolvedIncidents = incidents.filter(i => i.resolvedAt);
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((total, incident) => {
      return total + (incident.resolvedAt!.getTime() - incident.reportedAt.getTime());
    }, 0);

    return totalTime / resolvedIncidents.length / (1000 * 60 * 60); // Convert to hours
  }

  // Additional private methods would be implemented for complete functionality
  private async assignPlaybook(incidentId: string, category: string, severity: string): Promise<void> {}
  private async sendInitialNotifications(incident: SecurityIncident): Promise<void> {}
  private async handleStatusChange(incidentId: string, status: string, updatedBy: string): Promise<void> {}
  private async secureEvidenceStorage(evidence: EvidenceItem): Promise<void> {}
  private assignStepToTeamMember(role: string, team: string[]): string { return team[0] || 'unassigned'; }
  private determinePriority(category: string, severity: string): 'low' | 'medium' | 'high' | 'critical' { return 'medium'; }
  private calculateNotificationCompliance(incidents: SecurityIncident[], sentField: string, deadlineField: string): number { return 100; }
  private calculateAverageTimeToContainment(incidents: SecurityIncident[]): number { return 0; }
  private analyzeTrends(incidents: SecurityIncident[]): any { return {}; }
}
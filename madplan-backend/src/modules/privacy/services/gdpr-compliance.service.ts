import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../security/services/encryption.service';
import { AuditLoggingService } from '../../security/services/audit-logging.service';

export interface GDPRRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  rejectionReason?: string;
  requestData?: any;
  responseData?: any;
  legalBasis: string;
  processingNotes?: string;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata: {
    ipAddress: string;
    userAgent: string;
    requestedFields?: string[];
    dataCategories?: string[];
    processingSystems?: string[];
    verificationMethod: 'email' | 'identity_document' | 'security_questions';
    verificationStatus: 'pending' | 'verified' | 'failed';
  };
}

export interface ConsentRecord {
  id: string;
  userId: string;
  userEmail: string;
  consentType: 'marketing' | 'analytics' | 'functional' | 'performance' | 'advertising' | 'third_party';
  consentStatus: 'granted' | 'withdrawn' | 'pending';
  consentVersion: string;
  consentText: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  grantedAt?: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  source: 'registration' | 'settings' | 'banner' | 'email' | 'api';
  metadata: {
    ipAddress: string;
    userAgent: string;
    pageUrl?: string;
    campaignId?: string;
    consentMethod: 'explicit' | 'implied' | 'opt_in' | 'opt_out';
  };
  processingPurposes: string[];
  dataCategories: string[];
  retentionPeriod: number; // days
  thirdPartySharing: boolean;
  automatedDecisionMaking: boolean;
}

export interface DataProcessingRecord {
  id: string;
  userId: string;
  dataType: string;
  processingPurpose: string;
  legalBasis: string;
  processingSystem: string;
  dataLocation: 'EU' | 'US' | 'global';
  retentionPeriod: number; // days
  lastProcessedAt: Date;
  scheduled: boolean;
  consentRequired: boolean;
  consentId?: string;
  metadata: {
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
    encryptionStatus: 'encrypted' | 'plain' | 'hashed';
    backupIncluded: boolean;
    thirdPartyAccess: string[];
  };
}

export interface DataPortabilityExport {
  userId: string;
  userEmail: string;
  exportedAt: Date;
  dataFormat: 'json' | 'csv' | 'xml' | 'pdf';
  dataCategories: string[];
  exportSize: number; // bytes
  downloadUrl?: string;
  expiresAt: Date;
  metadata: {
    requestId: string;
    encryptionKey?: string;
    compressionType: 'none' | 'gzip' | 'zip';
    includeMetadata: boolean;
  };
}

@Injectable()
export class GDPRComplianceService {
  private readonly logger = new Logger(GDPRComplianceService.name);

  constructor(
    @InjectModel('GDPRRequest') private gdprRequestModel: Model<GDPRRequest>,
    @InjectModel('ConsentRecord') private consentModel: Model<ConsentRecord>,
    @InjectModel('DataProcessingRecord') private processingModel: Model<DataProcessingRecord>,
    @InjectModel('DataPortabilityExport') private exportModel: Model<DataPortabilityExport>,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditLoggingService,
  ) {}

  /**
   * Submit GDPR data request
   */
  async submitGDPRRequest(
    userId: string,
    userEmail: string,
    requestType: GDPRRequest['requestType'],
    requestData: any,
    metadata: GDPRRequest['metadata']
  ): Promise<GDPRRequest> {
    try {
      const request: GDPRRequest = {
        id: await this.generateRequestId(),
        userId,
        userEmail,
        requestType,
        status: 'pending',
        requestedAt: new Date(),
        legalBasis: this.determineLegalBasis(requestType),
        priority: this.determinePriority(requestType, requestData),
        requestData: await this.encryptionService.encryptUserData(JSON.stringify(requestData)),
        metadata: {
          ...metadata,
          verificationStatus: 'pending',
        },
      };

      const savedRequest = await this.gdprRequestModel.create(request);

      // Log GDPR request submission
      await this.auditService.logDataPrivacyEvent(
        requestType === 'access' ? 'data_access' : requestType === 'erasure' ? 'data_deletion' : 'data_export',
        userId,
        {
          dataType: 'gdpr_request',
          requestId: request.id,
        },
        {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        }
      );

      // Auto-assign based on request type and priority
      await this.autoAssignRequest(request);

      // Send notification to data protection team
      await this.notifyDataProtectionTeam(request);

      return savedRequest;

    } catch (error) {
      this.logger.error('Failed to submit GDPR request', error.stack);
      throw new Error('GDPR request submission failed');
    }
  }

  /**
   * Process data access request (Article 15)
   */
  async processDataAccessRequest(requestId: string, processedBy: string): Promise<any> {
    try {
      const request = await this.gdprRequestModel.findOne({ 
        id: requestId, 
        requestType: 'access' 
      });

      if (!request) {
        throw new Error('Access request not found');
      }

      // Update request status
      await this.updateRequestStatus(requestId, 'processing', processedBy);

      // Gather all user data across systems
      const userData = await this.gatherUserData(request.userId);

      // Create structured data export
      const dataExport = {
        personalData: userData.personalData,
        processingActivities: userData.processingActivities,
        consentHistory: userData.consentHistory,
        dataRetention: userData.dataRetention,
        thirdPartySharing: userData.thirdPartySharing,
        automatedDecisionMaking: userData.automatedDecisionMaking,
        dataTransfers: userData.dataTransfers,
        securityMeasures: userData.securityMeasures,
      };

      // Encrypt response data
      const encryptedResponse = await this.encryptionService.encryptUserData(
        JSON.stringify(dataExport),
        { context: { RequestType: 'data-access', RequestId: requestId } }
      );

      // Update request with response
      await this.gdprRequestModel.updateOne(
        { id: requestId },
        {
          status: 'completed',
          completedAt: new Date(),
          responseData: encryptedResponse,
          processingNotes: 'Data access request processed successfully',
        }
      );

      // Log completion
      await this.auditService.logDataPrivacyEvent(
        'data_access',
        request.userId,
        {
          dataType: 'user_data',
          requestId,
        }
      );

      return dataExport;

    } catch (error) {
      this.logger.error('Failed to process data access request', error.stack);
      await this.updateRequestStatus(requestId, 'rejected', processedBy, error.message);
      throw error;
    }
  }

  /**
   * Process data erasure request (Article 17 - Right to be Forgotten)
   */
  async processDataErasureRequest(requestId: string, processedBy: string): Promise<void> {
    try {
      const request = await this.gdprRequestModel.findOne({ 
        id: requestId, 
        requestType: 'erasure' 
      });

      if (!request) {
        throw new Error('Erasure request not found');
      }

      await this.updateRequestStatus(requestId, 'processing', processedBy);

      // Check if erasure is legally permissible
      const erasureCheck = await this.validateErasureRequest(request.userId);
      if (!erasureCheck.permitted) {
        await this.updateRequestStatus(
          requestId, 
          'rejected', 
          processedBy, 
          erasureCheck.reason
        );
        return;
      }

      // Perform systematic data erasure
      const erasureResults = await this.performDataErasure(request.userId);

      // Update request status
      await this.gdprRequestModel.updateOne(
        { id: requestId },
        {
          status: 'completed',
          completedAt: new Date(),
          responseData: await this.encryptionService.encryptUserData(
            JSON.stringify(erasureResults)
          ),
          processingNotes: 'Data erasure completed successfully',
        }
      );

      // Log erasure completion
      await this.auditService.logDataPrivacyEvent(
        'data_deletion',
        request.userId,
        {
          dataType: 'user_data',
          requestId,
        }
      );

    } catch (error) {
      this.logger.error('Failed to process data erasure request', error.stack);
      await this.updateRequestStatus(requestId, 'rejected', processedBy, error.message);
      throw error;
    }
  }

  /**
   * Process data portability request (Article 20)
   */
  async processDataPortabilityRequest(
    requestId: string, 
    format: 'json' | 'csv' | 'xml' = 'json',
    processedBy: string
  ): Promise<DataPortabilityExport> {
    try {
      const request = await this.gdprRequestModel.findOne({ 
        id: requestId, 
        requestType: 'portability' 
      });

      if (!request) {
        throw new Error('Portability request not found');
      }

      await this.updateRequestStatus(requestId, 'processing', processedBy);

      // Gather portable data (data provided by user or processed with consent)
      const portableData = await this.gatherPortableData(request.userId);

      // Create export file
      const exportData: DataPortabilityExport = {
        userId: request.userId,
        userEmail: request.userEmail,
        exportedAt: new Date(),
        dataFormat: format,
        dataCategories: Object.keys(portableData),
        exportSize: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        metadata: {
          requestId,
          compressionType: 'gzip',
          includeMetadata: true,
        },
      };

      // Generate secure download
      const exportFile = await this.createDataExportFile(portableData, format);
      exportData.exportSize = exportFile.size;
      exportData.downloadUrl = await this.generateSecureDownloadUrl(
        exportFile.path,
        request.userId
      );

      // Save export record
      const savedExport = await this.exportModel.create(exportData);

      // Update request status
      await this.gdprRequestModel.updateOne(
        { id: requestId },
        {
          status: 'completed',
          completedAt: new Date(),
          processingNotes: 'Data portability export generated successfully',
        }
      );

      // Log portability completion
      await this.auditService.logDataPrivacyEvent(
        'data_export',
        request.userId,
        {
          dataType: 'user_data',
          requestId,
        }
      );

      return savedExport;

    } catch (error) {
      this.logger.error('Failed to process data portability request', error.stack);
      await this.updateRequestStatus(requestId, 'rejected', processedBy, error.message);
      throw error;
    }
  }

  /**
   * Manage user consent records
   */
  async recordConsent(
    userId: string,
    userEmail: string,
    consentType: ConsentRecord['consentType'],
    consentStatus: 'granted' | 'withdrawn',
    consentDetails: Partial<ConsentRecord>,
    metadata: ConsentRecord['metadata']
  ): Promise<ConsentRecord> {
    try {
      const consent: ConsentRecord = {
        id: await this.generateConsentId(),
        userId,
        userEmail,
        consentType,
        consentStatus,
        consentVersion: this.getCurrentConsentVersion(consentType),
        consentText: await this.getConsentText(consentType, consentDetails.consentVersion),
        legalBasis: consentDetails.legalBasis || 'consent',
        source: consentDetails.source || 'settings',
        processingPurposes: consentDetails.processingPurposes || [],
        dataCategories: consentDetails.dataCategories || [],
        retentionPeriod: consentDetails.retentionPeriod || 365,
        thirdPartySharing: consentDetails.thirdPartySharing || false,
        automatedDecisionMaking: consentDetails.automatedDecisionMaking || false,
        metadata,
        ...(consentStatus === 'granted' && { grantedAt: new Date() }),
        ...(consentStatus === 'withdrawn' && { withdrawnAt: new Date() }),
      };

      const savedConsent = await this.consentModel.create(consent);

      // Log consent change
      await this.auditService.logDataPrivacyEvent(
        consentStatus === 'granted' ? 'consent_given' : 'consent_withdrawn',
        userId,
        {
          dataType: 'consent',
        },
        {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        }
      );

      // Update user preferences
      await this.updateUserPrivacyPreferences(userId, consentType, consentStatus);

      return savedConsent;

    } catch (error) {
      this.logger.error('Failed to record consent', error.stack);
      throw new Error('Consent recording failed');
    }
  }

  /**
   * Get current user consent status
   */
  async getUserConsentStatus(userId: string): Promise<Record<string, ConsentRecord>> {
    try {
      const latestConsents = await this.consentModel.aggregate([
        { $match: { userId } },
        { $sort: { grantedAt: -1, withdrawnAt: -1 } },
        {
          $group: {
            _id: '$consentType',
            latestConsent: { $first: '$$ROOT' },
          },
        },
      ]);

      const consentStatus: Record<string, ConsentRecord> = {};
      for (const consent of latestConsents) {
        consentStatus[consent._id] = consent.latestConsent;
      }

      return consentStatus;

    } catch (error) {
      this.logger.error('Failed to get user consent status', error.stack);
      throw new Error('Consent status retrieval failed');
    }
  }

  /**
   * Check if processing is lawful under GDPR
   */
  async validateProcessingLawfulness(
    userId: string,
    processingPurpose: string,
    dataType: string
  ): Promise<{ lawful: boolean; legalBasis: string; reason?: string }> {
    try {
      // Get user consent status
      const consentStatus = await this.getUserConsentStatus(userId);

      // Check if consent is required
      const consentRequired = this.isConsentRequired(processingPurpose, dataType);

      if (consentRequired) {
        const relevantConsent = this.findRelevantConsent(
          consentStatus, 
          processingPurpose, 
          dataType
        );

        if (!relevantConsent || relevantConsent.consentStatus !== 'granted') {
          return {
            lawful: false,
            legalBasis: 'consent',
            reason: 'Valid consent not found or withdrawn',
          };
        }

        return {
          lawful: true,
          legalBasis: 'consent',
        };
      }

      // Check other legal bases
      const legalBasis = this.determineLegalBasisForProcessing(
        processingPurpose,
        dataType
      );

      return {
        lawful: true,
        legalBasis,
      };

    } catch (error) {
      this.logger.error('Failed to validate processing lawfulness', error.stack);
      return {
        lawful: false,
        legalBasis: 'unknown',
        reason: 'Validation failed',
      };
    }
  }

  /**
   * Generate GDPR compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const [
        gdprRequests,
        consentMetrics,
        processingActivities,
        dataBreaches,
      ] = await Promise.all([
        this.getGDPRRequestsMetrics(startDate, endDate),
        this.getConsentMetrics(startDate, endDate),
        this.getProcessingActivitiesReport(startDate, endDate),
        this.getDataBreachesReport(startDate, endDate),
      ]);

      const report = {
        reportPeriod: { startDate, endDate },
        generatedAt: new Date(),
        gdprRequests,
        consentMetrics,
        processingActivities,
        dataBreaches,
        complianceScore: this.calculateComplianceScore({
          gdprRequests,
          consentMetrics,
          dataBreaches,
        }),
        recommendations: this.generateComplianceRecommendations({
          gdprRequests,
          consentMetrics,
          dataBreaches,
        }),
      };

      // Log report generation
      await this.auditService.logComplianceEvent(
        'compliance_review',
        'compliance_monitoring',
        {
          reportPeriod: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          complianceScore: report.complianceScore,
        }
      );

      return report;

    } catch (error) {
      this.logger.error('Failed to generate compliance report', error.stack);
      throw new Error('Compliance report generation failed');
    }
  }

  /**
   * Private helper methods
   */
  private async generateRequestId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `gdpr_${timestamp}_${random}`;
  }

  private async generateConsentId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `consent_${timestamp}_${random}`;
  }

  private determineLegalBasis(requestType: string): string {
    const legalBasisMap = {
      access: 'Data subject rights under Article 15',
      rectification: 'Data subject rights under Article 16',
      erasure: 'Data subject rights under Article 17',
      portability: 'Data subject rights under Article 20',
      restriction: 'Data subject rights under Article 18',
      objection: 'Data subject rights under Article 21',
    };
    return legalBasisMap[requestType] || 'GDPR data subject rights';
  }

  private determinePriority(
    requestType: string,
    requestData: any
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (requestType === 'erasure') return 'high';
    if (requestData?.urgent) return 'urgent';
    if (requestType === 'access' || requestType === 'portability') return 'medium';
    return 'low';
  }

  private async updateRequestStatus(
    requestId: string,
    status: GDPRRequest['status'],
    processedBy?: string,
    notes?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'processing') {
      updateData.processedAt = new Date();
      updateData.assignedTo = processedBy;
    }
    
    if (status === 'completed' || status === 'rejected') {
      updateData.completedAt = new Date();
      if (notes) updateData.processingNotes = notes;
      if (status === 'rejected') updateData.rejectionReason = notes;
    }

    await this.gdprRequestModel.updateOne({ id: requestId }, updateData);
  }

  private async gatherUserData(userId: string): Promise<any> {
    // Implementation would gather data from all relevant systems
    // This is a simplified structure
    return {
      personalData: {},
      processingActivities: [],
      consentHistory: [],
      dataRetention: {},
      thirdPartySharing: [],
      automatedDecisionMaking: [],
      dataTransfers: [],
      securityMeasures: {},
    };
  }

  private async validateErasureRequest(userId: string): Promise<{
    permitted: boolean;
    reason?: string;
  }> {
    // Check legal obligations, contract fulfillment, etc.
    return { permitted: true };
  }

  private async performDataErasure(userId: string): Promise<any> {
    // Implementation would systematically erase data across all systems
    return {
      systemsProcessed: [],
      retainedData: {},
      retentionReasons: [],
    };
  }

  private getCurrentConsentVersion(consentType: string): string {
    return this.configService.get(`gdpr.consent.versions.${consentType}`, '1.0');
  }

  private async getConsentText(consentType: string, version?: string): Promise<string> {
    // Implementation would return versioned consent text
    return `Consent text for ${consentType} version ${version || 'latest'}`;
  }

  private isConsentRequired(processingPurpose: string, dataType: string): boolean {
    // Implementation would check if consent is required based on purpose and data type
    const consentRequiredPurposes = ['marketing', 'analytics', 'advertising'];
    return consentRequiredPurposes.includes(processingPurpose);
  }

  private calculateComplianceScore(metrics: any): number {
    // Implementation would calculate compliance score based on various metrics
    return 85; // Example score
  }

  // Additional private methods would be implemented for complete functionality
  private async autoAssignRequest(request: GDPRRequest): Promise<void> {}
  private async notifyDataProtectionTeam(request: GDPRRequest): Promise<void> {}
  private async gatherPortableData(userId: string): Promise<any> { return {}; }
  private async createDataExportFile(data: any, format: string): Promise<{ size: number; path: string }> { return { size: 0, path: '' }; }
  private async generateSecureDownloadUrl(path: string, userId: string): Promise<string> { return ''; }
  private async updateUserPrivacyPreferences(userId: string, consentType: string, status: string): Promise<void> {}
  private findRelevantConsent(consentStatus: Record<string, ConsentRecord>, purpose: string, dataType: string): ConsentRecord | null { return null; }
  private determineLegalBasisForProcessing(purpose: string, dataType: string): string { return 'legitimate_interests'; }
  private async getGDPRRequestsMetrics(start: Date, end: Date): Promise<any> { return {}; }
  private async getConsentMetrics(start: Date, end: Date): Promise<any> { return {}; }
  private async getProcessingActivitiesReport(start: Date, end: Date): Promise<any> { return {}; }
  private async getDataBreachesReport(start: Date, end: Date): Promise<any> { return {}; }
  private generateComplianceRecommendations(metrics: any): string[] { return []; }
}
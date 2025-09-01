import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { AuditService } from './audit.service';

export interface GDPRRequest {
  id?: string;
  userId: string;
  type: 'access' | 'portability' | 'rectification' | 'erasure' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestDate: Date;
  completionDate?: Date;
  requestedData?: string[];
  processedBy?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ConsentRecord {
  id?: string;
  userId: string;
  consentType: string;
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface DataExportResult {
  userId: string;
  exportDate: Date;
  dataCategories: string[];
  totalRecords: number;
  fileSize: number;
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * GDPR Compliance Service
 * Handles data subject rights, consent management, and privacy controls
 */
@Injectable()
export class GDPRComplianceService {
  private readonly logger = new Logger(GDPRComplianceService.name);

  constructor(
    private configService: ConfigService,
    private auditService: AuditService,
    @InjectModel('GDPRRequest') private gdprRequestModel: Model<GDPRRequest>,
    @InjectModel('ConsentRecord') private consentModel: Model<ConsentRecord>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Board') private boardModel: Model<any>,
    @InjectModel('Card') private cardModel: Model<any>,
  ) {}

  /**
   * Handle data subject access request (Article 15)
   */
  async handleAccessRequest(
    userId: string,
    requestedBy: string,
    clientInfo?: any
  ): Promise<GDPRRequest> {
    this.logger.log(`Processing GDPR access request for user ${userId}`);

    // Create GDPR request record
    const gdprRequest = new this.gdprRequestModel({
      userId,
      type: 'access',
      status: 'processing',
      requestDate: new Date(),
      processedBy: requestedBy,
      requestedData: ['personal', 'boards', 'cards', 'activity', 'preferences'],
    });

    await gdprRequest.save();

    // Log the request
    await this.auditService.logDataAccessEvent(
      userId,
      'gdpr_request',
      'create',
      gdprRequest.id,
      clientInfo,
      { requestType: 'access' }
    );

    // Process the request asynchronously
    this.processAccessRequest(gdprRequest).catch(error => {
      this.logger.error('Failed to process access request', error);
    });

    return gdprRequest;
  }

  /**
   * Handle data portability request (Article 20)
   */
  async handlePortabilityRequest(
    userId: string,
    requestedBy: string,
    format: 'json' | 'csv' | 'xml' = 'json',
    clientInfo?: any
  ): Promise<GDPRRequest> {
    this.logger.log(`Processing GDPR portability request for user ${userId}`);

    const gdprRequest = new this.gdprRequestModel({
      userId,
      type: 'portability',
      status: 'processing',
      requestDate: new Date(),
      processedBy: requestedBy,
      metadata: { format },
    });

    await gdprRequest.save();

    await this.auditService.logDataAccessEvent(
      userId,
      'gdpr_request',
      'create',
      gdprRequest.id,
      clientInfo,
      { requestType: 'portability', format }
    );

    // Process the request asynchronously
    this.processPortabilityRequest(gdprRequest, format).catch(error => {
      this.logger.error('Failed to process portability request', error);
    });

    return gdprRequest;
  }

  /**
   * Handle data erasure request (Article 17 - Right to be Forgotten)
   */
  async handleErasureRequest(
    userId: string,
    requestedBy: string,
    reason: string,
    clientInfo?: any
  ): Promise<GDPRRequest> {
    this.logger.log(`Processing GDPR erasure request for user ${userId}`);

    const gdprRequest = new this.gdprRequestModel({
      userId,
      type: 'erasure',
      status: 'processing',
      requestDate: new Date(),
      processedBy: requestedBy,
      notes: reason,
    });

    await gdprRequest.save();

    await this.auditService.logDataAccessEvent(
      userId,
      'gdpr_request',
      'create',
      gdprRequest.id,
      clientInfo,
      { requestType: 'erasure', reason }
    );

    // Process the request asynchronously
    this.processErasureRequest(gdprRequest).catch(error => {
      this.logger.error('Failed to process erasure request', error);
    });

    return gdprRequest;
  }

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    version: string,
    clientInfo?: any
  ): Promise<ConsentRecord> {
    const consentRecord = new this.consentModel({
      userId,
      consentType,
      granted,
      timestamp: new Date(),
      version,
      ipAddress: clientInfo?.ip,
      userAgent: clientInfo?.userAgent,
      metadata: clientInfo,
    });

    await consentRecord.save();

    await this.auditService.logDataAccessEvent(
      userId,
      'consent',
      'create',
      consentRecord.id,
      clientInfo,
      { consentType, granted, version }
    );

    this.logger.log(`Consent recorded for user ${userId}: ${consentType} = ${granted}`);

    return consentRecord;
  }

  /**
   * Check if user has given consent for specific purpose
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const latestConsent = await this.consentModel
      .findOne({ userId, consentType })
      .sort({ timestamp: -1 })
      .exec();

    return latestConsent ? latestConsent.granted : false;
  }

  /**
   * Get user's consent history
   */
  async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    return this.consentModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .exec();
  }

  /**
   * Anonymize user data (for data retention compliance)
   */
  async anonymizeUserData(userId: string, reason: string): Promise<void> {
    this.logger.log(`Anonymizing data for user ${userId}, reason: ${reason}`);

    const anonymousId = this.generateAnonymousId(userId);
    
    try {
      // Anonymize user profile
      await this.userModel.updateOne(
        { _id: userId },
        {
          $set: {
            email: `${anonymousId}@anonymized.local`,
            name: 'Anonymized User',
            avatar: null,
            phone: null,
            address: null,
            dateOfBirth: null,
            anonymized: true,
            anonymizedAt: new Date(),
            anonymizationReason: reason,
          },
          $unset: {
            socialLogins: 1,
            preferences: 1,
            lastLoginAt: 1,
            loginHistory: 1,
          }
        }
      );

      // Anonymize board data (keep structure but remove personal info)
      await this.boardModel.updateMany(
        { owner: userId },
        {
          $set: {
            title: 'Anonymized Board',
            description: null,
            anonymized: true,
          }
        }
      );

      // Anonymize cards (keep content but remove personal identifiers)
      await this.cardModel.updateMany(
        { createdBy: userId },
        {
          $set: {
            createdBy: anonymousId,
            anonymized: true,
          },
          $unset: {
            attachments: 1,
            mentions: 1,
          }
        }
      );

      // Log anonymization
      await this.auditService.logDataAccessEvent(
        userId,
        'user_data',
        'update',
        userId,
        undefined,
        { operation: 'anonymization', reason, anonymousId }
      );

      this.logger.log(`Data anonymization completed for user ${userId}`);

    } catch (error) {
      this.logger.error(`Failed to anonymize data for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Export user data for portability
   */
  async exportUserData(
    userId: string,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<DataExportResult> {
    this.logger.log(`Exporting data for user ${userId} in ${format} format`);

    try {
      // Collect all user data
      const userData = await this.collectUserData(userId);
      
      // Convert to requested format
      let exportData: string;
      let fileExtension: string;
      
      switch (format) {
        case 'json':
          exportData = JSON.stringify(userData, null, 2);
          fileExtension = 'json';
          break;
        case 'csv':
          exportData = this.convertToCSV(userData);
          fileExtension = 'csv';
          break;
        case 'xml':
          exportData = this.convertToXML(userData);
          fileExtension = 'xml';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Generate secure download URL
      const filename = `user_data_${userId}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      const downloadUrl = await this.generateSecureDownloadUrl(exportData, filename, userId);
      
      const exportResult: DataExportResult = {
        userId,
        exportDate: new Date(),
        dataCategories: Object.keys(userData),
        totalRecords: this.countRecords(userData),
        fileSize: Buffer.byteLength(exportData, 'utf8'),
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      // Log export
      await this.auditService.logDataAccessEvent(
        userId,
        'user_data',
        'export',
        userId,
        undefined,
        { format, fileSize: exportResult.fileSize, categories: exportResult.dataCategories }
      );

      return exportResult;

    } catch (error) {
      this.logger.error(`Failed to export data for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get GDPR request status
   */
  async getGDPRRequestStatus(requestId: string): Promise<GDPRRequest> {
    return this.gdprRequestModel.findById(requestId).exec();
  }

  /**
   * List GDPR requests for a user
   */
  async getUserGDPRRequests(userId: string): Promise<GDPRRequest[]> {
    return this.gdprRequestModel
      .find({ userId })
      .sort({ requestDate: -1 })
      .exec();
  }

  /**
   * Process access request (internal)
   */
  private async processAccessRequest(gdprRequest: GDPRRequest): Promise<void> {
    try {
      // Collect user data
      const userData = await this.collectUserData(gdprRequest.userId);
      
      // Generate access report
      const accessReport = {
        requestId: gdprRequest.id,
        userId: gdprRequest.userId,
        requestDate: gdprRequest.requestDate,
        dataCategories: Object.keys(userData),
        data: userData,
        summary: {
          totalRecords: this.countRecords(userData),
          lastUpdated: new Date(),
        },
      };

      // Update request status
      await this.gdprRequestModel.updateOne(
        { _id: gdprRequest.id },
        {
          $set: {
            status: 'completed',
            completionDate: new Date(),
            metadata: { accessReport },
          }
        }
      );

      this.logger.log(`Access request completed for user ${gdprRequest.userId}`);

    } catch (error) {
      await this.gdprRequestModel.updateOne(
        { _id: gdprRequest.id },
        {
          $set: {
            status: 'rejected',
            completionDate: new Date(),
            notes: `Error: ${error.message}`,
          }
        }
      );
      
      throw error;
    }
  }

  /**
   * Process portability request (internal)
   */
  private async processPortabilityRequest(
    gdprRequest: GDPRRequest,
    format: string
  ): Promise<void> {
    try {
      const exportResult = await this.exportUserData(gdprRequest.userId, format as any);
      
      await this.gdprRequestModel.updateOne(
        { _id: gdprRequest.id },
        {
          $set: {
            status: 'completed',
            completionDate: new Date(),
            metadata: { exportResult },
          }
        }
      );

      this.logger.log(`Portability request completed for user ${gdprRequest.userId}`);

    } catch (error) {
      await this.gdprRequestModel.updateOne(
        { _id: gdprRequest.id },
        {
          $set: {
            status: 'rejected',
            completionDate: new Date(),
            notes: `Error: ${error.message}`,
          }
        }
      );
      
      throw error;
    }
  }

  /**
   * Process erasure request (internal)
   */
  private async processErasureRequest(gdprRequest: GDPRRequest): Promise<void> {
    try {
      // Check if user has active legal obligations
      const hasLegalObligations = await this.checkLegalObligations(gdprRequest.userId);
      
      if (hasLegalObligations) {
        await this.gdprRequestModel.updateOne(
          { _id: gdprRequest.id },
          {
            $set: {
              status: 'rejected',
              completionDate: new Date(),
              notes: 'Erasure rejected due to legal obligations',
            }
          }
        );
        return;
      }

      // Perform data erasure
      await this.eraseUserData(gdprRequest.userId);
      
      await this.gdprRequestModel.updateOne(
        { _id: gdprRequest.id },
        {
          $set: {
            status: 'completed',
            completionDate: new Date(),
          }
        }
      );

      this.logger.log(`Erasure request completed for user ${gdprRequest.userId}`);

    } catch (error) {
      await this.gdprRequestModel.updateOne(
        { _id: gdprRequest.id },
        {
          $set: {
            status: 'rejected',
            completionDate: new Date(),
            notes: `Error: ${error.message}`,
          }
        }
      );
      
      throw error;
    }
  }

  /**
   * Collect all user data
   */
  private async collectUserData(userId: string): Promise<any> {
    const [user, boards, cards, consents] = await Promise.all([
      this.userModel.findById(userId).lean(),
      this.boardModel.find({ owner: userId }).lean(),
      this.cardModel.find({ createdBy: userId }).lean(),
      this.consentModel.find({ userId }).lean(),
    ]);

    return {
      personalData: this.sanitizePersonalData(user),
      boards: boards.map(board => this.sanitizeBoardData(board)),
      cards: cards.map(card => this.sanitizeCardData(card)),
      consents: consents,
      metadata: {
        exportDate: new Date(),
        totalBoards: boards.length,
        totalCards: cards.length,
        accountCreated: user?.createdAt,
        lastActive: user?.lastLoginAt,
      },
    };
  }

  /**
   * Sanitize personal data for export
   */
  private sanitizePersonalData(user: any): any {
    if (!user) return null;

    const { password, salt, resetToken, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Sanitize board data for export
   */
  private sanitizeBoardData(board: any): any {
    return {
      id: board._id,
      title: board.title,
      description: board.description,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      isPrivate: board.isPrivate,
      theme: board.theme,
    };
  }

  /**
   * Sanitize card data for export
   */
  private sanitizeCardData(card: any): any {
    return {
      id: card._id,
      title: card.title,
      description: card.description,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      boardId: card.boardId,
      position: card.position,
      labels: card.labels,
    };
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simple CSV conversion - would need more sophisticated implementation
    const lines: string[] = [];
    
    // Add header
    lines.push('Category,Type,ID,Data');
    
    // Add data rows
    Object.entries(data).forEach(([category, items]) => {
      if (Array.isArray(items)) {
        items.forEach(item => {
          const csvRow = [
            category,
            item.type || 'record',
            item.id || item._id || '',
            JSON.stringify(item).replace(/"/g, '""')
          ].map(field => `"${field}"`).join(',');
          lines.push(csvRow);
        });
      } else {
        const csvRow = [
          category,
          'metadata',
          '',
          JSON.stringify(items).replace(/"/g, '""')
        ].map(field => `"${field}"`).join(',');
        lines.push(csvRow);
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Convert data to XML format
   */
  private convertToXML(data: any): string {
    // Simple XML conversion - would need more sophisticated implementation
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<userdata>\n';
    
    Object.entries(data).forEach(([category, items]) => {
      xml += `  <${category}>\n`;
      
      if (Array.isArray(items)) {
        items.forEach(item => {
          xml += '    <item>\n';
          Object.entries(item).forEach(([key, value]) => {
            xml += `      <${key}>${this.escapeXML(String(value))}</${key}>\n`;
          });
          xml += '    </item>\n';
        });
      } else {
        xml += `    <data>${this.escapeXML(JSON.stringify(items))}</data>\n`;
      }
      
      xml += `  </${category}>\n`;
    });
    
    xml += '</userdata>';
    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Count total records in exported data
   */
  private countRecords(data: any): number {
    let count = 0;
    
    Object.values(data).forEach(value => {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (value && typeof value === 'object') {
        count += 1;
      }
    });
    
    return count;
  }

  /**
   * Generate secure download URL for exported data
   */
  private async generateSecureDownloadUrl(
    data: string,
    filename: string,
    userId: string
  ): Promise<string> {
    // In a real implementation, this would upload to S3 with a pre-signed URL
    // For now, return a placeholder
    const token = crypto.randomBytes(32).toString('hex');
    return `https://api.madplan.com/gdpr/download/${userId}/${token}/${filename}`;
  }

  /**
   * Generate anonymous ID for anonymization
   */
  private generateAnonymousId(userId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(userId + this.configService.get('ANONYMIZATION_SALT', 'default-salt'));
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Check for legal obligations that prevent erasure
   */
  private async checkLegalObligations(userId: string): Promise<boolean> {
    // Check for active legal proceedings, tax obligations, etc.
    // This is a simplified check - real implementation would be more comprehensive
    const user = await this.userModel.findById(userId);
    
    // Example: Check if user has been flagged for legal review
    return user?.legalHold === true || user?.taxAudit === true;
  }

  /**
   * Permanently erase user data
   */
  private async eraseUserData(userId: string): Promise<void> {
    // Delete user account
    await this.userModel.deleteOne({ _id: userId });
    
    // Delete or anonymize associated data
    await this.boardModel.deleteMany({ owner: userId });
    await this.cardModel.deleteMany({ createdBy: userId });
    
    // Keep GDPR requests for compliance but mark as erased
    await this.gdprRequestModel.updateMany(
      { userId },
      { $set: { userErased: true } }
    );
    
    // Log erasure
    await this.auditService.logDataAccessEvent(
      userId,
      'user_data',
      'delete',
      userId,
      undefined,
      { operation: 'gdpr_erasure', permanent: true }
    );
  }
}
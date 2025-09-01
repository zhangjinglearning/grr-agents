import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { GDPRComplianceService, GDPRRequest, ConsentRecord } from '../services/gdpr-compliance.service';
import { AuditLoggingService } from '../../security/services/audit-logging.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    roles: Role[];
  };
}

@ApiTags('Privacy & GDPR')
@Controller('privacy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PrivacyController {
  constructor(
    private readonly gdprService: GDPRComplianceService,
    private readonly auditService: AuditLoggingService,
  ) {}

  /**
   * Submit GDPR Data Request (Article 15, 16, 17, 18, 20, 21)
   */
  @Post('gdpr-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit GDPR data subject request' })
  @ApiResponse({ status: 201, description: 'GDPR request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async submitGDPRRequest(
    @Req() req: AuthenticatedRequest,
    @Body() requestData: {
      requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
      description?: string;
      specificData?: string[];
      verificationMethod: 'email' | 'identity_document' | 'security_questions';
    }
  ): Promise<{ requestId: string; status: string; estimatedProcessingTime: string }> {
    try {
      const { requestType, description, specificData, verificationMethod } = requestData;

      if (!requestType) {
        throw new BadRequestException('Request type is required');
      }

      const validRequestTypes = ['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'];
      if (!validRequestTypes.includes(requestType)) {
        throw new BadRequestException('Invalid request type');
      }

      const metadata = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        requestedFields: specificData || [],
        dataCategories: this.determineDataCategories(requestType, specificData),
        processingsystems: ['web_app', 'mobile_app', 'api'],
        verificationMethod,
        verificationStatus: 'pending' as const,
      };

      const gdprRequest = await this.gdprService.submitGDPRRequest(
        req.user.id,
        req.user.email,
        requestType,
        { description, specificData },
        metadata
      );

      // Log the request submission for audit
      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'gdpr_request_api_call',
        requestType,
        'submitted',
        {
          requestId: gdprRequest.id,
          endpoint: '/privacy/gdpr-request',
          ipAddress: req.ip,
        }
      );

      return {
        requestId: gdprRequest.id,
        status: gdprRequest.status,
        estimatedProcessingTime: this.getEstimatedProcessingTime(requestType),
      };

    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to submit GDPR request');
    }
  }

  /**
   * Get user's GDPR request status
   */
  @Get('gdpr-request/:requestId')
  @ApiOperation({ summary: 'Get GDPR request status' })
  @ApiResponse({ status: 200, description: 'GDPR request details retrieved' })
  @ApiResponse({ status: 404, description: 'GDPR request not found' })
  async getGDPRRequestStatus(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string
  ): Promise<{
    requestId: string;
    requestType: string;
    status: string;
    submittedAt: Date;
    estimatedCompletion?: Date;
    lastUpdate?: Date;
  }> {
    try {
      // This would need to be implemented in the GDPR service
      // For now, returning a basic response structure
      
      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'gdpr_status_check',
        'request_status',
        'viewed',
        {
          requestId,
          endpoint: `/privacy/gdpr-request/${requestId}`,
          ipAddress: req.ip,
        }
      );

      // Implementation would fetch actual request from database
      return {
        requestId,
        requestType: 'access',
        status: 'processing',
        submittedAt: new Date(),
        estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lastUpdate: new Date(),
      };

    } catch (error) {
      throw new NotFoundException('GDPR request not found');
    }
  }

  /**
   * Manage user consent preferences
   */
  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user consent preferences' })
  @ApiResponse({ status: 200, description: 'Consent preferences updated' })
  async updateConsent(
    @Req() req: AuthenticatedRequest,
    @Body() consentData: {
      consentType: 'marketing' | 'analytics' | 'functional' | 'performance' | 'advertising' | 'third_party';
      consentStatus: 'granted' | 'withdrawn';
      source?: 'settings' | 'banner' | 'email';
    }
  ): Promise<{ success: boolean; consentId: string }> {
    try {
      const { consentType, consentStatus, source = 'settings' } = consentData;

      const metadata = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        pageUrl: req.get('Referer'),
        consentMethod: consentStatus === 'granted' ? 'explicit' : 'withdrawn' as const,
      };

      const consentRecord = await this.gdprService.recordConsent(
        req.user.id,
        req.user.email,
        consentType,
        consentStatus,
        {
          source,
          legalBasis: 'consent',
          processingPurposes: this.getProcessingPurposes(consentType),
          dataCategories: this.getDataCategories(consentType),
          retentionPeriod: this.getRetentionPeriod(consentType),
          thirdPartySharing: this.hasThirdPartySharing(consentType),
          automatedDecisionMaking: this.hasAutomatedDecisionMaking(consentType),
        },
        metadata
      );

      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'consent_updated',
        consentType,
        consentStatus,
        {
          consentId: consentRecord.id,
          source,
          endpoint: '/privacy/consent',
          ipAddress: req.ip,
        }
      );

      return {
        success: true,
        consentId: consentRecord.id,
      };

    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to update consent');
    }
  }

  /**
   * Get user's current consent status
   */
  @Get('consent')
  @ApiOperation({ summary: 'Get user consent preferences' })
  @ApiResponse({ status: 200, description: 'User consent preferences retrieved' })
  async getConsentStatus(
    @Req() req: AuthenticatedRequest
  ): Promise<Record<string, {
    status: 'granted' | 'withdrawn' | 'not_set';
    lastUpdated?: Date;
    version: string;
    purposes: string[];
  }>> {
    try {
      const consentStatus = await this.gdprService.getUserConsentStatus(req.user.id);

      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'consent_status_viewed',
        'consent_preferences',
        'viewed',
        {
          endpoint: '/privacy/consent',
          ipAddress: req.ip,
        }
      );

      // Transform the response for frontend consumption
      const response: Record<string, any> = {};
      
      const consentTypes = ['marketing', 'analytics', 'functional', 'performance', 'advertising', 'third_party'];
      
      for (const type of consentTypes) {
        const consent = consentStatus[type];
        response[type] = {
          status: consent?.consentStatus || 'not_set',
          lastUpdated: consent?.grantedAt || consent?.withdrawnAt,
          version: consent?.consentVersion || '1.0',
          purposes: consent?.processingPurposes || [],
        };
      }

      return response;

    } catch (error) {
      throw new BadRequestException('Failed to retrieve consent status');
    }
  }

  /**
   * Download user data export (for data portability requests)
   */
  @Get('data-export/:exportId')
  @ApiOperation({ summary: 'Download user data export' })
  @ApiResponse({ status: 200, description: 'Data export download initiated' })
  @ApiResponse({ status: 404, description: 'Export not found or expired' })
  async downloadDataExport(
    @Req() req: AuthenticatedRequest,
    @Param('exportId') exportId: string
  ): Promise<{ downloadUrl: string; expiresAt: Date; format: string; size: number }> {
    try {
      // Implementation would validate export ID and generate secure download URL
      
      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'data_export_downloaded',
        'data_portability',
        'success',
        {
          exportId,
          endpoint: `/privacy/data-export/${exportId}`,
          ipAddress: req.ip,
        }
      );

      return {
        downloadUrl: `https://secure-downloads.example.com/exports/${exportId}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        format: 'json',
        size: 1024 * 1024, // 1MB example
      };

    } catch (error) {
      throw new NotFoundException('Data export not found or expired');
    }
  }

  /**
   * Get privacy policy and data processing information
   */
  @Get('policy')
  @ApiOperation({ summary: 'Get privacy policy and data processing information' })
  @ApiResponse({ status: 200, description: 'Privacy policy information retrieved' })
  async getPrivacyPolicy(): Promise<{
    version: string;
    lastUpdated: Date;
    dataController: any;
    processingPurposes: any[];
    legalBases: any[];
    dataRetention: any;
    userRights: any[];
    contactInfo: any;
  }> {
    return {
      version: '2.0',
      lastUpdated: new Date('2024-01-01'),
      dataController: {
        name: 'MadPlan Inc.',
        address: '123 Privacy Street, Data City, DC 12345',
        email: 'privacy@madplan.com',
        phone: '+1-555-PRIVACY',
      },
      processingPurposes: [
        {
          purpose: 'Service Provision',
          description: 'To provide and maintain our project management services',
          legalBasis: 'contract',
          dataTypes: ['account_info', 'usage_data'],
        },
        {
          purpose: 'Communication',
          description: 'To send important service updates and notifications',
          legalBasis: 'legitimate_interests',
          dataTypes: ['contact_info'],
        },
      ],
      legalBases: [
        { basis: 'consent', description: 'You have given clear consent' },
        { basis: 'contract', description: 'Processing is necessary for a contract' },
        { basis: 'legal_obligation', description: 'Processing is necessary for legal compliance' },
        { basis: 'legitimate_interests', description: 'Processing is necessary for legitimate interests' },
      ],
      dataRetention: {
        accountData: '7 years after account closure',
        usageData: '2 years from collection',
        marketingData: 'Until consent withdrawn',
      },
      userRights: [
        'Right to access your data',
        'Right to rectify inaccurate data',
        'Right to erasure (right to be forgotten)',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object to processing',
        'Right to lodge a complaint',
      ],
      contactInfo: {
        dataProtectionOfficer: 'dpo@madplan.com',
        privacyQuestions: 'privacy@madplan.com',
        supervisoryAuthority: 'Your local data protection authority',
      },
    };
  }

  /**
   * Admin: Process GDPR requests (Data Protection Team only)
   */
  @Put('admin/gdpr-request/:requestId/process')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DATA_PROTECTION_OFFICER)
  @ApiOperation({ summary: 'Process GDPR request (Admin only)' })
  @ApiResponse({ status: 200, description: 'GDPR request processed' })
  async processGDPRRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
    @Body() processData: {
      action: 'approve' | 'reject' | 'process';
      notes?: string;
      format?: 'json' | 'csv' | 'xml';
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { action, notes, format = 'json' } = processData;

      // Verify admin has DPO role or admin role
      if (!req.user.roles.includes(Role.DATA_PROTECTION_OFFICER) && 
          !req.user.roles.includes(Role.ADMIN)) {
        throw new ForbiddenException('Insufficient permissions for GDPR request processing');
      }

      let result;
      switch (action) {
        case 'process':
          // Determine request type and process accordingly
          const requestType = 'access'; // This would be fetched from the request
          if (requestType === 'access') {
            result = await this.gdprService.processDataAccessRequest(requestId, req.user.email);
          } else if (requestType === 'erasure') {
            await this.gdprService.processDataErasureRequest(requestId, req.user.email);
          } else if (requestType === 'portability') {
            result = await this.gdprService.processDataPortabilityRequest(requestId, format, req.user.email);
          }
          break;
        default:
          throw new BadRequestException('Invalid action specified');
      }

      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'gdpr_request_processed',
        'admin_action',
        'success',
        {
          requestId,
          action,
          processedBy: req.user.email,
          endpoint: `/privacy/admin/gdpr-request/${requestId}/process`,
          ipAddress: req.ip,
        }
      );

      return {
        success: true,
        message: `GDPR request ${action}ed successfully`,
      };

    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to process GDPR request');
    }
  }

  /**
   * Admin: Generate compliance reports
   */
  @Get('admin/compliance-report')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DATA_PROTECTION_OFFICER)
  @ApiOperation({ summary: 'Generate GDPR compliance report (Admin only)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Compliance report generated' })
  async generateComplianceReport(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<any> {
    try {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const report = await this.gdprService.generateComplianceReport(start, end);

      await this.auditService.logDataPrivacyEvent(
        req.user.id,
        req.user.email,
        'compliance_report_generated',
        'admin_action',
        'success',
        {
          reportPeriod: `${start.toISOString()} to ${end.toISOString()}`,
          endpoint: '/privacy/admin/compliance-report',
          ipAddress: req.ip,
        }
      );

      return report;

    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to generate compliance report');
    }
  }

  /**
   * Private helper methods
   */
  private determineDataCategories(requestType: string, specificData?: string[]): string[] {
    if (specificData?.length) {
      return specificData;
    }

    const defaultCategories = {
      access: ['personal_data', 'usage_data', 'preferences', 'consent_records'],
      rectification: ['personal_data'],
      erasure: ['all_data'],
      portability: ['provided_data', 'generated_data'],
      restriction: ['specified_data'],
      objection: ['marketing_data', 'profiling_data'],
    };

    return defaultCategories[requestType] || ['personal_data'];
  }

  private getEstimatedProcessingTime(requestType: string): string {
    const processingTimes = {
      access: '30 days',
      rectification: '30 days',
      erasure: '30 days',
      portability: '30 days',
      restriction: '30 days',
      objection: '30 days',
    };

    return processingTimes[requestType] || '30 days';
  }

  private getProcessingPurposes(consentType: string): string[] {
    const purposeMap = {
      marketing: ['email_marketing', 'promotional_communications'],
      analytics: ['usage_analytics', 'performance_monitoring'],
      functional: ['service_provision', 'account_management'],
      performance: ['optimization', 'troubleshooting'],
      advertising: ['targeted_advertising', 'ad_personalization'],
      third_party: ['social_sharing', 'partner_integrations'],
    };

    return purposeMap[consentType] || [];
  }

  private getDataCategories(consentType: string): string[] {
    const categoryMap = {
      marketing: ['contact_info', 'preferences'],
      analytics: ['usage_data', 'performance_data'],
      functional: ['account_data', 'service_data'],
      performance: ['technical_data', 'error_logs'],
      advertising: ['behavioral_data', 'profile_data'],
      third_party: ['social_data', 'integration_data'],
    };

    return categoryMap[consentType] || [];
  }

  private getRetentionPeriod(consentType: string): number {
    const retentionMap = {
      marketing: 365 * 3, // 3 years
      analytics: 365 * 2, // 2 years
      functional: 365 * 7, // 7 years
      performance: 365 * 1, // 1 year
      advertising: 365 * 2, // 2 years
      third_party: 365 * 1, // 1 year
    };

    return retentionMap[consentType] || 365;
  }

  private hasThirdPartySharing(consentType: string): boolean {
    return ['advertising', 'third_party', 'marketing'].includes(consentType);
  }

  private hasAutomatedDecisionMaking(consentType: string): boolean {
    return ['advertising', 'analytics'].includes(consentType);
  }
}
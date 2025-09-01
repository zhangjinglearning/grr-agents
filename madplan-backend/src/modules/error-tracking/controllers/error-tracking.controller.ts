import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Role } from '../../../auth/enums/role.enum';
import { GetUser } from '../../../auth/decorators/get-user.decorator';
import { CrashReportingService, CrashData } from '../services/crash-reporting.service';
import { ErrorAnalysisService } from '../services/error-analysis.service';
import { ErrorTrackingService } from '../services/error-tracking.service';

export class ReportCrashDto {
  errorMessage: string;
  errorName: string;
  stackTrace?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  breadcrumbs?: Array<{
    message: string;
    category: string;
    timestamp: Date;
    level: string;
  }>;
}

export class ResolveCrashDto {
  resolution?: string;
}

export class ErrorQueryDto {
  startDate?: string;
  endDate?: string;
  severity?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

@ApiTags('Error Tracking')
@Controller('error-tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ErrorTrackingController {
  constructor(
    private readonly crashReportingService: CrashReportingService,
    private readonly errorAnalysisService: ErrorAnalysisService,
    private readonly errorTrackingService: ErrorTrackingService,
  ) {}

  @Post('crash')
  @ApiOperation({ summary: 'Report a crash' })
  @ApiResponse({ status: 201, description: 'Crash reported successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async reportCrash(
    @Body() crashDto: ReportCrashDto,
    @GetUser('id') userId: string,
  ) {
    try {
      const error = new Error(crashDto.errorMessage);
      error.name = crashDto.errorName;
      error.stack = crashDto.stackTrace;

      const crashData: CrashData = {
        error,
        userId,
        sessionId: crashDto.sessionId,
        userAgent: crashDto.userAgent,
        url: crashDto.url,
        severity: crashDto.severity,
        context: crashDto.context,
        stackTrace: crashDto.stackTrace,
        breadcrumbs: crashDto.breadcrumbs,
      };

      const crashId = await this.crashReportingService.reportCrash(crashData);

      return {
        success: true,
        data: { crashId },
        message: 'Crash reported successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to report crash',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('crashes')
  @ApiOperation({ summary: 'Get crash reports' })
  @ApiResponse({ status: 200, description: 'Crash reports retrieved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getCrashes(@Query() queryDto: ErrorQueryDto) {
    try {
      const startDate = queryDto.startDate ? new Date(queryDto.startDate) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = queryDto.endDate ? new Date(queryDto.endDate) : new Date();
      const limit = parseInt(queryDto.limit || '50');

      const crashes = await this.crashReportingService.getTopCrashes(
        startDate,
        endDate,
        limit,
      );

      return {
        success: true,
        data: crashes,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve crashes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('crash/:id')
  @ApiOperation({ summary: 'Get crash details' })
  @ApiResponse({ status: 200, description: 'Crash details retrieved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getCrashDetails(@Param('id') crashId: string) {
    try {
      const crash = await this.crashReportingService.getCrashDetails(crashId);
      const analysis = await this.crashReportingService.getCrashAnalysis(crashId);

      return {
        success: true,
        data: {
          crash,
          analysis,
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve crash details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('crash/:id/resolve')
  @ApiOperation({ summary: 'Resolve a crash' })
  @ApiResponse({ status: 200, description: 'Crash resolved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async resolveCrash(
    @Param('id') crashId: string,
    @Body() resolveDto: ResolveCrashDto,
    @GetUser('id') userId: string,
  ) {
    try {
      await this.crashReportingService.resolveCrash(crashId, userId);

      return {
        success: true,
        message: 'Crash resolved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to resolve crash',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get error trends' })
  @ApiResponse({ status: 200, description: 'Error trends retrieved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getErrorTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'hour' | 'day' | 'week' = 'day',
  ) {
    try {
      const start = startDate ? new Date(startDate) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const trends = await this.errorAnalysisService.getErrorTrends(start, end, groupBy);

      return {
        success: true,
        data: trends,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve error trends',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analysis/:errorId')
  @ApiOperation({ summary: 'Get error analysis' })
  @ApiResponse({ status: 200, description: 'Error analysis retrieved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getErrorAnalysis(@Param('errorId') errorId: string) {
    try {
      const analysis = await this.errorAnalysisService.analyzeError(errorId);

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to analyze error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Detect error anomalies' })
  @ApiResponse({ status: 200, description: 'Error anomalies detected successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async detectAnomalies(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : 
        new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const anomalies = await this.errorAnalysisService.detectAnomalies(start, end);

      return {
        success: true,
        data: anomalies,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to detect anomalies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get error statistics' })
  @ApiResponse({ status: 200, description: 'Error statistics retrieved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getErrorStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const statistics = await this.crashReportingService.getCrashStatistics(start, end);

      return {
        success: true,
        data: statistics,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve error statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('impact/:fingerprint')
  @ApiOperation({ summary: 'Get error impact analysis' })
  @ApiResponse({ status: 200, description: 'Error impact analysis retrieved successfully' })
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getErrorImpact(
    @Param('fingerprint') fingerprint: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const impact = await this.errorAnalysisService.getErrorImpactAnalysis(
        fingerprint,
        start,
        end,
      );

      return {
        success: true,
        data: impact,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve error impact analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('error')
  @ApiOperation({ summary: 'Log an error' })
  @ApiResponse({ status: 201, description: 'Error logged successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async logError(
    @Body() errorData: {
      message: string;
      name: string;
      stack?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      context?: Record<string, any>;
      url?: string;
      userAgent?: string;
      sessionId?: string;
    },
    @GetUser('id') userId: string,
  ) {
    try {
      const errorId = await this.errorTrackingService.logError({
        message: errorData.message,
        errorName: errorData.name,
        stackTrace: errorData.stack,
        severity: errorData.severity,
        context: errorData.context || {},
        url: errorData.url,
        userAgent: errorData.userAgent,
        sessionId: errorData.sessionId,
        userId,
        timestamp: new Date(),
      });

      return {
        success: true,
        data: { errorId },
        message: 'Error logged successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to log error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Get error tracking health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  @Roles(Role.ADMIN)
  async getHealthStatus() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [recentCrashes, recentErrors] = await Promise.all([
        this.crashReportingService.getCrashStatistics(oneHourAgo, now),
        this.errorAnalysisService.getErrorTrends(oneHourAgo, now, 'hour'),
      ]);

      const health = {
        status: 'healthy',
        timestamp: now,
        metrics: {
          recentCrashes: recentCrashes.totalCrashes,
          recentErrors: recentErrors.reduce((sum, trend) => sum + trend.errorCount, 0),
          criticalIssues: recentCrashes.severityDistribution?.critical || 0,
        },
        alerts: [],
      };

      // Add alerts based on thresholds
      if (health.metrics.criticalIssues > 10) {
        health.status = 'critical';
        health.alerts.push('High number of critical errors detected');
      } else if (health.metrics.recentCrashes > 50) {
        health.status = 'warning';
        health.alerts.push('Elevated crash rate detected');
      }

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve health status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

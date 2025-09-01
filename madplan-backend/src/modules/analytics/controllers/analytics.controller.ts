import {
  Controller,
  Get,
  Post,
  Body,
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
import { AnalyticsService, AnalyticsQuery } from '../services/analytics.service';

export class TrackEventDto {
  eventName: string;
  properties: Record<string, any>;
  sessionId?: string;
}

export class AnalyticsQueryDto {
  startDate: string;
  endDate: string;
  boardId?: string;
  userId?: string;
  eventType?: string;
  filters?: Record<string, any>;
}

export class FunnelAnalysisDto {
  funnelSteps: string[];
  startDate: string;
  endDate: string;
  boardId?: string;
}

export class RetentionAnalysisDto {
  startDate: string;
  endDate: string;
  cohortType?: 'daily' | 'weekly' | 'monthly';
}

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  @ApiOperation({ summary: 'Track an analytics event' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async trackEvent(
    @Body() trackEventDto: TrackEventDto,
    @GetUser('id') userId: string,
  ) {
    try {
      await this.analyticsService.trackEvent(
        trackEventDto.eventName,
        trackEventDto.properties,
        userId,
        trackEventDto.sessionId,
      );

      return {
        success: true,
        message: 'Event tracked successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to track event',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('data')
  @ApiOperation({ summary: 'Get analytics data' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getAnalytics(@Query() queryDto: AnalyticsQueryDto) {
    try {
      const query: AnalyticsQuery = {
        startDate: new Date(queryDto.startDate),
        endDate: new Date(queryDto.endDate),
        boardId: queryDto.boardId,
        userId: queryDto.userId,
        eventType: queryDto.eventType,
        filters: queryDto.filters,
      };

      const result = await this.analyticsService.getAnalytics(query);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve analytics data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user-journey')
  @ApiOperation({ summary: 'Get user journey analytics' })
  @ApiResponse({ status: 200, description: 'User journey data retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getUserJourney(
    @Query('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const journey = await this.analyticsService.getUserJourney(
        userId,
        new Date(startDate),
        new Date(endDate),
      );

      return {
        success: true,
        data: journey,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve user journey',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('funnel-analysis')
  @ApiOperation({ summary: 'Get funnel analysis' })
  @ApiResponse({ status: 200, description: 'Funnel analysis completed successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getFunnelAnalysis(@Body() funnelDto: FunnelAnalysisDto) {
    try {
      const analysis = await this.analyticsService.getFunnelAnalysis(
        funnelDto.funnelSteps,
        new Date(funnelDto.startDate),
        new Date(funnelDto.endDate),
        funnelDto.boardId,
      );

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to perform funnel analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('retention-analysis')
  @ApiOperation({ summary: 'Get retention analysis' })
  @ApiResponse({ status: 200, description: 'Retention analysis completed successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getRetentionAnalysis(@Body() retentionDto: RetentionAnalysisDto) {
    try {
      const analysis = await this.analyticsService.getRetentionAnalysis(
        new Date(retentionDto.startDate),
        new Date(retentionDto.endDate),
        retentionDto.cohortType || 'weekly',
      );

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to perform retention analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Get realtime analytics metrics' })
  @ApiResponse({ status: 200, description: 'Realtime metrics retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getRealtimeMetrics() {
    try {
      const metrics = await this.analyticsService.getRealtimeMetrics();

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve realtime metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('events/top')
  @ApiOperation({ summary: 'Get top events' })
  @ApiResponse({ status: 200, description: 'Top events retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getTopEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit: string = '10',
    @Query('boardId') boardId?: string,
  ) {
    try {
      const query: AnalyticsQuery = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        boardId,
      };

      const analytics = await this.analyticsService.getAnalytics(query);

      return {
        success: true,
        data: analytics.topEvents.slice(0, parseInt(limit)),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve top events',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/active')
  @ApiOperation({ summary: 'Get active users count' })
  @ApiResponse({ status: 200, description: 'Active users count retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getActiveUsers(
    @Query('period') period: string = '24h',
    @Query('boardId') boardId?: string,
  ) {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const query: AnalyticsQuery = {
        startDate,
        endDate: now,
        boardId,
      };

      const analytics = await this.analyticsService.getAnalytics(query);

      return {
        success: true,
        data: {
          activeUsers: analytics.uniqueUsers,
          period,
          startDate,
          endDate: now,
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve active users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('conversion-rate')
  @ApiOperation({ summary: 'Get conversion rate' })
  @ApiResponse({ status: 200, description: 'Conversion rate retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getConversionRate(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('conversionEvent') conversionEvent: string = 'conversion',
    @Query('boardId') boardId?: string,
  ) {
    try {
      const totalVisitorsQuery: AnalyticsQuery = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        boardId,
      };

      const conversionQuery: AnalyticsQuery = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        eventType: conversionEvent,
        boardId,
      };

      const [totalAnalytics, conversionAnalytics] = await Promise.all([
        this.analyticsService.getAnalytics(totalVisitorsQuery),
        this.analyticsService.getAnalytics(conversionQuery),
      ]);

      const conversionRate = totalAnalytics.uniqueUsers > 0 
        ? (conversionAnalytics.uniqueUsers / totalAnalytics.uniqueUsers) * 100 
        : 0;

      return {
        success: true,
        data: {
          totalVisitors: totalAnalytics.uniqueUsers,
          conversions: conversionAnalytics.uniqueUsers,
          conversionRate: Math.round(conversionRate * 100) / 100,
          conversionEvent,
          period: {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to calculate conversion rate',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

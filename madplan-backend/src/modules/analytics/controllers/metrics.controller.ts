import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  Param,
  UseGuards,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Role } from '../../../auth/enums/role.enum';
import { GetUser } from '../../../auth/decorators/get-user.decorator';

import { MetricsService, MetricQuery, DashboardMetrics } from '../services/metrics.service';
import { TraceBusiness } from '../../../decorators/trace.decorator';
import { EventCategory, EventAction } from '../schemas/analytics-event.schema';

class TrackEventDto {
  eventCategory: EventCategory;
  eventAction: EventAction;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
  metadata?: Record<string, any>;
}

class MetricQueryDto {
  category?: EventCategory;
  action?: EventAction;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  properties?: Record<string, any>;
  groupBy?: string[];
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

@ApiTags('Metrics & Analytics')
@Controller('metrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track analytics event' })
  @ApiResponse({ status: 204, description: 'Event tracked successfully' })
  @TraceBusiness('track_analytics_event', 'analytics')
  async trackEvent(@Body() trackEventDto: TrackEventDto) {
    await this.metricsService.trackEvent({
      ...trackEventDto,
      timestamp: new Date()
    });
  }

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get dashboard metrics overview' })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard metrics retrieved successfully',
    type: Object
  })
  @TraceBusiness('get_dashboard_metrics', 'analytics')
  async getDashboardMetrics(
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'day'
  ): Promise<DashboardMetrics> {
    return this.metricsService.getDashboardMetrics(period);
  }

  @Get('query')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Query specific metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Metrics retrieved successfully'
  })
  @TraceBusiness('query_metrics', 'analytics')
  async queryMetrics(@Query() query: MetricQueryDto) {
    const metricQuery: MetricQuery = {
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined
    };

    return this.metricsService.getMetric(metricQuery);
  }

  @Get('timeseries')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get time series metrics data' })
  @ApiResponse({ 
    status: 200, 
    description: 'Time series data retrieved successfully'
  })
  @TraceBusiness('get_timeseries_metrics', 'analytics')
  async getTimeSeriesMetrics(
    @Query() query: MetricQueryDto,
    @Query('interval') interval: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    const metricQuery: MetricQuery = {
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined
    };

    return this.metricsService.getTimeSeriesMetrics(metricQuery, interval);
  }

  @Get('funnel/:steps')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get funnel analysis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Funnel analysis retrieved successfully'
  })
  @TraceBusiness('get_funnel_analysis', 'analytics')
  async getFunnelAnalysis(
    @Param('steps') stepsParam: string,
    @Query('period') period: string = '30d'
  ) {
    const steps = stepsParam.split(',') as EventAction[];
    return this.metricsService.getFunnelAnalysis(steps, period);
  }

  @Get('cohort')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get cohort analysis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cohort analysis retrieved successfully'
  })
  @TraceBusiness('get_cohort_analysis', 'analytics')
  async getCohortAnalysis(
    @Query('type') cohortType: 'registration' | 'first_purchase' = 'registration',
    @Query('periods') periods: number = 12
  ) {
    return this.metricsService.getCohortAnalysis(cohortType, periods);
  }

  @Get('user-journey/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get user journey analysis' })
  @ApiResponse({ 
    status: 200, 
    description: 'User journey retrieved successfully'
  })
  @TraceBusiness('get_user_journey', 'analytics')
  async getUserJourney(
    @Param('userId') userId: string,
    @Query('days') days: number = 30
  ) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return this.metricsService.getTimeSeriesMetrics({
      userId,
      dateFrom,
      dateTo: new Date(),
      groupBy: ['eventAction', 'day']
    }, 'day');
  }

  @Get('real-time')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get real-time metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Real-time metrics retrieved successfully'
  })
  @TraceBusiness('get_realtime_metrics', 'analytics')
  async getRealTimeMetrics() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);

    const [
      activeUsers,
      recentEvents,
      errorEvents,
      performanceEvents
    ] = await Promise.all([
      this.metricsService.getMetric({
        dateFrom: lastHour,
        dateTo: now,
        category: EventCategory.USER_ACTION,
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        dateFrom: last5Minutes,
        dateTo: now,
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        dateFrom: lastHour,
        dateTo: now,
        category: EventCategory.ERROR,
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        dateFrom: lastHour,
        dateTo: now,
        category: EventCategory.PERFORMANCE,
        aggregation: 'avg'
      })
    ]);

    return {
      activeUsersLastHour: activeUsers.value,
      eventsLast5Minutes: recentEvents.value,
      errorsLastHour: errorEvents.value,
      avgPerformanceLastHour: performanceEvents.value,
      timestamp: new Date()
    };
  }

  @Get('user-activity')
  @ApiOperation({ summary: 'Get current user activity metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'User activity metrics retrieved successfully'
  })
  @TraceBusiness('get_user_activity', 'analytics')
  async getUserActivity(@GetUser('id') userId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      userEvents,
      boardsCreated,
      cardsCreated,
      sessionData
    ] = await Promise.all([
      this.metricsService.getTimeSeriesMetrics({
        userId,
        dateFrom: last30Days,
        dateTo: new Date(),
        aggregation: 'count'
      }, 'day'),
      this.metricsService.getMetric({
        userId,
        action: EventAction.BOARD_CREATE,
        dateFrom: last30Days,
        dateTo: new Date(),
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        userId,
        action: EventAction.CARD_CREATE,
        dateFrom: last30Days,
        dateTo: new Date(),
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        userId,
        category: EventCategory.USER_ACTION,
        dateFrom: last30Days,
        dateTo: new Date(),
        aggregation: 'count'
      })
    ]);

    return {
      dailyActivity: userEvents,
      totalBoardsCreated: boardsCreated.value,
      totalCardsCreated: cardsCreated.value,
      totalActions: sessionData.value,
      period: '30 days'
    };
  }

  @Get('performance')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get application performance metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance metrics retrieved successfully'
  })
  @TraceBusiness('get_performance_metrics', 'analytics')
  async getPerformanceMetrics(
    @Query('hours') hours: number = 24
  ) {
    const dateFrom = new Date();
    dateFrom.setHours(dateFrom.getHours() - hours);

    const [
      responseTimeData,
      errorRateData,
      throughputData,
      databasePerformance
    ] = await Promise.all([
      this.metricsService.getTimeSeriesMetrics({
        category: EventCategory.PERFORMANCE,
        properties: { metric: 'response_time' },
        dateFrom,
        dateTo: new Date(),
        aggregation: 'avg'
      }, 'hour'),
      this.metricsService.getTimeSeriesMetrics({
        category: EventCategory.ERROR,
        dateFrom,
        dateTo: new Date(),
        aggregation: 'count'
      }, 'hour'),
      this.metricsService.getTimeSeriesMetrics({
        category: EventCategory.SYSTEM_EVENT,
        action: EventAction.API_CALL,
        dateFrom,
        dateTo: new Date(),
        aggregation: 'count'
      }, 'hour'),
      this.metricsService.getTimeSeriesMetrics({
        category: EventCategory.PERFORMANCE,
        properties: { metric: 'database_query' },
        dateFrom,
        dateTo: new Date(),
        aggregation: 'avg'
      }, 'hour')
    ]);

    return {
      responseTime: responseTimeData,
      errorRate: errorRateData,
      throughput: throughputData,
      databasePerformance: databasePerformance,
      period: `${hours} hours`
    };
  }

  @Get('conversion')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get conversion metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Conversion metrics retrieved successfully'
  })
  @TraceBusiness('get_conversion_metrics', 'analytics')
  async getConversionMetrics(
    @Query('days') days: number = 30
  ) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Define conversion funnels
    const registrationFunnel = [
      EventAction.PAGE_VIEW,
      EventAction.REGISTER
    ];

    const engagementFunnel = [
      EventAction.REGISTER,
      EventAction.BOARD_CREATE,
      EventAction.CARD_CREATE
    ];

    const [
      registrationConversion,
      engagementConversion,
      featureAdoption
    ] = await Promise.all([
      this.metricsService.getFunnelAnalysis(registrationFunnel, `${days}d`),
      this.metricsService.getFunnelAnalysis(engagementFunnel, `${days}d`),
      this.metricsService.getMetric({
        action: EventAction.FEATURE_USED,
        dateFrom,
        dateTo: new Date(),
        groupBy: ['properties.featureName'],
        aggregation: 'count'
      })
    ]);

    return {
      registrationFunnel: registrationConversion,
      engagementFunnel: engagementConversion,
      featureAdoption: featureAdoption,
      period: `${days} days`
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get analytics system health' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics system health retrieved successfully'
  })
  async getAnalyticsHealth() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      totalEvents,
      errorRate,
      processingLatency
    ] = await Promise.all([
      this.metricsService.getMetric({
        dateFrom: last24Hours,
        dateTo: new Date(),
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        category: EventCategory.ERROR,
        dateFrom: last24Hours,
        dateTo: new Date(),
        aggregation: 'count'
      }),
      this.metricsService.getMetric({
        category: EventCategory.PERFORMANCE,
        properties: { metric: 'processing_time' },
        dateFrom: last24Hours,
        dateTo: new Date(),
        aggregation: 'avg'
      })
    ]);

    const errorRatePercent = totalEvents.value > 0 
      ? (errorRate.value / totalEvents.value) * 100 
      : 0;

    return {
      status: errorRatePercent < 1 ? 'healthy' : 'degraded',
      totalEventsLast24h: totalEvents.value,
      errorRate: errorRatePercent,
      avgProcessingLatency: processingLatency.value,
      timestamp: new Date()
    };
  }
}
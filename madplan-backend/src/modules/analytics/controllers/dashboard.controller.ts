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
import { DashboardService } from '../services/dashboard.service';

export class DashboardQueryDto {
  startDate: string;
  endDate: string;
  boardId?: string;
}

export class MetricSnapshotDto {
  metricName: string;
  value: number;
  metadata?: Record<string, any>;
}

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getDashboardMetrics(@Query() queryDto: DashboardQueryDto) {
    try {
      const metrics = await this.dashboardService.getDashboardMetrics(
        new Date(queryDto.startDate),
        new Date(queryDto.endDate),
        queryDto.boardId,
      );

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve dashboard metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Get realtime dashboard data' })
  @ApiResponse({ status: 200, description: 'Realtime dashboard data retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getRealtimeDashboard() {
    try {
      const dashboard = await this.dashboardService.getRealtimeDashboard();

      return {
        success: true,
        data: dashboard,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve realtime dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard overview retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getDashboardOverview(
    @Query('period') period: string = '7d',
    @Query('boardId') boardId?: string,
  ) {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const metrics = await this.dashboardService.getDashboardMetrics(
        startDate,
        now,
        boardId,
      );

      return {
        success: true,
        data: {
          ...metrics,
          period,
          dateRange: {
            start: startDate,
            end: now,
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve dashboard overview',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('metric-snapshot')
  @ApiOperation({ summary: 'Create a metric snapshot' })
  @ApiResponse({ status: 201, description: 'Metric snapshot created successfully' })
  @Roles(Role.ADMIN)
  async createMetricSnapshot(
    @Body() snapshotDto: MetricSnapshotDto,
    @GetUser('id') userId: string,
  ) {
    try {
      await this.dashboardService.createMetricSnapshot(
        snapshotDto.metricName,
        snapshotDto.value,
        {
          ...snapshotDto.metadata,
          createdBy: userId,
        },
      );

      return {
        success: true,
        message: 'Metric snapshot created successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create metric snapshot',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metric-history')
  @ApiOperation({ summary: 'Get metric history' })
  @ApiResponse({ status: 200, description: 'Metric history retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getMetricHistory(
    @Query('metricName') metricName: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      if (!metricName) {
        throw new HttpException(
          'Metric name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const history = await this.dashboardService.getMetricHistory(
        metricName,
        new Date(startDate),
        new Date(endDate),
      );

      return {
        success: true,
        data: {
          metricName,
          history,
          dateRange: {
            start: new Date(startDate),
            end: new Date(endDate),
          },
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve metric history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get key performance indicators' })
  @ApiResponse({ status: 200, description: 'KPIs retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getKPIs(
    @Query('period') period: string = '30d',
    @Query('boardId') boardId?: string,
  ) {
    try {
      const now = new Date();
      let startDate: Date;
      let previousStartDate: Date;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      }

      const [currentMetrics, previousMetrics] = await Promise.all([
        this.dashboardService.getDashboardMetrics(startDate, now, boardId),
        this.dashboardService.getDashboardMetrics(previousStartDate, startDate, boardId),
      ]);

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const kpis = {
        totalUsers: {
          current: currentMetrics.overview.totalUsers,
          previous: previousMetrics.overview.totalUsers,
          change: calculateChange(
            currentMetrics.overview.totalUsers,
            previousMetrics.overview.totalUsers,
          ),
        },
        activeUsers: {
          current: currentMetrics.overview.activeUsers,
          previous: previousMetrics.overview.activeUsers,
          change: calculateChange(
            currentMetrics.overview.activeUsers,
            previousMetrics.overview.activeUsers,
          ),
        },
        conversionRate: {
          current: currentMetrics.overview.conversionRate,
          previous: previousMetrics.overview.conversionRate,
          change: calculateChange(
            currentMetrics.overview.conversionRate,
            previousMetrics.overview.conversionRate,
          ),
        },
        bounceRate: {
          current: currentMetrics.overview.bounceRate,
          previous: previousMetrics.overview.bounceRate,
          change: calculateChange(
            currentMetrics.overview.bounceRate,
            previousMetrics.overview.bounceRate,
          ),
        },
        avgSessionDuration: {
          current: currentMetrics.overview.avgSessionDuration,
          previous: previousMetrics.overview.avgSessionDuration,
          change: calculateChange(
            currentMetrics.overview.avgSessionDuration,
            previousMetrics.overview.avgSessionDuration,
          ),
        },
        pageViews: {
          current: currentMetrics.traffic.pageViews,
          previous: previousMetrics.traffic.pageViews,
          change: calculateChange(
            currentMetrics.traffic.pageViews,
            previousMetrics.traffic.pageViews,
          ),
        },
      };

      return {
        success: true,
        data: {
          kpis,
          period,
          dateRange: {
            current: { start: startDate, end: now },
            previous: { start: previousStartDate, end: startDate },
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve KPIs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('widgets')
  @ApiOperation({ summary: 'Get dashboard widgets data' })
  @ApiResponse({ status: 200, description: 'Dashboard widgets data retrieved successfully' })
  @Roles(Role.USER, Role.ADMIN)
  async getDashboardWidgets(
    @Query('widgets') widgets: string,
    @Query('period') period: string = '7d',
    @Query('boardId') boardId?: string,
  ) {
    try {
      const widgetList = widgets ? widgets.split(',') : ['overview', 'traffic', 'engagement'];
      const now = new Date();
      let startDate: Date;

      switch (period) {
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
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const allMetrics = await this.dashboardService.getDashboardMetrics(
        startDate,
        now,
        boardId,
      );

      const widgetData: Record<string, any> = {};

      widgetList.forEach(widget => {
        switch (widget.trim()) {
          case 'overview':
            widgetData.overview = allMetrics.overview;
            break;
          case 'traffic':
            widgetData.traffic = allMetrics.traffic;
            break;
          case 'engagement':
            widgetData.engagement = allMetrics.engagement;
            break;
          case 'performance':
            widgetData.performance = allMetrics.performance;
            break;
        }
      });

      return {
        success: true,
        data: {
          widgets: widgetData,
          period,
          dateRange: {
            start: startDate,
            end: now,
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve dashboard widgets',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

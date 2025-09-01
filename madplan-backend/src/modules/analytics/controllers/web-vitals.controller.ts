import { 
  Controller, 
  Post, 
  Body, 
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Role } from '../../../auth/enums/role.enum';
import { GetUser } from '../../../auth/decorators/get-user.decorator';

import { WebVitalsService } from '../services/web-vitals.service';
import { TraceBusiness } from '../../../decorators/trace.decorator';

class WebVitalMetricDto {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  sessionId: string;
  userId?: string;
}

class PerformanceAlertDto {
  type: string;
  metric: string;
  value: number;
  threshold: any;
  url: string;
  sessionId: string;
  timestamp: number;
}

@ApiTags('Web Vitals & Performance')
@Controller('metrics/web-vitals')
export class WebVitalsController {
  constructor(private readonly webVitalsService: WebVitalsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track Core Web Vitals metric' })
  @ApiResponse({ status: 204, description: 'Web vital metric tracked successfully' })
  @TraceBusiness('track_web_vital', 'performance')
  async trackWebVital(@Body() webVitalDto: WebVitalMetricDto) {
    await this.webVitalsService.trackWebVital(webVitalDto);
  }

  @Post('alerts/performance')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send performance budget alert' })
  @ApiResponse({ status: 204, description: 'Performance alert sent successfully' })
  @TraceBusiness('send_performance_alert', 'performance')
  async sendPerformanceAlert(@Body() alertDto: PerformanceAlertDto) {
    await this.webVitalsService.handlePerformanceAlert(alertDto);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Web Vitals dashboard data' })
  @ApiResponse({ 
    status: 200, 
    description: 'Web Vitals dashboard data retrieved successfully' 
  })
  @TraceBusiness('get_web_vitals_dashboard', 'performance')
  async getWebVitalsDashboard(
    @Query('timeframe') timeframe: 'hour' | 'day' | 'week' | 'month' = 'day',
    @Query('url') url?: string
  ) {
    return this.webVitalsService.getWebVitalsDashboard(timeframe, url);
  }

  @Get('performance-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance analysis report' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance report retrieved successfully' 
  })
  @TraceBusiness('get_performance_report', 'performance')
  async getPerformanceReport(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week',
    @Query('url') url?: string
  ) {
    return this.webVitalsService.getPerformanceReport(timeframe, url);
  }

  @Get('user-experience')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user experience metrics for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'User experience metrics retrieved successfully' 
  })
  @TraceBusiness('get_user_experience', 'performance')
  async getUserExperienceMetrics(
    @GetUser('id') userId: string,
    @Query('days') days: number = 7
  ) {
    return this.webVitalsService.getUserExperienceMetrics(userId, days);
  }

  @Get('real-time')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get real-time performance metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Real-time performance metrics retrieved successfully' 
  })
  @TraceBusiness('get_realtime_performance', 'performance')
  async getRealTimePerformance() {
    return this.webVitalsService.getRealTimePerformanceMetrics();
  }

  @Get('trends')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance trends analysis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance trends retrieved successfully' 
  })
  @TraceBusiness('get_performance_trends', 'performance')
  async getPerformanceTrends(
    @Query('metric') metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB',
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week',
    @Query('groupBy') groupBy: 'hour' | 'day' | 'week' = 'day'
  ) {
    return this.webVitalsService.getPerformanceTrends(metric, timeframe, groupBy);
  }

  @Get('page-insights/:url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance insights for specific page' })
  @ApiResponse({ 
    status: 200, 
    description: 'Page performance insights retrieved successfully' 
  })
  @TraceBusiness('get_page_insights', 'performance')
  async getPageInsights(
    @Param('url') url: string,
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week'
  ) {
    const decodedUrl = decodeURIComponent(url);
    return this.webVitalsService.getPagePerformanceInsights(decodedUrl, timeframe);
  }

  @Get('device-insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance insights by device type' })
  @ApiResponse({ 
    status: 200, 
    description: 'Device performance insights retrieved successfully' 
  })
  @TraceBusiness('get_device_insights', 'performance')
  async getDeviceInsights(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week'
  ) {
    return this.webVitalsService.getDevicePerformanceInsights(timeframe);
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance improvement recommendations' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance recommendations retrieved successfully' 
  })
  @TraceBusiness('get_performance_recommendations', 'performance')
  async getPerformanceRecommendations(
    @Query('url') url?: string,
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week'
  ) {
    return this.webVitalsService.getPerformanceRecommendations(url, timeframe);
  }

  @Get('budget-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance budget compliance status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance budget status retrieved successfully' 
  })
  @TraceBusiness('get_budget_status', 'performance')
  async getPerformanceBudgetStatus() {
    return this.webVitalsService.getPerformanceBudgetStatus();
  }

  @Get('lighthouse-scores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Lighthouse performance scores' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lighthouse scores retrieved successfully' 
  })
  @TraceBusiness('get_lighthouse_scores', 'performance')
  async getLighthouseScores(
    @Query('url') url?: string,
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week'
  ) {
    return this.webVitalsService.getLighthouseScores(url, timeframe);
  }

  @Get('comparative-analysis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get comparative performance analysis' })
  @ApiResponse({ 
    status: 200, 
    description: 'Comparative analysis retrieved successfully' 
  })
  @TraceBusiness('get_comparative_analysis', 'performance')
  async getComparativeAnalysis(
    @Query('baseline') baseline: 'previous_week' | 'previous_month' = 'previous_week',
    @Query('metric') metric?: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB'
  ) {
    return this.webVitalsService.getComparativePerformanceAnalysis(baseline, metric);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get Web Vitals tracking system health' })
  @ApiResponse({ 
    status: 200, 
    description: 'Web Vitals system health retrieved successfully' 
  })
  async getWebVitalsHealth() {
    return this.webVitalsService.getSystemHealth();
  }
}
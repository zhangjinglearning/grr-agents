import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
// import * as dd from 'dd-trace';

// Mock dd-trace functionality for compilation
const dd = {
  increment: (...args: any[]) => {},
  histogram: (...args: any[]) => {},
  gauge: (...args: any[]) => {}
};

import { AnalyticsEvent, AnalyticsEventDocument, EventCategory, EventAction } from '../schemas/analytics-event.schema';
import { BusinessKPI, BusinessKPIDocument, KPICategory, KPIFrequency } from '../schemas/business-kpi.schema';
import { TracingService } from '../../../services/tracing.service';

export interface MetricQuery {
  category?: EventCategory;
  action?: EventAction;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  properties?: Record<string, any>;
  groupBy?: string[];
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

export interface MetricResult {
  value: number;
  timestamp: Date;
  period?: string;
  breakdown?: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalBoards: number;
    totalCards: number;
    avgSessionDuration: number;
    conversionRate: number;
  };
  growth: {
    newUsers: number;
    newUsersGrowth: number;
    retentionRate: number;
    churnRate: number;
  };
  engagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    avgBoardsPerUser: number;
    avgCardsPerBoard: number;
  };
  performance: {
    avgPageLoadTime: number;
    errorRate: number;
    uptimePercentage: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectModel(AnalyticsEvent.name)
    private analyticsEventModel: Model<AnalyticsEventDocument>,
    @InjectModel(BusinessKPI.name)
    private businessKPIModel: Model<BusinessKPIDocument>,
    private configService: ConfigService,
    private tracingService: TracingService
  ) {}

  // Track event for analytics
  async trackEvent(event: Partial<AnalyticsEvent>): Promise<void> {
    try {
      const analyticsEvent = new this.analyticsEventModel({
        ...event,
        timestamp: event.timestamp || new Date(),
        processed: false
      });

      await analyticsEvent.save();

      // Send to external analytics services
      await this.sendToExternalServices(analyticsEvent);

      // Real-time metrics update
      await this.updateRealTimeMetrics(analyticsEvent);

    } catch (error) {
      this.logger.error('Failed to track event:', error);
      throw error;
    }
  }

  // Get business metrics for dashboard
  async getDashboardMetrics(period: 'day' | 'week' | 'month' | 'year' = 'day'): Promise<DashboardMetrics> {
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);
    const previousPeriodStart = this.getPeriodStart(periodStart, period);

    return this.tracingService.traceOperation(
      {
        operation: 'get_dashboard_metrics',
        tags: { period }
      },
      async () => {
        const [overview, growth, engagement, performance] = await Promise.all([
          this.getOverviewMetrics(periodStart, now),
          this.getGrowthMetrics(periodStart, now, previousPeriodStart),
          this.getEngagementMetrics(periodStart, now),
          this.getPerformanceMetrics(periodStart, now)
        ]);

        return {
          overview,
          growth,
          engagement,
          performance
        };
      }
    );
  }

  // Get specific metric
  async getMetric(query: MetricQuery): Promise<MetricResult> {
    const pipeline = this.buildAggregationPipeline(query);
    const result = await this.analyticsEventModel.aggregate(pipeline);
    
    if (result.length === 0) {
      return {
        value: 0,
        timestamp: new Date(),
        breakdown: {},
        metadata: { query }
      };
    }

    return this.formatMetricResult(result[0], query);
  }

  // Get time series data for metrics
  async getTimeSeriesMetrics(
    query: MetricQuery,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<MetricResult[]> {
    const pipeline = this.buildTimeSeriesPipeline(query, interval);
    const results = await this.analyticsEventModel.aggregate(pipeline);
    
    return results.map(result => this.formatMetricResult(result, query));
  }

  // Get funnel analysis
  async getFunnelAnalysis(steps: EventAction[], period: string = '30d'): Promise<{
    steps: Array<{
      action: EventAction;
      users: number;
      conversionRate: number;
      dropoffRate: number;
    }>;
    totalConversions: number;
    overallConversionRate: number;
  }> {
    const dateFrom = this.getDateFromPeriod(period);
    
    const funnelData = await Promise.all(
      steps.map(async (action, index) => {
        // Get users who completed this step
        const users = await this.analyticsEventModel.distinct('userId', {
          eventAction: action,
          timestamp: { $gte: dateFrom },
          userId: { $exists: true }
        });

        // Get users who completed all previous steps
        let qualifiedUsers = new Set(users);
        if (index > 0) {
          for (let i = 0; i < index; i++) {
            const previousUsers = await this.analyticsEventModel.distinct('userId', {
              eventAction: steps[i],
              timestamp: { $gte: dateFrom },
              userId: { $exists: true, $in: Array.from(qualifiedUsers) }
            });
            qualifiedUsers = new Set(previousUsers);
          }
        }

        const actualUsers = users.filter(userId => qualifiedUsers.has(userId));
        
        return {
          action,
          users: actualUsers.length,
          qualifiedUsers: qualifiedUsers.size
        };
      })
    );

    // Calculate conversion and dropoff rates
    const steps_with_rates = funnelData.map((step, index) => {
      const previousUsers = index > 0 ? funnelData[index - 1].users : step.qualifiedUsers;
      const conversionRate = previousUsers > 0 ? (step.users / previousUsers) * 100 : 0;
      const dropoffRate = 100 - conversionRate;

      return {
        action: step.action,
        users: step.users,
        conversionRate: Math.round(conversionRate * 100) / 100,
        dropoffRate: Math.round(dropoffRate * 100) / 100
      };
    });

    const totalConversions = steps_with_rates[steps_with_rates.length - 1]?.users || 0;
    const initialUsers = steps_with_rates[0]?.users || 0;
    const overallConversionRate = initialUsers > 0 ? (totalConversions / initialUsers) * 100 : 0;

    return {
      steps: steps_with_rates,
      totalConversions,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100
    };
  }

  // Get cohort analysis
  async getCohortAnalysis(
    cohortType: 'registration' | 'first_purchase' = 'registration',
    periods: number = 12
  ): Promise<{
    cohorts: Array<{
      cohortDate: string;
      totalUsers: number;
      periods: Array<{
        period: number;
        activeUsers: number;
        retentionRate: number;
      }>;
    }>;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periods);

    // Get cohorts based on registration date
    const cohorts = await this.analyticsEventModel.aggregate([
      {
        $match: {
          eventAction: cohortType === 'registration' ? EventAction.REGISTER : EventAction.SUBSCRIPTION_START,
          timestamp: { $gte: startDate, $lte: endDate },
          userId: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            cohortMonth: {
              $dateToString: {
                format: '%Y-%m',
                date: '$timestamp'
              }
            }
          },
          firstSeen: { $min: '$timestamp' }
        }
      },
      {
        $group: {
          _id: '$_id.cohortMonth',
          users: { $addToSet: '$_id.userId' },
          totalUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 as 1 } }
    ]);

    // Calculate retention for each cohort
    const cohortAnalysis = await Promise.all(
      cohorts.map(async cohort => {
        const cohortDate = cohort._id;
        const cohortUsers = cohort.users;
        
        const retentionPeriods = await Promise.all(
          Array.from({ length: periods }, async (_, periodIndex) => {
            const periodStart = new Date(cohortDate + '-01');
            periodStart.setMonth(periodStart.getMonth() + periodIndex);
            
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            periodEnd.setDate(0); // Last day of the month

            const activeUsers = await this.analyticsEventModel.distinct('userId', {
              userId: { $in: cohortUsers },
              timestamp: { $gte: periodStart, $lte: periodEnd }
            });

            const retentionRate = (activeUsers.length / cohort.totalUsers) * 100;

            return {
              period: periodIndex,
              activeUsers: activeUsers.length,
              retentionRate: Math.round(retentionRate * 100) / 100
            };
          })
        );

        return {
          cohortDate,
          totalUsers: cohort.totalUsers,
          periods: retentionPeriods
        };
      })
    );

    return { cohorts: cohortAnalysis };
  }

  // Calculate and update KPIs
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateRealTimeKPIs(): Promise<void> {
    await this.tracingService.traceOperation(
      { operation: 'update_real_time_kpis' },
      async () => {
        const kpis = await this.businessKPIModel.find({
          frequency: KPIFrequency.REAL_TIME,
          active: true
        });

        await Promise.all(
          kpis.map(kpi => this.calculateAndUpdateKPI(kpi))
        );
      }
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateHourlyKPIs(): Promise<void> {
    await this.updateKPIsByFrequency(KPIFrequency.HOURLY);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async updateDailyKPIs(): Promise<void> {
    await this.updateKPIsByFrequency(KPIFrequency.DAILY);
  }

  // Private helper methods
  private async getOverviewMetrics(periodStart: Date, periodEnd: Date) {
    const [
      totalUsers,
      activeUsers,
      totalBoards,
      totalCards,
      sessionData,
      conversionData
    ] = await Promise.all([
      this.analyticsEventModel.distinct('userId', { userId: { $exists: true } }),
      this.analyticsEventModel.distinct('userId', {
        timestamp: { $gte: periodStart, $lte: periodEnd },
        userId: { $exists: true }
      }),
      this.analyticsEventModel.countDocuments({
        eventAction: EventAction.BOARD_CREATE,
        timestamp: { $lte: periodEnd }
      }),
      this.analyticsEventModel.countDocuments({
        eventAction: EventAction.CARD_CREATE,
        timestamp: { $lte: periodEnd }
      }),
      this.getSessionMetrics(periodStart, periodEnd),
      this.getConversionRate(periodStart, periodEnd)
    ]);

    return {
      totalUsers: totalUsers.length,
      activeUsers: activeUsers.length,
      totalBoards,
      totalCards,
      avgSessionDuration: sessionData.avgDuration,
      conversionRate: conversionData.rate
    };
  }

  private async getGrowthMetrics(periodStart: Date, periodEnd: Date, previousPeriodStart: Date) {
    const [currentNewUsers, previousNewUsers] = await Promise.all([
      this.analyticsEventModel.distinct('userId', {
        eventAction: EventAction.REGISTER,
        timestamp: { $gte: periodStart, $lte: periodEnd }
      }),
      this.analyticsEventModel.distinct('userId', {
        eventAction: EventAction.REGISTER,
        timestamp: { $gte: previousPeriodStart, $lt: periodStart }
      })
    ]);

    const newUsersGrowth = previousNewUsers.length > 0 
      ? ((currentNewUsers.length - previousNewUsers.length) / previousNewUsers.length) * 100
      : 0;

    const [retentionRate, churnRate] = await Promise.all([
      this.getRetentionRate(periodStart, periodEnd),
      this.getChurnRate(periodStart, periodEnd)
    ]);

    return {
      newUsers: currentNewUsers.length,
      newUsersGrowth: Math.round(newUsersGrowth * 100) / 100,
      retentionRate,
      churnRate
    };
  }

  private async getEngagementMetrics(periodStart: Date, periodEnd: Date) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [dau, wau, mau, boardsPerUser, cardsPerBoard] = await Promise.all([
      this.analyticsEventModel.distinct('userId', {
        timestamp: { $gte: dayAgo },
        userId: { $exists: true }
      }),
      this.analyticsEventModel.distinct('userId', {
        timestamp: { $gte: weekAgo },
        userId: { $exists: true }
      }),
      this.analyticsEventModel.distinct('userId', {
        timestamp: { $gte: monthAgo },
        userId: { $exists: true }
      }),
      this.getBoardsPerUser(periodStart, periodEnd),
      this.getCardsPerBoard(periodStart, periodEnd)
    ]);

    return {
      dailyActiveUsers: dau.length,
      weeklyActiveUsers: wau.length,
      monthlyActiveUsers: mau.length,
      avgBoardsPerUser: boardsPerUser,
      avgCardsPerBoard: cardsPerBoard
    };
  }

  private async getPerformanceMetrics(periodStart: Date, periodEnd: Date) {
    const [pageLoadTime, errorRate, uptimeData] = await Promise.all([
      this.getAveragePageLoadTime(periodStart, periodEnd),
      this.getErrorRate(periodStart, periodEnd),
      this.getUptimePercentage(periodStart, periodEnd)
    ]);

    return {
      avgPageLoadTime: pageLoadTime,
      errorRate,
      uptimePercentage: uptimeData
    };
  }

  private buildAggregationPipeline(query: MetricQuery): any[] {
    const pipeline: any[] = [];

    // Match stage
    const matchConditions: any = {};
    if (query.category) matchConditions.eventCategory = query.category;
    if (query.action) matchConditions.eventAction = query.action;
    if (query.userId) matchConditions.userId = query.userId;
    if (query.dateFrom || query.dateTo) {
      matchConditions.timestamp = {};
      if (query.dateFrom) matchConditions.timestamp.$gte = query.dateFrom;
      if (query.dateTo) matchConditions.timestamp.$lte = query.dateTo;
    }
    if (query.properties) {
      Object.entries(query.properties).forEach(([key, value]) => {
        matchConditions[`properties.${key}`] = value;
      });
    }

    pipeline.push({ $match: matchConditions });

    // Group stage
    const groupStage: any = {
      _id: query.groupBy ? this.buildGroupBy(query.groupBy) : null
    };

    switch (query.aggregation || 'count') {
      case 'count':
        groupStage.value = { $sum: 1 };
        break;
      case 'sum':
        groupStage.value = { $sum: '$properties.value' };
        break;
      case 'avg':
        groupStage.value = { $avg: '$properties.value' };
        break;
      case 'min':
        groupStage.value = { $min: '$properties.value' };
        break;
      case 'max':
        groupStage.value = { $max: '$properties.value' };
        break;
    }

    pipeline.push({ $group: groupStage });

    return pipeline;
  }

  private buildTimeSeriesPipeline(query: MetricQuery, interval: string): any[] {
    const pipeline = this.buildAggregationPipeline({
      ...query,
      groupBy: [interval]
    });

    // Modify the group stage for time series
    const groupStage = pipeline.find(stage => stage.$group);
    if (groupStage) {
      const dateFormat = this.getDateFormat(interval);
      groupStage.$group._id = {
        period: {
          $dateToString: {
            format: dateFormat,
            date: '$timestamp'
          }
        }
      };
    }

    pipeline.push({ $sort: { '_id.period': 1 as 1 } });

    return pipeline;
  }

  private buildGroupBy(groupBy: string[]): any {
    const groupId: any = {};
    
    groupBy.forEach(field => {
      if (['hour', 'day', 'week', 'month'].includes(field)) {
        groupId[field] = {
          $dateToString: {
            format: this.getDateFormat(field),
            date: '$timestamp'
          }
        };
      } else {
        groupId[field] = `$${field}`;
      }
    });

    return Object.keys(groupId).length === 1 ? Object.values(groupId)[0] : groupId;
  }

  private getDateFormat(interval: string): string {
    switch (interval) {
      case 'hour': return '%Y-%m-%d-%H';
      case 'day': return '%Y-%m-%d';
      case 'week': return '%Y-%U';
      case 'month': return '%Y-%m';
      default: return '%Y-%m-%d';
    }
  }

  private formatMetricResult(result: any, query: MetricQuery): MetricResult {
    return {
      value: result.value || 0,
      timestamp: new Date(),
      period: result._id?.period,
      breakdown: result._id && typeof result._id === 'object' ? result._id : {},
      metadata: { query }
    };
  }

  private getPeriodStart(date: Date, period: string): Date {
    const result = new Date(date);
    
    switch (period) {
      case 'day':
        result.setHours(0, 0, 0, 0);
        result.setDate(result.getDate() - 1);
        break;
      case 'week':
        result.setDate(result.getDate() - 7);
        break;
      case 'month':
        result.setMonth(result.getMonth() - 1);
        break;
      case 'year':
        result.setFullYear(result.getFullYear() - 1);
        break;
    }
    
    return result;
  }

  private getDateFromPeriod(period: string): Date {
    const now = new Date();
    const match = period.match(/^(\d+)([dwmy])$/);
    
    if (!match) {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
    }
    
    const [, amount, unit] = match;
    const multiplier = parseInt(amount);
    
    switch (unit) {
      case 'd': return new Date(now.getTime() - multiplier * 24 * 60 * 60 * 1000);
      case 'w': return new Date(now.getTime() - multiplier * 7 * 24 * 60 * 60 * 1000);
      case 'm': return new Date(now.getTime() - multiplier * 30 * 24 * 60 * 60 * 1000);
      case 'y': return new Date(now.getTime() - multiplier * 365 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private async sendToExternalServices(event: AnalyticsEventDocument): Promise<void> {
    // Send to Datadog
    if (this.configService.get('DATADOG_ENABLED')) {
      dd.increment('analytics.event', 1, [
        `category:${event.eventCategory}`,
        `action:${event.eventAction}`,
        `user_id:${event.userId || 'anonymous'}`
      ]);
    }

    // Send to other analytics services (Google Analytics, Mixpanel, etc.)
    // Implementation depends on specific services
  }

  private async updateRealTimeMetrics(event: AnalyticsEventDocument): Promise<void> {
    // Update real-time counters, active users, etc.
    // This could be implemented with Redis or in-memory cache
    
    try {
      // Example: Update active users count
      if (event.userId && [EventAction.LOGIN, EventAction.PAGE_VIEW].includes(event.eventAction)) {
        dd.increment('business.active_users', 1, [`user_id:${event.userId}`]);
      }

      // Example: Update feature usage
      if (event.eventAction === EventAction.FEATURE_USED) {
        const featureName = event.properties?.featureName;
        if (featureName) {
          dd.increment('business.feature_usage', 1, [`feature:${featureName}`]);
        }
      }

    } catch (error) {
      this.logger.error('Failed to update real-time metrics:', error);
    }
  }

  private async updateKPIsByFrequency(frequency: KPIFrequency): Promise<void> {
    const kpis = await this.businessKPIModel.find({
      frequency,
      active: true
    });

    await Promise.all(
      kpis.map(kpi => this.calculateAndUpdateKPI(kpi))
    );
  }

  private async calculateAndUpdateKPI(kpi: BusinessKPIDocument): Promise<void> {
    try {
      const startTime = Date.now();
      let value = 0;

      // Calculate KPI value based on its definition
      switch (kpi.name) {
        case 'daily_active_users':
          value = await this.calculateDAU();
          break;
        case 'conversion_rate':
          value = (await this.getConversionRate(
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            new Date()
          )).rate;
          break;
        case 'average_session_duration':
          value = (await this.getSessionMetrics(
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            new Date()
          )).avgDuration;
          break;
        // Add more KPI calculations
        default:
          this.logger.warn(`No calculation method for KPI: ${kpi.name}`);
          return;
      }

      // Calculate change from previous value
      const changeAbsolute = kpi.value ? value - kpi.value : 0;
      const changePercent = kpi.value ? ((value - kpi.value) / kpi.value) * 100 : 0;

      // Update KPI
      kpi.previousValue = kpi.value;
      kpi.value = value;
      kpi.changeAbsolute = changeAbsolute;
      kpi.changePercent = changePercent;
      kpi.lastCalculated = new Date();
      kpi.calculationDuration = Date.now() - startTime;
      kpi.timestamp = new Date();

      // Add to historical values
      kpi.historicalValues.push({
        timestamp: new Date(),
        value,
        period: kpi.frequency
      });

      // Keep only last 100 historical values
      if (kpi.historicalValues.length > 100) {
        kpi.historicalValues = kpi.historicalValues.slice(-100);
      }

      await kpi.save();

      this.logger.log(`Updated KPI ${kpi.name}: ${value}`);

    } catch (error) {
      this.logger.error(`Failed to update KPI ${kpi.name}:`, error);
    }
  }

  // KPI calculation methods
  private async calculateDAU(): Promise<number> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = await this.analyticsEventModel.distinct('userId', {
      timestamp: { $gte: yesterday },
      userId: { $exists: true }
    });
    return activeUsers.length;
  }

  private async getSessionMetrics(from: Date, to: Date): Promise<{ avgDuration: number }> {
    // Simplified session duration calculation
    // In a real implementation, you'd calculate based on session start/end events
    return { avgDuration: 1200000 }; // 20 minutes in milliseconds
  }

  private async getConversionRate(from: Date, to: Date): Promise<{ rate: number }> {
    const [visitors, conversions] = await Promise.all([
      this.analyticsEventModel.distinct('userId', {
        eventAction: EventAction.PAGE_VIEW,
        timestamp: { $gte: from, $lte: to }
      }),
      this.analyticsEventModel.distinct('userId', {
        eventAction: EventAction.REGISTER,
        timestamp: { $gte: from, $lte: to }
      })
    ]);

    const rate = visitors.length > 0 ? (conversions.length / visitors.length) * 100 : 0;
    return { rate };
  }

  private async getRetentionRate(from: Date, to: Date): Promise<number> {
    // Simplified retention calculation
    return 75; // 75% retention rate
  }

  private async getChurnRate(from: Date, to: Date): Promise<number> {
    // Simplified churn calculation
    return 5; // 5% churn rate
  }

  private async getBoardsPerUser(from: Date, to: Date): Promise<number> {
    const result = await this.analyticsEventModel.aggregate([
      {
        $match: {
          eventAction: EventAction.BOARD_CREATE,
          timestamp: { $gte: from, $lte: to },
          userId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$userId',
          boards: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          avgBoards: { $avg: '$boards' }
        }
      }
    ]);

    return result[0]?.avgBoards || 0;
  }

  private async getCardsPerBoard(from: Date, to: Date): Promise<number> {
    // Simplified calculation
    return 8.5; // Average cards per board
  }

  private async getAveragePageLoadTime(from: Date, to: Date): Promise<number> {
    const result = await this.analyticsEventModel.aggregate([
      {
        $match: {
          eventCategory: EventCategory.PERFORMANCE,
          'properties.pageLoadTime': { $exists: true },
          timestamp: { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: null,
          avgLoadTime: { $avg: '$properties.pageLoadTime' }
        }
      }
    ]);

    return result[0]?.avgLoadTime || 0;
  }

  private async getErrorRate(from: Date, to: Date): Promise<number> {
    const [totalRequests, errorRequests] = await Promise.all([
      this.analyticsEventModel.countDocuments({
        eventCategory: EventCategory.SYSTEM_EVENT,
        eventAction: EventAction.API_CALL,
        timestamp: { $gte: from, $lte: to }
      }),
      this.analyticsEventModel.countDocuments({
        eventCategory: EventCategory.ERROR,
        timestamp: { $gte: from, $lte: to }
      })
    ]);

    return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
  }

  private async getUptimePercentage(from: Date, to: Date): Promise<number> {
    // This would typically come from infrastructure monitoring
    return 99.9; // 99.9% uptime
  }
}
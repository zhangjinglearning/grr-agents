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
import { TracingService } from '../../../services/tracing.service';

export interface WebVitalMetric {
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

export interface PerformanceAlert {
  type: string;
  metric: string;
  value: number;
  threshold: any;
  url: string;
  sessionId: string;
  timestamp: number;
}

export interface WebVitalsDashboard {
  overview: {
    totalPageViews: number;
    averagePageLoadTime: number;
    performanceScore: number;
    coreWebVitalsPass: number;
  };
  metrics: {
    LCP: { value: number; rating: string; percentile75: number; percentile95: number };
    FID: { value: number; rating: string; percentile75: number; percentile95: number };
    CLS: { value: number; rating: string; percentile75: number; percentile95: number };
    FCP: { value: number; rating: string; percentile75: number; percentile95: number };
    TTFB: { value: number; rating: string; percentile75: number; percentile95: number };
  };
  trends: Array<{
    date: string;
    LCP: number;
    FID: number;
    CLS: number;
    FCP: number;
    TTFB: number;
  }>;
  topIssues: Array<{
    url: string;
    metric: string;
    value: number;
    rating: string;
    impact: number;
  }>;
}

@Injectable()
export class WebVitalsService {
  private readonly logger = new Logger(WebVitalsService.name);

  // Performance budget thresholds
  private readonly PERFORMANCE_BUDGETS = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  };

  constructor(
    @InjectModel(AnalyticsEvent.name)
    private analyticsEventModel: Model<AnalyticsEventDocument>,
    private configService: ConfigService,
    private tracingService: TracingService
  ) {}

  // Track Core Web Vitals metric
  async trackWebVital(webVital: WebVitalMetric): Promise<void> {
    try {
      // Store in analytics events collection
      const analyticsEvent = new this.analyticsEventModel({
        eventCategory: EventCategory.PERFORMANCE,
        eventAction: EventAction.PAGE_VIEW,
        userId: webVital.userId,
        sessionId: webVital.sessionId,
        timestamp: new Date(webVital.timestamp),
        properties: {
          metric_name: webVital.name,
          metric_value: webVital.value,
          metric_rating: webVital.rating,
          metric_delta: webVital.delta,
          metric_id: webVital.id,
          navigation_type: webVital.navigationType,
          url: webVital.url,
          user_agent: webVital.userAgent,
          connection_type: webVital.connectionType,
          device_memory: webVital.deviceMemory,
          hardware_concurrency: webVital.hardwareConcurrency,
          page_load_time: webVital.name === 'LCP' ? webVital.value : undefined,
        },
        metadata: {
          source: 'web-vitals',
          version: '1.0.0',
          environment: this.configService.get<string>('NODE_ENV', 'development'),
        },
        tags: [
          'web-vitals',
          `metric:${webVital.name}`,
          `rating:${webVital.rating}`,
          `navigation:${webVital.navigationType}`,
        ],
      });

      await analyticsEvent.save();

      // Send to external monitoring services
      this.sendToMonitoringServices(webVital);

      this.logger.debug(`Web Vital tracked: ${webVital.name} = ${webVital.value} (${webVital.rating})`);

    } catch (error) {
      this.logger.error('Failed to track web vital:', error);
      throw error;
    }
  }

  // Handle performance alerts
  async handlePerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      // Store alert in analytics
      await this.analyticsEventModel.create({
        eventCategory: EventCategory.PERFORMANCE,
        eventAction: EventAction.API_CALL,
        sessionId: alert.sessionId,
        timestamp: new Date(alert.timestamp),
        properties: {
          alert_type: alert.type,
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          url: alert.url,
          severity: 'high',
        },
        metadata: {
          source: 'performance-budget',
          alert: true,
        },
        tags: ['performance-alert', `metric:${alert.metric}`, 'budget-exceeded'],
      });

      // Send real-time alerts
      await this.sendPerformanceAlert(alert);

      this.logger.warn(`Performance budget exceeded: ${alert.metric} = ${alert.value} on ${alert.url}`);

    } catch (error) {
      this.logger.error('Failed to handle performance alert:', error);
    }
  }

  // Get Web Vitals dashboard
  async getWebVitalsDashboard(
    timeframe: 'hour' | 'day' | 'week' | 'month' = 'day',
    url?: string
  ): Promise<WebVitalsDashboard> {
    const dateFrom = this.getTimeframeStart(timeframe);
    const dateTo = new Date();

    return this.tracingService.traceOperation(
      {
        operation: 'get_web_vitals_dashboard',
        tags: { timeframe, url: url || 'all' }
      },
      async () => {
        const matchQuery: any = {
          eventCategory: EventCategory.PERFORMANCE,
          timestamp: { $gte: dateFrom, $lte: dateTo },
          'properties.metric_name': { $exists: true }
        };

        if (url) {
          matchQuery['properties.url'] = url;
        }

        // Get overview metrics
        const [totalPageViews, metricsData, trendsData, topIssues] = await Promise.all([
          this.getTotalPageViews(dateFrom, dateTo, url),
          this.getWebVitalsMetrics(matchQuery),
          this.getWebVitalsTrends(matchQuery, timeframe),
          this.getTopPerformanceIssues(matchQuery, 10)
        ]);

        const performanceScore = this.calculatePerformanceScore(metricsData);
        const coreWebVitalsPass = this.calculateCoreWebVitalsPass(metricsData);

        return {
          overview: {
            totalPageViews,
            averagePageLoadTime: metricsData.LCP?.value || 0,
            performanceScore,
            coreWebVitalsPass,
          },
          metrics: metricsData,
          trends: trendsData,
          topIssues
        };
      }
    );
  }

  // Get performance analysis report
  async getPerformanceReport(
    timeframe: 'day' | 'week' | 'month' = 'week',
    url?: string
  ): Promise<any> {
    const dateFrom = this.getTimeframeStart(timeframe);
    const dateTo = new Date();

    const matchQuery: any = {
      eventCategory: EventCategory.PERFORMANCE,
      timestamp: { $gte: dateFrom, $lte: dateTo },
      'properties.metric_name': { $exists: true }
    };

    if (url) {
      matchQuery['properties.url'] = url;
    }

    const [
      metrics,
      deviceBreakdown,
      connectionBreakdown,
      pageBreakdown,
      recommendations
    ] = await Promise.all([
      this.getWebVitalsMetrics(matchQuery),
      this.getDeviceBreakdown(matchQuery),
      this.getConnectionBreakdown(matchQuery),
      this.getPageBreakdown(matchQuery),
      this.generateRecommendations(matchQuery)
    ]);

    return {
      timeframe,
      url,
      metrics,
      breakdowns: {
        device: deviceBreakdown,
        connection: connectionBreakdown,
        pages: pageBreakdown
      },
      recommendations,
      generatedAt: new Date()
    };
  }

  // Get user experience metrics
  async getUserExperienceMetrics(userId: string, days: number = 7): Promise<any> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const userMetrics = await this.analyticsEventModel.aggregate([
      {
        $match: {
          userId,
          eventCategory: EventCategory.PERFORMANCE,
          timestamp: { $gte: dateFrom },
          'properties.metric_name': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$properties.metric_name',
          avgValue: { $avg: '$properties.metric_value' },
          count: { $sum: 1 },
          ratings: { $push: '$properties.metric_rating' }
        }
      }
    ]);

    return this.formatUserExperienceData(userMetrics, days);
  }

  // Get real-time performance metrics
  async getRealTimePerformanceMetrics(): Promise<any> {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [recentMetrics, hourlyMetrics] = await Promise.all([
      this.getWebVitalsMetrics({
        eventCategory: EventCategory.PERFORMANCE,
        timestamp: { $gte: last5Minutes },
        'properties.metric_name': { $exists: true }
      }),
      this.getWebVitalsMetrics({
        eventCategory: EventCategory.PERFORMANCE,
        timestamp: { $gte: lastHour },
        'properties.metric_name': { $exists: true }
      })
    ]);

    return {
      realTime: {
        last5Minutes: recentMetrics,
        dataPoints: await this.getRecentDataPoints(last5Minutes)
      },
      hourly: hourlyMetrics,
      timestamp: new Date()
    };
  }

  // Get performance trends
  async getPerformanceTrends(
    metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB',
    timeframe: 'day' | 'week' | 'month' = 'week',
    groupBy: 'hour' | 'day' | 'week' = 'day'
  ): Promise<any> {
    const dateFrom = this.getTimeframeStart(timeframe);
    const dateTo = new Date();

    const trends = await this.analyticsEventModel.aggregate([
      {
        $match: {
          eventCategory: EventCategory.PERFORMANCE,
          'properties.metric_name': metric,
          timestamp: { $gte: dateFrom, $lte: dateTo }
        }
      },
      {
        $group: {
          _id: this.getDateGrouping(groupBy),
          avgValue: { $avg: '$properties.metric_value' },
          p50: { $percentile: { input: '$properties.metric_value', p: [0.5], method: 'approximate' } } as any,
          p75: { $percentile: { input: '$properties.metric_value', p: [0.75], method: 'approximate' } } as any,
          p95: { $percentile: { input: '$properties.metric_value', p: [0.95], method: 'approximate' } } as any,
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    return {
      metric,
      timeframe,
      groupBy,
      data: trends.map(trend => ({
        period: trend._id,
        average: Math.round(trend.avgValue * 100) / 100,
        p50: trend.p50[0],
        p75: trend.p75[0],
        p95: trend.p95[0],
        count: trend.count
      }))
    };
  }

  // Get page performance insights
  async getPagePerformanceInsights(url: string, timeframe: 'day' | 'week' | 'month'): Promise<any> {
    const dateFrom = this.getTimeframeStart(timeframe);
    
    const metrics = await this.getWebVitalsMetrics({
      eventCategory: EventCategory.PERFORMANCE,
      'properties.url': url,
      timestamp: { $gte: dateFrom },
      'properties.metric_name': { $exists: true }
    });

    const recommendations = await this.generatePageRecommendations(url, metrics);

    return {
      url,
      timeframe,
      metrics,
      recommendations,
      score: this.calculatePerformanceScore(metrics)
    };
  }

  // Get device performance insights
  async getDevicePerformanceInsights(timeframe: 'day' | 'week' | 'month'): Promise<any> {
    const dateFrom = this.getTimeframeStart(timeframe);
    
    const deviceMetrics = await this.analyticsEventModel.aggregate([
      {
        $match: {
          eventCategory: EventCategory.PERFORMANCE,
          timestamp: { $gte: dateFrom },
          'properties.metric_name': { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            deviceType: '$properties.device_type',
            metric: '$properties.metric_name'
          },
          avgValue: { $avg: '$properties.metric_value' },
          count: { $sum: 1 }
        }
      }
    ]);

    return this.formatDeviceInsights(deviceMetrics);
  }

  // Get performance recommendations
  async getPerformanceRecommendations(url?: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    const dateFrom = this.getTimeframeStart(timeframe);
    
    const matchQuery: any = {
      eventCategory: EventCategory.PERFORMANCE,
      timestamp: { $gte: dateFrom },
      'properties.metric_name': { $exists: true }
    };

    if (url) {
      matchQuery['properties.url'] = url;
    }

    return this.generateRecommendations(matchQuery);
  }

  // Get performance budget status
  async getPerformanceBudgetStatus(): Promise<any> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const budgetStatus = await Promise.all(
      Object.keys(this.PERFORMANCE_BUDGETS).map(async (metric) => {
        const results = await this.analyticsEventModel.aggregate([
          {
            $match: {
              eventCategory: EventCategory.PERFORMANCE,
              'properties.metric_name': metric,
              timestamp: { $gte: last24Hours }
            }
          },
          {
            $group: {
              _id: null,
              avgValue: { $avg: '$properties.metric_value' },
              p75: { $percentile: { input: '$properties.metric_value', p: [0.75], method: 'approximate' } } as any,
              total: { $sum: 1 },
              passed: {
                $sum: {
                  $cond: [
                    { $lte: ['$properties.metric_value', this.PERFORMANCE_BUDGETS[metric as keyof typeof this.PERFORMANCE_BUDGETS].good] },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]);

        const result = results[0];
        if (!result) {
          return { metric, status: 'no-data', passRate: 0, avgValue: 0 };
        }

        const passRate = (result.passed / result.total) * 100;
        const status = passRate >= 75 ? 'good' : passRate >= 50 ? 'needs-improvement' : 'poor';

        return {
          metric,
          status,
          passRate: Math.round(passRate),
          avgValue: Math.round(result.avgValue),
          p75: result.p75[0],
          budget: this.PERFORMANCE_BUDGETS[metric as keyof typeof this.PERFORMANCE_BUDGETS],
          total: result.total
        };
      })
    );

    const overallScore = budgetStatus.reduce((sum, item) => sum + item.passRate, 0) / budgetStatus.length;

    return {
      overallScore: Math.round(overallScore),
      status: overallScore >= 75 ? 'good' : overallScore >= 50 ? 'needs-improvement' : 'poor',
      metrics: budgetStatus,
      lastUpdated: new Date()
    };
  }

  // Get Lighthouse scores (placeholder - would integrate with actual Lighthouse CI)
  async getLighthouseScores(url?: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    // This would integrate with Lighthouse CI or similar service
    return {
      url,
      timeframe,
      scores: {
        performance: 85,
        accessibility: 92,
        bestPractices: 89,
        seo: 94,
        pwa: 78
      },
      audits: [
        { category: 'performance', title: 'Largest Contentful Paint', score: 80, value: '2.8s' },
        { category: 'performance', title: 'First Input Delay', score: 95, value: '45ms' },
        { category: 'performance', title: 'Cumulative Layout Shift', score: 85, value: '0.15' }
      ],
      lastUpdated: new Date()
    };
  }

  // Get comparative performance analysis
  async getComparativePerformanceAnalysis(
    baseline: 'previous_week' | 'previous_month' = 'previous_week',
    metric?: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB'
  ): Promise<any> {
    const now = new Date();
    const currentPeriodStart = baseline === 'previous_week' 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const baselinePeriodStart = baseline === 'previous_week'
      ? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const baselinePeriodEnd = currentPeriodStart;

    const metricsToCompare = metric ? [metric] : ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'];
    
    const comparisons = await Promise.all(
      metricsToCompare.map(async (metricName) => {
        const [currentData, baselineData] = await Promise.all([
          this.getWebVitalsMetrics({
            eventCategory: EventCategory.PERFORMANCE,
            'properties.metric_name': metricName,
            timestamp: { $gte: currentPeriodStart, $lte: now }
          }),
          this.getWebVitalsMetrics({
            eventCategory: EventCategory.PERFORMANCE,
            'properties.metric_name': metricName,
            timestamp: { $gte: baselinePeriodStart, $lte: baselinePeriodEnd }
          })
        ]);

        const currentValue = currentData[metricName as keyof typeof currentData]?.value || 0;
        const baselineValue = baselineData[metricName as keyof typeof baselineData]?.value || 0;
        const change = currentValue - baselineValue;
        const changePercent = baselineValue > 0 ? (change / baselineValue) * 100 : 0;

        return {
          metric: metricName,
          current: currentValue,
          baseline: baselineValue,
          change,
          changePercent: Math.round(changePercent * 100) / 100,
          trend: change < 0 ? 'improving' : change > 0 ? 'degrading' : 'stable'
        };
      })
    );

    return {
      baseline,
      period: baseline === 'previous_week' ? '7 days' : '30 days',
      comparisons,
      overallTrend: this.calculateOverallTrend(comparisons)
    };
  }

  // Get system health
  async getSystemHealth(): Promise<any> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      totalMetrics,
      recentMetrics,
      errorRate,
      avgProcessingTime
    ] = await Promise.all([
      this.analyticsEventModel.countDocuments({
        eventCategory: EventCategory.PERFORMANCE,
        timestamp: { $gte: last24Hours }
      }),
      this.analyticsEventModel.countDocuments({
        eventCategory: EventCategory.PERFORMANCE,
        timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      }),
      this.getErrorRate(last24Hours),
      this.getAvgProcessingTime(last24Hours)
    ]);

    const health = errorRate < 1 && avgProcessingTime < 100 ? 'healthy' : 'degraded';

    return {
      status: health,
      metrics: {
        totalMetricsLast24h: totalMetrics,
        recentMetricsLast5m: recentMetrics,
        errorRate,
        avgProcessingTime
      },
      timestamp: new Date()
    };
  }

  // Scheduled tasks
  @Cron(CronExpression.EVERY_5_MINUTES)
  async aggregateRealtimeMetrics(): Promise<void> {
    try {
      const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
      
      // Aggregate recent Web Vitals data for real-time dashboard
      const metrics = await this.getWebVitalsMetrics({
        eventCategory: EventCategory.PERFORMANCE,
        timestamp: { $gte: last5Minutes },
        'properties.metric_name': { $exists: true }
      });

      // Send aggregated metrics to monitoring services
      Object.entries(metrics).forEach(([metric, data]) => {
        dd.gauge(`web_vitals.${metric.toLowerCase()}.avg`, (data as any).value, [
          `environment:${this.configService.get<string>('NODE_ENV', 'development')}`
        ]);
      });

    } catch (error) {
      this.logger.error('Failed to aggregate real-time metrics:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async generatePerformanceAlerts(): Promise<void> {
    try {
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check for performance degradation
      const metrics = await this.getWebVitalsMetrics({
        eventCategory: EventCategory.PERFORMANCE,
        timestamp: { $gte: lastHour },
        'properties.metric_name': { $exists: true }
      });

      // Generate alerts for poor performing metrics
      Object.entries(metrics).forEach(([metricName, data]) => {
        const budget = this.PERFORMANCE_BUDGETS[metricName as keyof typeof this.PERFORMANCE_BUDGETS];
        if (budget && (data as any).value > budget.poor) {
          this.sendPerformanceAlert({
            type: 'performance_degradation',
            metric: metricName,
            value: (data as any).value,
            threshold: budget,
            url: 'aggregate',
            sessionId: 'system',
            timestamp: Date.now()
          });
        }
      });

    } catch (error) {
      this.logger.error('Failed to generate performance alerts:', error);
    }
  }

  // Private helper methods
  private sendToMonitoringServices(webVital: WebVitalMetric): void {
    // Send to Datadog
    dd.histogram(`web_vitals.${webVital.name.toLowerCase()}`, webVital.value, [
      `rating:${webVital.rating}`,
      `navigation:${webVital.navigationType}`,
      `environment:${this.configService.get<string>('NODE_ENV', 'development')}`
    ]);

    dd.increment('web_vitals.total', 1, [
      `metric:${webVital.name}`,
      `rating:${webVital.rating}`
    ]);
  }

  private async sendPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    // Send to alerting systems (Slack, email, etc.)
    this.logger.warn(`Performance Alert: ${alert.type}`, alert);
    
    // Send to Datadog
    dd.increment('performance.alerts', 1, [
      `type:${alert.type}`,
      `metric:${alert.metric}`,
      `environment:${this.configService.get<string>('NODE_ENV', 'development')}`
    ]);
  }

  private getTimeframeStart(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'hour': return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private async getTotalPageViews(dateFrom: Date, dateTo: Date, url?: string): Promise<number> {
    const matchQuery: any = {
      eventCategory: EventCategory.PERFORMANCE,
      eventAction: EventAction.PAGE_VIEW,
      timestamp: { $gte: dateFrom, $lte: dateTo }
    };

    if (url) {
      matchQuery['properties.url'] = url;
    }

    return this.analyticsEventModel.countDocuments(matchQuery);
  }

  private async getWebVitalsMetrics(matchQuery: any): Promise<any> {
    const metrics = await this.analyticsEventModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$properties.metric_name',
          avgValue: { $avg: '$properties.metric_value' },
          p75: { $percentile: { input: '$properties.metric_value', p: [0.75], method: 'approximate' } } as any,
          p95: { $percentile: { input: '$properties.metric_value', p: [0.95], method: 'approximate' } } as any,
          ratings: { $push: '$properties.metric_rating' }
        }
      }
    ]);

    const result: any = {};
    metrics.forEach(metric => {
      const goodCount = metric.ratings.filter((r: string) => r === 'good').length;
      const rating = goodCount / metric.ratings.length >= 0.75 ? 'good' : 
                    goodCount / metric.ratings.length >= 0.5 ? 'needs-improvement' : 'poor';

      result[metric._id] = {
        value: Math.round(metric.avgValue * 100) / 100,
        rating,
        percentile75: metric.p75[0],
        percentile95: metric.p95[0]
      };
    });

    return result;
  }

  private async getWebVitalsTrends(matchQuery: any, timeframe: string): Promise<any[]> {
    const groupBy = timeframe === 'hour' ? 'hour' : 'day';
    
    const trends = await this.analyticsEventModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: this.getDateGrouping(groupBy),
            metric: '$properties.metric_name'
          },
          avgValue: { $avg: '$properties.metric_value' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          metrics: {
            $push: {
              metric: '$_id.metric',
              value: '$avgValue'
            }
          }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    return trends.map(trend => {
      const result: any = { date: trend._id };
      trend.metrics.forEach((m: any) => {
        result[m.metric] = Math.round(m.value * 100) / 100;
      });
      return result;
    });
  }

  private async getTopPerformanceIssues(matchQuery: any, limit: number): Promise<any[]> {
    const issues = await this.analyticsEventModel.aggregate([
      { $match: { ...matchQuery, 'properties.metric_rating': 'poor' } },
      {
        $group: {
          _id: {
            url: '$properties.url',
            metric: '$properties.metric_name'
          },
          avgValue: { $avg: '$properties.metric_value' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    return issues.map(issue => ({
      url: issue._id.url,
      metric: issue._id.metric,
      value: Math.round(issue.avgValue * 100) / 100,
      rating: 'poor',
      impact: issue.count
    }));
  }

  private calculatePerformanceScore(metrics: any): number {
    const weights = { LCP: 25, FID: 25, CLS: 25, FCP: 15, TTFB: 10 };
    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([metric, weight]) => {
      if (metrics[metric]) {
        const rating = metrics[metric].rating;
        let score = 100;
        if (rating === 'needs-improvement') score = 60;
        if (rating === 'poor') score = 30;

        totalScore += score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 100;
  }

  private calculateCoreWebVitalsPass(metrics: any): number {
    const coreMetrics = ['LCP', 'FID', 'CLS'];
    const passingMetrics = coreMetrics.filter(metric => 
      metrics[metric] && metrics[metric].rating === 'good'
    ).length;

    return Math.round((passingMetrics / coreMetrics.length) * 100);
  }

  private getDateGrouping(groupBy: string): any {
    switch (groupBy) {
      case 'hour':
        return { $dateToString: { format: '%Y-%m-%d-%H', date: '$timestamp' } };
      case 'day':
        return { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
      case 'week':
        return { $dateToString: { format: '%Y-%U', date: '$timestamp' } };
      default:
        return { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
    }
  }

  private async getDeviceBreakdown(matchQuery: any): Promise<any[]> {
    return this.analyticsEventModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$properties.device_type',
          count: { $sum: 1 },
          avgLCP: { $avg: { $cond: [{ $eq: ['$properties.metric_name', 'LCP'] }, '$properties.metric_value', null] } }
        }
      }
    ]);
  }

  private async getConnectionBreakdown(matchQuery: any): Promise<any[]> {
    return this.analyticsEventModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$properties.connection_type',
          count: { $sum: 1 },
          avgLCP: { $avg: { $cond: [{ $eq: ['$properties.metric_name', 'LCP'] }, '$properties.metric_value', null] } }
        }
      }
    ]);
  }

  private async getPageBreakdown(matchQuery: any): Promise<any[]> {
    return this.analyticsEventModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$properties.url',
          count: { $sum: 1 },
          avgLCP: { $avg: { $cond: [{ $eq: ['$properties.metric_name', 'LCP'] }, '$properties.metric_value', null] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
  }

  private async generateRecommendations(matchQuery: any): Promise<any[]> {
    const metrics = await this.getWebVitalsMetrics(matchQuery);
    const recommendations: any[] = [];

    Object.entries(metrics).forEach(([metric, data]: [string, any]) => {
      if (data.rating !== 'good') {
        recommendations.push(...this.getMetricRecommendations(metric, data));
      }
    });

    return recommendations;
  }

  private getMetricRecommendations(metric: string, data: any): any[] {
    const recommendations: any[] = [];

    switch (metric) {
      case 'LCP':
        if (data.rating === 'poor') {
          recommendations.push({
            metric,
            priority: 'high',
            title: 'Optimize Largest Contentful Paint',
            description: 'LCP is taking too long, affecting user experience',
            actions: [
              'Optimize images with proper sizing and modern formats',
              'Implement lazy loading for below-the-fold content',
              'Use a CDN for faster asset delivery',
              'Minimize render-blocking resources'
            ]
          });
        }
        break;
      
      case 'FID':
        if (data.rating === 'poor') {
          recommendations.push({
            metric,
            priority: 'high',
            title: 'Reduce First Input Delay',
            description: 'Users are experiencing delays when interacting with the page',
            actions: [
              'Minimize JavaScript execution time',
              'Use code splitting to reduce bundle size',
              'Break up long-running tasks',
              'Remove unused JavaScript'
            ]
          });
        }
        break;
      
      case 'CLS':
        if (data.rating === 'poor') {
          recommendations.push({
            metric,
            priority: 'medium',
            title: 'Fix Cumulative Layout Shift',
            description: 'Page elements are shifting unexpectedly',
            actions: [
              'Set explicit dimensions for images and videos',
              'Reserve space for dynamic content',
              'Use CSS aspect-ratio for responsive elements',
              'Preload fonts and use font-display: swap'
            ]
          });
        }
        break;
    }

    return recommendations;
  }

  private async generatePageRecommendations(url: string, metrics: any): Promise<any[]> {
    // Generate page-specific recommendations based on URL and metrics
    return this.getMetricRecommendations('LCP', metrics.LCP || { rating: 'good' });
  }

  private formatDeviceInsights(deviceMetrics: any[]): any {
    const insights: any = {};
    
    deviceMetrics.forEach(metric => {
      const deviceType = metric._id.deviceType || 'unknown';
      const metricName = metric._id.metric;
      
      if (!insights[deviceType]) {
        insights[deviceType] = {};
      }
      
      insights[deviceType][metricName] = {
        value: Math.round(metric.avgValue * 100) / 100,
        count: metric.count
      };
    });

    return insights;
  }

  private async getRecentDataPoints(since: Date): Promise<any[]> {
    return this.analyticsEventModel.aggregate([
      {
        $match: {
          eventCategory: EventCategory.PERFORMANCE,
          timestamp: { $gte: since },
          'properties.metric_name': 'LCP'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d-%H-%M', date: '$timestamp' }
          },
          avgValue: { $avg: '$properties.metric_value' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  }

  private formatUserExperienceData(userMetrics: any[], days: number): any {
    const formatted: any = {};
    
    userMetrics.forEach(metric => {
      const goodRatings = metric.ratings.filter((r: string) => r === 'good').length;
      const rating = goodRatings / metric.ratings.length >= 0.75 ? 'good' :
                    goodRatings / metric.ratings.length >= 0.5 ? 'needs-improvement' : 'poor';

      formatted[metric._id] = {
        average: Math.round(metric.avgValue * 100) / 100,
        rating,
        samples: metric.count,
        passRate: Math.round((goodRatings / metric.ratings.length) * 100)
      };
    });

    return {
      period: `${days} days`,
      metrics: formatted,
      overallScore: this.calculatePerformanceScore(formatted)
    };
  }

  private calculateOverallTrend(comparisons: any[]): string {
    const improvingCount = comparisons.filter(c => c.trend === 'improving').length;
    const degradingCount = comparisons.filter(c => c.trend === 'degrading').length;
    
    if (improvingCount > degradingCount) return 'improving';
    if (degradingCount > improvingCount) return 'degrading';
    return 'stable';
  }

  private async getErrorRate(since: Date): Promise<number> {
    // This would track error rates in Web Vitals collection
    return 0.5; // Mock error rate
  }

  private async getAvgProcessingTime(since: Date): Promise<number> {
    // This would track processing time for Web Vitals data
    return 45; // Mock processing time in ms
  }
}
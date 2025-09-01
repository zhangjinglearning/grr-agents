import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsEvent, AnalyticsEventDocument } from '../schemas/analytics-event.schema';
import { MetricsService } from './metrics.service';
import { WebVitalsService } from './web-vitals.service';

export interface AnalyticsQuery {
  startDate: Date;
  endDate: Date;
  boardId?: string;
  userId?: string;
  eventType?: string;
  filters?: Record<string, any>;
}

export interface AnalyticsResult {
  totalEvents: number;
  uniqueUsers: number;
  topEvents: Array<{ event: string; count: number }>;
  timeSeriesData: Array<{ date: string; count: number }>;
  conversionRate?: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly analyticsEventModel: Model<AnalyticsEventDocument>,
    private readonly metricsService: MetricsService,
    private readonly webVitalsService: WebVitalsService,
  ) {}

  async trackEvent(
    eventName: string,
    properties: Record<string, any>,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    try {
      const event = new this.analyticsEventModel({
        eventName,
        properties,
        userId,
        sessionId,
        timestamp: new Date(),
        userAgent: properties.userAgent,
        ipAddress: properties.ipAddress,
        pageUrl: properties.pageUrl,
      });

      await event.save();
      this.logger.debug(`Event tracked: ${eventName}`, { userId, sessionId });
    } catch (error) {
      this.logger.error(`Failed to track event: ${eventName}`, error);
      throw error;
    }
  }

  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    try {
      const matchStage: any = {
        timestamp: {
          $gte: query.startDate,
          $lte: query.endDate,
        },
      };

      if (query.boardId) {
        matchStage['properties.boardId'] = query.boardId;
      }

      if (query.userId) {
        matchStage.userId = query.userId;
      }

      if (query.eventType) {
        matchStage.eventName = query.eventType;
      }

      // Apply additional filters
      if (query.filters) {
        Object.entries(query.filters).forEach(([key, value]) => {
          matchStage[`properties.${key}`] = value;
        });
      }

      const pipeline = [
        { $match: matchStage },
        {
          $facet: {
            totalEvents: [{ $count: 'count' }],
            uniqueUsers: [
              { $group: { _id: '$userId' } },
              { $count: 'count' }
            ],
            topEvents: [
              { $group: { _id: '$eventName', count: { $sum: 1 } } },
              { $sort: { count: -1 as -1 } },
              { $limit: 10 },
              { $project: { event: '$_id', count: 1, _id: 0 } }
            ],
            timeSeriesData: [
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$timestamp'
                    }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id': 1 as 1 } },
              { $project: { date: '$_id', count: 1, _id: 0 } }
            ]
          }
        }
      ];

      const [result] = await this.analyticsEventModel.aggregate(pipeline as any);

      return {
        totalEvents: result.totalEvents[0]?.count || 0,
        uniqueUsers: result.uniqueUsers[0]?.count || 0,
        topEvents: result.topEvents || [],
        timeSeriesData: result.timeSeriesData || [],
      };
    } catch (error) {
      this.logger.error('Failed to get analytics', error);
      throw error;
    }
  }

  async getUserJourney(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const events = await this.analyticsEventModel
        .find({
          userId,
          timestamp: { $gte: startDate, $lte: endDate },
        })
        .sort({ timestamp: 1 })
        .lean();

      return events.map(event => ({
        eventName: (event as any).eventName,
        timestamp: (event as any).timestamp,
        properties: (event as any).properties,
        pageUrl: (event as any).pageUrl,
      }));
    } catch (error) {
      this.logger.error(`Failed to get user journey for user: ${userId}`, error);
      throw error;
    }
  }

  async getFunnelAnalysis(
    funnelSteps: string[],
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<any> {
    try {
      const matchStage: any = {
        timestamp: { $gte: startDate, $lte: endDate },
        eventName: { $in: funnelSteps },
      };

      if (boardId) {
        matchStage['properties.boardId'] = boardId;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              userId: '$userId',
              eventName: '$eventName',
            },
            firstOccurrence: { $min: '$timestamp' },
          }
        },
        {
          $group: {
            _id: '$_id.userId',
            events: {
              $push: {
                eventName: '$_id.eventName',
                timestamp: '$firstOccurrence',
              }
            }
          }
        },
        {
          $project: {
            userId: '$_id',
            sortedEvents: {
              $sortArray: {
                input: '$events',
                sortBy: { timestamp: 1 }
              }
            }
          }
        }
      ];

      const userJourneys = await this.analyticsEventModel.aggregate(pipeline);

      // Calculate funnel metrics
      const funnelMetrics = funnelSteps.map((step, index) => {
        const usersAtStep = userJourneys.filter(journey =>
          journey.sortedEvents.some((event: any) => event.eventName === step)
        ).length;

        const conversionRate = index === 0 ? 100 : 
          (usersAtStep / userJourneys.length) * 100;

        return {
          step,
          users: usersAtStep,
          conversionRate: Math.round(conversionRate * 100) / 100,
        };
      });

      return {
        totalUsers: userJourneys.length,
        funnelSteps: funnelMetrics,
        dropOffPoints: this.calculateDropOffPoints(funnelMetrics),
      };
    } catch (error) {
      this.logger.error('Failed to get funnel analysis', error);
      throw error;
    }
  }

  private calculateDropOffPoints(funnelMetrics: any[]): any[] {
    const dropOffs = [];
    for (let i = 1; i < funnelMetrics.length; i++) {
      const current = funnelMetrics[i];
      const previous = funnelMetrics[i - 1];
      const dropOffRate = ((previous.users - current.users) / previous.users) * 100;
      
      dropOffs.push({
        fromStep: previous.step,
        toStep: current.step,
        dropOffRate: Math.round(dropOffRate * 100) / 100,
        usersLost: previous.users - current.users,
      });
    }
    return dropOffs;
  }

  async getRetentionAnalysis(
    startDate: Date,
    endDate: Date,
    cohortType: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ): Promise<any> {
    try {
      // Implementation for retention analysis
      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            eventName: 'user_login',
          }
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              period: {
                $dateToString: {
                  format: cohortType === 'daily' ? '%Y-%m-%d' :
                          cohortType === 'weekly' ? '%Y-%U' : '%Y-%m',
                  date: '$timestamp'
                }
              }
            }
          }
        },
        {
          $group: {
            _id: '$_id.userId',
            periods: { $addToSet: '$_id.period' }
          }
        }
      ];

      const userPeriods = await this.analyticsEventModel.aggregate(pipeline);
      
      // Calculate retention rates
      const retentionData = this.calculateRetentionRates(userPeriods, cohortType);
      
      return retentionData;
    } catch (error) {
      this.logger.error('Failed to get retention analysis', error);
      throw error;
    }
  }

  private calculateRetentionRates(userPeriods: any[], cohortType: string): any {
    // Simplified retention calculation
    const cohorts = new Map();
    
    userPeriods.forEach(user => {
      const firstPeriod = user.periods.sort()[0];
      if (!cohorts.has(firstPeriod)) {
        cohorts.set(firstPeriod, {
          cohortPeriod: firstPeriod,
          totalUsers: 0,
          retentionByPeriod: new Map(),
        });
      }
      
      const cohort = cohorts.get(firstPeriod);
      cohort.totalUsers++;
      
      user.periods.forEach((period: string) => {
        if (!cohort.retentionByPeriod.has(period)) {
          cohort.retentionByPeriod.set(period, 0);
        }
        cohort.retentionByPeriod.set(period, cohort.retentionByPeriod.get(period) + 1);
      });
    });

    return Array.from(cohorts.values()).map(cohort => ({
      cohortPeriod: cohort.cohortPeriod,
      totalUsers: cohort.totalUsers,
      retentionRates: Array.from(cohort.retentionByPeriod.entries()).map(([period, users]) => ({
        period,
        retainedUsers: users,
        retentionRate: Math.round((users / cohort.totalUsers) * 100 * 100) / 100,
      })),
    }));
  }

  async getRealtimeMetrics(): Promise<any> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const metrics = await this.analyticsEventModel.aggregate([
        {
          $match: {
            timestamp: { $gte: oneHourAgo, $lte: now }
          }
        },
        {
          $facet: {
            activeUsers: [
              { $group: { _id: '$userId' } },
              { $count: 'count' }
            ],
            pageViews: [
              { $match: { eventName: 'page_view' } },
              { $count: 'count' }
            ],
            topPages: [
              { $match: { eventName: 'page_view' } },
              { $group: { _id: '$pageUrl', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 }
            ]
          }
        }
      ]);

      return {
        activeUsers: metrics[0].activeUsers[0]?.count || 0,
        pageViews: metrics[0].pageViews[0]?.count || 0,
        topPages: metrics[0].topPages || [],
        timestamp: now,
      };
    } catch (error) {
      this.logger.error('Failed to get realtime metrics', error);
      throw error;
    }
  }
}

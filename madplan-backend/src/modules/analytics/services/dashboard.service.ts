import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsEvent, AnalyticsEventDocument } from '../schemas/analytics-event.schema';
import { MetricSnapshot, MetricSnapshotDocument } from '../schemas/metric-snapshot.schema';
import { UserSession, UserSessionDocument } from '../schemas/user-session.schema';

export interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    avgSessionDuration: number;
    bounceRate: number;
    conversionRate: number;
  };
  traffic: {
    pageViews: number;
    uniquePageViews: number;
    topPages: Array<{ page: string; views: number }>;
    trafficSources: Array<{ source: string; sessions: number }>;
  };
  engagement: {
    avgTimeOnSite: number;
    pagesPerSession: number;
    newVsReturning: { new: number; returning: number };
    topEvents: Array<{ event: string; count: number }>;
  };
  performance: {
    loadTime: number;
    errorRate: number;
    uptime: number;
  };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly analyticsEventModel: Model<AnalyticsEventDocument>,
    @InjectModel(MetricSnapshot.name)
    private readonly metricSnapshotModel: Model<MetricSnapshotDocument>,
    @InjectModel(UserSession.name)
    private readonly userSessionModel: Model<UserSessionDocument>,
  ) {}

  async getDashboardMetrics(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<DashboardMetrics> {
    try {
      const [overview, traffic, engagement, performance] = await Promise.all([
        this.getOverviewMetrics(startDate, endDate, boardId),
        this.getTrafficMetrics(startDate, endDate, boardId),
        this.getEngagementMetrics(startDate, endDate, boardId),
        this.getPerformanceMetrics(startDate, endDate, boardId),
      ]);

      return {
        overview,
        traffic,
        engagement,
        performance,
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard metrics', error);
      throw error;
    }
  }

  private async getOverviewMetrics(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<DashboardMetrics['overview']> {
    const matchStage: any = {
      timestamp: { $gte: startDate, $lte: endDate },
    };

    if (boardId) {
      matchStage['properties.boardId'] = boardId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          totalUsers: [
            { $group: { _id: '$userId' } },
            { $count: 'count' }
          ],
          activeUsers: [
            {
              $match: {
                timestamp: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
              }
            },
            { $group: { _id: '$userId' } },
            { $count: 'count' }
          ],
          sessions: [
            { $group: { _id: '$sessionId' } },
            { $count: 'count' }
          ],
          conversions: [
            { $match: { eventName: 'conversion' } },
            { $count: 'count' }
          ]
        }
      }
    ];

    const [result] = await this.analyticsEventModel.aggregate(pipeline);

    // Get session data for duration and bounce rate
    const sessionStats = await this.getSessionStats(startDate, endDate, boardId);

    return {
      totalUsers: result.totalUsers[0]?.count || 0,
      activeUsers: result.activeUsers[0]?.count || 0,
      totalSessions: result.sessions[0]?.count || 0,
      avgSessionDuration: sessionStats.avgDuration,
      bounceRate: sessionStats.bounceRate,
      conversionRate: this.calculateConversionRate(
        result.conversions[0]?.count || 0,
        result.sessions[0]?.count || 0
      ),
    };
  }

  private async getTrafficMetrics(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<DashboardMetrics['traffic']> {
    const matchStage: any = {
      timestamp: { $gte: startDate, $lte: endDate },
      eventName: 'page_view',
    };

    if (boardId) {
      matchStage['properties.boardId'] = boardId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          pageViews: [{ $count: 'count' }],
          uniquePageViews: [
            { $group: { _id: { userId: '$userId', page: '$pageUrl' } } },
            { $count: 'count' }
          ],
          topPages: [
            { $group: { _id: '$pageUrl', views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 10 },
            { $project: { page: '$_id', views: 1, _id: 0 } }
          ],
          trafficSources: [
            {
              $group: {
                _id: '$properties.referrer',
                sessions: { $addToSet: '$sessionId' }
              }
            },
            {
              $project: {
                source: { $ifNull: ['$_id', 'Direct'] },
                sessions: { $size: '$sessions' }
              }
            },
            { $sort: { sessions: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ];

    const [result] = await this.analyticsEventModel.aggregate(pipeline as any);

    return {
      pageViews: result.pageViews[0]?.count || 0,
      uniquePageViews: result.uniquePageViews[0]?.count || 0,
      topPages: result.topPages || [],
      trafficSources: result.trafficSources || [],
    };
  }

  private async getEngagementMetrics(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<DashboardMetrics['engagement']> {
    const matchStage: any = {
      timestamp: { $gte: startDate, $lte: endDate },
    };

    if (boardId) {
      matchStage['properties.boardId'] = boardId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          topEvents: [
            { $group: { _id: '$eventName', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { event: '$_id', count: 1, _id: 0 } }
          ],
          userTypes: [
            {
              $group: {
                _id: '$userId',
                firstSeen: { $min: '$timestamp' }
              }
            },
            {
              $project: {
                isNew: {
                  $gte: ['$firstSeen', startDate]
                }
              }
            },
            {
              $group: {
                _id: '$isNew',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    const [result] = await this.analyticsEventModel.aggregate(pipeline as any);

    // Calculate new vs returning users
    const userTypes = result.userTypes.reduce((acc: any, item: any) => {
      if (item._id) {
        acc.new = item.count;
      } else {
        acc.returning = item.count;
      }
      return acc;
    }, { new: 0, returning: 0 });

    // Get session-based metrics
    const sessionMetrics = await this.getSessionEngagementMetrics(startDate, endDate, boardId);

    return {
      avgTimeOnSite: sessionMetrics.avgTimeOnSite,
      pagesPerSession: sessionMetrics.pagesPerSession,
      newVsReturning: userTypes,
      topEvents: result.topEvents || [],
    };
  }

  private async getPerformanceMetrics(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<DashboardMetrics['performance']> {
    const matchStage: any = {
      timestamp: { $gte: startDate, $lte: endDate },
    };

    if (boardId) {
      matchStage['properties.boardId'] = boardId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          loadTimes: [
            { $match: { eventName: 'page_load' } },
            {
              $group: {
                _id: null,
                avgLoadTime: { $avg: '$properties.loadTime' }
              }
            }
          ],
          errors: [
            { $match: { eventName: 'error' } },
            { $count: 'count' }
          ],
          totalEvents: [{ $count: 'count' }]
        }
      }
    ];

    const [result] = await this.analyticsEventModel.aggregate(pipeline);

    const totalEvents = result.totalEvents[0]?.count || 0;
    const errorCount = result.errors[0]?.count || 0;

    return {
      loadTime: result.loadTimes[0]?.avgLoadTime || 0,
      errorRate: totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0,
      uptime: 99.9, // This would typically come from a monitoring service
    };
  }

  private async getSessionStats(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<{ avgDuration: number; bounceRate: number }> {
    const matchStage: any = {
      startTime: { $gte: startDate, $lte: endDate },
    };

    if (boardId) {
      matchStage.boardId = boardId;
    }

    const sessions = await this.userSessionModel.find(matchStage).lean();

    if (sessions.length === 0) {
      return { avgDuration: 0, bounceRate: 0 };
    }

    const totalDuration = sessions.reduce((sum, session) => {
      const duration = session.endTime 
        ? session.endTime.getTime() - session.startTime.getTime()
        : 0;
      return sum + duration;
    }, 0);

    const bouncedSessions = sessions.filter(session => 
      session.pageViews <= 1
    ).length;

    return {
      avgDuration: totalDuration / sessions.length / 1000, // Convert to seconds
      bounceRate: (bouncedSessions / sessions.length) * 100,
    };
  }

  private async getSessionEngagementMetrics(
    startDate: Date,
    endDate: Date,
    boardId?: string,
  ): Promise<{ avgTimeOnSite: number; pagesPerSession: number }> {
    const matchStage: any = {
      startTime: { $gte: startDate, $lte: endDate },
    };

    if (boardId) {
      matchStage.boardId = boardId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          avgDuration: {
            $avg: {
              $subtract: [
                { $ifNull: ['$endTime', new Date()] },
                '$startTime'
              ]
            }
          },
          avgPageViews: { $avg: '$pageViews' }
        }
      }
    ];

    const [result] = await this.userSessionModel.aggregate(pipeline);

    return {
      avgTimeOnSite: result?.avgDuration ? result.avgDuration / 1000 : 0,
      pagesPerSession: result?.avgPageViews || 0,
    };
  }

  private calculateConversionRate(conversions: number, sessions: number): number {
    return sessions > 0 ? (conversions / sessions) * 100 : 0;
  }

  async getRealtimeDashboard(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const realtimeMetrics = await this.getDashboardMetrics(oneHourAgo, now);

    return {
      ...realtimeMetrics,
      timestamp: now,
      isRealtime: true,
    };
  }

  async createMetricSnapshot(
    metricName: string,
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const snapshot = new this.metricSnapshotModel({
        metricName,
        value,
        timestamp: new Date(),
        metadata: metadata || {},
      });

      await snapshot.save();
      this.logger.debug(`Metric snapshot created: ${metricName} = ${value}`);
    } catch (error) {
      this.logger.error(`Failed to create metric snapshot: ${metricName}`, error);
      throw error;
    }
  }

  async getMetricHistory(
    metricName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const snapshots = await this.metricSnapshotModel
        .find({
          metricName,
          timestamp: { $gte: startDate, $lte: endDate },
        })
        .sort({ timestamp: 1 })
        .lean();

      return snapshots.map(snapshot => ({
        timestamp: snapshot.timestamp,
        value: snapshot.value,
        metadata: snapshot.metadata,
      }));
    } catch (error) {
      this.logger.error(`Failed to get metric history: ${metricName}`, error);
      throw error;
    }
  }
}

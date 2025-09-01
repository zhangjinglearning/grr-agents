import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
  ProductivityMetric,
  ProductivityMetricDocument,
  BoardAnalytics,
  BoardAnalyticsDocument,
  PerformanceInsight,
  PerformanceInsightDocument,
  MetricType,
  TimeFrame,
  AnalyticsScope,
} from './analytics.entity';
import {
  AnalyticsQueryInput,
  ProductivityReportInput,
  InsightGenerationInput,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(AnalyticsEvent.name) private eventModel: Model<AnalyticsEventDocument>,
    @InjectModel(ProductivityMetric.name) private metricModel: Model<ProductivityMetricDocument>,
    @InjectModel(BoardAnalytics.name) private boardAnalyticsModel: Model<BoardAnalyticsDocument>,
    @InjectModel(PerformanceInsight.name) private insightModel: Model<PerformanceInsightDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  // Event Tracking
  async trackEvent(
    eventType: MetricType,
    userId: string,
    boardId?: string,
    entityId?: string,
    entityType?: string,
    metadata?: any,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AnalyticsEvent> {
    const event = new this.eventModel({
      eventType,
      userId,
      boardId,
      entityId,
      entityType,
      metadata,
      sessionId,
      ipAddress,
      userAgent,
    });

    const savedEvent = await event.save();
    
    // Emit event for real-time processing
    this.eventEmitter.emit('analytics.event.tracked', savedEvent);
    
    return savedEvent;
  }

  // Event Listeners
  @OnEvent('card.created')
  async handleCardCreated(payload: any) {
    await this.trackEvent(
      MetricType.CARD_CREATED,
      payload.userId,
      payload.boardId,
      payload.cardId,
      'card',
      { listId: payload.listId }
    );
  }

  @OnEvent('card.updated')
  async handleCardUpdated(payload: any) {
    // Track completion if status changed to completed
    if (payload.changes?.status === 'completed') {
      await this.trackEvent(
        MetricType.CARD_COMPLETED,
        payload.userId,
        payload.boardId,
        payload.cardId,
        'card',
        payload.changes
      );
    }
  }

  @OnEvent('card.moved')
  async handleCardMoved(payload: any) {
    await this.trackEvent(
      MetricType.CARD_MOVED,
      payload.userId,
      payload.boardId,
      payload.cardId,
      'card',
      {
        fromListId: payload.fromListId,
        toListId: payload.toListId,
        position: payload.position,
      }
    );
  }

  @OnEvent('list.created')
  async handleListCreated(payload: any) {
    await this.trackEvent(
      MetricType.LIST_CREATED,
      payload.userId,
      payload.boardId,
      payload.listId,
      'list'
    );
  }

  @OnEvent('board.accessed')
  async handleBoardAccessed(payload: any) {
    await this.trackEvent(
      MetricType.BOARD_ACCESSED,
      payload.userId,
      payload.boardId,
      payload.boardId,
      'board',
      { accessType: payload.accessType }
    );
  }

  @OnEvent('user.active')
  async handleUserActive(payload: any) {
    await this.trackEvent(
      MetricType.USER_ACTIVE,
      payload.userId,
      payload.boardId,
      undefined,
      'session',
      { action: payload.action }
    );
  }

  @OnEvent('collaboration.event')
  async handleCollaborationEvent(payload: any) {
    await this.trackEvent(
      MetricType.COLLABORATION_EVENT,
      payload.userId,
      payload.boardId,
      payload.entityId,
      'collaboration',
      { action: payload.action, type: payload.type }
    );
  }

  @OnEvent('search.performed')
  async handleSearchPerformed(payload: any) {
    await this.trackEvent(
      MetricType.SEARCH_PERFORMED,
      payload.userId,
      payload.boardId,
      undefined,
      'search',
      { query: payload.query, resultsCount: payload.resultsCount }
    );
  }

  @OnEvent('template.used')
  async handleTemplateUsed(payload: any) {
    await this.trackEvent(
      MetricType.TEMPLATE_USED,
      payload.userId,
      payload.boardId,
      payload.templateId,
      'template',
      { templateType: payload.templateType }
    );
  }

  // Analytics Queries
  async getAnalytics(query: AnalyticsQueryInput, userId: string): Promise<any> {
    const {
      scope,
      timeFrame,
      startDate,
      endDate,
      boardId,
      eventTypes,
      groupBy,
    } = query;

    const matchStage: any = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Apply scope filtering
    if (scope === AnalyticsScope.USER) {
      matchStage.userId = userId;
    }
    if (scope === AnalyticsScope.BOARD && boardId) {
      matchStage.boardId = boardId;
    }
    if (eventTypes && eventTypes.length > 0) {
      matchStage.eventType = { $in: eventTypes };
    }

    const pipeline: any[] = [{ $match: matchStage }];

    // Group by time frame
    const groupStage: any = {
      _id: this.getTimeGrouping(timeFrame),
      count: { $sum: 1 },
      uniqueUsers: { $addToSet: '$userId' },
    };

    if (groupBy) {
      groupStage[groupBy] = { $addToSet: `$${groupBy}` };
    }

    pipeline.push(
      { $group: groupStage },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          ...(groupBy && { [groupBy]: { $size: `$${groupBy}` } }),
        },
      },
      { $sort: { _id: 1 } }
    );

    const results = await this.eventModel.aggregate(pipeline).exec();

    return {
      data: results,
      summary: await this.getAnalyticsSummary(matchStage),
    };
  }

  async getProductivityReport(input: ProductivityReportInput, userId: string): Promise<any> {
    const { startDate, endDate, boardId, includeComparison } = input;

    const matchStage: any = {
      userId,
      date: { $gte: startDate, $lte: endDate },
    };

    if (boardId) {
      matchStage.boardId = boardId;
    }

    const metrics = await this.metricModel.find(matchStage).sort({ date: 1 }).exec();

    const summary = metrics.reduce(
      (acc, metric) => ({
        totalCardsCreated: acc.totalCardsCreated + metric.cardsCreated,
        totalCardsCompleted: acc.totalCardsCompleted + metric.cardsCompleted,
        totalCardsMoved: acc.totalCardsMoved + metric.cardsMoved,
        totalListsCreated: acc.totalListsCreated + metric.listsCreated,
        totalActiveTime: acc.totalActiveTime + metric.activeTimeMinutes,
        totalSearches: acc.totalSearches + metric.searchesPerformed,
        totalTemplatesUsed: acc.totalTemplatesUsed + metric.templatesUsed,
        avgCompletionTime: (acc.avgCompletionTime + metric.avgCompletionTime) / 2,
        totalSessions: acc.totalSessions + metric.totalSessions,
      }),
      {
        totalCardsCreated: 0,
        totalCardsCompleted: 0,
        totalCardsMoved: 0,
        totalListsCreated: 0,
        totalActiveTime: 0,
        totalSearches: 0,
        totalTemplatesUsed: 0,
        avgCompletionTime: 0,
        totalSessions: 0,
      }
    );

    const report = {
      period: { startDate, endDate },
      summary,
      dailyMetrics: metrics,
      insights: await this.generateProductivityInsights(userId, startDate, endDate),
    };

    if (includeComparison) {
      const comparisonPeriod = this.getComparisonPeriod(startDate, endDate);
      const comparisonData = await this.getProductivityReport(
        {
          startDate: comparisonPeriod.startDate,
          endDate: comparisonPeriod.endDate,
          boardId,
        },
        userId
      );
      report['comparison'] = comparisonData;
    }

    return report;
  }

  async getBoardAnalytics(boardId: string, startDate: Date, endDate: Date): Promise<any> {
    const analytics = await this.boardAnalyticsModel
      .find({
        boardId,
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: 1 })
      .exec();

    const latest = analytics[analytics.length - 1];

    return {
      timeline: analytics,
      current: latest ? {
        totalCards: latest.totalCards,
        totalLists: latest.totalLists,
        activeUsers: latest.activeUsers,
        completionRate: latest.completionRate,
        avgTimeToComplete: latest.avgTimeToComplete,
        labelDistribution: latest.labelDistribution,
        priorityDistribution: latest.priorityDistribution,
        activityHeatmap: latest.activityHeatmap,
      } : null,
      trends: this.calculateTrends(analytics),
    };
  }

  async getPerformanceInsights(userId: string, boardId?: string): Promise<PerformanceInsight[]> {
    const query: any = {
      userId,
      isActive: true,
    };

    if (boardId) {
      query.boardId = boardId;
    }

    return this.insightModel
      .find(query)
      .sort({ severity: -1, score: -1, generatedAt: -1 })
      .limit(50)
      .exec();
  }

  async getDashboardData(userId: string, boardId?: string): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [
      recentEvents,
      productivityReport,
      boardAnalytics,
      insights,
    ] = await Promise.all([
      this.getRecentEvents(userId, boardId, 10),
      this.getProductivityReport({ startDate, endDate, boardId }, userId),
      boardId ? this.getBoardAnalytics(boardId, startDate, endDate) : null,
      this.getPerformanceInsights(userId, boardId),
    ]);

    return {
      recentEvents,
      productivity: productivityReport,
      board: boardAnalytics,
      insights: insights.slice(0, 5), // Top 5 insights
      quickStats: {
        cardsCreatedToday: await this.getTodayMetric(userId, MetricType.CARD_CREATED),
        cardsCompletedToday: await this.getTodayMetric(userId, MetricType.CARD_COMPLETED),
        boardsAccessedToday: await this.getTodayMetric(userId, MetricType.BOARD_ACCESSED),
        activeTimeToday: await this.getTodayActiveTime(userId),
      },
    };
  }

  // Scheduled Tasks
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateHourlyMetrics(): Promise<void> {
    this.logger.log('Aggregating hourly metrics...');
    await this.aggregateMetrics(TimeFrame.HOUR);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async aggregateDailyMetrics(): Promise<void> {
    this.logger.log('Aggregating daily metrics...');
    await this.aggregateMetrics(TimeFrame.DAY);
    await this.generateBoardAnalytics();
    await this.generateInsights();
  }

  @Cron(CronExpression.EVERY_WEEK)
  async aggregateWeeklyMetrics(): Promise<void> {
    this.logger.log('Aggregating weekly metrics...');
    await this.aggregateMetrics(TimeFrame.WEEK);
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async aggregateMonthlyMetrics(): Promise<void> {
    this.logger.log('Aggregating monthly metrics...');
    await this.aggregateMetrics(TimeFrame.MONTH);
  }

  // Helper Methods
  private async aggregateMetrics(timeFrame: TimeFrame): Promise<void> {
    const { startDate, endDate } = this.getTimeFrameBounds(timeFrame);
    
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            boardId: '$boardId',
            date: this.getTimeGrouping(timeFrame),
          },
          cardsCreated: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.CARD_CREATED] }, 1, 0] },
          },
          cardsCompleted: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.CARD_COMPLETED] }, 1, 0] },
          },
          cardsMoved: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.CARD_MOVED] }, 1, 0] },
          },
          listsCreated: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.LIST_CREATED] }, 1, 0] },
          },
          boardsAccessed: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.BOARD_ACCESSED] }, 1, 0] },
          },
          collaborationEvents: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.COLLABORATION_EVENT] }, 1, 0] },
          },
          searchesPerformed: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.SEARCH_PERFORMED] }, 1, 0] },
          },
          templatesUsed: {
            $sum: { $cond: [{ $eq: ['$eventType', MetricType.TEMPLATE_USED] }, 1, 0] },
          },
          totalEvents: { $sum: 1 },
        },
      },
    ];

    const results = await this.eventModel.aggregate(pipeline).exec();

    for (const result of results) {
      await this.metricModel.findOneAndUpdate(
        {
          userId: result._id.userId,
          boardId: result._id.boardId,
          date: result._id.date,
        },
        {
          $set: {
            cardsCreated: result.cardsCreated,
            cardsCompleted: result.cardsCompleted,
            cardsMoved: result.cardsMoved,
            listsCreated: result.listsCreated,
            boardsAccessed: result.boardsAccessed,
            collaborationEvents: result.collaborationEvents,
            searchesPerformed: result.searchesPerformed,
            templatesUsed: result.templatesUsed,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      ).exec();
    }
  }

  private async generateBoardAnalytics(): Promise<void> {
    // Implementation for board analytics generation
    // This would aggregate board-level metrics
  }

  private async generateInsights(): Promise<void> {
    // Implementation for insight generation
    // This would analyze patterns and generate actionable insights
  }

  private async generateProductivityInsights(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const insights: any[] = [];

    // Analyze productivity patterns
    const metrics = await this.metricModel
      .find({
        userId,
        date: { $gte: startDate, $lte: endDate },
      })
      .exec();

    if (metrics.length === 0) return insights;

    // Calculate averages
    const avgCardsCreated = metrics.reduce((sum, m) => sum + m.cardsCreated, 0) / metrics.length;
    const avgCardsCompleted = metrics.reduce((sum, m) => sum + m.cardsCompleted, 0) / metrics.length;
    const completionRate = avgCardsCompleted / (avgCardsCreated || 1);

    // Generate insights based on patterns
    if (completionRate > 0.8) {
      insights.push({
        type: 'productivity_high',
        title: 'Excellent Completion Rate',
        description: `You're completing ${Math.round(completionRate * 100)}% of your cards. Keep up the great work!`,
        score: completionRate,
      });
    } else if (completionRate < 0.5) {
      insights.push({
        type: 'productivity_low',
        title: 'Low Completion Rate',
        description: `Your completion rate is ${Math.round(completionRate * 100)}%. Consider breaking down tasks or setting smaller goals.`,
        score: completionRate,
      });
    }

    return insights;
  }

  private getTimeGrouping(timeFrame: TimeFrame): any {
    switch (timeFrame) {
      case TimeFrame.HOUR:
        return {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' },
        };
      case TimeFrame.DAY:
        return {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
        };
      case TimeFrame.WEEK:
        return {
          year: { $year: '$timestamp' },
          week: { $week: '$timestamp' },
        };
      case TimeFrame.MONTH:
        return {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
        };
      default:
        return '$timestamp';
    }
  }

  private getTimeFrameBounds(timeFrame: TimeFrame): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate: Date;

    switch (timeFrame) {
      case TimeFrame.HOUR:
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case TimeFrame.DAY:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case TimeFrame.WEEK:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case TimeFrame.MONTH:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private getComparisonPeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
    const duration = endDate.getTime() - startDate.getTime();
    return {
      startDate: new Date(startDate.getTime() - duration),
      endDate: new Date(startDate.getTime() - 1),
    };
  }

  private calculateTrends(analytics: BoardAnalytics[]): any {
    if (analytics.length < 2) return null;

    const first = analytics[0];
    const last = analytics[analytics.length - 1];

    return {
      totalCards: ((last.totalCards - first.totalCards) / first.totalCards) * 100,
      activeUsers: ((last.activeUsers - first.activeUsers) / first.activeUsers) * 100,
      completionRate: ((last.completionRate - first.completionRate) / first.completionRate) * 100,
    };
  }

  private async getRecentEvents(userId: string, boardId?: string, limit = 10): Promise<AnalyticsEvent[]> {
    const query: any = { userId };
    if (boardId) {
      query.boardId = boardId;
    }

    return this.eventModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  private async getTodayMetric(userId: string, eventType: MetricType): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.eventModel
      .countDocuments({
        userId,
        eventType,
        timestamp: { $gte: today, $lt: tomorrow },
      })
      .exec();
  }

  private async getTodayActiveTime(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metric = await this.metricModel
      .findOne({
        userId,
        date: today,
      })
      .exec();

    return metric?.activeTimeMinutes || 0;
  }

  private async getAnalyticsSummary(matchStage: any): Promise<any> {
    const totalEvents = await this.eventModel.countDocuments(matchStage).exec();
    const uniqueUsers = await this.eventModel.distinct('userId', matchStage).exec();
    const uniqueBoards = await this.eventModel.distinct('boardId', matchStage).exec();

    return {
      totalEvents,
      uniqueUsers: uniqueUsers.length,
      uniqueBoards: uniqueBoards.filter(Boolean).length,
    };
  }
}
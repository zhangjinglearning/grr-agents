import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsEvent,
  ProductivityMetric,
  BoardAnalytics,
  PerformanceInsight,
} from './analytics.entity';
import {
  AnalyticsQueryInput,
  ProductivityReportInput,
  BoardAnalyticsInput,
  InsightGenerationInput,
  EventTrackingInput,
  DashboardQueryInput,
} from './dto/analytics.dto';

@Resolver(() => AnalyticsEvent)
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Mutation(() => AnalyticsEvent)
  @UseGuards(JwtAuthGuard)
  async trackEvent(
    @Args('input') input: EventTrackingInput,
    @Context() context: any,
  ): Promise<AnalyticsEvent> {
    const userId = context.req.user.userId;
    const { eventType, boardId, entityId, entityType, metadata, sessionId } = input;
    
    return this.analyticsService.trackEvent(
      eventType,
      userId,
      boardId,
      entityId,
      entityType,
      metadata,
      sessionId,
      context.req.ip,
      context.req.get('User-Agent'),
    );
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getAnalytics(
    @Args('query') query: AnalyticsQueryInput,
    @Context() context: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    return this.analyticsService.getAnalytics(query, userId);
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getProductivityReport(
    @Args('input') input: ProductivityReportInput,
    @Context() context: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    return this.analyticsService.getProductivityReport(input, userId);
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getBoardAnalytics(
    @Args('input') input: BoardAnalyticsInput,
    @Context() context: any,
  ): Promise<any> {
    const { boardId, startDate, endDate } = input;
    return this.analyticsService.getBoardAnalytics(boardId, startDate, endDate);
  }

  @Query(() => [PerformanceInsight])
  @UseGuards(JwtAuthGuard)
  async getPerformanceInsights(
    @Args('boardId', { type: () => ID, nullable: true }) boardId?: string,
    @Context() context?: any,
  ): Promise<PerformanceInsight[]> {
    const userId = context.req.user.userId;
    return this.analyticsService.getPerformanceInsights(userId, boardId);
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getDashboardData(
    @Args('query', { nullable: true }) query?: DashboardQueryInput,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    return this.analyticsService.getDashboardData(userId, query?.boardId);
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getUserProductivityTrends(
    @Args('days', { defaultValue: 30 }) days: number,
    @Args('boardId', { type: () => ID, nullable: true }) boardId?: string,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.analyticsService.getProductivityReport(
      { startDate, endDate, boardId, includeComparison: true },
      userId
    );
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getActivityHeatmap(
    @Args('boardId', { type: () => ID, nullable: true }) boardId?: string,
    @Args('days', { defaultValue: 90 }) days?: number,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily activity data for heatmap visualization
    return this.analyticsService.getAnalytics(
      {
        scope: boardId ? 'board' : 'user',
        timeFrame: 'day',
        startDate,
        endDate,
        boardId,
        groupBy: 'eventType',
      } as any,
      userId
    );
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getCollaborationStats(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Args('days', { defaultValue: 30 }) days?: number,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.analyticsService.getAnalytics(
      {
        scope: 'board',
        timeFrame: 'day',
        startDate,
        endDate,
        boardId,
        eventTypes: ['collaboration_event', 'board_accessed', 'card_created', 'card_updated'],
      } as any,
      userId
    );
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getTimeTrackingData(
    @Args('boardId', { type: () => ID, nullable: true }) boardId?: string,
    @Args('days', { defaultValue: 7 }) days?: number,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Return time tracking and productivity data
    return this.analyticsService.getProductivityReport(
      { startDate, endDate, boardId, includeComparison: false },
      userId
    );
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getGoalProgress(
    @Args('boardId', { type: () => ID, nullable: true }) boardId?: string,
    @Args('period', { defaultValue: 'month' }) period?: string,
    @Context() context?: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const report = await this.analyticsService.getProductivityReport(
      { startDate, endDate, boardId, includeComparison: false },
      userId
    );

    // Transform data for goal progress visualization
    return {
      period,
      cardsCompleted: report.summary.totalCardsCompleted,
      completionRate: report.summary.totalCardsCompleted / (report.summary.totalCardsCreated || 1),
      activeTime: report.summary.totalActiveTime,
      productivity: report.insights.filter(i => i.type.includes('productivity')),
    };
  }
}
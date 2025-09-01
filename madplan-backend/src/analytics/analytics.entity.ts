import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, Int, Float, registerEnumType } from '@nestjs/graphql';

export enum MetricType {
  CARD_CREATED = 'card_created',
  CARD_COMPLETED = 'card_completed',
  CARD_MOVED = 'card_moved',
  LIST_CREATED = 'list_created',
  BOARD_ACCESSED = 'board_accessed',
  USER_ACTIVE = 'user_active',
  COLLABORATION_EVENT = 'collaboration_event',
  SEARCH_PERFORMED = 'search_performed',
  TEMPLATE_USED = 'template_used',
}

export enum TimeFrame {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export enum AnalyticsScope {
  USER = 'user',
  BOARD = 'board',
  ORGANIZATION = 'organization',
  GLOBAL = 'global',
}

registerEnumType(MetricType, {
  name: 'MetricType',
});

registerEnumType(TimeFrame, {
  name: 'TimeFrame',
});

registerEnumType(AnalyticsScope, {
  name: 'AnalyticsScope',
});

@Schema()
@ObjectType()
export class AnalyticsEvent {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, enum: MetricType })
  @Field(() => MetricType)
  eventType: MetricType;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  userId: string;

  @Prop({ type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID, { nullable: true })
  boardId?: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID, { nullable: true })
  entityId?: string;

  @Prop()
  @Field({ nullable: true })
  entityType?: string;

  @Prop({ type: Object })
  @Field({ nullable: true })
  metadata?: any;

  @Prop({ required: true, default: Date.now })
  @Field()
  timestamp: Date;

  @Prop()
  @Field({ nullable: true })
  sessionId?: string;

  @Prop()
  @Field({ nullable: true })
  ipAddress?: string;

  @Prop()
  @Field({ nullable: true })
  userAgent?: string;
}

@Schema()
@ObjectType()
export class ProductivityMetric {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  userId: string;

  @Prop({ type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID, { nullable: true })
  boardId?: string;

  @Prop({ required: true })
  @Field()
  date: Date;

  @Prop({ default: 0 })
  @Field(() => Int)
  cardsCreated: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  cardsCompleted: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  cardsMoved: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  listsCreated: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  boardsAccessed: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  collaborationEvents: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  searchesPerformed: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  templatesUsed: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  activeTimeMinutes: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  avgCompletionTime: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  totalSessions: number;

  @Prop({ default: Date.now })
  @Field()
  updatedAt: Date;
}

@Schema()
@ObjectType()
export class BoardAnalytics {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ required: true })
  @Field()
  date: Date;

  @Prop({ default: 0 })
  @Field(() => Int)
  totalCards: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  totalLists: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  activeUsers: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  totalViews: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  totalEdits: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  avgCardsPerList: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  completionRate: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  avgTimeToComplete: number;

  @Prop({ type: Object })
  @Field({ nullable: true })
  labelDistribution?: any;

  @Prop({ type: Object })
  @Field({ nullable: true })
  priorityDistribution?: any;

  @Prop({ type: Object })
  @Field({ nullable: true })
  activityHeatmap?: any;

  @Prop({ default: Date.now })
  @Field()
  updatedAt: Date;
}

@Schema()
@ObjectType()
export class PerformanceInsight {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  userId: string;

  @Prop({ type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID, { nullable: true })
  boardId?: string;

  @Prop({ required: true })
  @Field()
  insightType: string;

  @Prop({ required: true })
  @Field()
  title: string;

  @Prop({ required: true })
  @Field()
  description: string;

  @Prop({ type: Object })
  @Field({ nullable: true })
  data?: any;

  @Prop({ default: 0 })
  @Field(() => Float)
  score: number;

  @Prop({ default: 'info' })
  @Field()
  severity: string; // info, warning, critical

  @Prop({ default: false })
  @Field()
  isRead: boolean;

  @Prop({ default: true })
  @Field()
  isActive: boolean;

  @Prop({ default: Date.now })
  @Field()
  generatedAt: Date;

  @Prop()
  @Field({ nullable: true })
  expiresAt?: Date;
}

export type AnalyticsEventDocument = AnalyticsEvent & Document;
export type ProductivityMetricDocument = ProductivityMetric & Document;
export type BoardAnalyticsDocument = BoardAnalytics & Document;
export type PerformanceInsightDocument = PerformanceInsight & Document;

export const AnalyticsEventSchema = SchemaFactory.createForClass(AnalyticsEvent);
export const ProductivityMetricSchema = SchemaFactory.createForClass(ProductivityMetric);
export const BoardAnalyticsSchema = SchemaFactory.createForClass(BoardAnalytics);
export const PerformanceInsightSchema = SchemaFactory.createForClass(PerformanceInsight);

// Indexes for performance
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ boardId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: -1 });

ProductivityMetricSchema.index({ userId: 1, date: -1 }, { unique: true });
ProductivityMetricSchema.index({ boardId: 1, date: -1 });
ProductivityMetricSchema.index({ date: -1 });

BoardAnalyticsSchema.index({ boardId: 1, date: -1 }, { unique: true });
BoardAnalyticsSchema.index({ date: -1 });

PerformanceInsightSchema.index({ userId: 1, isActive: 1, generatedAt: -1 });
PerformanceInsightSchema.index({ boardId: 1, isActive: 1 });
PerformanceInsightSchema.index({ severity: 1, isActive: 1 });
PerformanceInsightSchema.index({ expiresAt: 1 });

// TTL index for events (remove after 1 year)
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// TTL index for insights (remove expired insights)
PerformanceInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
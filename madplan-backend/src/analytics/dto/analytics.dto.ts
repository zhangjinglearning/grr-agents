import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsEnum, IsDateString, IsArray, IsString, IsBoolean } from 'class-validator';
import { MetricType, TimeFrame, AnalyticsScope } from '../analytics.entity';

@InputType()
export class AnalyticsQueryInput {
  @Field(() => AnalyticsScope)
  @IsEnum(AnalyticsScope)
  scope: AnalyticsScope;

  @Field(() => TimeFrame)
  @IsEnum(TimeFrame)
  timeFrame: TimeFrame;

  @Field()
  @IsDateString()
  startDate: Date;

  @Field()
  @IsDateString()
  endDate: Date;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  boardId?: string;

  @Field(() => [MetricType], { nullable: true })
  @IsOptional()
  @IsArray()
  eventTypes?: MetricType[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

@InputType()
export class ProductivityReportInput {
  @Field()
  @IsDateString()
  startDate: Date;

  @Field()
  @IsDateString()
  endDate: Date;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  boardId?: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  includeComparison: boolean;
}

@InputType()
export class BoardAnalyticsInput {
  @Field(() => ID)
  @IsNotEmpty()
  boardId: string;

  @Field()
  @IsDateString()
  startDate: Date;

  @Field()
  @IsDateString()
  endDate: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

@InputType()
export class InsightGenerationInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  boardId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  insightTypes?: string[];

  @Field({ defaultValue: 30 })
  @IsOptional()
  daysPeriod?: number;
}

@InputType()
export class EventTrackingInput {
  @Field(() => MetricType)
  @IsEnum(MetricType)
  eventType: MetricType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  boardId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  entityId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  entityType?: string;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: any;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

@InputType()
export class DashboardQueryInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  boardId?: string;

  @Field({ defaultValue: 30 })
  @IsOptional()
  daysPeriod?: number;

  @Field({ defaultValue: false })
  @IsBoolean()
  includeInsights: boolean;

  @Field({ defaultValue: false })
  @IsBoolean()
  includeComparisons: boolean;
}
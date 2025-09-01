import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AnalyticsEvent,
  AnalyticsEventSchema,
  ProductivityMetric,
  ProductivityMetricSchema,
  BoardAnalytics,
  BoardAnalyticsSchema,
  PerformanceInsight,
  PerformanceInsightSchema,
} from './analytics.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsResolver } from './analytics.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
      { name: ProductivityMetric.name, schema: ProductivityMetricSchema },
      { name: BoardAnalytics.name, schema: BoardAnalyticsSchema },
      { name: PerformanceInsight.name, schema: PerformanceInsightSchema },
    ]),
  ],
  providers: [AnalyticsService, AnalyticsResolver],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
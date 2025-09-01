import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AnalyticsService } from './services/analytics.service';
import { MetricsService } from './services/metrics.service';
import { DashboardService } from './services/dashboard.service';
import { ReportingService } from './services/reporting.service';

import { AnalyticsController } from './controllers/analytics.controller';
import { MetricsController } from './controllers/metrics.controller';
import { DashboardController } from './controllers/dashboard.controller';

import { AnalyticsEvent, AnalyticsEventSchema } from './schemas/analytics-event.schema';
import { MetricSnapshot, MetricSnapshotSchema } from './schemas/metric-snapshot.schema';
import { UserSession, UserSessionSchema } from './schemas/user-session.schema';
import { BusinessKPI, BusinessKPISchema } from './schemas/business-kpi.schema';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
      { name: MetricSnapshot.name, schema: MetricSnapshotSchema },
      { name: UserSession.name, schema: UserSessionSchema },
      { name: BusinessKPI.name, schema: BusinessKPISchema },
    ]),
  ],
  controllers: [
    AnalyticsController,
    MetricsController,
    DashboardController,
  ],
  providers: [
    AnalyticsService,
    MetricsService,
    DashboardService,
    ReportingService,
  ],
  exports: [
    AnalyticsService,
    MetricsService,
    DashboardService,
  ],
})
export class AnalyticsModule {}
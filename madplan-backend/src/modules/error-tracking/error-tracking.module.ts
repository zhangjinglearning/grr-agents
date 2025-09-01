import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { ErrorTrackingService } from './services/error-tracking.service';
import { CrashReportingService } from './services/crash-reporting.service';
import { ErrorAnalysisService } from './services/error-analysis.service';

import { ErrorTrackingController } from './controllers/error-tracking.controller';

import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';
import { CrashReport, CrashReportSchema } from './schemas/crash-report.schema';
import { ErrorPattern, ErrorPatternSchema } from './schemas/error-pattern.schema';

import { SentryInterceptor } from './interceptors/sentry.interceptor';
import { GlobalErrorFilter } from './filters/global-error.filter';

@Global()
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: ErrorLog.name, schema: ErrorLogSchema },
      { name: CrashReport.name, schema: CrashReportSchema },
      { name: ErrorPattern.name, schema: ErrorPatternSchema },
    ]),
  ],
  controllers: [ErrorTrackingController],
  providers: [
    ErrorTrackingService,
    CrashReportingService,
    ErrorAnalysisService,
    SentryInterceptor,
    GlobalErrorFilter,
  ],
  exports: [
    ErrorTrackingService,
    CrashReportingService,
    ErrorAnalysisService,
    SentryInterceptor,
    GlobalErrorFilter,
  ],
})
export class ErrorTrackingModule {}
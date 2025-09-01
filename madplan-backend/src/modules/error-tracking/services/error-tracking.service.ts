import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';
import { httpIntegration, expressIntegration, mongoIntegration } from '@sentry/node';
import * as crypto from 'crypto';
// import * as dd from 'dd-trace';

// Mock dd-trace functionality for compilation
const dd = {
  increment: (...args: any[]) => {},
  histogram: (...args: any[]) => {},
  gauge: (...args: any[]) => {}
};

import { ErrorLog, ErrorLogDocument, ErrorSeverity, ErrorCategory, ErrorStatus, ErrorContext } from '../schemas/error-log.schema';
import { TracingService } from '../../../services/tracing.service';

export interface ErrorTrackingOptions {
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: ErrorContext;
  metadata?: any;
  fingerprint?: string;
  tags?: string[];
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  topErrors: Array<{
    message: string;
    occurrences: number;
    lastSeen: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
  }>;
  errorRate: number;
  resolvedErrors: number;
  unresolvedErrors: number;
}

@Injectable()
export class ErrorTrackingService implements OnModuleInit {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private sentryInitialized = false;

  constructor(
    @InjectModel(ErrorLog.name)
    private errorLogModel: Model<ErrorLogDocument>,
    private configService: ConfigService,
    private tracingService: TracingService
  ) {}

  onModuleInit() {
    this.initializeSentry();
  }

  // Initialize Sentry for external error tracking
  private initializeSentry(): void {
    const sentryDsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const release = this.configService.get<string>('npm_package_version', '1.0.0');

    if (sentryDsn) {
      Sentry.init({
        dsn: sentryDsn,
        environment,
        release: `madplan-backend@${release}`,
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        integrations: [
          httpIntegration(),
          expressIntegration(),
          mongoIntegration(),
        ],
        beforeSend: (event) => {
          // Filter out sensitive information
          if (event.request?.data) {
            this.sanitizeRequestData(event.request.data);
          }
          return event;
        },
      });

      this.sentryInitialized = true;
      this.logger.log('Sentry error tracking initialized');
    } else {
      this.logger.warn('Sentry DSN not configured, external error tracking disabled');
    }
  }

  // Track error with comprehensive context
  async trackError(
    error: Error | string,
    options: ErrorTrackingOptions
  ): Promise<ErrorLogDocument> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const stackTrace = typeof error === 'string' ? undefined : error.stack;
      
      // Generate fingerprint for error grouping
      const fingerprint = options.fingerprint || this.generateFingerprint(errorMessage, stackTrace);
      
      // Check if this error already exists
      const existingError = await this.findExistingError(fingerprint);
      
      if (existingError) {
        return this.updateExistingError(existingError);
      }

      // Create new error log
      const errorLog = new this.errorLogModel({
        message: errorMessage,
        severity: options.severity,
        category: options.category,
        status: ErrorStatus.OPEN,
        errorType: typeof error !== 'string' ? error.constructor.name : 'StringError',
        stackTrace,
        stackFrames: this.parseStackTrace(stackTrace),
        context: {
          ...options.context,
          timestamp: new Date(),
          environment: this.configService.get<string>('NODE_ENV', 'development'),
          version: this.configService.get<string>('npm_package_version', '1.0.0'),
        },
        metadata: options.metadata || {},
        fingerprint,
        tags: options.tags || [],
        occurrences: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        priority: this.calculatePriority(options.severity, options.category)
      });

      const savedError = await errorLog.save();

      // Send to external services
      await this.sendToExternalServices(savedError, error);

      // Send metrics
      this.sendErrorMetrics(savedError);

      // Check for alerts
      await this.checkErrorAlerts(savedError);

      this.logger.error(`Error tracked: ${errorMessage}`, {
        errorId: savedError._id,
        fingerprint,
        severity: options.severity,
        category: options.category
      });

      return savedError;

    } catch (trackingError) {
      this.logger.error('Failed to track error:', trackingError);
      
      // Fallback: at least log to console and Sentry
      this.logger.error(typeof error === 'string' ? error : error.message, error);
      
      if (this.sentryInitialized && typeof error !== 'string') {
        Sentry.captureException(error);
      }

      throw trackingError;
    }
  }

  // Track application crash
  async trackCrash(error: Error, context?: ErrorContext): Promise<ErrorLogDocument> {
    return this.trackError(error, {
      severity: ErrorSeverity.FATAL,
      category: ErrorCategory.SYSTEM,
      context,
      tags: ['crash', 'critical']
    });
  }

  /**
   * Log error method for compatibility
   */
  async logError(errorData: any): Promise<string> {
    // Create error log entry using trackError
    const errorLog = await this.trackError(
      errorData.message || 'Unknown error',
      {
        severity: errorData.severity || ErrorSeverity.ERROR,
        category: errorData.category || ErrorCategory.APPLICATION,
        context: errorData.context || {},
        metadata: errorData.metadata || {},
        tags: errorData.tags || []
      }
    );

    return errorLog._id.toString();
  }

  // Get error statistics
  async getErrorStats(
    timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<ErrorStats> {
    const dateFrom = this.getTimeframeStart(timeframe);
    
    return this.tracingService.traceOperation(
      {
        operation: 'get_error_stats',
        tags: { timeframe }
      },
      async () => {
        const [
          totalErrors,
          errorsByCategory,
          errorsBySeverity,
          topErrors,
          resolvedCount,
          unresolvedCount,
          totalRequests
        ] = await Promise.all([
          this.errorLogModel.countDocuments({
            createdAt: { $gte: dateFrom }
          }),
          this.getErrorsByCategory(dateFrom),
          this.getErrorsBySeverity(dateFrom),
          this.getTopErrors(dateFrom, 10),
          this.errorLogModel.countDocuments({
            createdAt: { $gte: dateFrom },
            resolved: true
          }),
          this.errorLogModel.countDocuments({
            createdAt: { $gte: dateFrom },
            resolved: false
          }),
          this.getTotalRequests(dateFrom)
        ]);

        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

        return {
          totalErrors,
          errorsByCategory,
          errorsBySeverity,
          topErrors,
          errorRate,
          resolvedErrors: resolvedCount,
          unresolvedErrors: unresolvedCount
        };
      }
    );
  }

  // Resolve error
  async resolveError(
    errorId: string,
    resolution: string,
    resolvedBy: string
  ): Promise<ErrorLogDocument> {
    const errorLog = await this.errorLogModel.findById(errorId);
    
    if (!errorLog) {
      throw new Error('Error not found');
    }

    errorLog.status = ErrorStatus.RESOLVED;
    errorLog.resolved = true;
    errorLog.resolvedAt = new Date();
    errorLog.resolvedBy = resolvedBy;
    errorLog.resolution = resolution;

    const savedError = await errorLog.save();

    // Send metrics
    dd.increment('errors.resolved', 1, [
      `category:${errorLog.category}`,
      `severity:${errorLog.severity}`
    ]);

    this.logger.log(`Error resolved: ${errorId}`, {
      errorId,
      resolvedBy,
      resolution: resolution.substring(0, 100)
    });

    return savedError;
  }

  // Ignore error
  async ignoreError(errorId: string, reason: string): Promise<ErrorLogDocument> {
    const errorLog = await this.errorLogModel.findById(errorId);
    
    if (!errorLog) {
      throw new Error('Error not found');
    }

    errorLog.status = ErrorStatus.IGNORED;
    errorLog.ignored = true;
    errorLog.comments.push({
      userId: 'system',
      message: `Ignored: ${reason}`,
      timestamp: new Date()
    });

    return errorLog.save();
  }

  // Get error details with related errors
  async getErrorDetails(errorId: string): Promise<ErrorLogDocument & { relatedErrors: ErrorLogDocument[] }> {
    const errorLog = await this.errorLogModel.findById(errorId);
    
    if (!errorLog) {
      throw new Error('Error not found');
    }

    // Find related errors
    const relatedErrors = await this.errorLogModel.find({
      $or: [
        { fingerprint: errorLog.fingerprint, _id: { $ne: errorId } },
        { 'relatedErrors.errorId': errorId }
      ]
    }).limit(10).sort({ lastSeen: -1 });

    return {
      ...errorLog.toObject(),
      relatedErrors
    } as any;
  }

  // Search errors with filters
  async searchErrors(filters: {
    severity?: ErrorSeverity[];
    category?: ErrorCategory[];
    status?: ErrorStatus[];
    dateFrom?: Date;
    dateTo?: Date;
    userId?: string;
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    errors: ErrorLogDocument[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const query: any = {};

    // Build query
    if (filters.severity?.length) query.severity = { $in: filters.severity };
    if (filters.category?.length) query.category = { $in: filters.category };
    if (filters.status?.length) query.status = { $in: filters.status };
    if (filters.userId) query['context.userId'] = filters.userId;
    if (filters.tags?.length) query.tags = { $in: filters.tags };

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
    }

    if (filters.search) {
      query.$or = [
        { message: { $regex: filters.search, $options: 'i' } },
        { errorType: { $regex: filters.search, $options: 'i' } },
        { 'context.endpoint': { $regex: filters.search, $options: 'i' } }
      ];
    }

    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const [errors, total] = await Promise.all([
      this.errorLogModel.find(query)
        .sort({ lastSeen: -1 })
        .limit(limit)
        .skip(offset),
      this.errorLogModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      errors,
      total,
      pagination: {
        page,
        limit,
        totalPages
      }
    };
  }

  // Scheduled tasks
  @Cron(CronExpression.EVERY_5_MINUTES)
  async analyzeErrorPatterns(): Promise<void> {
    try {
      const recentErrors = await this.errorLogModel.find({
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
        resolved: false
      });

      // Group by fingerprint to detect spikes
      const errorGroups = new Map<string, ErrorLogDocument[]>();
      
      recentErrors.forEach(error => {
        const fingerprint = error.fingerprint;
        if (!errorGroups.has(fingerprint)) {
          errorGroups.set(fingerprint, []);
        }
        errorGroups.get(fingerprint)!.push(error);
      });

      // Check for error spikes
      for (const [fingerprint, errors] of errorGroups) {
        if (errors.length >= 10) { // 10 or more occurrences in 5 minutes
          await this.handleErrorSpike(fingerprint, errors);
        }
      }

    } catch (error) {
      this.logger.error('Error pattern analysis failed:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldErrors(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep errors for 90 days

      const result = await this.errorLogModel.deleteMany({
        createdAt: { $lt: cutoffDate },
        resolved: true,
        severity: { $nin: [ErrorSeverity.FATAL, ErrorSeverity.ERROR] }
      });

      if (result.deletedCount > 0) {
        this.logger.log(`Cleaned up ${result.deletedCount} old resolved errors`);
      }

    } catch (error) {
      this.logger.error('Error cleanup failed:', error);
    }
  }

  // Private helper methods
  private generateFingerprint(message: string, stackTrace?: string): string {
    // Create a unique fingerprint for grouping similar errors
    const content = message + (stackTrace ? this.extractRelevantStackFrames(stackTrace) : '');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private extractRelevantStackFrames(stackTrace: string): string {
    // Extract only application-specific stack frames
    const lines = stackTrace.split('\n').slice(0, 5); // Top 5 frames
    return lines
      .filter(line => line.includes('/src/') || line.includes('madplan'))
      .join('\n');
  }

  private parseStackTrace(stackTrace?: string): any[] {
    if (!stackTrace) return [];

    const frames: any[] = [];
    const lines = stackTrace.split('\n');

    for (const line of lines) {
      const match = line.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/);
      if (match) {
        const [, func, filename, lineno, colno] = match;
        frames.push({
          function: func,
          filename,
          lineno: parseInt(lineno),
          colno: parseInt(colno),
          inApp: filename.includes('/src/') || filename.includes('madplan')
        });
      }
    }

    return frames;
  }

  private calculatePriority(severity: ErrorSeverity, category: ErrorCategory): number {
    let priority = 1;

    // Severity weight
    switch (severity) {
      case ErrorSeverity.FATAL: priority += 4; break;
      case ErrorSeverity.ERROR: priority += 3; break;
      case ErrorSeverity.WARNING: priority += 2; break;
      case ErrorSeverity.INFO: priority += 1; break;
    }

    // Category weight
    if ([ErrorCategory.SECURITY, ErrorCategory.AUTHENTICATION, ErrorCategory.DATABASE].includes(category)) {
      priority += 1;
    }

    return Math.min(priority, 5);
  }

  private async findExistingError(fingerprint: string): Promise<ErrorLogDocument | null> {
    return this.errorLogModel.findOne({
      fingerprint,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
    });
  }

  private async updateExistingError(errorLog: ErrorLogDocument): Promise<ErrorLogDocument> {
    errorLog.occurrences += 1;
    errorLog.lastSeen = new Date();
    
    if (errorLog.status === ErrorStatus.RESOLVED) {
      errorLog.status = ErrorStatus.RECURRING;
    }

    return errorLog.save();
  }

  private async sendToExternalServices(errorLog: ErrorLogDocument, originalError: Error | string): Promise<void> {
    // Send to Sentry
    if (this.sentryInitialized && typeof originalError !== 'string') {
      Sentry.withScope(scope => {
        scope.setTag('errorId', errorLog._id.toString());
        scope.setTag('category', errorLog.category);
        scope.setLevel(this.mapSeverityToSentryLevel(errorLog.severity));
        scope.setContext('errorContext', errorLog.context);
        
        if (errorLog.context.userId) {
          scope.setUser({ id: errorLog.context.userId });
        }

        Sentry.captureException(originalError);
      });
    }
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): any {
    switch (severity) {
      case ErrorSeverity.FATAL: return 'fatal';
      case ErrorSeverity.ERROR: return 'error';
      case ErrorSeverity.WARNING: return 'warning';
      case ErrorSeverity.INFO: return 'info';
      case ErrorSeverity.DEBUG: return 'debug';
      default: return 'error';
    }
  }

  private sendErrorMetrics(errorLog: ErrorLogDocument): void {
    dd.increment('errors.total', 1, [
      `severity:${errorLog.severity}`,
      `category:${errorLog.category}`,
      `environment:${errorLog.context.environment}`
    ]);

    if (errorLog.severity === ErrorSeverity.FATAL) {
      dd.increment('errors.fatal', 1, [
        `category:${errorLog.category}`
      ]);
    }
  }

  private async checkErrorAlerts(errorLog: ErrorLogDocument): Promise<void> {
    // Check if this error should trigger an alert
    if (errorLog.severity === ErrorSeverity.FATAL || 
        (errorLog.severity === ErrorSeverity.ERROR && errorLog.category === ErrorCategory.SECURITY)) {
      
      // Send immediate alert
      await this.sendErrorAlert(errorLog);
    }
  }

  private async sendErrorAlert(errorLog: ErrorLogDocument): Promise<void> {
    // Integration with alerting systems (Slack, email, PagerDuty)
    this.logger.error(`CRITICAL ERROR ALERT: ${errorLog.message}`, {
      errorId: errorLog._id,
      severity: errorLog.severity,
      category: errorLog.category,
      occurrences: errorLog.occurrences
    });
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

  private async getErrorsByCategory(dateFrom: Date): Promise<Record<ErrorCategory, number>> {
    const results = await this.errorLogModel.aggregate([
      { $match: { createdAt: { $gte: dateFrom } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });

    results.forEach(result => {
      errorsByCategory[result._id] = result.count;
    });

    return errorsByCategory;
  }

  private async getErrorsBySeverity(dateFrom: Date): Promise<Record<ErrorSeverity, number>> {
    const results = await this.errorLogModel.aggregate([
      { $match: { createdAt: { $gte: dateFrom } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    results.forEach(result => {
      errorsBySeverity[result._id] = result.count;
    });

    return errorsBySeverity;
  }

  private async getTopErrors(dateFrom: Date, limit: number): Promise<any[]> {
    return this.errorLogModel.aggregate([
      { $match: { createdAt: { $gte: dateFrom } } },
      { 
        $group: { 
          _id: '$fingerprint',
          message: { $first: '$message' },
          category: { $first: '$category' },
          severity: { $first: '$severity' },
          occurrences: { $sum: '$occurrences' },
          lastSeen: { $max: '$lastSeen' }
        }
      },
      { $sort: { occurrences: -1 as -1 } },
      { $limit: limit }
    ]);
  }

  private async getTotalRequests(dateFrom: Date): Promise<number> {
    // This would come from request tracking
    // For now, return a mock value
    return 10000;
  }

  private async handleErrorSpike(fingerprint: string, errors: ErrorLogDocument[]): Promise<void> {
    this.logger.warn(`Error spike detected: ${errors[0].message}`, {
      fingerprint,
      count: errors.length,
      timeframe: '5 minutes'
    });

    // Mark as recurring if not already
    await this.errorLogModel.updateMany(
      { fingerprint },
      { 
        $set: { 
          status: ErrorStatus.RECURRING,
          priority: 5 
        }
      }
    );

    // Send alert
    dd.increment('errors.spike', 1, [
      `fingerprint:${fingerprint}`,
      `severity:${errors[0].severity}`,
      `category:${errors[0].category}`
    ]);
  }

  private sanitizeRequestData(data: any): void {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    const sanitize = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[Filtered]';
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      });
    };

    sanitize(data);
  }
}
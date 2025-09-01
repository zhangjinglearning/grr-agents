import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';
import { Request } from 'express';

import { ErrorTrackingService } from '../services/error-tracking.service';
import { ErrorSeverity, ErrorCategory } from '../schemas/error-log.schema';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SentryInterceptor.name);

  constructor(private readonly errorTrackingService: ErrorTrackingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Create Sentry transaction
    const transaction = Sentry.startTransaction({
      name: `${request.method} ${request.route?.path || request.url}`,
      op: 'http.server',
      tags: {
        method: request.method,
        url: request.url,
        route: request.route?.path,
      },
    });

    // Set user context if available
    const userId = (request as any).user?.id;
    if (userId) {
      Sentry.setUser({ id: userId });
      transaction.setTag('user.id', userId);
    }

    // Set request context
    Sentry.setContext('request', {
      method: request.method,
      url: request.url,
      headers: this.sanitizeHeaders(request.headers),
      query: request.query,
      params: request.params,
      ip: request.ip,
      userAgent: request.get('User-Agent'),
    });

    // Add request ID for tracing
    const requestId = (request as any).tracingContext?.correlationId;
    if (requestId) {
      transaction.setTag('request.id', requestId);
      Sentry.setTag('request.id', requestId);
    }

    // Start span for request processing
    const span = transaction.startChild({
      op: 'request.processing',
      description: `Processing ${request.method} ${request.url}`,
    });

    return next.handle().pipe(
      tap(() => {
        // Success path
        const duration = Date.now() - startTime;
        
        span.setTag('success', true);
        span.setData('response.time', duration);
        
        transaction.setTag('success', true);
        transaction.setData('response.time', duration);

        // Track performance metrics
        if (duration > 1000) {
          this.logger.warn(`Slow request: ${request.method} ${request.url} took ${duration}ms`);
          
          // Track slow request as a performance issue
          Sentry.addBreadcrumb({
            message: 'Slow request detected',
            category: 'performance',
            level: 'warning',
            data: {
              duration,
              method: request.method,
              url: request.url,
            },
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Set error context
        span.setTag('error', true);
        span.setData('error.message', error.message);
        span.setData('response.time', duration);
        
        transaction.setTag('error', true);
        transaction.setData('error.message', error.message);
        transaction.setData('response.time', duration);

        // Enhanced error context for Sentry
        Sentry.withScope(scope => {
          // Set error level based on error type
          const errorLevel = this.determineErrorLevel(error);
          scope.setLevel(errorLevel);

          // Add error tags
          scope.setTag('error.type', error.constructor.name);
          scope.setTag('error.name', error.name);
          scope.setTag('request.method', request.method);
          scope.setTag('request.url', request.url);
          scope.setTag('response.time', duration);

          // Add breadcrumbs for request flow
          scope.addBreadcrumb({
            message: 'Request started',
            category: 'request',
            level: 'info',
            data: {
              method: request.method,
              url: request.url,
              timestamp: new Date(startTime).toISOString(),
            },
          });

          scope.addBreadcrumb({
            message: 'Error occurred',
            category: 'error',
            level: 'error',
            data: {
              error: error.message,
              duration,
              timestamp: new Date().toISOString(),
            },
          });

          // Add request fingerprint for grouping
          scope.setFingerprint([
            request.method,
            request.route?.path || request.url,
            error.constructor.name,
          ]);

          // Set additional context
          scope.setContext('error', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
            status: (error as any).status,
          });

          scope.setContext('performance', {
            responseTime: duration,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date().toISOString(),
          });

          // Capture the exception
          const eventId = Sentry.captureException(error);
          
          this.logger.debug(`Error captured by Sentry with ID: ${eventId}`);

          // Add Sentry event ID to error for correlation
          if (error instanceof Error) {
            (error as any).sentryEventId = eventId;
          }
        });

        return throwError(error);
      }),
      tap({
        finalize: () => {
          // Finish spans and transaction
          span.finish();
          transaction.finish();
        },
      })
    );
  }

  private determineErrorLevel(error: any): Sentry.SeverityLevel {
    // Map error types to Sentry severity levels
    if (error.status) {
      if (error.status >= 500) return 'error';
      if (error.status >= 400) return 'warning';
      return 'info';
    }

    // Check error type
    if (error.name === 'ValidationError') return 'warning';
    if (error.name === 'UnauthorizedError') return 'warning';
    if (error.name === 'ForbiddenError') return 'warning';
    if (error.name === 'NotFoundError') return 'info';
    if (error.name === 'MongoError') return 'error';
    if (error.name === 'TimeoutError') return 'error';

    // Check error message for severity indicators
    const message = error.message?.toLowerCase() || '';
    if (message.includes('fatal') || message.includes('crash')) return 'fatal';
    if (message.includes('critical') || message.includes('severe')) return 'error';
    if (message.includes('warning') || message.includes('deprecated')) return 'warning';

    // Default to error for unhandled exceptions
    return 'error';
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-access-token',
      'x-refresh-token',
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[Redacted]';
      }
    });

    return sanitized;
  }
}

// Additional utility interceptor for performance monitoring
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        // Log performance metrics
        const performanceData = {
          method: request.method,
          url: request.url,
          duration,
          memoryDelta,
          timestamp: new Date().toISOString(),
        };

        // Log slow requests
        if (duration > 2000) {
          this.logger.warn(`Slow request detected: ${request.method} ${request.url}`, performanceData);
          
          // Send to Sentry as performance issue
          Sentry.addBreadcrumb({
            message: 'Slow request detected',
            category: 'performance',
            level: 'warning',
            data: performanceData,
          });
        }

        // Log high memory usage
        if (Math.abs(memoryDelta) > 50 * 1024 * 1024) { // 50MB
          this.logger.warn(`High memory usage: ${request.method} ${request.url}`, performanceData);
          
          Sentry.addBreadcrumb({
            message: 'High memory usage detected',
            category: 'performance',
            level: 'warning',
            data: performanceData,
          });
        }

        // Track custom performance metrics
        Sentry.setContext('performance', performanceData);
      })
    );
  }
}
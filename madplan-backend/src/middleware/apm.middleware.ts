import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
// import * as dd from 'dd-trace';

// Mock dd-trace functionality for compilation
const dd = {
  init: (...args: any[]) => {},
  increment: (...args: any[]) => {},
  histogram: (...args: any[]) => {},
  gauge: (...args: any[]) => {},
  scope: () => ({
    active: () => null
  })
};

// Initialize Datadog tracer
dd.init({
  service: 'madplan-backend',
  env: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  profiling: process.env.NODE_ENV === 'production',
  tags: {
    'service.name': 'madplan-backend',
    'service.version': process.env.npm_package_version || '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development'
  }
});

export interface TracingContext {
  traceId: string;
  spanId: string;
  userId?: string;
  sessionId?: string;
  correlationId: string;
}

@Injectable()
export class APMMiddleware implements NestMiddleware {
  private readonly logger = new Logger(APMMiddleware.name);

  constructor(private configService: ConfigService) {}

  use(req: Request & { tracingContext?: TracingContext }, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const span = dd.scope().active();
    
    // Generate correlation ID for request tracking
    const correlationId = this.generateCorrelationId();
    
    // Create tracing context
    const tracingContext: TracingContext = {
      traceId: span?.context().toTraceId() || 'unknown',
      spanId: span?.context().toSpanId() || 'unknown',
      correlationId,
      userId: req.headers['x-user-id'] as string,
      sessionId: req.headers['x-session-id'] as string
    };

    // Attach tracing context to request
    req.tracingContext = tracingContext;

    // Add custom headers for downstream services
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Trace-ID', tracingContext.traceId);

    // Set span tags for better observability
    if (span) {
      span.setTag('http.method', req.method);
      span.setTag('http.url', req.url);
      span.setTag('http.route', req.route?.path || req.path);
      span.setTag('user.id', tracingContext.userId);
      span.setTag('session.id', tracingContext.sessionId);
      span.setTag('correlation.id', correlationId);
      span.setTag('request.ip', req.ip);
      span.setTag('request.user_agent', req.get('User-Agent'));
    }

    // Custom metrics collection
    this.collectCustomMetrics(req, tracingContext);

    // Response interceptor for completion metrics
    const originalSend = res.send;
    res.send = function(body) {
      const duration = Date.now() - startTime;
      
      // Set response span tags
      if (span) {
        span.setTag('http.status_code', res.statusCode);
        span.setTag('http.response_time', duration);
        span.setTag('http.response_size', body ? Buffer.byteLength(body) : 0);
      }

      // Log structured request/response data
      const logData = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        correlationId,
        traceId: tracingContext.traceId,
        userId: tracingContext.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Log based on status code
      if (res.statusCode >= 500) {
        span?.setTag('error', true);
        span?.log({ error: true, message: 'Server error occurred' });
        // Don't log the original logger here to avoid conflicts
      } else if (res.statusCode >= 400) {
        span?.setTag('http.client_error', true);
      }

      // Custom business metrics
      dd.increment('http.requests.total', 1, [
        `method:${req.method.toLowerCase()}`,
        `status:${res.statusCode}`,
        `route:${req.route?.path || 'unknown'}`
      ]);

      dd.histogram('http.request.duration', duration, [
        `method:${req.method.toLowerCase()}`,
        `status:${res.statusCode}`,
        `route:${req.route?.path || 'unknown'}`
      ]);

      return originalSend.call(this, body);
    };

    next();
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private collectCustomMetrics(req: Request, context: TracingContext): void {
    // Track unique users
    if (context.userId) {
      dd.increment('users.active', 1, [`user_id:${context.userId}`]);
    }

    // Track API endpoints
    const endpoint = req.route?.path || req.path;
    dd.increment('endpoints.called', 1, [
      `endpoint:${endpoint}`,
      `method:${req.method.toLowerCase()}`
    ]);

    // Track request size
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    if (contentLength > 0) {
      dd.histogram('http.request.size', contentLength, [
        `method:${req.method.toLowerCase()}`,
        `endpoint:${endpoint}`
      ]);
    }

    // Track geographic information if available
    const country = req.get('CloudFront-Viewer-Country');
    if (country) {
      dd.increment('requests.by_country', 1, [`country:${country}`]);
    }
  }
}

// Error tracking middleware
@Injectable()
export class ErrorTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorTrackingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Track errors and exceptions
      if (res.statusCode >= 400) {
        const span = dd.scope().active();
        const errorData = {
          statusCode: res.statusCode,
          method: req.method,
          url: req.url,
          error: body,
          traceId: span?.context().toTraceId(),
          correlationId: (req as any).tracingContext?.correlationId
        };

        // Custom error metrics
        dd.increment('errors.total', 1, [
          `status:${res.statusCode}`,
          `method:${req.method.toLowerCase()}`,
          `error_type:${res.statusCode >= 500 ? 'server_error' : 'client_error'}`
        ]);

        // Log structured error data
        if (res.statusCode >= 500) {
          span?.setTag('error', true);
          span?.log({ 
            level: 'error',
            message: `Server error: ${res.statusCode}`,
            error: body 
          });
        }
      }

      return originalSend.call(this, body);
    };

    next();
  }
}

// Performance monitoring middleware
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Performance metrics
      dd.histogram('performance.response_time', duration, [
        `method:${req.method.toLowerCase()}`,
        `route:${req.route?.path || 'unknown'}`
      ]);

      dd.gauge('performance.memory_usage', endMemory.heapUsed, [
        `route:${req.route?.path || 'unknown'}`
      ]);

      if (memoryDelta !== 0) {
        dd.histogram('performance.memory_delta', Math.abs(memoryDelta), [
          `direction:${memoryDelta > 0 ? 'increase' : 'decrease'}`,
          `route:${req.route?.path || 'unknown'}`
        ]);
      }

      // Alert on slow requests
      if (duration > 1000) {
        dd.increment('performance.slow_requests', 1, [
          `method:${req.method.toLowerCase()}`,
          `route:${req.route?.path || 'unknown'}`,
          `duration_bucket:${duration > 5000 ? 'very_slow' : 'slow'}`
        ]);
      }
    });

    next();
  }
}

// Business metrics middleware
@Injectable()
export class BusinessMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Track business-specific events
    res.on('finish', () => {
      const route = req.route?.path;
      const method = req.method.toLowerCase();
      
      // Track API usage patterns
      if (route) {
        // Authentication events
        if (route.includes('/auth/')) {
          const event = route.includes('/login') ? 'login_attempt' : 
                       route.includes('/register') ? 'registration_attempt' : 
                       route.includes('/refresh') ? 'token_refresh' : 'auth_other';
          
          dd.increment(`business.auth.${event}`, 1, [
            `success:${res.statusCode < 400}`,
            `status:${res.statusCode}`
          ]);
        }

        // Board operations
        if (route.includes('/boards')) {
          const operation = method === 'post' ? 'create' :
                           method === 'put' || method === 'patch' ? 'update' :
                           method === 'delete' ? 'delete' : 'read';
          
          dd.increment(`business.boards.${operation}`, 1, [
            `success:${res.statusCode < 400}`
          ]);
        }

        // User activity tracking
        if ((req as any).tracingContext?.userId) {
          dd.increment('business.user_activity', 1, [
            `user_id:${(req as any).tracingContext.userId}`,
            `action:${method}_${route.split('/')[1]}`
          ]);
        }
      }
    });

    next();
  }
}
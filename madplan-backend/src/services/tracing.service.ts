import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dd from 'dd-trace';

export interface CustomSpanOptions {
  operation: string;
  resource?: string;
  tags?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DatabaseOperation {
  collection: string;
  operation: string;
  query?: any;
  duration?: number;
  recordCount?: number;
}

export interface ExternalServiceCall {
  service: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  duration?: number;
}

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Create a custom span for operation tracking
   */
  async traceOperation<T>(
    options: CustomSpanOptions,
    operation: () => Promise<T>
  ): Promise<T> {
    const span = dd.trace('custom.operation', {
      resource: options.resource || options.operation,
      tags: {
        'operation.name': options.operation,
        'operation.type': 'custom',
        ...options.tags
      }
    });

    try {
      const result = await operation();
      
      // Add success tags
      span.setTag('operation.success', true);
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          span.setTag(`metadata.${key}`, value);
        });
      }
      
      return result;
    } catch (error) {
      // Track error in span
      span.setTag('error', true);
      span.setTag('error.type', error.constructor.name);
      span.setTag('error.message', error.message);
      span.log({ 
        error: true, 
        message: error.message,
        stack: error.stack 
      });
      
      throw error;
    } finally {
      span.finish();
    }
  }

  /**
   * Track database operations with detailed metrics
   */
  async traceDatabaseOperation<T>(
    operation: DatabaseOperation,
    callback: () => Promise<T>
  ): Promise<T> {
    const span = dd.trace('mongodb.query', {
      resource: `${operation.operation} ${operation.collection}`,
      tags: {
        'db.type': 'mongodb',
        'db.collection': operation.collection,
        'db.operation': operation.operation,
        'component': 'database'
      }
    });

    const startTime = Date.now();

    try {
      // Add query information if available
      if (operation.query) {
        span.setTag('db.query', JSON.stringify(operation.query, null, 0));
      }

      const result = await callback();
      
      const duration = Date.now() - startTime;
      
      // Add success metrics
      span.setTag('db.duration', duration);
      span.setTag('db.success', true);
      
      if (operation.recordCount !== undefined) {
        span.setTag('db.record_count', operation.recordCount);
      }

      // Custom metrics for database performance
      dd.histogram('database.query.duration', duration, [
        `collection:${operation.collection}`,
        `operation:${operation.operation}`
      ]);

      dd.increment('database.queries.total', 1, [
        `collection:${operation.collection}`,
        `operation:${operation.operation}`,
        'status:success'
      ]);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track database errors
      span.setTag('error', true);
      span.setTag('error.type', error.constructor.name);
      span.setTag('error.message', error.message);
      span.setTag('db.duration', duration);
      
      dd.increment('database.queries.total', 1, [
        `collection:${operation.collection}`,
        `operation:${operation.operation}`,
        'status:error'
      ]);

      dd.histogram('database.errors.duration', duration, [
        `collection:${operation.collection}`,
        `operation:${operation.operation}`,
        `error_type:${error.constructor.name}`
      ]);

      this.logger.error(`Database operation failed: ${operation.operation} on ${operation.collection}`, {
        error: error.message,
        duration,
        query: operation.query
      });

      throw error;
    } finally {
      span.finish();
    }
  }

  /**
   * Track external service calls
   */
  async traceExternalCall<T>(
    serviceCall: ExternalServiceCall,
    callback: () => Promise<T>
  ): Promise<T> {
    const span = dd.trace('http.request', {
      resource: `${serviceCall.method.toUpperCase()} ${serviceCall.service}`,
      tags: {
        'http.method': serviceCall.method.toUpperCase(),
        'http.url': serviceCall.endpoint,
        'service.name': serviceCall.service,
        'component': 'http-client'
      }
    });

    const startTime = Date.now();

    try {
      const result = await callback();
      
      const duration = Date.now() - startTime;
      
      // Success metrics
      span.setTag('http.status_code', serviceCall.statusCode || 200);
      span.setTag('http.duration', duration);
      span.setTag('http.success', true);

      dd.histogram('external_service.request.duration', duration, [
        `service:${serviceCall.service}`,
        `method:${serviceCall.method.toLowerCase()}`,
        `status:${serviceCall.statusCode || 200}`
      ]);

      dd.increment('external_service.requests.total', 1, [
        `service:${serviceCall.service}`,
        `method:${serviceCall.method.toLowerCase()}`,
        'status:success'
      ]);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Error tracking
      span.setTag('error', true);
      span.setTag('error.type', error.constructor.name);
      span.setTag('error.message', error.message);
      span.setTag('http.duration', duration);
      
      if (error.response?.status) {
        span.setTag('http.status_code', error.response.status);
      }

      dd.increment('external_service.requests.total', 1, [
        `service:${serviceCall.service}`,
        `method:${serviceCall.method.toLowerCase()}`,
        'status:error'
      ]);

      dd.histogram('external_service.errors.duration', duration, [
        `service:${serviceCall.service}`,
        `method:${serviceCall.method.toLowerCase()}`,
        `error_type:${error.constructor.name}`
      ]);

      this.logger.error(`External service call failed: ${serviceCall.service}`, {
        error: error.message,
        endpoint: serviceCall.endpoint,
        method: serviceCall.method,
        duration
      });

      throw error;
    } finally {
      span.finish();
    }
  }

  /**
   * Add custom business event tracking
   */
  trackBusinessEvent(
    eventName: string, 
    properties: Record<string, any> = {},
    userId?: string
  ): void {
    const span = dd.scope().active();
    
    if (span) {
      span.setTag(`business.event`, eventName);
      Object.entries(properties).forEach(([key, value]) => {
        span.setTag(`business.${key}`, value);
      });
      
      if (userId) {
        span.setTag('user.id', userId);
      }
    }

    // Custom metrics for business events
    dd.increment(`business.events.${eventName}`, 1, [
      ...Object.entries(properties).map(([key, value]) => `${key}:${value}`),
      ...(userId ? [`user_id:${userId}`] : [])
    ]);

    this.logger.log(`Business event: ${eventName}`, {
      event: eventName,
      properties,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track user journey and funnel metrics
   */
  trackUserJourney(
    step: string,
    funnelName: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): void {
    const span = dd.scope().active();
    
    if (span) {
      span.setTag('user.journey.step', step);
      span.setTag('user.journey.funnel', funnelName);
      span.setTag('user.id', userId);
    }

    // Track funnel progression
    dd.increment('business.funnel.step', 1, [
      `funnel:${funnelName}`,
      `step:${step}`,
      `user_id:${userId}`
    ]);

    // Track funnel completion rates
    dd.increment(`business.funnel.${funnelName}.${step}`, 1, [
      `user_id:${userId}`
    ]);

    this.logger.log(`User journey: ${funnelName} - ${step}`, {
      funnel: funnelName,
      step,
      userId,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track performance metrics for critical operations
   */
  trackPerformanceMetric(
    operation: string,
    value: number,
    unit: 'ms' | 'bytes' | 'count' = 'ms',
    tags: Record<string, string> = {}
  ): void {
    const span = dd.scope().active();
    
    if (span) {
      span.setTag(`performance.${operation}`, value);
      span.setTag(`performance.${operation}.unit`, unit);
    }

    const metricTags = Object.entries(tags).map(([key, value]) => `${key}:${value}`);
    
    dd.histogram(`performance.${operation}`, value, metricTags);

    // Set up performance alerting thresholds
    if (unit === 'ms' && value > 1000) {
      dd.increment('performance.slow_operations', 1, [
        `operation:${operation}`,
        `threshold:slow`,
        ...metricTags
      ]);
    }

    if (unit === 'ms' && value > 5000) {
      dd.increment('performance.very_slow_operations', 1, [
        `operation:${operation}`,
        `threshold:very_slow`,
        ...metricTags
      ]);
    }
  }

  /**
   * Get current trace context for correlation
   */
  getCurrentTraceContext(): { traceId: string; spanId: string } | null {
    const span = dd.scope().active();
    
    if (span) {
      return {
        traceId: span.context().toTraceId(),
        spanId: span.context().toSpanId()
      };
    }
    
    return null;
  }

  /**
   * Create a distributed trace context for async operations
   */
  createChildSpan(operation: string, tags: Record<string, any> = {}): any {
    const parentSpan = dd.scope().active();
    
    return dd.trace(operation, {
      childOf: parentSpan,
      tags: {
        'operation.name': operation,
        'operation.type': 'async',
        ...tags
      }
    });
  }

  /**
   * Track feature flag usage and A/B test variations
   */
  trackFeatureFlag(
    flagName: string,
    variation: string,
    userId?: string,
    context: Record<string, any> = {}
  ): void {
    const span = dd.scope().active();
    
    if (span) {
      span.setTag('feature_flag.name', flagName);
      span.setTag('feature_flag.variation', variation);
      if (userId) {
        span.setTag('user.id', userId);
      }
    }

    dd.increment('business.feature_flags', 1, [
      `flag:${flagName}`,
      `variation:${variation}`,
      ...(userId ? [`user_id:${userId}`] : [])
    ]);

    this.logger.log(`Feature flag used: ${flagName} = ${variation}`, {
      flag: flagName,
      variation,
      userId,
      context
    });
  }
}
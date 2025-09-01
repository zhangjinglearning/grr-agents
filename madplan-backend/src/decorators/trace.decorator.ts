import { Injectable, Logger } from '@nestjs/common';
// import * as dd from 'dd-trace';

// Mock dd-trace functionality for compilation
const dd = {
  trace: (name: string, fn: any) => {
    if (typeof fn === 'function') {
      return fn({
        setTag: () => {},
        log: () => {},
        finish: () => {}
      });
    }
    return fn;
  },
  increment: (...args: any[]) => {},
  histogram: (...args: any[]) => {},
  gauge: (...args: any[]) => {}
};

/**
 * Decorator to automatically trace method execution
 */
export function Trace(options?: {
  operation?: string;
  resource?: string;
  tags?: Record<string, any>;
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const className = target.constructor.name;
    const operationName = options?.operation || `${className}.${propertyName}`;
    const resourceName = options?.resource || `${className}#${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const span = dd.trace(operationName, {
        resource: resourceName,
        tags: {
          'method.class': className,
          'method.name': propertyName,
          'component': 'application',
          ...options?.tags
        }
      });

      try {
        // Add method arguments as tags (be careful with sensitive data)
        if (args.length > 0 && !containsSensitiveData(args)) {
          span.setTag('method.args.count', args.length);
          args.forEach((arg, index) => {
            if (arg && typeof arg === 'object' && arg.id) {
              span.setTag(`method.args.${index}.id`, arg.id);
            }
          });
        }

        const result = await method.apply(this, args);
        
        // Track successful execution
        span.setTag('method.success', true);
        
        // Add result metadata if available
        if (result && typeof result === 'object') {
          if (result.id) span.setTag('result.id', result.id);
          if (Array.isArray(result)) span.setTag('result.count', result.length);
          if (result.status) span.setTag('result.status', result.status);
        }

        return result;
      } catch (error) {
        // Track method errors
        span.setTag('error', true);
        span.setTag('error.type', error.constructor.name);
        span.setTag('error.message', error.message);
        span.log({
          error: true,
          message: error.message,
          stack: error.stack
        });

        // Custom metrics for method errors
        dd.increment('methods.errors.total', 1, [
          `class:${className}`,
          `method:${propertyName}`,
          `error_type:${error.constructor.name}`
        ]);

        throw error;
      } finally {
        span.finish();
      }
    };

    return descriptor;
  };
}

/**
 * Decorator specifically for database operations
 */
export function TraceDB(collection?: string, operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      const dbCollection = collection || inferCollectionFromMethod(propertyName, className);
      const dbOperation = operation || inferOperationFromMethod(propertyName);
      
      const span = dd.trace('mongodb.query', {
        resource: `${dbOperation} ${dbCollection}`,
        tags: {
          'db.type': 'mongodb',
          'db.collection': dbCollection,
          'db.operation': dbOperation,
          'method.class': className,
          'method.name': propertyName,
          'component': 'database'
        }
      });

      const startTime = Date.now();

      try {
        // Extract query information from arguments
        const queryArg = findQueryInArgs(args);
        if (queryArg) {
          span.setTag('db.query', JSON.stringify(queryArg, null, 0));
        }

        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Success metrics
        span.setTag('db.success', true);
        span.setTag('db.duration', duration);
        
        if (Array.isArray(result)) {
          span.setTag('db.record_count', result.length);
        } else if (result && typeof result === 'object' && result.modifiedCount !== undefined) {
          span.setTag('db.modified_count', result.modifiedCount);
        }

        // Database performance metrics
        dd.histogram('database.method.duration', duration, [
          `collection:${dbCollection}`,
          `operation:${dbOperation}`,
          `class:${className}`,
          `method:${propertyName}`
        ]);

        dd.increment('database.methods.total', 1, [
          `collection:${dbCollection}`,
          `operation:${dbOperation}`,
          `class:${className}`,
          'status:success'
        ]);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        span.setTag('error', true);
        span.setTag('error.type', error.constructor.name);
        span.setTag('error.message', error.message);
        span.setTag('db.duration', duration);

        dd.increment('database.methods.total', 1, [
          `collection:${dbCollection}`,
          `operation:${dbOperation}`,
          `class:${className}`,
          'status:error'
        ]);

        throw error;
      } finally {
        span.finish();
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for API endpoints to track business metrics
 */
export function TraceBusiness(eventName?: string, category?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const className = target.constructor.name;
    const businessEvent = eventName || `${className.replace('Controller', '').toLowerCase()}.${propertyName}`;
    const eventCategory = category || 'api';

    descriptor.value = async function (...args: any[]) {
      const span = dd.trace('business.operation', {
        resource: businessEvent,
        tags: {
          'business.event': businessEvent,
          'business.category': eventCategory,
          'method.class': className,
          'method.name': propertyName,
          'component': 'business'
        }
      });

      try {
        // Extract user context from request
        const req = args.find(arg => arg && arg.user);
        const userId = req?.user?.id || req?.user?.sub;
        
        if (userId) {
          span.setTag('user.id', userId);
        }

        const result = await method.apply(this, args);
        
        // Track successful business operations
        span.setTag('business.success', true);
        
        // Business metrics
        dd.increment(`business.${eventCategory}.operations`, 1, [
          `event:${businessEvent}`,
          `class:${className}`,
          'status:success',
          ...(userId ? [`user_id:${userId}`] : [])
        ]);

        // Track user activity
        if (userId) {
          dd.increment('business.user_activity', 1, [
            `user_id:${userId}`,
            `event:${businessEvent}`,
            `category:${eventCategory}`
          ]);
        }

        return result;
      } catch (error) {
        span.setTag('error', true);
        span.setTag('error.type', error.constructor.name);
        span.setTag('error.message', error.message);

        dd.increment(`business.${eventCategory}.operations`, 1, [
          `event:${businessEvent}`,
          `class:${className}`,
          'status:error',
          `error_type:${error.constructor.name}`
        ]);

        throw error;
      } finally {
        span.finish();
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for tracking performance-critical operations
 */
export function TracePerformance(
  thresholds?: { 
    warn?: number; 
    error?: number; 
    critical?: number;
  }
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const className = target.constructor.name;
    const defaultThresholds = { 
      warn: 1000, 
      error: 5000, 
      critical: 10000,
      ...thresholds 
    };

    descriptor.value = async function (...args: any[]) {
      const span = dd.trace('performance.operation', {
        resource: `${className}#${propertyName}`,
        tags: {
          'performance.operation': `${className}.${propertyName}`,
          'method.class': className,
          'method.name': propertyName,
          'component': 'performance'
        }
      });

      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      try {
        const result = await method.apply(this, args);
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

        // Performance metrics
        span.setTag('performance.duration', duration);
        span.setTag('performance.memory_delta', memoryUsed);
        span.setTag('performance.success', true);

        // Check performance thresholds
        if (duration > defaultThresholds.critical) {
          span.setTag('performance.alert', 'critical');
          dd.increment('performance.alerts', 1, [
            `operation:${className}.${propertyName}`,
            'level:critical'
          ]);
        } else if (duration > defaultThresholds.error) {
          span.setTag('performance.alert', 'error');
          dd.increment('performance.alerts', 1, [
            `operation:${className}.${propertyName}`,
            'level:error'
          ]);
        } else if (duration > defaultThresholds.warn) {
          span.setTag('performance.alert', 'warn');
          dd.increment('performance.alerts', 1, [
            `operation:${className}.${propertyName}`,
            'level:warn'
          ]);
        }

        // Performance metrics
        dd.histogram('performance.operation.duration', duration, [
          `operation:${className}.${propertyName}`,
          `class:${className}`
        ]);

        dd.histogram('performance.operation.memory', Math.abs(memoryUsed), [
          `operation:${className}.${propertyName}`,
          `direction:${memoryUsed > 0 ? 'increase' : 'decrease'}`
        ]);

        return result;
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        span.setTag('error', true);
        span.setTag('error.type', error.constructor.name);
        span.setTag('performance.duration', duration);

        dd.increment('performance.operation.errors', 1, [
          `operation:${className}.${propertyName}`,
          `error_type:${error.constructor.name}`
        ]);

        throw error;
      } finally {
        span.finish();
      }
    };

    return descriptor;
  };
}

// Helper functions
function containsSensitiveData(args: any[]): boolean {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  const argString = JSON.stringify(args).toLowerCase();
  return sensitiveKeys.some(key => argString.includes(key));
}

function inferCollectionFromMethod(methodName: string, className: string): string {
  // Try to extract collection from class name
  const classMatch = className.match(/(.+?)(?:Service|Repository|Controller)$/);
  if (classMatch) {
    return classMatch[1].toLowerCase() + 's';
  }
  
  // Try to extract from method name
  const methodMatch = methodName.match(/(?:create|find|update|delete|get)(.+)/);
  if (methodMatch) {
    return methodMatch[1].toLowerCase();
  }
  
  return 'unknown';
}

function inferOperationFromMethod(methodName: string): string {
  if (methodName.includes('create') || methodName.includes('save')) return 'insert';
  if (methodName.includes('find') || methodName.includes('get')) return 'find';
  if (methodName.includes('update') || methodName.includes('modify')) return 'update';
  if (methodName.includes('delete') || methodName.includes('remove')) return 'delete';
  if (methodName.includes('count')) return 'count';
  if (methodName.includes('aggregate')) return 'aggregate';
  return 'query';
}

function findQueryInArgs(args: any[]): any {
  // Look for query-like objects in arguments
  for (const arg of args) {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      // Check if it looks like a MongoDB query
      if (arg._id || arg.id || arg.$and || arg.$or || arg.where) {
        return arg;
      }
    }
  }
  return null;
}
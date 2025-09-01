import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  HttpStatus,
  Logger,
  Injectable
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

import { ErrorTrackingService } from '../services/error-tracking.service';
import { ErrorSeverity, ErrorCategory } from '../schemas/error-log.schema';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  traceId?: string;
  correlationId?: string;
}

@Injectable()
@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);

  constructor(
    private readonly errorTrackingService: ErrorTrackingService,
    private readonly configService: ConfigService
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine error details
    const errorInfo = this.extractErrorInfo(exception);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    // Create error context
    const errorContext = {
      userId: (request as any).user?.id,
      sessionId: (request as any).tracingContext?.sessionId,
      requestId: (request as any).tracingContext?.correlationId,
      traceId: (request as any).tracingContext?.traceId,
      correlationId: (request as any).tracingContext?.correlationId,
      endpoint: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      ipAddress: request.ip,
      timestamp: new Date(),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      version: this.configService.get<string>('npm_package_version', '1.0.0'),
      body: this.sanitizeRequestBody(request.body),
      query: request.query,
      params: request.params,
      headers: this.sanitizeHeaders(request.headers)
    };

    // Determine error severity and category
    const { severity, category } = this.categorizeError(exception, errorInfo.status);

    // Track error
    try {
      await this.errorTrackingService.trackError(
        typeof exception === 'string' ? exception : exception as Error,
        {
          severity,
          category,
          context: errorContext,
          metadata: {
            httpStatus: errorInfo.status,
            isHttpException: exception instanceof HttpException,
            originalError: exception instanceof Error ? exception.constructor.name : 'Unknown'
          },
          tags: this.generateErrorTags(exception, request, errorInfo.status)
        }
      );
    } catch (trackingError) {
      this.logger.error('Failed to track error in global filter:', trackingError);
    }

    // Log error
    const logMessage = `${request.method} ${request.url} - ${errorInfo.status} - ${errorInfo.message}`;
    if (errorInfo.status >= 500) {
      this.logger.error(logMessage, {
        error: exception,
        context: errorContext,
        stack: exception instanceof Error ? exception.stack : undefined
      });
    } else {
      this.logger.warn(logMessage, {
        context: errorContext
      });
    }

    // Send to Sentry for server errors
    if (errorInfo.status >= 500 && exception instanceof Error) {
      Sentry.withScope(scope => {
        scope.setTag('errorFilter', 'global');
        scope.setTag('httpStatus', errorInfo.status);
        scope.setLevel('error');
        scope.setContext('request', {
          method: request.method,
          url: request.url,
          userAgent: request.get('User-Agent'),
          ipAddress: request.ip
        });
        
        if (errorContext.userId) {
          scope.setUser({ id: errorContext.userId });
        }

        Sentry.captureException(exception);
      });
    }

    // Create error response
    const errorResponse: ErrorResponse = {
      statusCode: errorInfo.status,
      message: errorInfo.message,
      error: errorInfo.error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: errorContext.requestId,
      traceId: errorContext.traceId,
      correlationId: errorContext.correlationId
    };

    // Filter sensitive information in production
    if (isProduction) {
      errorResponse.message = this.sanitizeErrorMessage(errorResponse.message);
      
      // Remove internal details for server errors
      if (errorInfo.status >= 500) {
        errorResponse.message = 'Internal server error';
      }
    }

    // Set security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');

    // Send response
    response
      .status(errorInfo.status)
      .json(errorResponse);
  }

  private extractErrorInfo(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      
      if (typeof response === 'string') {
        return {
          status: exception.getStatus(),
          message: response,
          error: exception.constructor.name
        };
      }
      
      return {
        status: exception.getStatus(),
        message: (response as any).message || exception.message,
        error: (response as any).error || exception.constructor.name
      };
    }

    if (exception instanceof Error) {
      // Handle specific error types
      if (exception.name === 'ValidationError') {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          error: 'Bad Request'
        };
      }

      if (exception.name === 'MongoError' || exception.name === 'MongooseError') {
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Internal Server Error'
        };
      }

      if (exception.name === 'JsonWebTokenError') {
        return {
          status: HttpStatus.UNAUTHORIZED,
          message: 'Invalid token',
          error: 'Unauthorized'
        };
      }

      if (exception.name === 'TokenExpiredError') {
        return {
          status: HttpStatus.UNAUTHORIZED,
          message: 'Token expired',
          error: 'Unauthorized'
        };
      }

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        error: 'Internal Server Error'
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'Internal Server Error'
    };
  }

  private categorizeError(exception: unknown, status: number): {
    severity: ErrorSeverity;
    category: ErrorCategory;
  } {
    // Severity based on HTTP status
    let severity: ErrorSeverity;
    if (status >= 500) {
      severity = ErrorSeverity.ERROR;
    } else if (status >= 400) {
      severity = ErrorSeverity.WARNING;
    } else {
      severity = ErrorSeverity.INFO;
    }

    // Special cases for severity
    if (exception instanceof Error) {
      if (exception.name === 'MongoError' || exception.name === 'MongooseError') {
        severity = ErrorSeverity.ERROR;
      }
      if (exception.message.toLowerCase().includes('crash') || 
          exception.message.toLowerCase().includes('fatal')) {
        severity = ErrorSeverity.FATAL;
      }
    }

    // Category based on error type and status
    let category: ErrorCategory = ErrorCategory.APPLICATION;

    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      category = ErrorCategory.AUTHENTICATION;
    } else if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY) {
      category = ErrorCategory.VALIDATION;
    } else if (status >= 500) {
      if (exception instanceof Error) {
        if (exception.name.includes('Mongo')) {
          category = ErrorCategory.DATABASE;
        } else if (exception.name.includes('Network') || exception.name.includes('Timeout')) {
          category = ErrorCategory.NETWORK;
        } else if (exception.message.toLowerCase().includes('external') ||
                   exception.message.toLowerCase().includes('api')) {
          category = ErrorCategory.EXTERNAL_SERVICE;
        } else {
          category = ErrorCategory.SYSTEM;
        }
      }
    }

    return { severity, category };
  }

  private generateErrorTags(exception: unknown, request: Request, status: number): string[] {
    const tags: string[] = [];

    // HTTP method and status tags
    tags.push(`method:${request.method.toLowerCase()}`);
    tags.push(`status:${status}`);
    tags.push(`status_class:${Math.floor(status / 100)}xx`);

    // Route tags
    const route = (request as any).route?.path || request.url;
    if (route) {
      tags.push(`route:${route}`);
    }

    // Error type tags
    if (exception instanceof Error) {
      tags.push(`error_type:${exception.constructor.name}`);
      tags.push(`error_name:${exception.name}`);
    }

    // Environment tags
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    tags.push(`environment:${environment}`);

    // User context tags
    const userId = (request as any).user?.id;
    if (userId) {
      tags.push(`user_id:${userId}`);
    }

    // Special condition tags
    if (status >= 500) tags.push('server_error');
    if (status >= 400 && status < 500) tags.push('client_error');
    if (exception instanceof HttpException) tags.push('http_exception');

    return tags;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'ssn', 'credit_card', 'creditCard', 'cvv', 'pin'
    ];

    const sanitize = (obj: any) => {
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[Filtered]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      });
    };

    sanitize(sanitized);
    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization', 'cookie', 'x-api-key', 'x-auth-token'
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[Filtered]';
      }
    });

    return sanitized;
  }

  private sanitizeErrorMessage(message: string | string[]): string | string[] {
    if (Array.isArray(message)) {
      return message.map(msg => this.sanitizeErrorMessage(msg) as string);
    }

    if (typeof message !== 'string') {
      return message;
    }

    // Remove sensitive information from error messages
    const sensitivePatterns = [
      /password[^\s]*/gi,
      /token[^\s]*/gi,
      /secret[^\s]*/gi,
      /key[^\s]*/gi,
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g // Email addresses (optional)
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[Filtered]');
    });

    return sanitized;
  }
}
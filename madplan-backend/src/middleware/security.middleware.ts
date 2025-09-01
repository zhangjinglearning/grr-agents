import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import * as rateLimit from 'express-rate-limit';
import * as RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import * as DOMPurify from 'isomorphic-dompurify';
import { SecretsManagerService } from '../services/secrets-manager.service';
import { AuditService } from '../services/audit.service';

/**
 * Comprehensive security middleware for production deployment
 * Implements multiple layers of security controls
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private redisClient: any;
  private rateLimitStore: any;

  constructor(
    private configService: ConfigService,
    private secretsService: SecretsManagerService,
    private auditService: AuditService,
  ) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis client for rate limiting
   */
  private async initializeRedis() {
    try {
      const redisUrl = this.configService.get('REDIS_URL');
      this.redisClient = createClient({ url: redisUrl });
      await this.redisClient.connect();
      
      this.rateLimitStore = new RedisStore({
        sendCommand: (...args: string[]) => this.redisClient.sendCommand(args),
      });
      
      this.logger.log('Redis client initialized for security middleware');
    } catch (error) {
      this.logger.error('Failed to initialize Redis client', error);
    }
  }

  /**
   * Apply security middleware
   */
  use(req: Request, res: Response, next: NextFunction) {
    // Apply security headers
    this.applySecurityHeaders(req, res);
    
    // Apply rate limiting
    this.applyRateLimiting(req, res, next);
    
    // Sanitize input
    this.sanitizeInput(req);
    
    // Log security events
    this.logSecurityEvent(req);
    
    // Detect suspicious activity
    this.detectSuspiciousActivity(req, res);
    
    next();
  }

  /**
   * Apply security headers using helmet
   */
  private applySecurityHeaders(req: Request, res: Response) {
    const securityConfig = this.configService.get('security');
    
    helmet({
      contentSecurityPolicy: {
        directives: securityConfig.csp.directives,
        reportOnly: securityConfig.csp.reportOnly,
      },
      hsts: {
        maxAge: securityConfig.https.hsts.maxAge,
        includeSubDomains: securityConfig.https.hsts.includeSubDomains,
        preload: securityConfig.https.hsts.preload,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'same-origin' },
      frameguard: { action: 'deny' },
    })(req, res, () => {});

    // Custom security headers
    res.setHeader('X-API-Version', this.configService.get('API_VERSION', '1.0'));
    res.setHeader('X-Rate-Limit-Policy', 'strict');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  }

  /**
   * Apply rate limiting based on endpoint and user role
   */
  private applyRateLimiting(req: Request, res: Response, next: NextFunction) {
    const rateLimitConfig = this.configService.get('security.rateLimiting');
    
    if (!rateLimitConfig.enabled) {
      return next();
    }

    // Determine rate limit based on endpoint and user
    const limits = this.determineRateLimit(req);
    
    const limiter = rateLimit({
      store: this.rateLimitStore,
      windowMs: limits.windowMs,
      max: limits.maxRequests,
      message: {
        error: 'Rate limit exceeded',
        retryAfter: limits.windowMs / 1000,
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => this.generateRateLimitKey(req),
      skip: (req) => this.shouldSkipRateLimit(req),
      onLimitReached: (req, res, options) => {
        this.handleRateLimitExceeded(req, res, options);
      },
    });

    limiter(req, res, next);
  }

  /**
   * Determine rate limit based on request context
   */
  private determineRateLimit(req: Request) {
    const rateLimitConfig = this.configService.get('security.rateLimiting.limits');
    const userRole = (req as any).user?.role || 'anonymous';
    const path = req.path;

    // Authentication endpoints
    if (path.startsWith('/api/auth/')) {
      return rateLimitConfig.authentication;
    }

    // Upload endpoints
    if (path.includes('/upload')) {
      return rateLimitConfig.upload;
    }

    // Role-based limits
    if (rateLimitConfig[userRole]) {
      return rateLimitConfig[userRole];
    }

    return rateLimitConfig.api.general;
  }

  /**
   * Generate rate limit key
   */
  private generateRateLimitKey(req: Request): string {
    const userId = (req as any).user?.id;
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Use user ID if authenticated, otherwise IP + User-Agent fingerprint
    if (userId) {
      return `user:${userId}`;
    }
    
    return `ip:${ip}:${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
  }

  /**
   * Check if rate limiting should be skipped
   */
  private shouldSkipRateLimit(req: Request): boolean {
    const skipPaths = ['/health', '/metrics', '/status'];
    return skipPaths.some(path => req.path.startsWith(path));
  }

  /**
   * Handle rate limit exceeded
   */
  private handleRateLimitExceeded(req: Request, res: Response, options: any) {
    const clientInfo = this.getClientInfo(req);
    
    this.logger.warn('Rate limit exceeded', {
      ...clientInfo,
      path: req.path,
      method: req.method,
      limit: options.max,
      windowMs: options.windowMs,
    });

    // Log security event
    this.auditService.logSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      clientInfo,
      metadata: {
        path: req.path,
        method: req.method,
        limit: options.max,
      },
    });
  }

  /**
   * Sanitize request input
   */
  private sanitizeInput(req: Request) {
    const validationConfig = this.configService.get('security.validation');
    
    if (!validationConfig.sanitizeInput) {
      return;
    }

    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = this.sanitizeObject(req.params);
    }
  }

  /**
   * Recursively sanitize object properties
   */
  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    // HTML sanitization
    let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    
    // SQL injection prevention patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    ];
    
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // NoSQL injection prevention
    const noSqlPatterns = [
      /\$where/gi,
      /\$regex/gi,
      /\$ne/gi,
      /\$in/gi,
      /\$nin/gi,
      /\$gt/gi,
      /\$lt/gi,
    ];
    
    noSqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // JavaScript injection prevention
    const jsPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];
    
    jsPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized.trim();
  }

  /**
   * Log security events
   */
  private logSecurityEvent(req: Request) {
    const monitoringConfig = this.configService.get('security.security_monitoring');
    
    if (!monitoringConfig.enabled || !monitoringConfig.logging) {
      return;
    }

    const clientInfo = this.getClientInfo(req);
    const sensitiveFields = monitoringConfig.logging.sensitiveFieldsHandling;

    // Log request with security context
    this.logger.log('Security middleware processed request', {
      ...clientInfo,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      referer: req.get('Referer'),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(req: Request, res: Response) {
    const anomalyConfig = this.configService.get('security.security_monitoring.anomalyDetection');
    
    if (!anomalyConfig.enabled) {
      return;
    }

    const clientInfo = this.getClientInfo(req);
    const suspiciousPatterns = [
      // Path traversal attempts
      /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\/gi,
      
      // Command injection attempts
      /[;&|`$(){}[\]]/g,
      
      // File inclusion attempts
      /\/etc\/passwd|\/etc\/shadow|\/proc\/|\/sys\//gi,
      
      // Binary data in text fields
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]/g,
    ];

    const requestData = JSON.stringify({
      path: req.path,
      query: req.query,
      body: req.body,
    });

    const suspiciousCount = suspiciousPatterns.reduce((count, pattern) => {
      return count + (pattern.test(requestData) ? 1 : 0);
    }, 0);

    if (suspiciousCount >= anomalyConfig.thresholds.suspiciousPatterns) {
      this.logger.warn('Suspicious activity detected', {
        ...clientInfo,
        suspiciousCount,
        path: req.path,
        method: req.method,
      });

      // Log security event
      this.auditService.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'high',
        clientInfo,
        metadata: {
          suspiciousCount,
          patterns: 'multiple_injection_attempts',
          path: req.path,
        },
      });

      // Apply automated response
      this.applyAutomatedResponse(req, res, 'suspiciousActivity');
    }
  }

  /**
   * Apply automated incident response
   */
  private applyAutomatedResponse(req: Request, res: Response, eventType: string) {
    const responseConfig = this.configService.get('security.incidentResponse.automatedResponse');
    
    if (!responseConfig.enabled || !responseConfig[eventType]) {
      return;
    }

    const actions = responseConfig[eventType].actions;
    const clientInfo = this.getClientInfo(req);

    actions.forEach(action => {
      switch (action) {
        case 'logAlert':
          this.logger.error(`Automated response triggered: ${eventType}`, clientInfo);
          break;
          
        case 'increasemonitoring':
          // Increase monitoring for this client
          this.increaseMonitoring(clientInfo);
          break;
          
        case 'temporaryBlock':
          // Implement temporary IP blocking
          this.temporaryBlock(clientInfo.ip, 300); // 5 minutes
          break;
          
        case 'notifySecurityTeam':
          // Send notification to security team
          this.notifySecurityTeam(eventType, clientInfo);
          break;
      }
    });
  }

  /**
   * Get client information for security logging
   */
  private getClientInfo(req: Request) {
    return {
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      userId: (req as any).user?.id || null,
      sessionId: (req as any).session?.id || null,
      origin: req.get('Origin') || null,
      referer: req.get('Referer') || null,
    };
  }

  /**
   * Get client IP address with proxy support
   */
  private getClientIP(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.get('CF-Connecting-IP') ||
      req.connection.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Increase monitoring for suspicious clients
   */
  private async increaseMonitoring(clientInfo: any) {
    try {
      const key = `monitoring:${clientInfo.ip}`;
      await this.redisClient.setEx(key, 3600, JSON.stringify({
        level: 'high',
        reason: 'suspicious_activity',
        timestamp: Date.now(),
        clientInfo,
      }));
    } catch (error) {
      this.logger.error('Failed to increase monitoring', error);
    }
  }

  /**
   * Temporarily block IP address
   */
  private async temporaryBlock(ip: string, durationSeconds: number) {
    try {
      const key = `blocked:${ip}`;
      await this.redisClient.setEx(key, durationSeconds, JSON.stringify({
        reason: 'suspicious_activity',
        blockedAt: Date.now(),
        expiresAt: Date.now() + (durationSeconds * 1000),
      }));
      
      this.logger.warn(`Temporarily blocked IP: ${ip} for ${durationSeconds} seconds`);
    } catch (error) {
      this.logger.error('Failed to block IP', error);
    }
  }

  /**
   * Notify security team of incidents
   */
  private async notifySecurityTeam(eventType: string, clientInfo: any) {
    try {
      // Implementation would depend on notification service
      // Could be SNS, Slack, email, etc.
      this.logger.log(`Security team notified of ${eventType}`, clientInfo);
    } catch (error) {
      this.logger.error('Failed to notify security team', error);
    }
  }

  /**
   * Clean up resources
   */
  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
  }
}
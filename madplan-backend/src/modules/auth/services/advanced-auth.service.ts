import { Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { EncryptionService } from '../../security/services/encryption.service';
import { AuditLoggingService } from '../../security/services/audit-logging.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface AuthContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  mfaVerified?: boolean;
  loginTime: Date;
  lastActivity: Date;
}

export interface SecurityPolicy {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordHistoryCount: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  requireMfa: boolean;
  allowedIpRanges?: string[];
  blockedCountries?: string[];
}

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (req: any) => string;
}

@Injectable()
export class AdvancedAuthService {
  private readonly logger = new Logger(AdvancedAuthService.name);
  private readonly defaultSecurityPolicy: SecurityPolicy;
  private readonly rateLimitConfigs: Map<string, RateLimitConfig> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditLoggingService,
    @InjectRedis() private readonly redis: Redis,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('UserSession') private readonly sessionModel: Model<any>,
    @InjectModel('SecurityEvent') private readonly securityEventModel: Model<any>,
  ) {
    this.defaultSecurityPolicy = {
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true,
      passwordHistoryCount: 5,
      maxFailedAttempts: 5,
      lockoutDuration: 900, // 15 minutes
      sessionTimeout: 3600, // 1 hour
      requireMfa: true,
      allowedIpRanges: [],
      blockedCountries: ['CN', 'RU', 'KP'] // Example blocked countries
    };

    this.setupRateLimiting();
  }

  /**
   * Advanced user authentication with comprehensive security checks
   */
  async authenticateUser(
    email: string,
    password: string,
    authContext: Partial<AuthContext>
  ): Promise<AuthTokens> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      await this.checkRateLimit('login', authContext.ipAddress);
      
      // Security policy checks
      await this.validateSecurityContext(authContext);
      
      // Find user and verify account status
      const user = await this.userModel.findOne({ email }).exec();
      if (!user) {
        await this.auditService.logAuthenticationEvent(
          undefined,
          email,
          'login_failed',
          'failure',
          { reason: 'user_not_found', ...authContext }
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check account lockout
      await this.checkAccountLockout(user._id.toString());
      
      // Verify password
      const isPasswordValid = await this.encryptionService.verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        await this.handleFailedLogin(user._id.toString(), authContext);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if MFA is required
      if (this.defaultSecurityPolicy.requireMfa && user.mfaEnabled) {
        // Return temporary token requiring MFA completion
        return this.createMfaToken(user, authContext);
      }

      // Create session and tokens
      const sessionId = uuidv4();
      const tokens = await this.createAuthTokens(user, sessionId, authContext);
      
      // Save session
      await this.saveUserSession(user._id.toString(), sessionId, authContext);
      
      // Clear failed attempts
      await this.clearFailedAttempts(user._id.toString());
      
      // Audit successful login
      await this.auditService.logAuthenticationEvent(
        user._id.toString(),
        user.email,
        'login',
        'success',
        {
          sessionId,
          loginDuration: Date.now() - startTime,
          ...authContext
        }
      );

      return tokens;

    } catch (error) {
      this.logger.error('Authentication failed', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Complete MFA authentication
   */
  async completeMfaAuthentication(
    mfaToken: string,
    mfaCode: string,
    authContext: Partial<AuthContext>
  ): Promise<AuthTokens> {
    try {
      // Verify MFA token
      const mfaPayload = this.jwtService.verify(mfaToken, {
        secret: this.configService.get('auth.mfaSecret')
      });

      if (mfaPayload.type !== 'mfa_required') {
        throw new UnauthorizedException('Invalid MFA token');
      }

      const user = await this.userModel.findById(mfaPayload.userId).exec();
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify MFA code
      const isValidMfa = await this.verifyMfaCode(user._id.toString(), mfaCode);
      if (!isValidMfa) {
        await this.auditService.logAuthenticationEvent(
          user._id.toString(),
          user.email,
          'mfa_failed',
          'failure',
          { mfaCode: '***', ...authContext }
        );
        throw new UnauthorizedException('Invalid MFA code');
      }

      // Create session and tokens
      const sessionId = uuidv4();
      const tokens = await this.createAuthTokens(user, sessionId, {
        ...authContext,
        mfaVerified: true
      });
      
      // Save session
      await this.saveUserSession(user._id.toString(), sessionId, {
        ...authContext,
        mfaVerified: true
      });

      // Audit successful MFA
      await this.auditService.logAuthenticationEvent(
        user._id.toString(),
        user.email,
        'mfa_success',
        'success',
        { sessionId, ...authContext }
      );

      return tokens;

    } catch (error) {
      this.logger.error('MFA authentication failed', error);
      throw error;
    }
  }

  /**
   * Setup MFA for user
   */
  async setupMfa(userId: string): Promise<MfaSetupResult> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `MadPlan (${user.email})`,
        issuer: 'MadPlan',
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      // Generate backup codes
      const backupCodes = Array.from({ length: 8 }, () => 
        this.encryptionService.generateSecureToken(8).toUpperCase()
      );

      // Encrypt and store secret and backup codes
      const encryptedSecret = await this.encryptionService.encryptUserData(secret.base32);
      const encryptedBackupCodes = await Promise.all(
        backupCodes.map(code => this.encryptionService.encryptUserData(code))
      );

      // Save to user record (don't enable MFA until verified)
      await this.userModel.findByIdAndUpdate(userId, {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
        mfaSetupTime: new Date()
      });

      // Audit MFA setup
      await this.auditService.logAuthenticationEvent(
        userId,
        user.email,
        'mfa_setup',
        'success',
        { backupCodesGenerated: backupCodes.length }
      );

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes
      };

    } catch (error) {
      this.logger.error('MFA setup failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Verify and enable MFA
   */
  async verifyAndEnableMfa(userId: string, verificationCode: string): Promise<boolean> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.mfaSecret) {
        throw new UnauthorizedException('MFA not set up');
      }

      // Decrypt secret
      const decryptedSecret = await this.encryptionService.decryptUserData(user.mfaSecret);
      
      // Verify code
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: verificationCode,
        window: 2 // Allow 2-step window (60 second tolerance)
      });

      if (!verified) {
        await this.auditService.logAuthenticationEvent(
          userId,
          user.email,
          'mfa_verification_failed',
          'failure',
          { verificationCode: '***' }
        );
        return false;
      }

      // Enable MFA
      await this.userModel.findByIdAndUpdate(userId, {
        mfaEnabled: true,
        mfaEnabledTime: new Date()
      });

      // Audit MFA enabled
      await this.auditService.logAuthenticationEvent(
        userId,
        user.email,
        'mfa_enabled',
        'success'
      );

      return true;

    } catch (error) {
      this.logger.error('MFA verification failed', { userId, error: error.message });
      return false;
    }
  }

  /**
   * Advanced authorization with role-based and attribute-based access control
   */
  async authorizeUser(
    userId: string,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    try {
      const user = await this.userModel.findById(userId).populate('roles').exec();
      if (!user) {
        return false;
      }

      // Get user permissions
      const userPermissions = await this.getUserPermissions(userId);
      
      // Check direct permission
      const directPermission = `${resource}:${action}`;
      if (userPermissions.includes(directPermission) || userPermissions.includes('*:*')) {
        await this.auditService.logAuthorizationEvent(
          userId,
          action,
          resource,
          context?.resourceId || resource,
          'success',
          { 
            permissionType: 'direct',
            permission: directPermission,
            ...context
          }
        );
        return true;
      }

      // Check role-based permissions
      const rolePermissions = await this.getRolePermissions(user.roles);
      if (rolePermissions.includes(directPermission)) {
        await this.auditService.logAuthorizationEvent(
          userId,
          action,
          resource,
          context?.resourceId || resource,
          'success',
          { 
            permissionType: 'role-based',
            permission: directPermission,
            roles: user.roles.map(r => r.name),
            ...context
          }
        );
        return true;
      }

      // Check attribute-based permissions
      const attributeResult = await this.evaluateAttributeBasedAccess(
        user,
        resource,
        action,
        context
      );

      if (attributeResult.allowed) {
        await this.auditService.logAuthorizationEvent(
          userId,
          action,
          resource,
          context?.resourceId || resource,
          'success',
          { 
            permissionType: 'attribute-based',
            attributes: attributeResult.attributes,
            ...context
          }
        );
        return true;
      }

      // Access denied
      await this.auditService.logAuthorizationEvent(
        userId,
        action,
        resource,
        context?.resourceId || resource,
        'denied',
        { 
          userRoles: user.roles.map(r => r.name),
          userPermissions,
          ...context
        }
      );

      return false;

    } catch (error) {
      this.logger.error('Authorization check failed', { userId, resource, action, error: error.message });
      
      // Log authorization error
      await this.auditService.logAuthorizationEvent(
        userId,
        action,
        resource,
        context?.resourceId || resource,
        'failure',
        { error: error.message, ...context }
      );

      return false;
    }
  }

  /**
   * Rate limiting implementation
   */
  async checkRateLimit(operation: string, identifier: string): Promise<void> {
    const config = this.rateLimitConfigs.get(operation);
    if (!config) {
      return; // No rate limiting configured for this operation
    }

    const key = `rate_limit:${operation}:${identifier}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
    }

    if (current > config.maxAttempts) {
      await this.auditService.logSecurityViolation(
        undefined,
        'rate_limit_exceeded',
        `Rate limit exceeded for operation: ${operation}`,
        {
          operation,
          identifier,
          attempts: current,
          maxAttempts: config.maxAttempts,
          windowMs: config.windowMs
        }
      );
      
      throw new ForbiddenException('Rate limit exceeded');
    }
  }

  /**
   * Session management and validation
   */
  async validateSession(sessionId: string, userId: string): Promise<AuthContext | null> {
    try {
      const session = await this.sessionModel.findOne({
        sessionId,
        userId,
        active: true,
        expiresAt: { $gt: new Date() }
      }).exec();

      if (!session) {
        return null;
      }

      // Check for suspicious activity
      await this.checkSessionSecurity(session);

      // Update last activity
      await this.sessionModel.findByIdAndUpdate(session._id, {
        lastActivity: new Date()
      });

      return {
        userId: session.userId,
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        mfaVerified: session.mfaVerified,
        loginTime: session.loginTime,
        lastActivity: new Date()
      };

    } catch (error) {
      this.logger.error('Session validation failed', { sessionId, userId, error: error.message });
      return null;
    }
  }

  /**
   * Logout and session cleanup
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    try {
      // Deactivate session
      await this.sessionModel.findOneAndUpdate(
        { sessionId, userId },
        { 
          active: false,
          logoutTime: new Date()
        }
      );

      // Remove session from cache
      await this.redis.del(`session:${sessionId}`);

      // Audit logout
      await this.auditService.logAuthenticationEvent(
        userId,
        undefined,
        'logout',
        'success',
        { sessionId }
      );

    } catch (error) {
      this.logger.error('Logout failed', { sessionId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Security monitoring and threat detection
   */
  async detectSecurityThreats(userId: string, context: any): Promise<void> {
    const threats = [];

    // Detect unusual login patterns
    const recentLogins = await this.sessionModel.find({
      userId,
      loginTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ loginTime: -1 }).limit(10);

    // Multiple locations
    const uniqueIPs = new Set(recentLogins.map(login => login.ipAddress));
    if (uniqueIPs.size > 3) {
      threats.push({
        type: 'multiple_locations',
        severity: 'medium',
        details: { uniqueIPs: Array.from(uniqueIPs) }
      });
    }

    // Multiple devices
    const uniqueDevices = new Set(recentLogins.map(login => login.deviceId));
    if (uniqueDevices.size > 3) {
      threats.push({
        type: 'multiple_devices',
        severity: 'medium',
        details: { uniqueDevices: Array.from(uniqueDevices) }
      });
    }

    // Unusual hours
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 22) {
      threats.push({
        type: 'unusual_hours',
        severity: 'low',
        details: { loginHour: currentHour }
      });
    }

    // Process threats
    for (const threat of threats) {
      await this.processSecurityThreat(userId, threat, context);
    }
  }

  // Private helper methods

  private setupRateLimiting(): void {
    // Login attempts
    this.rateLimitConfigs.set('login', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 10,
      skipSuccessfulRequests: true,
      skipFailedRequests: false
    });

    // Password reset
    this.rateLimitConfigs.set('password_reset', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxAttempts: 3,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    });

    // MFA attempts
    this.rateLimitConfigs.set('mfa', {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxAttempts: 5,
      skipSuccessfulRequests: true,
      skipFailedRequests: false
    });

    // API calls per user
    this.rateLimitConfigs.set('api', {
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    });
  }

  private async validateSecurityContext(context: Partial<AuthContext>): Promise<void> {
    // IP-based restrictions
    if (this.defaultSecurityPolicy.allowedIpRanges?.length > 0) {
      const isAllowedIp = this.defaultSecurityPolicy.allowedIpRanges.some(range =>
        this.isIpInRange(context.ipAddress, range)
      );
      
      if (!isAllowedIp) {
        await this.auditService.logSecurityViolation(
          undefined,
          'ip_not_allowed',
          `IP address not in allowed ranges: ${context.ipAddress}`,
          { ipAddress: context.ipAddress, allowedRanges: this.defaultSecurityPolicy.allowedIpRanges }
        );
        throw new ForbiddenException('Access denied from this location');
      }
    }

    // Geographic restrictions would be implemented here
    // Device fingerprinting validation would be implemented here
  }

  private async checkAccountLockout(userId: string): Promise<void> {
    const lockoutKey = `lockout:${userId}`;
    const lockoutData = await this.redis.get(lockoutKey);
    
    if (lockoutData) {
      const { lockedUntil, failedAttempts } = JSON.parse(lockoutData);
      
      if (new Date() < new Date(lockedUntil)) {
        await this.auditService.logSecurityViolation(
          userId,
          'account_locked',
          'Attempted login on locked account',
          { failedAttempts, lockedUntil }
        );
        throw new ForbiddenException('Account is locked due to multiple failed attempts');
      }
    }
  }

  private async handleFailedLogin(userId: string, context: Partial<AuthContext>): Promise<void> {
    const failedKey = `failed_attempts:${userId}`;
    const attempts = await this.redis.incr(failedKey);
    
    if (attempts === 1) {
      await this.redis.expire(failedKey, 3600); // 1 hour window
    }

    if (attempts >= this.defaultSecurityPolicy.maxFailedAttempts) {
      // Lock account
      const lockoutUntil = new Date(Date.now() + this.defaultSecurityPolicy.lockoutDuration * 1000);
      await this.redis.setex(
        `lockout:${userId}`,
        this.defaultSecurityPolicy.lockoutDuration,
        JSON.stringify({
          lockedUntil: lockoutUntil,
          failedAttempts: attempts
        })
      );

      await this.auditService.logSecurityViolation(
        userId,
        'account_locked',
        'Account locked due to multiple failed login attempts',
        { failedAttempts: attempts, lockedUntil: lockoutUntil, ...context }
      );
    }

    await this.auditService.logAuthenticationEvent(
      userId,
      undefined,
      'login_failed',
      'failure',
      { failedAttempts: attempts, ...context }
    );
  }

  private async createMfaToken(user: any, context: Partial<AuthContext>): Promise<AuthTokens> {
    const mfaPayload = {
      userId: user._id.toString(),
      email: user.email,
      type: 'mfa_required',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
    };

    const mfaToken = this.jwtService.sign(mfaPayload, {
      secret: this.configService.get('auth.mfaSecret')
    });

    return {
      accessToken: mfaToken,
      refreshToken: '',
      expiresIn: 300,
      tokenType: 'mfa_required'
    };
  }

  private async createAuthTokens(
    user: any,
    sessionId: string,
    context: Partial<AuthContext>
  ): Promise<AuthTokens> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles || [],
      sessionId,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('auth.accessTokenExpiry', '15m')
    });

    const refreshToken = this.jwtService.sign(
      { sub: user._id.toString(), sessionId, type: 'refresh' },
      {
        secret: this.configService.get('auth.refreshTokenSecret'),
        expiresIn: this.configService.get('auth.refreshTokenExpiry', '7d')
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  private async saveUserSession(
    userId: string,
    sessionId: string,
    context: Partial<AuthContext>
  ): Promise<void> {
    const session = new this.sessionModel({
      sessionId,
      userId,
      email: context.email,
      roles: [],
      permissions: [],
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceId: context.deviceId,
      mfaVerified: context.mfaVerified || false,
      loginTime: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.defaultSecurityPolicy.sessionTimeout * 1000),
      active: true
    });

    await session.save();

    // Cache session for quick access
    await this.redis.setex(
      `session:${sessionId}`,
      this.defaultSecurityPolicy.sessionTimeout,
      JSON.stringify(session)
    );
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    await this.redis.del(`failed_attempts:${userId}`);
    await this.redis.del(`lockout:${userId}`);
  }

  private async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.mfaSecret) {
      return false;
    }

    // Decrypt secret
    const decryptedSecret = await this.encryptionService.decryptUserData(user.mfaSecret);
    
    // Verify TOTP code
    const totpValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (totpValid) {
      return true;
    }

    // Check backup codes
    if (user.mfaBackupCodes) {
      for (const encryptedBackupCode of user.mfaBackupCodes) {
        const backupCode = await this.encryptionService.decryptUserData(encryptedBackupCode);
        if (backupCode === code.toUpperCase()) {
          // Remove used backup code
          await this.userModel.findByIdAndUpdate(userId, {
            $pull: { mfaBackupCodes: encryptedBackupCode }
          });
          return true;
        }
      }
    }

    return false;
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    // Implementation would fetch user-specific permissions
    return [];
  }

  private async getRolePermissions(roles: any[]): Promise<string[]> {
    // Implementation would fetch role-based permissions
    return [];
  }

  private async evaluateAttributeBasedAccess(
    user: any,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<{ allowed: boolean; attributes: any }> {
    // Implementation of ABAC (Attribute-Based Access Control)
    // This would evaluate policies based on user attributes, resource attributes, and environmental attributes
    
    return {
      allowed: false,
      attributes: {}
    };
  }

  private async checkSessionSecurity(session: any): Promise<void> {
    // Check for session hijacking indicators
    // Implementation would include IP consistency checks, user agent validation, etc.
  }

  private async processSecurityThreat(userId: string, threat: any, context: any): Promise<void> {
    await this.auditService.logSecurityViolation(
      userId,
      threat.type,
      `Security threat detected: ${threat.type}`,
      {
        severity: threat.severity,
        threatDetails: threat.details,
        ...context
      }
    );

    // Implement threat response based on severity
    if (threat.severity === 'high' || threat.severity === 'critical') {
      // Could trigger additional security measures like forcing password reset
      // or temporarily locking the account
    }
  }

  private isIpInRange(ip: string, range: string): boolean {
    // Implementation of IP range checking (CIDR notation support)
    // This is a simplified version - production code would use a proper IP library
    return true; // Placeholder
  }
}
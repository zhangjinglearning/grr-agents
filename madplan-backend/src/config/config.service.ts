import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseConfig {
  uri: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    family: number;
    maxPoolSize: number;
    minPoolSize: number;
    maxIdleTimeMS: number;
    waitQueueTimeoutMS: number;
    retryWrites: boolean;
    readPreference?: string;
    readConcern?: string;
    writeConcern?: {
      w: string | number;
      j: boolean;
    };
  };
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  enableTestAccounts: boolean;
  requireEmailVerification: boolean;
  sessionTimeout: string;
  maxLoginAttempts?: number;
  lockoutDuration?: number;
}

export interface RedisConfig {
  enabled: boolean;
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix: string;
  defaultTTL: number;
  sessionTTL: number;
  queryTTL: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
}

export interface CorsConfig {
  origins: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  maxAge?: number;
}

export interface AppConfig {
  name: string;
  version: string;
  environment: string;
  port: number;
  host: string;
  debug: boolean;
  enableGraphQLPlayground: boolean;
  enableIntrospection: boolean;
  logLevel: string;
  enableCors: boolean;
}

@Injectable()
export class ConfigService {
  private config: any;

  constructor(private nestConfigService: NestConfigService) {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    const environment = this.nestConfigService.get('NODE_ENV', 'development');
    const configPath = path.join(process.cwd(), 'config', `${environment}.yaml`);

    try {
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        // Replace environment variables in the YAML content
        const processedContents = this.processEnvironmentVariables(fileContents);
        this.config = yaml.load(processedContents) as any;
        console.log(`✅ Configuration loaded from ${configPath}`);
      } else {
        console.warn(`⚠️  Configuration file not found: ${configPath}, using environment variables only`);
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      console.error(`❌ Error loading configuration from ${configPath}:`, error);
      this.config = this.getDefaultConfig();
    }
  }

  private processEnvironmentVariables(content: string): string {
    // Replace ${VARIABLE_NAME} with actual environment variable values
    return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = this.nestConfigService.get(varName);
      if (value === undefined) {
        console.warn(`⚠️  Environment variable ${varName} is not set, using placeholder`);
        return match; // Keep the placeholder if env var is not set
      }
      return value;
    });
  }

  private getDefaultConfig(): any {
    return {
      app: {
        name: 'MadPlan Backend',
        version: '1.0.0',
        environment: this.nestConfigService.get('NODE_ENV', 'development'),
        port: parseInt(this.nestConfigService.get('PORT', '3000'), 10),
        host: '0.0.0.0',
        debug: this.nestConfigService.get('NODE_ENV') === 'development',
        enableGraphQLPlayground: this.nestConfigService.get('NODE_ENV') === 'development',
        enableIntrospection: this.nestConfigService.get('NODE_ENV') !== 'production',
        logLevel: this.nestConfigService.get('LOG_LEVEL', 'info'),
        enableCors: true,
      },
      database: {
        uri: this.nestConfigService.get('MONGODB_URI', 'mongodb://localhost:27017/madplan'),
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4,
          maxPoolSize: 10,
          minPoolSize: 1,
          maxIdleTimeMS: 300000,
          waitQueueTimeoutMS: 5000,
          retryWrites: true,
        },
      },
      auth: {
        jwtSecret: this.nestConfigService.get('JWT_SECRET', 'development-secret'),
        jwtExpiresIn: '1h',
        refreshTokenExpiresIn: '7d',
        bcryptRounds: 10,
        enableTestAccounts: true,
        requireEmailVerification: false,
        sessionTimeout: '1h',
      },
      redis: {
        enabled: false,
        keyPrefix: 'madplan:',
        defaultTTL: 3600,
        sessionTTL: 3600,
        queryTTL: 300,
      },
      cors: {
        origins: ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    };
  }

  // Getter methods for different configuration sections
  get app(): AppConfig {
    return this.config.app;
  }

  get database(): DatabaseConfig {
    return this.config.database;
  }

  get auth(): AuthConfig {
    return this.config.auth;
  }

  get redis(): RedisConfig {
    return this.config.redis;
  }

  get cors(): CorsConfig {
    return this.config.cors;
  }

  // Environment helpers
  get isDevelopment(): boolean {
    return this.app.environment === 'development';
  }

  get isStaging(): boolean {
    return this.app.environment === 'staging';
  }

  get isProduction(): boolean {
    return this.app.environment === 'production';
  }

  // Convenience methods
  get(key: string, defaultValue?: any): any {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  // Security-related getters
  get jwtSecret(): string {
    const secret = this.auth.jwtSecret;
    if (!secret || secret === 'development-secret') {
      if (this.isProduction) {
        throw new Error('JWT_SECRET must be set in production environment');
      }
      console.warn('⚠️  Using default JWT secret - not suitable for production');
    }
    return secret;
  }

  get mongoUri(): string {
    const uri = this.database.uri;
    if (!uri || uri.includes('localhost')) {
      if (this.isProduction) {
        throw new Error('MONGODB_URI must be set to a production database in production environment');
      }
      if (this.isStaging) {
        console.warn('⚠️  Using localhost MongoDB in staging environment');
      }
    }
    return uri;
  }

  // Feature flag helpers
  isFeatureEnabled(feature: string): boolean {
    return this.get(`features.${feature}`, false);
  }

  // Environment-specific configurations
  getLoggingConfig() {
    return this.get('logging', {
      level: 'info',
      format: 'json',
      enableFileLogging: true,
      enableConsoleLogging: true,
    });
  }

  getMonitoringConfig() {
    return this.get('monitoring', {
      enabled: false,
      apm: { enabled: false },
      metrics: { enabled: false },
    });
  }

  getSecurityConfig() {
    return this.get('security', {
      helmet: {},
      trustProxy: false,
      requireHttps: false,
    });
  }

  getRateLimitConfig() {
    return this.get('rateLimit', {
      windowMs: 900000,
      max: 100,
      skipSuccessfulRequests: false,
    });
  }

  getUploadConfig() {
    return this.get('upload', {
      maxFileSize: 10485760,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      destination: './uploads',
    });
  }

  getHealthCheckConfig() {
    return this.get('healthCheck', {
      enabled: true,
      path: '/api/health',
      includeDatabase: true,
      includeRedis: false,
      timeout: 5000,
    });
  }

  // Validation methods
  validate(): void {
    const errors: string[] = [];

    // Validate required configurations
    if (!this.jwtSecret) {
      errors.push('JWT secret is required');
    }

    if (!this.mongoUri) {
      errors.push('MongoDB URI is required');
    }

    if (!this.app.port || isNaN(this.app.port)) {
      errors.push('Valid port number is required');
    }

    // Production-specific validations
    if (this.isProduction) {
      if (this.jwtSecret === 'development-secret') {
        errors.push('Production JWT secret cannot be the default development secret');
      }

      if (this.mongoUri.includes('localhost')) {
        errors.push('Production database cannot be localhost');
      }

      if (this.app.enableGraphQLPlayground) {
        errors.push('GraphQL Playground must be disabled in production');
      }

      if (this.app.enableIntrospection) {
        errors.push('GraphQL introspection must be disabled in production');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    console.log('✅ Configuration validation passed');
  }

  // Debug method
  getDebugInfo(): any {
    const debugConfig = { ...this.config };
    
    // Remove sensitive information for debug output
    if (debugConfig.auth) {
      debugConfig.auth.jwtSecret = '[REDACTED]';
    }
    
    if (debugConfig.database && debugConfig.database.uri) {
      debugConfig.database.uri = debugConfig.database.uri.replace(
        /mongodb:\/\/[^@]+@/,
        'mongodb://[CREDENTIALS]@'
      );
    }

    if (debugConfig.redis && debugConfig.redis.url) {
      debugConfig.redis.url = '[REDACTED]';
    }

    return {
      environment: this.app.environment,
      version: this.app.version,
      port: this.app.port,
      features: this.get('features', {}),
      config: debugConfig,
    };
  }
}
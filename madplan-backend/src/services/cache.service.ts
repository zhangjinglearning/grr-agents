import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PerformanceService } from './performance.service';

export interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  tags?: string[];
  compress?: boolean;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalOperations: number;
  avgResponseTime: number;
}

/**
 * Production-grade caching service with Redis
 * Implements multiple caching strategies and performance monitoring
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | any;
  private stats: CacheStats;
  private responseTimeHistory: number[] = [];

  constructor(
    private configService: ConfigService,
    private performanceService: PerformanceService,
  ) {
    this.initializeStats();
  }

  async onModuleInit() {
    await this.initializeRedis();
    this.startMetricsCollection();
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Initialize Redis connection with cluster support
   */
  private async initializeRedis() {
    const cacheConfig = this.configService.get('performance.redis');
    
    if (!cacheConfig.enabled) {
      this.logger.warn('Redis caching is disabled');
      return;
    }

    try {
      if (cacheConfig.cluster.enabled) {
        // Initialize Redis Cluster
        this.redis = new Redis.Cluster(cacheConfig.cluster.nodes, {
          ...cacheConfig.cluster.options,
          keyPrefix: cacheConfig.keyPrefix,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
        });

        this.logger.log('Initializing Redis Cluster connection');
      } else {
        // Initialize single Redis instance
        this.redis = new Redis({
          host: cacheConfig.host,
          port: cacheConfig.port,
          password: cacheConfig.password,
          db: cacheConfig.db,
          keyPrefix: cacheConfig.keyPrefix,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          ...cacheConfig.connectionPool,
        });

        this.logger.log('Initializing single Redis connection');
      }

      // Connect to Redis
      await this.redis.connect();
      
      // Set up event listeners
      this.redis.on('connect', () => {
        this.logger.log('Redis connection established');
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error', error);
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed');
      });

      this.logger.log('Redis cache service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Redis', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.redis) {
      return null;
    }

    const startTime = Date.now();
    
    try {
      const fullKey = this.buildKey(key, options.keyPrefix);
      const value = await this.redis.get(fullKey);
      
      const responseTime = Date.now() - startTime;
      this.trackResponseTime(responseTime);

      if (value === null) {
        this.stats.misses++;
        this.logger.debug(`Cache miss: ${fullKey}`);
        return null;
      }

      this.stats.hits++;
      this.logger.debug(`Cache hit: ${fullKey} (${responseTime}ms)`);

      // Deserialize if needed
      if (options.serialize !== false) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;

    } catch (error) {
      this.logger.error(`Cache get error for key ${key}`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    const startTime = Date.now();

    try {
      const fullKey = this.buildKey(key, options.keyPrefix);
      const ttl = options.ttl || this.getDefaultTTL();
      
      // Serialize if needed
      let serializedValue: string;
      if (options.serialize !== false) {
        serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      } else {
        serializedValue = value;
      }

      // Compress if requested
      if (options.compress && serializedValue.length > 1024) {
        // In a real implementation, you'd use a compression library
        this.logger.debug(`Compressing value for key: ${fullKey}`);
      }

      // Set with TTL
      await this.redis.setex(fullKey, ttl, serializedValue);
      
      // Add tags if specified
      if (options.tags && options.tags.length > 0) {
        await this.addTags(fullKey, options.tags);
      }

      const responseTime = Date.now() - startTime;
      this.trackResponseTime(responseTime);
      
      this.stats.sets++;
      this.logger.debug(`Cache set: ${fullKey} (${responseTime}ms, TTL: ${ttl}s)`);

      return true;

    } catch (error) {
      this.logger.error(`Cache set error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options.keyPrefix);
      const result = await this.redis.del(fullKey);
      
      this.stats.deletes++;
      this.logger.debug(`Cache delete: ${fullKey}`);

      return result > 0;

    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async deleteMany(keys: string[], options: CacheOptions = {}): Promise<number> {
    if (!this.redis || keys.length === 0) {
      return 0;
    }

    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.keyPrefix));
      const result = await this.redis.del(...fullKeys);
      
      this.stats.deletes += result;
      this.logger.debug(`Cache delete many: ${result} keys deleted`);

      return result;

    } catch (error) {
      this.logger.error('Cache delete many error', error);
      return 0;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.stats.deletes += result;
      
      this.logger.log(`Cache cleared by pattern: ${pattern} (${result} keys)`);
      
      return result;

    } catch (error) {
      this.logger.error(`Cache clear by pattern error: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Clear cache by tags
   */
  async clearByTags(tags: string[]): Promise<number> {
    if (!this.redis || tags.length === 0) {
      return 0;
    }

    try {
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = `tags:${tag}`;
        const keys = await this.redis.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          totalDeleted += deleted;
          
          // Remove the tag set itself
          await this.redis.del(tagKey);
        }
      }

      this.stats.deletes += totalDeleted;
      this.logger.log(`Cache cleared by tags: ${tags.join(', ')} (${totalDeleted} keys)`);

      return totalDeleted;

    } catch (error) {
      this.logger.error(`Cache clear by tags error: ${tags.join(', ')}`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options.keyPrefix);
      const result = await this.redis.exists(fullKey);
      
      return result === 1;

    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    if (!this.redis) {
      return -1;
    }

    try {
      const fullKey = this.buildKey(key, options.keyPrefix);
      return await this.redis.ttl(fullKey);

    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}`, error);
      return -1;
    }
  }

  /**
   * Extend TTL for key
   */
  async extend(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options.keyPrefix);
      const result = await this.redis.expire(fullKey, ttl);
      
      return result === 1;

    } catch (error) {
      this.logger.error(`Cache extend error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalOperations = this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes;
    const hitRate = totalOperations > 0 ? this.stats.hits / (this.stats.hits + this.stats.misses) : 0;
    const avgResponseTime = this.responseTimeHistory.length > 0 
      ? this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length
      : 0;

    return {
      ...this.stats,
      hitRate,
      totalOperations,
      avgResponseTime,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.initializeStats();
    this.responseTimeHistory = [];
  }

  /**
   * Cache decorator for methods
   */
  cache(options: CacheOptions & { keyGenerator?: (...args: any[]) => string } = {}) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheService = this.cacheService as CacheService;
        
        if (!cacheService) {
          return originalMethod.apply(this, args);
        }

        // Generate cache key
        let cacheKey: string;
        if (options.keyGenerator) {
          cacheKey = options.keyGenerator(...args);
        } else {
          const argsHash = crypto
            .createHash('md5')
            .update(JSON.stringify(args))
            .digest('hex');
          cacheKey = `${target.constructor.name}:${propertyName}:${argsHash}`;
        }

        // Try to get from cache
        const cachedResult = await cacheService.get(cacheKey, options);
        if (cachedResult !== null) {
          return cachedResult;
        }

        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Store in cache
        await cacheService.set(cacheKey, result, options);

        return result;
      };
    };
  }

  /**
   * Warming up cache with predefined data
   */
  async warmUp(warmUpData: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    if (!this.redis) {
      this.logger.warn('Cannot warm up cache: Redis not available');
      return;
    }

    this.logger.log(`Warming up cache with ${warmUpData.length} entries`);

    const promises = warmUpData.map(({ key, value, options }) =>
      this.set(key, value, options)
    );

    await Promise.all(promises);
    this.logger.log('Cache warm-up completed');
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    redis: boolean;
    hitRate: number;
    avgResponseTime: number;
    details: any;
  }> {
    const stats = this.getStats();
    
    let redisStatus = false;
    let redisInfo = {};

    try {
      if (this.redis) {
        const ping = await this.redis.ping();
        redisStatus = ping === 'PONG';
        
        if (this.redis instanceof Redis.Cluster) {
          redisInfo = { type: 'cluster', nodes: this.redis.nodes().length };
        } else {
          redisInfo = { type: 'single', connected: this.redis.status === 'ready' };
        }
      }
    } catch (error) {
      redisStatus = false;
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!redisStatus) {
      status = 'unhealthy';
    } else if (stats.hitRate < 0.5 || stats.avgResponseTime > 100) {
      status = 'degraded';
    }

    return {
      status,
      redis: redisStatus,
      hitRate: stats.hitRate,
      avgResponseTime: stats.avgResponseTime,
      details: {
        redis: redisInfo,
        stats,
        thresholds: {
          minHitRate: 0.5,
          maxResponseTime: 100,
        },
      },
    };
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.configService.get('performance.redis.keyPrefix', 'madplan:');
    return `${keyPrefix}${key}`;
  }

  /**
   * Get default TTL from configuration
   */
  private getDefaultTTL(): number {
    return this.configService.get('performance.caching.defaultTtl', 300);
  }

  /**
   * Add tags to cache key for invalidation
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const tagKey = `tags:${tag}`;
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, this.getDefaultTTL() * 2); // Tags live longer
      }
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error('Error adding cache tags', error);
    }
  }

  /**
   * Initialize cache statistics
   */
  private initializeStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalOperations: 0,
      avgResponseTime: 0,
    };
  }

  /**
   * Track response time for performance monitoring
   */
  private trackResponseTime(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);
    
    // Keep only the last 1000 response times
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory.shift();
    }

    // Report to performance service
    this.performanceService.recordMetric('cache.response_time', responseTime);
  }

  /**
   * Start metrics collection for monitoring
   */
  private startMetricsCollection(): void {
    // Report cache metrics every minute
    setInterval(() => {
      const stats = this.getStats();
      
      this.performanceService.recordMetric('cache.hit_rate', stats.hitRate);
      this.performanceService.recordMetric('cache.total_operations', stats.totalOperations);
      this.performanceService.recordMetric('cache.avg_response_time', stats.avgResponseTime);
      
      this.logger.debug('Cache metrics reported', {
        hitRate: stats.hitRate.toFixed(3),
        totalOps: stats.totalOperations,
        avgResponseTime: stats.avgResponseTime.toFixed(2),
      });
      
    }, 60000); // Every minute
  }
}
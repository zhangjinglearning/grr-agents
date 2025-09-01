import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PerformanceService } from './performance.service';

export interface QueryAnalysis {
  query: any;
  collection: string;
  executionTime: number;
  docsExamined: number;
  docsReturned: number;
  indexesUsed: string[];
  isOptimized: boolean;
  recommendations: string[];
}

export interface IndexRecommendation {
  collection: string;
  index: Record<string, number | string>;
  reason: string;
  estimatedImprovement: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ConnectionPoolStats {
  available: number;
  inUse: number;
  total: number;
  waitingQueue: number;
  utilization: number;
}

/**
 * Database optimization service for MongoDB
 * Provides query optimization, index management, and performance monitoring
 */
@Injectable()
export class DatabaseOptimizationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseOptimizationService.name);
  private queryHistory: QueryAnalysis[] = [];
  private slowQueries: QueryAnalysis[] = [];

  constructor(
    @InjectConnection() private connection: Connection,
    private configService: ConfigService,
    private performanceService: PerformanceService,
  ) {}

  async onModuleInit() {
    await this.initializeIndexes();
    this.startMonitoring();
  }

  /**
   * Initialize recommended indexes
   */
  private async initializeIndexes() {
    const indexConfig = this.configService.get('performance.database.queryOptimization.indexes');
    
    if (!indexConfig) {
      this.logger.warn('No index configuration found');
      return;
    }

    this.logger.log('Initializing database indexes...');

    try {
      for (const [collectionName, indexes] of Object.entries(indexConfig)) {
        const collection = this.connection.collection(collectionName);
        
        for (const indexSpec of indexes as any[]) {
          try {
            await collection.createIndex(indexSpec, {
              background: true,
              name: this.generateIndexName(indexSpec),
            });
            
            this.logger.log(`Created index for ${collectionName}: ${JSON.stringify(indexSpec)}`);
          } catch (error) {
            // Index might already exist
            if (!error.message.includes('already exists')) {
              this.logger.error(`Failed to create index for ${collectionName}`, error);
            }
          }
        }
      }

      this.logger.log('Database indexes initialization completed');

    } catch (error) {
      this.logger.error('Failed to initialize database indexes', error);
    }
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzeQuery(
    collection: string,
    query: any,
    options: any = {}
  ): Promise<QueryAnalysis> {
    const startTime = Date.now();

    try {
      // Execute explain plan
      const db = this.connection.db;
      const explainResult = await db.collection(collection)
        .find(query, options)
        .explain('executionStats');

      const executionTime = Date.now() - startTime;
      const stats = explainResult.executionStats;

      // Analyze the execution plan
      const analysis: QueryAnalysis = {
        query,
        collection,
        executionTime,
        docsExamined: stats.docsExamined || 0,
        docsReturned: stats.docsReturned || 0,
        indexesUsed: this.extractIndexesUsed(explainResult),
        isOptimized: this.isQueryOptimized(stats),
        recommendations: this.generateQueryRecommendations(stats, query, collection),
      };

      // Store query history
      this.queryHistory.push(analysis);
      if (this.queryHistory.length > 1000) {
        this.queryHistory = this.queryHistory.slice(-500);
      }

      // Track slow queries
      const slowQueryThreshold = this.configService.get(
        'performance.database.queryOptimization.monitoring.slowQueryThresholdMs',
        100
      );

      if (executionTime > slowQueryThreshold) {
        this.slowQueries.push(analysis);
        if (this.slowQueries.length > 100) {
          this.slowQueries = this.slowQueries.slice(-50);
        }

        this.logger.warn('Slow query detected', {
          collection,
          executionTime,
          docsExamined: analysis.docsExamined,
          docsReturned: analysis.docsReturned,
          query: JSON.stringify(query),
        });
      }

      // Record performance metrics
      this.performanceService.recordDatabaseQuery(
        'find',
        collection,
        executionTime,
        analysis.docsReturned,
        false
      );

      return analysis;

    } catch (error) {
      this.logger.error(`Query analysis failed for collection ${collection}`, error);
      
      // Record error metrics
      this.performanceService.recordDatabaseQuery(
        'find',
        collection,
        Date.now() - startTime,
        0,
        true
      );

      throw error;
    }
  }

  /**
   * Get index recommendations based on query patterns
   */
  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Analyze query history for patterns
    const queryPatterns = this.analyzeQueryPatterns();

    for (const pattern of queryPatterns) {
      const recommendation = this.generateIndexRecommendation(pattern);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Check for missing indexes on frequently queried fields
    const frequentFields = this.getFrequentlyQueriedFields();
    for (const field of frequentFields) {
      const hasIndex = await this.hasIndexOnField(field.collection, field.field);
      
      if (!hasIndex && field.frequency > 10) {
        recommendations.push({
          collection: field.collection,
          index: { [field.field]: 1 },
          reason: `Field '${field.field}' is queried frequently (${field.frequency} times) but has no index`,
          estimatedImprovement: 'High',
          priority: field.frequency > 50 ? 'high' : 'medium',
        });
      }
    }

    return recommendations;
  }

  /**
   * Optimize collection by creating recommended indexes
   */
  async optimizeCollection(collectionName: string): Promise<{
    indexesCreated: number;
    improvements: string[];
  }> {
    this.logger.log(`Optimizing collection: ${collectionName}`);

    const recommendations = (await this.getIndexRecommendations())
      .filter(rec => rec.collection === collectionName);

    let indexesCreated = 0;
    const improvements: string[] = [];

    for (const recommendation of recommendations) {
      try {
        const collection = this.connection.collection(collectionName);
        const indexName = this.generateIndexName(recommendation.index);

        await collection.createIndex(recommendation.index, {
          background: true,
          name: indexName,
        });

        indexesCreated++;
        improvements.push(`Created index: ${indexName} - ${recommendation.reason}`);

        this.logger.log(`Created recommended index for ${collectionName}: ${JSON.stringify(recommendation.index)}`);

      } catch (error) {
        this.logger.error(`Failed to create recommended index for ${collectionName}`, error);
      }
    }

    // Analyze existing indexes for redundancy
    const redundantIndexes = await this.findRedundantIndexes(collectionName);
    
    for (const redundantIndex of redundantIndexes) {
      try {
        const collection = this.connection.collection(collectionName);
        await collection.dropIndex(redundantIndex.name);
        improvements.push(`Removed redundant index: ${redundantIndex.name}`);
        
        this.logger.log(`Removed redundant index: ${redundantIndex.name}`);
        
      } catch (error) {
        this.logger.error(`Failed to remove redundant index: ${redundantIndex.name}`, error);
      }
    }

    return {
      indexesCreated,
      improvements,
    };
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): ConnectionPoolStats {
    // Note: This is a simplified version. In a real implementation,
    // you'd get actual connection pool stats from MongoDB driver
    const poolSize = this.configService.get('performance.database.mongodb.connectionPool.maxPoolSize', 100);
    
    return {
      available: Math.floor(poolSize * 0.8),
      inUse: Math.floor(poolSize * 0.2),
      total: poolSize,
      waitingQueue: 0,
      utilization: 0.2,
    };
  }

  /**
   * Get slow query report
   */
  getSlowQueryReport(): {
    totalSlowQueries: number;
    slowestQuery: QueryAnalysis | null;
    commonSlowPatterns: Array<{
      pattern: string;
      count: number;
      avgTime: number;
    }>;
    recommendations: string[];
  } {
    if (this.slowQueries.length === 0) {
      return {
        totalSlowQueries: 0,
        slowestQuery: null,
        commonSlowPatterns: [],
        recommendations: [],
      };
    }

    // Find slowest query
    const slowestQuery = this.slowQueries.reduce((slowest, current) =>
      current.executionTime > slowest.executionTime ? current : slowest
    );

    // Analyze common slow patterns
    const patternGroups = this.slowQueries.reduce((groups, query) => {
      const pattern = this.getQueryPattern(query.query);
      
      if (!groups[pattern]) {
        groups[pattern] = [];
      }
      
      groups[pattern].push(query);
      return groups;
    }, {} as Record<string, QueryAnalysis[]>);

    const commonSlowPatterns = Object.entries(patternGroups)
      .map(([pattern, queries]) => ({
        pattern,
        count: queries.length,
        avgTime: queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate recommendations
    const recommendations = [
      ...new Set(
        this.slowQueries.flatMap(query => query.recommendations)
      )
    ];

    return {
      totalSlowQueries: this.slowQueries.length,
      slowestQuery,
      commonSlowPatterns,
      recommendations,
    };
  }

  /**
   * Get database performance summary
   */
  async getPerformanceSummary() {
    const connectionStats = this.getConnectionPoolStats();
    const slowQueryReport = this.getSlowQueryReport();
    const indexRecommendations = await this.getIndexRecommendations();

    const recentQueries = this.queryHistory.filter(
      query => query.executionTime > Date.now() - 3600000 // Last hour
    );

    const avgQueryTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length
      : 0;

    const queryEfficiency = recentQueries.length > 0
      ? recentQueries.filter(q => q.isOptimized).length / recentQueries.length
      : 0;

    return {
      connection: {
        pool: connectionStats,
        status: this.connection.readyState === 1 ? 'connected' : 'disconnected',
      },
      queries: {
        totalAnalyzed: this.queryHistory.length,
        averageTime: avgQueryTime,
        efficiency: queryEfficiency,
        slowQueries: slowQueryReport.totalSlowQueries,
      },
      optimization: {
        indexRecommendations: indexRecommendations.length,
        highPriorityRecommendations: indexRecommendations.filter(r => r.priority === 'high').length,
      },
      recommendations: [
        ...slowQueryReport.recommendations.slice(0, 3),
        ...indexRecommendations.slice(0, 3).map(r => r.reason),
      ],
    };
  }

  /**
   * Start database monitoring
   */
  private startMonitoring() {
    // Monitor connection pool every minute
    setInterval(() => {
      const stats = this.getConnectionPoolStats();
      
      this.performanceService.recordMetric('db.connection_pool.available', stats.available);
      this.performanceService.recordMetric('db.connection_pool.in_use', stats.inUse);
      this.performanceService.recordMetric('db.connection_pool.utilization', stats.utilization);
      
    }, 60000);

    // Report slow queries every 5 minutes
    setInterval(() => {
      const slowQueryReport = this.getSlowQueryReport();
      
      this.performanceService.recordMetric('db.slow_queries.count', slowQueryReport.totalSlowQueries);
      
      if (slowQueryReport.slowestQuery) {
        this.performanceService.recordMetric(
          'db.slowest_query.time',
          slowQueryReport.slowestQuery.executionTime
        );
      }
      
    }, 300000);
  }

  /**
   * Extract indexes used from explain plan
   */
  private extractIndexesUsed(explainResult: any): string[] {
    const indexes: string[] = [];
    
    if (explainResult.queryPlanner?.winningPlan?.inputStage?.indexName) {
      indexes.push(explainResult.queryPlanner.winningPlan.inputStage.indexName);
    }

    return indexes;
  }

  /**
   * Check if query is optimized
   */
  private isQueryOptimized(stats: any): boolean {
    // A query is considered optimized if:
    // 1. It uses an index (docsExamined ~= docsReturned)
    // 2. It doesn't examine too many documents relative to what it returns
    
    const examineToReturnRatio = stats.docsReturned > 0 
      ? stats.docsExamined / stats.docsReturned 
      : stats.docsExamined;

    return examineToReturnRatio <= 10; // Arbitrary threshold
  }

  /**
   * Generate query optimization recommendations
   */
  private generateQueryRecommendations(stats: any, query: any, collection: string): string[] {
    const recommendations: string[] = [];

    // Check examine-to-return ratio
    const examineToReturnRatio = stats.docsReturned > 0 
      ? stats.docsExamined / stats.docsReturned 
      : stats.docsExamined;

    if (examineToReturnRatio > 10) {
      recommendations.push(`High examine-to-return ratio (${examineToReturnRatio.toFixed(1)}). Consider adding an index.`);
    }

    // Check for missing indexes
    if (stats.docsExamined > 1000 && stats.docsReturned < 100) {
      recommendations.push('Query examines many documents but returns few. Create an index on query fields.');
    }

    // Check for inefficient operators
    if (query.$regex && !query.$regex.startsWith('^')) {
      recommendations.push('Regex query without anchor (^) cannot use index efficiently.');
    }

    if (query.$where) {
      recommendations.push('$where operator cannot use indexes. Consider rewriting query.');
    }

    // Check for sort without index
    if (stats.executionStats?.sortPattern && !stats.executionStats.inputStage?.indexName) {
      recommendations.push('Sort operation without index. Consider creating compound index.');
    }

    return recommendations;
  }

  /**
   * Analyze query patterns from history
   */
  private analyzeQueryPatterns() {
    const patterns = new Map();

    for (const query of this.queryHistory) {
      const pattern = this.getQueryPattern(query.query);
      
      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          pattern,
          queries: [],
          collection: query.collection,
        });
      }

      patterns.get(pattern).queries.push(query);
    }

    return Array.from(patterns.values());
  }

  /**
   * Get query pattern for analysis
   */
  private getQueryPattern(query: any): string {
    // Simplify query to pattern by replacing values with types
    const pattern = JSON.stringify(query, (key, value) => {
      if (typeof value === 'string') return '<string>';
      if (typeof value === 'number') return '<number>';
      if (typeof value === 'boolean') return '<boolean>';
      if (value instanceof Date) return '<date>';
      if (Array.isArray(value)) return '<array>';
      return value;
    });

    return pattern;
  }

  /**
   * Generate index recommendation from query pattern
   */
  private generateIndexRecommendation(pattern: any): IndexRecommendation | null {
    const queries = pattern.queries;
    
    if (queries.length < 5) {
      return null; // Not frequent enough
    }

    const slowQueries = queries.filter(q => !q.isOptimized);
    
    if (slowQueries.length === 0) {
      return null; // Already optimized
    }

    // Extract common fields from query pattern
    const commonFields = this.extractCommonFields(pattern.pattern);
    
    if (commonFields.length === 0) {
      return null;
    }

    const index = commonFields.reduce((idx, field) => {
      idx[field] = 1; // Ascending index
      return idx;
    }, {} as Record<string, number>);

    return {
      collection: pattern.collection,
      index,
      reason: `Query pattern appears ${queries.length} times, ${slowQueries.length} are not optimized`,
      estimatedImprovement: slowQueries.length > queries.length / 2 ? 'High' : 'Medium',
      priority: slowQueries.length > 10 ? 'high' : 'medium',
    };
  }

  /**
   * Extract common query fields from pattern
   */
  private extractCommonFields(pattern: string): string[] {
    try {
      const queryObj = JSON.parse(pattern);
      return Object.keys(queryObj).filter(key => key !== '$and' && key !== '$or');
    } catch {
      return [];
    }
  }

  /**
   * Get frequently queried fields
   */
  private getFrequentlyQueriedFields(): Array<{
    collection: string;
    field: string;
    frequency: number;
  }> {
    const fieldCounts = new Map();

    for (const query of this.queryHistory) {
      const fields = this.extractQueryFields(query.query);
      
      for (const field of fields) {
        const key = `${query.collection}.${field}`;
        fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
      }
    }

    return Array.from(fieldCounts.entries())
      .map(([key, frequency]) => {
        const [collection, field] = key.split('.');
        return { collection, field, frequency };
      })
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract fields from query object
   */
  private extractQueryFields(query: any, prefix = ''): string[] {
    const fields: string[] = [];

    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) {
        // Skip operators, but process their values
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'object') {
              fields.push(...this.extractQueryFields(item, prefix));
            }
          }
        }
        continue;
      }

      const fieldName = prefix ? `${prefix}.${key}` : key;
      fields.push(fieldName);

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        fields.push(...this.extractQueryFields(value, fieldName));
      }
    }

    return fields;
  }

  /**
   * Check if collection has index on field
   */
  private async hasIndexOnField(collectionName: string, field: string): Promise<boolean> {
    try {
      const collection = this.connection.collection(collectionName);
      const indexes = await collection.indexes();
      
      return indexes.some(index => 
        index.key && Object.prototype.hasOwnProperty.call(index.key, field)
      );
    } catch {
      return false;
    }
  }

  /**
   * Find redundant indexes
   */
  private async findRedundantIndexes(collectionName: string): Promise<Array<{ name: string; reason: string }>> {
    try {
      const collection = this.connection.collection(collectionName);
      const indexes = await collection.indexes();
      const redundant: Array<{ name: string; reason: string }> = [];

      // Simple redundancy check: if an index is a prefix of another
      for (let i = 0; i < indexes.length; i++) {
        for (let j = i + 1; j < indexes.length; j++) {
          const index1 = indexes[i];
          const index2 = indexes[j];

          if (this.isIndexRedundant(index1, index2)) {
            redundant.push({
              name: index1.name,
              reason: `Redundant with index ${index2.name}`,
            });
          }
        }
      }

      return redundant;
    } catch {
      return [];
    }
  }

  /**
   * Check if one index is redundant compared to another
   */
  private isIndexRedundant(index1: any, index2: any): boolean {
    const keys1 = Object.keys(index1.key || {});
    const keys2 = Object.keys(index2.key || {});

    // Check if index1 is a prefix of index2
    if (keys1.length >= keys2.length) {
      return false;
    }

    return keys1.every((key, i) => keys2[i] === key);
  }

  /**
   * Generate index name from index specification
   */
  private generateIndexName(indexSpec: Record<string, any>): string {
    return Object.entries(indexSpec)
      .map(([key, direction]) => `${key}_${direction}`)
      .join('_');
  }
}
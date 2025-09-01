import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudWatch } from 'aws-sdk';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceBudget {
  metric: string;
  threshold: number;
  operator: 'lt' | 'gt' | 'eq';
  severity: 'warning' | 'error';
}

export interface PerformanceReport {
  timestamp: Date;
  summary: {
    responseTime: {
      p50: number;
      p90: number;
      p99: number;
    };
    throughput: number;
    errorRate: number;
    cacheHitRate: number;
  };
  budgetViolations: Array<{
    budget: PerformanceBudget;
    actualValue: number;
    severity: string;
  }>;
  recommendations: string[];
}

/**
 * Performance monitoring and optimization service
 * Tracks metrics, monitors budgets, and provides performance insights
 */
@Injectable()
export class PerformanceService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceService.name);
  private cloudWatch: CloudWatch;
  private metrics: PerformanceMetric[] = [];
  private budgets: PerformanceBudget[] = [];
  private responseTimeHistory: number[] = [];
  private throughputHistory: number[] = [];
  private errorHistory: number[] = [];

  constructor(private configService: ConfigService) {
    this.initializeCloudWatch();
    this.initializePerformanceBudgets();
  }

  async onModuleInit() {
    this.startMetricsCollection();
    this.startBudgetMonitoring();
  }

  /**
   * Initialize CloudWatch for metrics reporting
   */
  private initializeCloudWatch() {
    const region = this.configService.get('AWS_REGION');
    this.cloudWatch = new CloudWatch({ region });
  }

  /**
   * Initialize performance budgets from configuration
   */
  private initializePerformanceBudgets() {
    const budgetConfig = this.configService.get('performance.monitoring.budgets');
    
    this.budgets = [
      // API response time budgets
      {
        metric: 'api.response_time.p50',
        threshold: budgetConfig.apiResponseTime.p50,
        operator: 'lt',
        severity: 'warning',
      },
      {
        metric: 'api.response_time.p90',
        threshold: budgetConfig.apiResponseTime.p90,
        operator: 'lt',
        severity: 'warning',
      },
      {
        metric: 'api.response_time.p99',
        threshold: budgetConfig.apiResponseTime.p99,
        operator: 'lt',
        severity: 'error',
      },
      
      // Database query time budgets
      {
        metric: 'db.query_time.p50',
        threshold: budgetConfig.dbQueryTime.p50,
        operator: 'lt',
        severity: 'warning',
      },
      {
        metric: 'db.query_time.p90',
        threshold: budgetConfig.dbQueryTime.p90,
        operator: 'lt',
        severity: 'warning',
      },
      {
        metric: 'db.query_time.p99',
        threshold: budgetConfig.dbQueryTime.p99,
        operator: 'lt',
        severity: 'error',
      },
      
      // Cache response time budgets
      {
        metric: 'cache.response_time.p50',
        threshold: budgetConfig.cacheResponseTime.p50,
        operator: 'lt',
        severity: 'warning',
      },
      {
        metric: 'cache.response_time.p90',
        threshold: budgetConfig.cacheResponseTime.p90,
        operator: 'lt',
        severity: 'warning',
      },
      {
        metric: 'cache.response_time.p99',
        threshold: budgetConfig.cacheResponseTime.p99,
        operator: 'lt',
        severity: 'error',
      },
    ];

    this.logger.log(`Initialized ${this.budgets.length} performance budgets`);
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string = 'Count', tags?: Record<string, string>) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics in memory (last 10,000)
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }

    // Track specific metrics for trend analysis
    if (name.includes('response_time')) {
      this.responseTimeHistory.push(value);
      if (this.responseTimeHistory.length > 1000) {
        this.responseTimeHistory.shift();
      }
    }

    if (name.includes('throughput')) {
      this.throughputHistory.push(value);
      if (this.throughputHistory.length > 1000) {
        this.throughputHistory.shift();
      }
    }

    if (name.includes('error')) {
      this.errorHistory.push(value);
      if (this.errorHistory.length > 1000) {
        this.errorHistory.shift();
      }
    }

    this.logger.debug(`Recorded metric: ${name} = ${value} ${unit}`, tags);
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    requestSize?: number,
    responseSize?: number
  ) {
    const tags = {
      method,
      path: this.sanitizePath(path),
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };

    this.recordMetric('http.request_count', 1, 'Count', tags);
    this.recordMetric('http.response_time', responseTime, 'Milliseconds', tags);
    
    if (requestSize) {
      this.recordMetric('http.request_size', requestSize, 'Bytes', tags);
    }
    
    if (responseSize) {
      this.recordMetric('http.response_size', responseSize, 'Bytes', tags);
    }

    // Record error metrics
    if (statusCode >= 400) {
      this.recordMetric('http.error_count', 1, 'Count', tags);
    }

    // Record success metrics
    if (statusCode >= 200 && statusCode < 300) {
      this.recordMetric('http.success_count', 1, 'Count', tags);
    }
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(
    operation: string,
    collection: string,
    duration: number,
    recordCount?: number,
    error?: boolean
  ) {
    const tags = {
      operation,
      collection,
      status: error ? 'error' : 'success',
    };

    this.recordMetric('db.query_count', 1, 'Count', tags);
    this.recordMetric('db.query_time', duration, 'Milliseconds', tags);
    
    if (recordCount !== undefined) {
      this.recordMetric('db.records_processed', recordCount, 'Count', tags);
    }

    if (error) {
      this.recordMetric('db.error_count', 1, 'Count', tags);
    }

    // Log slow queries
    const slowQueryThreshold = this.configService.get(
      'performance.database.queryOptimization.monitoring.slowQueryThresholdMs',
      100
    );
    
    if (duration > slowQueryThreshold) {
      this.logger.warn(`Slow database query detected`, {
        operation,
        collection,
        duration,
        threshold: slowQueryThreshold,
      });
      
      this.recordMetric('db.slow_query_count', 1, 'Count', tags);
    }
  }

  /**
   * Calculate percentiles from array of values
   */
  private calculatePercentiles(values: number[]): { p50: number; p75: number; p90: number; p95: number; p99: number } {
    if (values.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)] || 0,
      p75: sorted[Math.floor(len * 0.75)] || 0,
      p90: sorted[Math.floor(len * 0.9)] || 0,
      p95: sorted[Math.floor(len * 0.95)] || 0,
      p99: sorted[Math.floor(len * 0.99)] || 0,
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(timeRange?: { start: Date; end: Date }): PerformanceMetric[] {
    let filteredMetrics = this.metrics;

    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    return filteredMetrics;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): PerformanceReport {
    const now = new Date();
    const responseTimePercentiles = this.calculatePercentiles(this.responseTimeHistory);
    
    // Calculate throughput (requests per second over last minute)
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentRequests = this.metrics.filter(
      metric => metric.name === 'http.request_count' && metric.timestamp >= oneMinuteAgo
    );
    const throughput = recentRequests.reduce((sum, metric) => sum + metric.value, 0);

    // Calculate error rate
    const recentErrors = this.metrics.filter(
      metric => metric.name === 'http.error_count' && metric.timestamp >= oneMinuteAgo
    );
    const totalErrors = recentErrors.reduce((sum, metric) => sum + metric.value, 0);
    const errorRate = recentRequests.length > 0 ? totalErrors / recentRequests.length : 0;

    // Calculate cache hit rate
    const cacheHits = this.metrics.filter(
      metric => metric.name === 'cache.hits' && metric.timestamp >= oneMinuteAgo
    );
    const cacheMisses = this.metrics.filter(
      metric => metric.name === 'cache.misses' && metric.timestamp >= oneMinuteAgo
    );
    const totalCacheRequests = cacheHits.length + cacheMisses.length;
    const cacheHitRate = totalCacheRequests > 0 ? cacheHits.length / totalCacheRequests : 0;

    // Check budget violations
    const budgetViolations = this.checkBudgetViolations({
      'api.response_time.p50': responseTimePercentiles.p50,
      'api.response_time.p90': responseTimePercentiles.p90,
      'api.response_time.p99': responseTimePercentiles.p99,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      responseTime: responseTimePercentiles,
      throughput,
      errorRate,
      cacheHitRate,
      budgetViolations,
    });

    return {
      timestamp: now,
      summary: {
        responseTime: {
          p50: responseTimePercentiles.p50,
          p90: responseTimePercentiles.p90,
          p99: responseTimePercentiles.p99,
        },
        throughput,
        errorRate,
        cacheHitRate,
      },
      budgetViolations,
      recommendations,
    };
  }

  /**
   * Check performance budget violations
   */
  private checkBudgetViolations(currentValues: Record<string, number>) {
    const violations: Array<{
      budget: PerformanceBudget;
      actualValue: number;
      severity: string;
    }> = [];

    for (const budget of this.budgets) {
      const actualValue = currentValues[budget.metric];
      
      if (actualValue === undefined) {
        continue;
      }

      let violated = false;
      
      switch (budget.operator) {
        case 'lt':
          violated = actualValue >= budget.threshold;
          break;
        case 'gt':
          violated = actualValue <= budget.threshold;
          break;
        case 'eq':
          violated = actualValue !== budget.threshold;
          break;
      }

      if (violated) {
        violations.push({
          budget,
          actualValue,
          severity: budget.severity,
        });
      }
    }

    return violations;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(data: {
    responseTime: any;
    throughput: number;
    errorRate: number;
    cacheHitRate: number;
    budgetViolations: any[];
  }): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (data.responseTime.p99 > 1000) {
      recommendations.push('High P99 response time detected. Consider optimizing slow endpoints or adding caching.');
    }
    
    if (data.responseTime.p50 > 200) {
      recommendations.push('Median response time is high. Review database queries and API logic.');
    }

    // Cache recommendations
    if (data.cacheHitRate < 0.7) {
      recommendations.push('Cache hit rate is low. Review caching strategy and TTL settings.');
    }

    // Error rate recommendations
    if (data.errorRate > 0.05) {
      recommendations.push('High error rate detected. Review error logs and implement proper error handling.');
    }

    // Throughput recommendations
    if (data.throughput < 10) {
      recommendations.push('Low throughput detected. Consider load balancing or horizontal scaling.');
    }

    // Budget violation recommendations
    if (data.budgetViolations.length > 0) {
      const criticalViolations = data.budgetViolations.filter(v => v.severity === 'error');
      if (criticalViolations.length > 0) {
        recommendations.push('Critical performance budget violations detected. Immediate optimization required.');
      }
    }

    return recommendations;
  }

  /**
   * Send metrics to CloudWatch
   */
  private async sendMetricsToCloudWatch() {
    if (!this.cloudWatch) {
      return;
    }

    try {
      const namespace = this.configService.get('performance.monitoring.metrics.namespace', 'MadPlan/Production');
      const recentMetrics = this.metrics.filter(
        metric => metric.timestamp > new Date(Date.now() - 60000) // Last minute
      );

      if (recentMetrics.length === 0) {
        return;
      }

      // Group metrics by name for batch sending
      const metricGroups = recentMetrics.reduce((groups, metric) => {
        if (!groups[metric.name]) {
          groups[metric.name] = [];
        }
        groups[metric.name].push(metric);
        return groups;
      }, {} as Record<string, PerformanceMetric[]>);

      // Send metrics in batches
      for (const [metricName, metrics] of Object.entries(metricGroups)) {
        const metricData = metrics.map(metric => ({
          MetricName: metricName,
          Value: metric.value,
          Unit: metric.unit as any,
          Timestamp: metric.timestamp,
          Dimensions: metric.tags ? Object.entries(metric.tags).map(([Name, Value]) => ({ Name, Value })) : [],
        }));

        await this.cloudWatch.putMetricData({
          Namespace: namespace,
          MetricData: metricData,
        }).promise();
      }

      this.logger.debug(`Sent ${recentMetrics.length} metrics to CloudWatch`);

    } catch (error) {
      this.logger.error('Failed to send metrics to CloudWatch', error);
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection() {
    // Collect system metrics every 30 seconds
    setInterval(async () => {
      try {
        // Collect Node.js process metrics
        const memUsage = process.memoryUsage();
        this.recordMetric('system.memory.used', memUsage.heapUsed, 'Bytes');
        this.recordMetric('system.memory.total', memUsage.heapTotal, 'Bytes');
        this.recordMetric('system.memory.external', memUsage.external, 'Bytes');

        // Collect CPU usage (simplified)
        const cpuUsage = process.cpuUsage();
        this.recordMetric('system.cpu.user', cpuUsage.user / 1000, 'Milliseconds');
        this.recordMetric('system.cpu.system', cpuUsage.system / 1000, 'Milliseconds');

        // Event loop lag
        const start = process.hrtime.bigint();
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
          this.recordMetric('system.event_loop_lag', lag, 'Milliseconds');
        });

      } catch (error) {
        this.logger.error('Error collecting system metrics', error);
      }
    }, 30000);

    // Send metrics to CloudWatch every minute
    setInterval(() => {
      this.sendMetricsToCloudWatch().catch(error => {
        this.logger.error('Error sending metrics to CloudWatch', error);
      });
    }, 60000);
  }

  /**
   * Start performance budget monitoring
   */
  private startBudgetMonitoring() {
    // Check budgets every 5 minutes
    setInterval(() => {
      const summary = this.getPerformanceSummary();
      
      if (summary.budgetViolations.length > 0) {
        this.logger.warn(`Performance budget violations detected`, {
          violations: summary.budgetViolations.length,
          critical: summary.budgetViolations.filter(v => v.severity === 'error').length,
        });

        // Send alerts for critical violations
        const criticalViolations = summary.budgetViolations.filter(v => v.severity === 'error');
        if (criticalViolations.length > 0) {
          this.sendPerformanceAlert(criticalViolations);
        }
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Send performance alert
   */
  private async sendPerformanceAlert(violations: any[]) {
    // In a real implementation, this would send alerts via SNS, Slack, etc.
    this.logger.error('Critical performance budget violations', {
      violations: violations.map(v => ({
        metric: v.budget.metric,
        threshold: v.budget.threshold,
        actual: v.actualValue,
        severity: v.severity,
      })),
    });
  }

  /**
   * Sanitize URL path for metrics (remove IDs and parameters)
   */
  private sanitizePath(path: string): string {
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[0-9a-f-]{36}/g, '/:uuid')
      .replace(/\/[0-9a-f]{24}/g, '/:objectid')
      .split('?')[0]; // Remove query parameters
  }
}
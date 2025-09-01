import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from '../schemas/error-log.schema';
import { ErrorPattern, ErrorPatternDocument } from '../schemas/error-pattern.schema';

export interface ErrorAnalysisResult {
  errorId: string;
  pattern: string;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers: number;
  commonContext: Record<string, any>;
  recommendations: string[];
  relatedErrors: string[];
}

export interface ErrorTrendData {
  period: string;
  errorCount: number;
  uniqueErrors: number;
  affectedUsers: number;
  severityBreakdown: Record<string, number>;
}

@Injectable()
export class ErrorAnalysisService {
  private readonly logger = new Logger(ErrorAnalysisService.name);

  constructor(
    @InjectModel(ErrorLog.name)
    private readonly errorLogModel: Model<ErrorLogDocument>,
    @InjectModel(ErrorPattern.name)
    private readonly errorPatternModel: Model<ErrorPatternDocument>,
  ) {}

  async analyzeError(errorId: string): Promise<ErrorAnalysisResult> {
    try {
      const error = await this.errorLogModel.findById(errorId);
      if (!error) {
        throw new Error(`Error not found: ${errorId}`);
      }

      // Find or create error pattern
      let pattern = await this.errorPatternModel.findOne({
        fingerprint: error.fingerprint,
      });

      if (!pattern) {
        pattern = await this.createErrorPattern(error) as any;
      }

      // Get related errors
      const relatedErrors = await this.findRelatedErrors(error);

      // Analyze frequency and trend
      const frequencyData = await this.analyzeFrequency(error.fingerprint);

      // Get affected users
      const affectedUsers = await this.getAffectedUsers(error.fingerprint);

      // Extract common context
      const commonContext = await this.extractCommonContext(error.fingerprint);

      // Generate recommendations
      const recommendations = this.generateRecommendations(error, pattern, frequencyData);

      return {
        errorId,
        pattern: pattern.pattern,
        frequency: frequencyData.frequency,
        trend: frequencyData.trend,
        severity: this.calculateSeverity(frequencyData, affectedUsers.length),
        affectedUsers: affectedUsers.length,
        commonContext,
        recommendations,
        relatedErrors: relatedErrors.map(e => e._id.toString()),
      };
    } catch (error) {
      this.logger.error(`Failed to analyze error: ${errorId}`, error);
      throw error;
    }
  }

  async getErrorTrends(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' = 'day',
  ): Promise<ErrorTrendData[]> {
    try {
      const formatMap = {
        hour: '%Y-%m-%d %H:00',
        day: '%Y-%m-%d',
        week: '%Y-%U',
      };

      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              period: {
                $dateToString: {
                  format: formatMap[groupBy],
                  date: '$timestamp',
                },
              },
              severity: '$severity',
            },
            errorCount: { $sum: 1 },
            uniqueErrors: { $addToSet: '$fingerprint' },
            affectedUsers: { $addToSet: '$userId' },
          },
        },
        {
          $group: {
            _id: '$_id.period',
            totalErrors: { $sum: '$errorCount' },
            uniqueErrors: { $addToSet: '$uniqueErrors' },
            affectedUsers: { $addToSet: '$affectedUsers' },
            severityBreakdown: {
              $push: {
                severity: '$_id.severity',
                count: '$errorCount',
              },
            },
          },
        },
        {
          $project: {
            period: '$_id',
            errorCount: '$totalErrors',
            uniqueErrors: {
              $size: {
                $reduce: {
                  input: '$uniqueErrors',
                  initialValue: [],
                  in: { $setUnion: ['$$value', '$$this'] },
                },
              },
            },
            affectedUsers: {
              $size: {
                $reduce: {
                  input: '$affectedUsers',
                  initialValue: [],
                  in: { $setUnion: ['$$value', '$$this'] },
                },
              },
            },
            severityBreakdown: {
              $arrayToObject: {
                $map: {
                  input: '$severityBreakdown',
                  as: 'item',
                  in: {
                    k: '$$item.severity',
                    v: '$$item.count',
                  },
                },
              },
            },
            _id: 0,
          },
        },
        { $sort: { period: 1 as any } },
      ];

      return await this.errorLogModel.aggregate(pipeline);
    } catch (error) {
      this.logger.error('Failed to get error trends', error);
      throw error;
    }
  }

  async detectAnomalies(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    type: 'spike' | 'new_error' | 'increased_severity';
    description: string;
    severity: string;
    affectedMetric: string;
    value: number;
    threshold: number;
    timestamp: Date;
  }>> {
    try {
      const anomalies = [];

      // Detect error spikes
      const spikes = await this.detectErrorSpikes(startDate, endDate);
      anomalies.push(...spikes);

      // Detect new error patterns
      const newErrors = await this.detectNewErrors(startDate, endDate);
      anomalies.push(...newErrors);

      // Detect severity increases
      const severityIncreases = await this.detectSeverityIncreases(startDate, endDate);
      anomalies.push(...severityIncreases);

      return anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      this.logger.error('Failed to detect anomalies', error);
      throw error;
    }
  }

  async getErrorImpactAnalysis(
    fingerprint: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalOccurrences: number;
    affectedUsers: number;
    affectedSessions: number;
    userImpactScore: number;
    businessImpactScore: number;
    technicalImpactScore: number;
    overallImpactScore: number;
  }> {
    try {
      const pipeline = [
        {
          $match: {
            fingerprint,
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalOccurrences: { $sum: 1 },
            affectedUsers: { $addToSet: '$userId' },
            affectedSessions: { $addToSet: '$sessionId' },
            severities: { $push: '$severity' },
            contexts: { $push: '$context' },
          },
        },
      ];

      const [result] = await this.errorLogModel.aggregate(pipeline);

      if (!result) {
        return {
          totalOccurrences: 0,
          affectedUsers: 0,
          affectedSessions: 0,
          userImpactScore: 0,
          businessImpactScore: 0,
          technicalImpactScore: 0,
          overallImpactScore: 0,
        };
      }

      const affectedUsers = result.affectedUsers.length;
      const affectedSessions = result.affectedSessions.length;

      // Calculate impact scores
      const userImpactScore = this.calculateUserImpactScore(
        result.totalOccurrences,
        affectedUsers,
        affectedSessions,
      );

      const businessImpactScore = this.calculateBusinessImpactScore(
        result.severities,
        result.contexts,
      );

      const technicalImpactScore = this.calculateTechnicalImpactScore(
        result.totalOccurrences,
        result.severities,
      );

      const overallImpactScore = Math.round(
        (userImpactScore + businessImpactScore + technicalImpactScore) / 3,
      );

      return {
        totalOccurrences: result.totalOccurrences,
        affectedUsers,
        affectedSessions,
        userImpactScore,
        businessImpactScore,
        technicalImpactScore,
        overallImpactScore,
      };
    } catch (error) {
      this.logger.error(`Failed to get error impact analysis: ${fingerprint}`, error);
      throw error;
    }
  }

  private async createErrorPattern(error: ErrorLogDocument): Promise<ErrorPatternDocument> {
    const pattern = new this.errorPatternModel({
      fingerprint: error.fingerprint,
      pattern: `${(error as any).errorName}: ${error.message}`,
      firstSeen: (error as any).timestamp,
      lastSeen: (error as any).timestamp,
      occurrences: 1,
      severity: error.severity,
      status: 'active',
      tags: error.tags || [],
    });

    return await pattern.save();
  }

  private async findRelatedErrors(error: ErrorLogDocument): Promise<ErrorLogDocument[]> {
    // Find errors with similar stack traces or contexts
    const relatedErrors = await this.errorLogModel
      .find({
        $and: [
          { _id: { $ne: error._id } },
          {
            $or: [
              { errorName: (error as any).errorName },
              { 'context.component': error.context?.component },
              { 'context.feature': error.context?.feature },
            ],
          },
        ],
      })
      .limit(5)
      .lean();

    return relatedErrors;
  }

  private async analyzeFrequency(fingerprint: string): Promise<{
    frequency: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [recentCount, previousCount] = await Promise.all([
      this.errorLogModel.countDocuments({
        fingerprint,
        timestamp: { $gte: oneDayAgo, $lte: now },
      }),
      this.errorLogModel.countDocuments({
        fingerprint,
        timestamp: { $gte: twoDaysAgo, $lt: oneDayAgo },
      }),
    ]);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentCount > previousCount * 1.2) {
      trend = 'increasing';
    } else if (recentCount < previousCount * 0.8) {
      trend = 'decreasing';
    }

    return { frequency: recentCount, trend };
  }

  private async getAffectedUsers(fingerprint: string): Promise<string[]> {
    const users = await this.errorLogModel.distinct('userId', { fingerprint });
    return users.filter(Boolean) as string[];
  }

  private async extractCommonContext(fingerprint: string): Promise<Record<string, any>> {
    const errors = await this.errorLogModel
      .find({ fingerprint })
      .select('context')
      .limit(100)
      .lean();

    const contextKeys = new Map<string, Map<any, number>>();

    errors.forEach(error => {
      if (error.context) {
        Object.entries(error.context).forEach(([key, value]) => {
          if (!contextKeys.has(key)) {
            contextKeys.set(key, new Map());
          }
          const valueMap = contextKeys.get(key)!;
          valueMap.set(value, (valueMap.get(value) || 0) + 1);
        });
      }
    });

    const commonContext: Record<string, any> = {};
    contextKeys.forEach((valueMap, key) => {
      const sortedValues = Array.from(valueMap.entries()).sort((a, b) => b[1] - a[1]);
      if (sortedValues.length > 0 && sortedValues[0][1] > errors.length * 0.5) {
        commonContext[key] = sortedValues[0][0];
      }
    });

    return commonContext;
  }

  private generateRecommendations(
    error: ErrorLogDocument,
    pattern: ErrorPatternDocument,
    frequencyData: { frequency: number; trend: string },
  ): string[] {
    const recommendations: string[] = [];

    if (frequencyData.trend === 'increasing') {
      recommendations.push('Monitor this error closely as it shows an increasing trend');
      recommendations.push('Consider implementing additional error handling');
    }

    if ((error as any).severity === 'critical') {
      recommendations.push('Immediate attention required due to critical severity');
      recommendations.push('Consider implementing circuit breaker pattern');
    }

    if ((error as any).errorName === 'TypeError') {
      recommendations.push('Add type checking and validation');
      recommendations.push('Review variable initialization');
    }

    if ((error as any).errorName === 'ReferenceError') {
      recommendations.push('Check for undefined variables or functions');
      recommendations.push('Review scope and variable declarations');
    }

    if (error.context?.component) {
      recommendations.push(`Focus debugging efforts on the ${error.context.component} component`);
    }

    return recommendations;
  }

  private calculateSeverity(
    frequencyData: { frequency: number; trend: string },
    affectedUsers: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;

    // Frequency impact
    if (frequencyData.frequency > 100) score += 3;
    else if (frequencyData.frequency > 50) score += 2;
    else if (frequencyData.frequency > 10) score += 1;

    // Trend impact
    if (frequencyData.trend === 'increasing') score += 2;

    // User impact
    if (affectedUsers > 100) score += 3;
    else if (affectedUsers > 50) score += 2;
    else if (affectedUsers > 10) score += 1;

    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private async detectErrorSpikes(startDate: Date, endDate: Date): Promise<any[]> {
    // Implementation for detecting error spikes
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00',
              date: '$timestamp',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as any } },
    ];

    const hourlyData = await this.errorLogModel.aggregate(pipeline);
    const spikes = [];

    // Simple spike detection: if count is 3x higher than average
    const average = hourlyData.reduce((sum, item) => sum + item.count, 0) / hourlyData.length;
    const threshold = average * 3;

    hourlyData.forEach(item => {
      if (item.count > threshold) {
        spikes.push({
          type: 'spike' as const,
          description: `Error spike detected: ${item.count} errors in hour ${item._id}`,
          severity: 'high',
          affectedMetric: 'error_count',
          value: item.count,
          threshold,
          timestamp: new Date(item._id),
        });
      }
    });

    return spikes;
  }

  private async detectNewErrors(startDate: Date, endDate: Date): Promise<any[]> {
    const newPatterns = await this.errorPatternModel.find({
      firstSeen: { $gte: startDate, $lte: endDate },
    });

    return newPatterns.map(pattern => ({
      type: 'new_error' as const,
      description: `New error pattern detected: ${pattern.pattern}`,
      severity: pattern.severity,
      affectedMetric: 'new_error_pattern',
      value: 1,
      threshold: 0,
      timestamp: pattern.firstSeen,
    }));
  }

  private async detectSeverityIncreases(startDate: Date, endDate: Date): Promise<any[]> {
    // Implementation for detecting severity increases
    return []; // Simplified for now
  }

  private calculateUserImpactScore(
    occurrences: number,
    affectedUsers: number,
    affectedSessions: number,
  ): number {
    const userImpactRatio = affectedUsers > 0 ? occurrences / affectedUsers : 0;
    const sessionImpactRatio = affectedSessions > 0 ? occurrences / affectedSessions : 0;
    
    return Math.min(100, Math.round((userImpactRatio + sessionImpactRatio) * 10));
  }

  private calculateBusinessImpactScore(severities: string[], contexts: any[]): number {
    const criticalCount = severities.filter(s => s === 'critical').length;
    const highCount = severities.filter(s => s === 'high').length;
    
    const businessCriticalContexts = contexts.filter(c => 
      c?.feature === 'payment' || c?.feature === 'auth' || c?.component === 'checkout'
    ).length;
    
    return Math.min(100, (criticalCount * 20) + (highCount * 10) + (businessCriticalContexts * 15));
  }

  private calculateTechnicalImpactScore(occurrences: number, severities: string[]): number {
    const severityWeight = severities.reduce((sum, severity) => {
      switch (severity) {
        case 'critical': return sum + 4;
        case 'high': return sum + 3;
        case 'medium': return sum + 2;
        case 'low': return sum + 1;
        default: return sum + 1;
      }
    }, 0);
    
    return Math.min(100, Math.round((occurrences * 0.1) + (severityWeight * 2)));
  }
}

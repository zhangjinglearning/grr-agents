import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CrashReport, CrashReportDocument } from '../schemas/crash-report.schema';
import * as Sentry from '@sentry/node';

export interface CrashData {
  error: Error;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  stackTrace?: string;
  breadcrumbs?: Array<{
    message: string;
    category: string;
    timestamp: Date;
    level: string;
  }>;
}

export interface CrashAnalysis {
  crashId: string;
  frequency: number;
  affectedUsers: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  tags: string[];
  similarCrashes: string[];
}

@Injectable()
export class CrashReportingService {
  private readonly logger = new Logger(CrashReportingService.name);

  constructor(
    @InjectModel(CrashReport.name)
    private readonly crashReportModel: Model<CrashReportDocument>,
  ) {}

  async reportCrash(crashData: CrashData): Promise<string> {
    try {
      const crashReport = new this.crashReportModel({
        errorMessage: crashData.error.message,
        errorName: crashData.error.name,
        stackTrace: crashData.stackTrace || crashData.error.stack,
        userId: crashData.userId,
        sessionId: crashData.sessionId,
        userAgent: crashData.userAgent,
        url: crashData.url,
        timestamp: crashData.timestamp || new Date(),
        severity: crashData.severity,
        context: crashData.context || {},
        breadcrumbs: crashData.breadcrumbs || [],
        fingerprint: this.generateFingerprint(crashData.error),
        resolved: false,
        tags: this.extractTags(crashData),
      });

      const savedReport = await crashReport.save();

      // Send to Sentry for additional tracking
      Sentry.captureException(crashData.error, {
        user: crashData.userId ? { id: crashData.userId } : undefined,
        tags: {
          severity: crashData.severity,
          sessionId: crashData.sessionId,
        },
        contexts: {
          crash: {
            crashId: savedReport._id.toString(),
            url: crashData.url,
          },
        },
        extra: crashData.context,
      });

      this.logger.error(`Crash reported: ${savedReport._id}`, {
        error: crashData.error.message,
        userId: crashData.userId,
        severity: crashData.severity,
      });

      return savedReport._id.toString();
    } catch (error) {
      this.logger.error('Failed to report crash', error);
      throw error;
    }
  }

  async getCrashAnalysis(crashId: string): Promise<CrashAnalysis> {
    try {
      const crash = await this.crashReportModel.findById(crashId);
      if (!crash) {
        throw new Error(`Crash not found: ${crashId}`);
      }

      // Find similar crashes based on fingerprint
      const similarCrashes = await this.crashReportModel
        .find({
          fingerprint: crash.fingerprint,
          _id: { $ne: crashId },
        })
        .limit(10)
        .select('_id')
        .lean();

      // Get frequency and affected users for this crash type
      const crashStats = await this.crashReportModel.aggregate([
        { $match: { fingerprint: crash.fingerprint } },
        {
          $group: {
            _id: null,
            frequency: { $sum: 1 },
            affectedUsers: { $addToSet: '$userId' },
            firstSeen: { $min: '$timestamp' },
            lastSeen: { $max: '$timestamp' },
          },
        },
      ]);

      const stats = crashStats[0] || {
        frequency: 1,
        affectedUsers: [],
        firstSeen: crash.timestamp,
        lastSeen: crash.timestamp,
      };

      return {
        crashId,
        frequency: stats.frequency,
        affectedUsers: stats.affectedUsers.length,
        firstSeen: stats.firstSeen,
        lastSeen: stats.lastSeen,
        resolved: crash.resolved,
        tags: crash.tags,
        similarCrashes: similarCrashes.map(c => c._id.toString()),
      };
    } catch (error) {
      this.logger.error(`Failed to get crash analysis: ${crashId}`, error);
      throw error;
    }
  }

  async getCrashTrends(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' = 'day',
  ): Promise<any[]> {
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
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        {
          $group: {
            _id: '$_id.period',
            totalCrashes: { $sum: '$count' },
            severityBreakdown: {
              $push: {
                severity: '$_id.severity',
                count: '$count',
                uniqueUsers: { $size: '$uniqueUsers' },
              },
            },
            totalUniqueUsers: { $addToSet: '$uniqueUsers' },
          },
        },
        {
          $project: {
            period: '$_id',
            totalCrashes: 1,
            severityBreakdown: 1,
            totalUniqueUsers: {
              $size: {
                $reduce: {
                  input: '$totalUniqueUsers',
                  initialValue: [],
                  in: { $setUnion: ['$$value', '$$this'] },
                },
              },
            },
            _id: 0,
          },
        },
        { $sort: { period: 1 as any } },
      ];

      return await this.crashReportModel.aggregate(pipeline);
    } catch (error) {
      this.logger.error('Failed to get crash trends', error);
      throw error;
    }
  }

  async getTopCrashes(
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$fingerprint',
            count: { $sum: 1 },
            affectedUsers: { $addToSet: '$userId' },
            lastSeen: { $max: '$timestamp' },
            firstSeen: { $min: '$timestamp' },
            severity: { $first: '$severity' },
            errorMessage: { $first: '$errorMessage' },
            errorName: { $first: '$errorName' },
            resolved: { $first: '$resolved' },
            sampleCrashId: { $first: '$_id' },
          },
        },
        {
          $project: {
            fingerprint: '$_id',
            count: 1,
            affectedUsers: { $size: '$affectedUsers' },
            lastSeen: 1,
            firstSeen: 1,
            severity: 1,
            errorMessage: 1,
            errorName: 1,
            resolved: 1,
            sampleCrashId: 1,
            _id: 0,
          },
        },
        { $sort: { count: -1 as any } },
        { $limit: limit },
      ];

      return await this.crashReportModel.aggregate(pipeline);
    } catch (error) {
      this.logger.error('Failed to get top crashes', error);
      throw error;
    }
  }

  async resolveCrash(crashId: string, resolvedBy: string): Promise<void> {
    try {
      const crash = await this.crashReportModel.findById(crashId);
      if (!crash) {
        throw new Error(`Crash not found: ${crashId}`);
      }

      // Resolve all crashes with the same fingerprint
      await this.crashReportModel.updateMany(
        { fingerprint: crash.fingerprint },
        {
          $set: {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy,
          },
        },
      );

      this.logger.log(`Crash resolved: ${crashId} by ${resolvedBy}`);
    } catch (error) {
      this.logger.error(`Failed to resolve crash: ${crashId}`, error);
      throw error;
    }
  }

  async getCrashDetails(crashId: string): Promise<CrashReport> {
    try {
      const crash = await this.crashReportModel.findById(crashId).lean();
      if (!crash) {
        throw new Error(`Crash not found: ${crashId}`);
      }

      return crash;
    } catch (error) {
      this.logger.error(`Failed to get crash details: ${crashId}`, error);
      throw error;
    }
  }

  private generateFingerprint(error: Error): string {
    // Create a unique fingerprint based on error type and stack trace
    const stackLines = (error.stack || '').split('\n').slice(0, 5);
    const key = `${error.name}:${error.message}:${stackLines.join('|')}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private extractTags(crashData: CrashData): string[] {
    const tags: string[] = [];
    
    tags.push(`severity:${crashData.severity}`);
    tags.push(`error_type:${crashData.error.name}`);
    
    if (crashData.userAgent) {
      const browser = this.extractBrowser(crashData.userAgent);
      if (browser) tags.push(`browser:${browser}`);
    }
    
    if (crashData.url) {
      const path = new URL(crashData.url).pathname;
      tags.push(`path:${path}`);
    }
    
    if (crashData.context) {
      Object.entries(crashData.context).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          tags.push(`${key}:${value}`);
        }
      });
    }
    
    return tags;
  }

  private extractBrowser(userAgent: string): string | null {
    if (userAgent.includes('Chrome')) return 'chrome';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (userAgent.includes('Safari')) return 'safari';
    if (userAgent.includes('Edge')) return 'edge';
    return null;
  }

  async getCrashStatistics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalCrashes: number;
    uniqueErrors: number;
    affectedUsers: number;
    crashRate: number;
    severityDistribution: Record<string, number>;
    topErrorTypes: Array<{ type: string; count: number }>;
  }> {
    try {
      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $facet: {
            overview: [
              {
                $group: {
                  _id: null,
                  totalCrashes: { $sum: 1 },
                  uniqueErrors: { $addToSet: '$fingerprint' },
                  affectedUsers: { $addToSet: '$userId' },
                },
              },
              {
                $project: {
                  totalCrashes: 1,
                  uniqueErrors: { $size: '$uniqueErrors' },
                  affectedUsers: { $size: '$affectedUsers' },
                },
              },
            ],
            severityDistribution: [
              {
                $group: {
                  _id: '$severity',
                  count: { $sum: 1 },
                },
              },
            ],
            topErrorTypes: [
              {
                $group: {
                  _id: '$errorName',
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 as -1 } },
              { $limit: 10 },
              {
                $project: {
                  type: '$_id',
                  count: 1,
                  _id: 0,
                },
              },
            ],
          },
        },
      ];

      const [result] = await this.crashReportModel.aggregate(pipeline as any);
      const overview = result.overview[0] || {
        totalCrashes: 0,
        uniqueErrors: 0,
        affectedUsers: 0,
      };

      const severityDistribution = result.severityDistribution.reduce(
        (acc: Record<string, number>, item: any) => {
          acc[item._id] = item.count;
          return acc;
        },
        {},
      );

      return {
        ...overview,
        crashRate: overview.affectedUsers > 0 ? (overview.totalCrashes / overview.affectedUsers) : 0,
        severityDistribution,
        topErrorTypes: result.topErrorTypes,
      };
    } catch (error) {
      this.logger.error('Failed to get crash statistics', error);
      throw error;
    }
  }
}

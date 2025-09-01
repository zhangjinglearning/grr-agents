import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsEvent, AnalyticsEventDocument } from '../schemas/analytics-event.schema';
import { UserSession, UserSessionDocument } from '../schemas/user-session.schema';

export interface ReportConfig {
  name: string;
  type: 'user_activity' | 'performance' | 'engagement' | 'conversion' | 'custom';
  startDate: Date;
  endDate: Date;
  filters?: Record<string, any>;
  groupBy?: string[];
  metrics?: string[];
}

export interface ReportResult {
  reportId: string;
  config: ReportConfig;
  data: any[];
  summary: Record<string, any>;
  generatedAt: Date;
  exportFormats?: string[];
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly analyticsEventModel: Model<AnalyticsEventDocument>,
    @InjectModel(UserSession.name)
    private readonly userSessionModel: Model<UserSessionDocument>,
  ) {}

  async generateReport(config: ReportConfig): Promise<ReportResult> {
    try {
      const reportId = this.generateReportId();
      this.logger.log(`Generating report: ${config.name} (${reportId})`);

      let data: any[] = [];
      let summary: Record<string, any> = {};

      switch (config.type) {
        case 'user_activity':
          ({ data, summary } = await this.generateUserActivityReport(config));
          break;
        case 'performance':
          ({ data, summary } = await this.generatePerformanceReport(config));
          break;
        case 'engagement':
          ({ data, summary } = await this.generateEngagementReport(config));
          break;
        case 'conversion':
          ({ data, summary } = await this.generateConversionReport(config));
          break;
        case 'custom':
          ({ data, summary } = await this.generateCustomReport(config));
          break;
        default:
          throw new Error(`Unsupported report type: ${config.type}`);
      }

      const result: ReportResult = {
        reportId,
        config,
        data,
        summary,
        generatedAt: new Date(),
        exportFormats: ['json', 'csv', 'pdf'],
      };

      this.logger.log(`Report generated successfully: ${reportId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate report: ${config.name}`, error);
      throw error;
    }
  }

  private async generateUserActivityReport(config: ReportConfig): Promise<{ data: any[]; summary: any }> {
    const matchStage: any = {
      timestamp: { $gte: config.startDate, $lte: config.endDate },
    };

    // Apply filters
    if (config.filters) {
      Object.entries(config.filters).forEach(([key, value]) => {
        matchStage[key] = value;
      });
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            userId: '$userId',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp'
              }
            }
          },
          events: { $sum: 1 },
          uniqueEvents: { $addToSet: '$eventName' },
          firstActivity: { $min: '$timestamp' },
          lastActivity: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          userId: '$_id.userId',
          date: '$_id.date',
          totalEvents: '$events',
          uniqueEventTypes: { $size: '$uniqueEvents' },
          sessionDuration: {
            $subtract: ['$lastActivity', '$firstActivity']
          },
          _id: 0
        }
      },
      { $sort: { date: 1 as 1, userId: 1 as 1 } }
    ];

    const data = await this.analyticsEventModel.aggregate(pipeline);

    // Calculate summary statistics
    const summary = {
      totalUsers: new Set(data.map(d => d.userId)).size,
      totalEvents: data.reduce((sum, d) => sum + d.totalEvents, 0),
      avgEventsPerUser: data.length > 0 ? data.reduce((sum, d) => sum + d.totalEvents, 0) / data.length : 0,
      avgSessionDuration: data.length > 0 ? data.reduce((sum, d) => sum + d.sessionDuration, 0) / data.length / 1000 : 0,
      dateRange: {
        start: config.startDate,
        end: config.endDate
      }
    };

    return { data, summary };
  }

  private async generatePerformanceReport(config: ReportConfig): Promise<{ data: any[]; summary: any }> {
    const matchStage: any = {
      timestamp: { $gte: config.startDate, $lte: config.endDate },
      eventName: { $in: ['page_load', 'api_call', 'error'] }
    };

    if (config.filters) {
      Object.entries(config.filters).forEach(([key, value]) => {
        matchStage[key] = value;
      });
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            eventName: '$eventName',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp'
              }
            }
          },
          count: { $sum: 1 },
          avgDuration: { $avg: '$properties.duration' },
          minDuration: { $min: '$properties.duration' },
          maxDuration: { $max: '$properties.duration' },
          errors: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'error'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          eventType: '$_id.eventName',
          date: '$_id.date',
          count: 1,
          avgDuration: { $round: ['$avgDuration', 2] },
          minDuration: 1,
          maxDuration: 1,
          errorCount: '$errors',
          _id: 0
        }
      },
      { $sort: { date: 1 as 1, eventType: 1 as 1 } }
    ];

    const data = await this.analyticsEventModel.aggregate(pipeline);

    const summary = {
      totalRequests: data.reduce((sum, d) => sum + d.count, 0),
      totalErrors: data.reduce((sum, d) => sum + d.errorCount, 0),
      avgResponseTime: data.length > 0 ? data.reduce((sum, d) => sum + (d.avgDuration || 0), 0) / data.length : 0,
      errorRate: data.length > 0 ? (data.reduce((sum, d) => sum + d.errorCount, 0) / data.reduce((sum, d) => sum + d.count, 0)) * 100 : 0,
      dateRange: {
        start: config.startDate,
        end: config.endDate
      }
    };

    return { data, summary };
  }

  private async generateEngagementReport(config: ReportConfig): Promise<{ data: any[]; summary: any }> {
    const sessionMatchStage: any = {
      startTime: { $gte: config.startDate, $lte: config.endDate },
    };

    if (config.filters?.boardId) {
      sessionMatchStage.boardId = config.filters.boardId;
    }

    const pipeline = [
      { $match: sessionMatchStage },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$startTime'
              }
            }
          },
          totalSessions: { $sum: 1 },
          avgSessionDuration: {
            $avg: {
              $subtract: [
                { $ifNull: ['$endTime', '$startTime'] },
                '$startTime'
              ]
            }
          },
          avgPageViews: { $avg: '$pageViews' },
          bounceRate: {
            $avg: {
              $cond: [{ $lte: ['$pageViews', 1] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          date: '$_id.date',
          totalSessions: 1,
          avgSessionDuration: { $divide: ['$avgSessionDuration', 1000] }, // Convert to seconds
          avgPageViews: { $round: ['$avgPageViews', 2] },
          bounceRate: { $multiply: ['$bounceRate', 100] },
          _id: 0
        }
      },
      { $sort: { date: 1 as 1 } }
    ];

    const data = await this.userSessionModel.aggregate(pipeline);

    const summary = {
      totalSessions: data.reduce((sum, d) => sum + d.totalSessions, 0),
      avgSessionDuration: data.length > 0 ? data.reduce((sum, d) => sum + d.avgSessionDuration, 0) / data.length : 0,
      avgPageViews: data.length > 0 ? data.reduce((sum, d) => sum + d.avgPageViews, 0) / data.length : 0,
      avgBounceRate: data.length > 0 ? data.reduce((sum, d) => sum + d.bounceRate, 0) / data.length : 0,
      dateRange: {
        start: config.startDate,
        end: config.endDate
      }
    };

    return { data, summary };
  }

  private async generateConversionReport(config: ReportConfig): Promise<{ data: any[]; summary: any }> {
    const matchStage: any = {
      timestamp: { $gte: config.startDate, $lte: config.endDate },
      eventName: { $in: ['page_view', 'signup', 'purchase', 'conversion'] }
    };

    if (config.filters) {
      Object.entries(config.filters).forEach(([key, value]) => {
        matchStage[key] = value;
      });
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp'
              }
            }
          },
          totalVisitors: { $addToSet: '$userId' },
          conversions: {
            $sum: {
              $cond: [
                { $in: ['$eventName', ['signup', 'purchase', 'conversion']] },
                1,
                0
              ]
            }
          },
          pageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'page_view'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          date: '$_id.date',
          totalVisitors: { $size: '$totalVisitors' },
          conversions: 1,
          pageViews: 1,
          conversionRate: {
            $multiply: [
              { $divide: ['$conversions', { $size: '$totalVisitors' }] },
              100
            ]
          },
          _id: 0
        }
      },
      { $sort: { date: 1 as 1 } }
    ];

    const data = await this.analyticsEventModel.aggregate(pipeline);

    const summary = {
      totalVisitors: data.reduce((sum, d) => sum + d.totalVisitors, 0),
      totalConversions: data.reduce((sum, d) => sum + d.conversions, 0),
      totalPageViews: data.reduce((sum, d) => sum + d.pageViews, 0),
      overallConversionRate: data.length > 0 ? 
        (data.reduce((sum, d) => sum + d.conversions, 0) / data.reduce((sum, d) => sum + d.totalVisitors, 0)) * 100 : 0,
      dateRange: {
        start: config.startDate,
        end: config.endDate
      }
    };

    return { data, summary };
  }

  private async generateCustomReport(config: ReportConfig): Promise<{ data: any[]; summary: any }> {
    // Custom report implementation based on config.metrics and config.groupBy
    const matchStage: any = {
      timestamp: { $gte: config.startDate, $lte: config.endDate },
    };

    if (config.filters) {
      Object.entries(config.filters).forEach(([key, value]) => {
        matchStage[key] = value;
      });
    }

    // Build dynamic aggregation pipeline based on config
    const groupStage: any = { _id: {} };
    
    if (config.groupBy) {
      config.groupBy.forEach(field => {
        if (field === 'date') {
          groupStage._id.date = {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          };
        } else {
          groupStage._id[field] = `$${field}`;
        }
      });
    }

    // Add metrics
    if (config.metrics) {
      config.metrics.forEach(metric => {
        switch (metric) {
          case 'count':
            groupStage.count = { $sum: 1 };
            break;
          case 'unique_users':
            groupStage.uniqueUsers = { $addToSet: '$userId' };
            break;
          case 'avg_duration':
            groupStage.avgDuration = { $avg: '$properties.duration' };
            break;
        }
      });
    }

    const pipeline = [
      { $match: matchStage },
      { $group: groupStage },
      {
        $project: {
          ...groupStage._id,
          count: 1,
          uniqueUsers: { $size: { $ifNull: ['$uniqueUsers', []] } },
          avgDuration: { $round: [{ $ifNull: ['$avgDuration', 0] }, 2] },
          _id: 0
        }
      },
      { $sort: { date: 1 as 1 } }
    ];

    const data = await this.analyticsEventModel.aggregate(pipeline);

    const summary = {
      totalRecords: data.length,
      dateRange: {
        start: config.startDate,
        end: config.endDate
      },
      appliedFilters: config.filters || {},
      groupedBy: config.groupBy || [],
      metrics: config.metrics || []
    };

    return { data, summary };
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async exportReport(reportResult: ReportResult, format: 'json' | 'csv' | 'pdf'): Promise<Buffer | string> {
    switch (format) {
      case 'json':
        return JSON.stringify(reportResult, null, 2);
      case 'csv':
        return this.convertToCSV(reportResult.data);
      case 'pdf':
        // PDF generation would require a library like puppeteer or pdfkit
        throw new Error('PDF export not implemented yet');
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  async scheduleReport(config: ReportConfig, schedule: string): Promise<string> {
    // This would integrate with a job scheduler like Bull or Agenda
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Report scheduled: ${config.name} with schedule: ${schedule}`);
    
    // Implementation would depend on the chosen scheduler
    return scheduleId;
  }
}

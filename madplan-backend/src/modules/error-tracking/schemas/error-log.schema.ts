import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ErrorLogDocument = ErrorLog & Document;

export enum ErrorSeverity {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug'
}

export enum ErrorCategory {
  APPLICATION = 'application',
  DATABASE = 'database',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  EXTERNAL_SERVICE = 'external_service',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic',
  PERFORMANCE = 'performance',
  SECURITY = 'security'
}

export enum ErrorStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
  RECURRING = 'recurring'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp?: Date;
  environment?: string;
  version?: string;
  [key: string]: any;
}

export interface ErrorStackFrame {
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  context?: string[];
  inApp?: boolean;
}

export interface ErrorMetadata {
  fingerprint?: string;
  release?: string;
  environment?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  breadcrumbs?: Array<{
    timestamp: Date;
    message: string;
    category: string;
    level: string;
    data?: any;
  }>;
}

@Schema({
  timestamps: true,
  collection: 'error_logs',
  index: [
    { severity: 1, timestamp: -1 },
    { category: 1, timestamp: -1 },
    { status: 1, timestamp: -1 },
    { fingerprint: 1, timestamp: -1 },
    { 'context.userId': 1, timestamp: -1 },
    { resolved: 1, timestamp: -1 }
  ]
})
export class ErrorLog {
  @Prop({ required: true })
  message: string;

  @Prop({ required: true, enum: ErrorSeverity, index: true })
  severity: ErrorSeverity;

  @Prop({ required: true, enum: ErrorCategory, index: true })
  category: ErrorCategory;

  @Prop({ required: true, enum: ErrorStatus, default: ErrorStatus.OPEN, index: true })
  status: ErrorStatus;

  @Prop({ required: false })
  errorType?: string;

  @Prop({ required: false })
  errorCode?: string;

  @Prop({ required: false, type: String })
  stackTrace?: string;

  @Prop({
    type: [Object],
    required: false,
    default: []
  })
  stackFrames: ErrorStackFrame[];

  @Prop({
    type: Object,
    required: false,
    default: {}
  })
  context: ErrorContext;

  @Prop({
    type: Object,
    required: false,
    default: {}
  })
  metadata: ErrorMetadata;

  @Prop({ required: false, index: true })
  fingerprint?: string;

  @Prop({ default: 1 })
  occurrences: number;

  @Prop({ default: Date.now, index: true })
  firstSeen: Date;

  @Prop({ default: Date.now, index: true })
  lastSeen: Date;

  @Prop({ required: false })
  resolvedAt?: Date;

  @Prop({ required: false })
  resolvedBy?: string;

  @Prop({ required: false })
  resolution?: string;

  @Prop({
    type: [String],
    default: [],
    index: true
  })
  tags: string[];

  @Prop({
    type: [Object],
    default: []
  })
  relatedErrors: {
    errorId: string;
    relationship: 'caused_by' | 'causes' | 'similar' | 'duplicate';
    confidence: number;
  }[];

  @Prop({ default: false, index: true })
  resolved: boolean;

  @Prop({ default: false })
  ignored: boolean;

  @Prop({ required: false })
  assignedTo?: string;

  @Prop({ required: false })
  priority?: number; // 1-5, 5 being highest

  @Prop({
    type: [Object],
    default: []
  })
  comments: {
    userId: string;
    message: string;
    timestamp: Date;
  }[];

  @Prop({ required: false })
  externalId?: string; // Sentry ID, etc.

  @Prop({
    type: Object,
    required: false
  })
  performance?: {
    responseTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    databaseQueries?: number;
  };
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);

// Indexes for performance
ErrorLogSchema.index({ fingerprint: 1, firstSeen: -1 });
ErrorLogSchema.index({ 'context.userId': 1, severity: 1, timestamp: -1 }, { sparse: true });
ErrorLogSchema.index({ category: 1, severity: 1, timestamp: -1 });
ErrorLogSchema.index({ status: 1, severity: 1, timestamp: -1 });
ErrorLogSchema.index({ resolved: 1, timestamp: -1 });

// TTL index for automatic cleanup (optional - keep errors for 1 year)
ErrorLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 1 year
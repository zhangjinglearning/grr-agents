import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BusinessKPIDocument = BusinessKPI & Document;

export enum KPICategory {
  GROWTH = 'growth',
  ENGAGEMENT = 'engagement',
  RETENTION = 'retention',
  CONVERSION = 'conversion',
  REVENUE = 'revenue',
  PRODUCT = 'product',
  OPERATIONAL = 'operational'
}

export enum KPIFrequency {
  REAL_TIME = 'real_time',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export interface KPITarget {
  value: number;
  period: string;
  deadline?: Date;
  description?: string;
}

export interface KPIAlert {
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  channel: 'email' | 'slack' | 'webhook';
  enabled: boolean;
  recipients?: string[];
}

@Schema({
  timestamps: true,
  collection: 'business_kpis'
})
export class BusinessKPI {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: true, enum: KPICategory, index: true })
  category: KPICategory;

  @Prop({ required: true, enum: KPIFrequency })
  frequency: KPIFrequency;

  @Prop({ required: true })
  unit: string; // 'count', 'percentage', 'currency', 'time', 'ratio'

  @Prop({ required: true })
  value: number;

  @Prop({ required: false })
  previousValue?: number;

  @Prop({ required: false })
  changePercent?: number;

  @Prop({ required: false })
  changeAbsolute?: number;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;

  @Prop({ required: false })
  periodStart?: Date;

  @Prop({ required: false })
  periodEnd?: Date;

  @Prop({
    type: Object,
    required: false
  })
  target?: KPITarget;

  @Prop({
    type: [Object],
    default: []
  })
  alerts: KPIAlert[];

  @Prop({
    type: Object,
    default: {}
  })
  metadata: {
    source?: string;
    calculation?: string;
    dependencies?: string[];
    tags?: string[];
    owner?: string;
    [key: string]: any;
  };

  @Prop({
    type: [Object],
    default: []
  })
  historicalValues: {
    timestamp: Date;
    value: number;
    period?: string;
  }[];

  @Prop({ default: true })
  active: boolean;

  @Prop({ required: false })
  lastCalculated?: Date;

  @Prop({ required: false })
  calculationDuration?: number; // milliseconds
}

export const BusinessKPISchema = SchemaFactory.createForClass(BusinessKPI);

// Indexes
BusinessKPISchema.index({ name: 1 }, { unique: true });
BusinessKPISchema.index({ category: 1, timestamp: -1 });
BusinessKPISchema.index({ frequency: 1, lastCalculated: 1 });
BusinessKPISchema.index({ active: 1, timestamp: -1 });
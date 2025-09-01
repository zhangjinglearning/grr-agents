import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType } from '@nestjs/graphql';

export type CrashReportDocument = CrashReport & Document;

@Schema({ timestamps: true })
@ObjectType()
export class CrashReport {
  @Field(() => String)
  _id: string;

  @Prop({ required: true })
  @Field()
  errorMessage: string;

  @Prop({ required: true })
  @Field()
  errorName: string;

  @Prop({ required: true })
  @Field()
  stackTrace: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  @Field(() => String, { nullable: true })
  userId?: string;

  @Prop({ index: true })
  @Field({ nullable: true })
  sessionId?: string;

  @Prop()
  @Field({ nullable: true })
  userAgent?: string;

  @Prop()
  @Field({ nullable: true })
  url?: string;

  @Prop({ required: true, index: true })
  @Field()
  timestamp: Date;

  @Prop({ 
    required: true, 
    enum: ['low', 'medium', 'high', 'critical'],
    index: true 
  })
  @Field()
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Prop({ type: Object, default: {} })
  @Field(() => String)
  context: Record<string, any>;

  @Prop({ 
    type: [{
      message: String,
      category: String,
      timestamp: Date,
      level: String,
    }],
    default: [] 
  })
  @Field(() => [String])
  breadcrumbs: Array<{
    message: string;
    category: string;
    timestamp: Date;
    level: string;
  }>;

  @Prop({ required: true, index: true })
  @Field()
  fingerprint: string;

  @Prop({ default: false, index: true })
  @Field()
  resolved: boolean;

  @Prop()
  @Field({ nullable: true })
  resolvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @Field(() => String, { nullable: true })
  resolvedBy?: string;

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  tags: string[];

  @Prop()
  @Field({ nullable: true })
  environment?: string;

  @Prop()
  @Field({ nullable: true })
  release?: string;

  @Prop()
  @Field({ nullable: true })
  platform?: string;

  @Prop()
  @Field({ nullable: true })
  device?: string;

  @Prop()
  @Field({ nullable: true })
  browser?: string;

  @Prop()
  @Field({ nullable: true })
  os?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const CrashReportSchema = SchemaFactory.createForClass(CrashReport);

// Create compound indexes for better query performance
CrashReportSchema.index({ fingerprint: 1, timestamp: -1 });
CrashReportSchema.index({ userId: 1, timestamp: -1 });
CrashReportSchema.index({ severity: 1, resolved: 1, timestamp: -1 });
CrashReportSchema.index({ timestamp: -1 });
CrashReportSchema.index({ resolved: 1, severity: 1 });
CrashReportSchema.index({ tags: 1 });
CrashReportSchema.index({ environment: 1, timestamp: -1 });

// Text search index for error messages and stack traces
CrashReportSchema.index({
  errorMessage: 'text',
  stackTrace: 'text',
  'context.component': 'text',
});

// TTL index to automatically delete old crash reports (optional)
// CrashReportSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days

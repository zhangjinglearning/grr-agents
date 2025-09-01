import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Field, ObjectType, Float } from '@nestjs/graphql';

export type MetricSnapshotDocument = MetricSnapshot & Document;

@Schema({ timestamps: true })
@ObjectType()
export class MetricSnapshot {
  @Field(() => String)
  _id: string;

  @Prop({ required: true, index: true })
  @Field()
  metricName: string;

  @Prop({ required: true })
  @Field(() => Float)
  value: number;

  @Prop({ required: true, index: true })
  @Field()
  timestamp: Date;

  @Prop({ type: Object, default: {} })
  @Field(() => String)
  metadata: Record<string, any>;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const MetricSnapshotSchema = SchemaFactory.createForClass(MetricSnapshot);

// Create compound indexes for better query performance
MetricSnapshotSchema.index({ metricName: 1, timestamp: -1 });
MetricSnapshotSchema.index({ timestamp: -1 });
MetricSnapshotSchema.index({ metricName: 1, 'metadata.boardId': 1, timestamp: -1 });

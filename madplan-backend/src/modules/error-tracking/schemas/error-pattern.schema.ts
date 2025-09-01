import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, Int } from '@nestjs/graphql';

export type ErrorPatternDocument = ErrorPattern & Document;

@Schema({ timestamps: true })
@ObjectType()
export class ErrorPattern {
  @Field(() => String)
  _id: string;

  @Prop({ required: true, unique: true, index: true })
  @Field()
  fingerprint: string;

  @Prop({ required: true })
  @Field()
  pattern: string;

  @Prop({ required: true, index: true })
  @Field()
  firstSeen: Date;

  @Prop({ required: true, index: true })
  @Field()
  lastSeen: Date;

  @Prop({ default: 0 })
  @Field(() => Int)
  occurrences: number;

  @Prop({ 
    required: true, 
    enum: ['low', 'medium', 'high', 'critical'],
    index: true 
  })
  @Field()
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Prop({ 
    required: true, 
    enum: ['active', 'resolved', 'ignored'],
    default: 'active',
    index: true 
  })
  @Field()
  status: 'active' | 'resolved' | 'ignored';

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  tags: string[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @Field(() => String, { nullable: true })
  assignedTo?: string;

  @Prop()
  @Field({ nullable: true })
  resolvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @Field(() => String, { nullable: true })
  resolvedBy?: string;

  @Prop()
  @Field({ nullable: true })
  resolution?: string;

  @Prop({ type: Object, default: {} })
  @Field(() => String)
  metadata: Record<string, any>;

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  affectedComponents: string[];

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  affectedFeatures: string[];

  @Prop({ default: 0 })
  @Field(() => Int)
  affectedUsers: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  affectedSessions: number;

  @Prop()
  @Field({ nullable: true })
  businessImpact?: string;

  @Prop({ default: 0 })
  @Field(() => Int)
  priority: number;

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  relatedPatterns: string[];

  @Prop()
  @Field({ nullable: true })
  rootCause?: string;

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  preventionMeasures: string[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const ErrorPatternSchema = SchemaFactory.createForClass(ErrorPattern);

// Create compound indexes for better query performance
ErrorPatternSchema.index({ status: 1, severity: 1, lastSeen: -1 });
ErrorPatternSchema.index({ assignedTo: 1, status: 1 });
ErrorPatternSchema.index({ tags: 1 });
ErrorPatternSchema.index({ affectedComponents: 1 });
ErrorPatternSchema.index({ affectedFeatures: 1 });
ErrorPatternSchema.index({ priority: -1, lastSeen: -1 });
ErrorPatternSchema.index({ occurrences: -1 });
ErrorPatternSchema.index({ affectedUsers: -1 });

// Text search index
ErrorPatternSchema.index({
  pattern: 'text',
  rootCause: 'text',
  resolution: 'text',
});

// Methods to calculate derived fields
ErrorPatternSchema.methods.calculatePriority = function() {
  let priority = 0;
  
  // Severity weight
  switch (this.severity) {
    case 'critical': priority += 40; break;
    case 'high': priority += 30; break;
    case 'medium': priority += 20; break;
    case 'low': priority += 10; break;
  }
  
  // Frequency weight
  if (this.occurrences > 1000) priority += 30;
  else if (this.occurrences > 100) priority += 20;
  else if (this.occurrences > 10) priority += 10;
  
  // User impact weight
  if (this.affectedUsers > 100) priority += 20;
  else if (this.affectedUsers > 10) priority += 10;
  
  // Recency weight
  const daysSinceLastSeen = (Date.now() - this.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastSeen < 1) priority += 10;
  else if (daysSinceLastSeen < 7) priority += 5;
  
  return Math.min(100, priority);
};

ErrorPatternSchema.methods.updateStats = async function() {
  const ErrorLog = this.model('ErrorLog');
  
  const stats = await ErrorLog.aggregate([
    { $match: { fingerprint: this.fingerprint } },
    {
      $group: {
        _id: null,
        occurrences: { $sum: 1 },
        affectedUsers: { $addToSet: '$userId' },
        affectedSessions: { $addToSet: '$sessionId' },
        lastSeen: { $max: '$timestamp' },
      }
    }
  ]);
  
  if (stats.length > 0) {
    const stat = stats[0];
    this.occurrences = stat.occurrences;
    this.affectedUsers = stat.affectedUsers.filter(Boolean).length;
    this.affectedSessions = stat.affectedSessions.filter(Boolean).length;
    this.lastSeen = stat.lastSeen;
    this.priority = this.calculatePriority();
  }
};

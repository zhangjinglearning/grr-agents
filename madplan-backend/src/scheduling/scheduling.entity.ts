import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsBoolean, IsEnum, IsOptional, IsNumber, IsDate, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type SchedulingDocument = CardScheduling & Document;

export enum RecurrenceType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom'
}

export enum ReminderType {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in-app'
}

export enum SchedulingStatus {
  PENDING = 'pending',
  OVERDUE = 'overdue',
  COMPLETED = 'completed'
}

// Register enums for GraphQL
registerEnumType(RecurrenceType, {
  name: 'RecurrenceType',
  description: 'Types of recurrence patterns for scheduled cards'
});

registerEnumType(ReminderType, {
  name: 'ReminderType',
  description: 'Types of reminders for scheduled cards'
});

registerEnumType(SchedulingStatus, {
  name: 'SchedulingStatus',
  description: 'Status of scheduled cards'
});

@ObjectType()
export class RecurrencePattern {
  @Field(() => RecurrenceType)
  @IsEnum(RecurrenceType)
  type: RecurrenceType;

  @Field()
  @IsNumber()
  @Min(1)
  @Max(365)
  interval: number;

  @Field(() => [Number], { nullable: true })
  @IsOptional()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  occurrences?: number; // Maximum number of occurrences
}

@ObjectType()
export class Reminder {
  @Field(() => ReminderType)
  @IsEnum(ReminderType)
  type: ReminderType;

  @Field()
  @IsString()
  @IsNotEmpty()
  timing: string; // Format: "1h", "1d", "1w", "30m"

  @Field({ defaultValue: true })
  @IsBoolean()
  enabled: boolean;
}

@Schema({
  timestamps: true,
  collection: 'card_scheduling',
})
@ObjectType()
export class CardScheduling {
  @Field(() => ID)
  id: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Card',
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  cardId: string;

  @Prop({
    type: Date,
    index: true,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @Prop({
    type: Date,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Prop({
    required: true,
    default: false,
  })
  @Field()
  @IsBoolean()
  isRecurring: boolean;

  @Prop({
    type: {
      type: { type: String, enum: RecurrenceType, required: true },
      interval: { type: Number, required: true, min: 1, max: 365 },
      daysOfWeek: [Number],
      endDate: Date,
      occurrences: { type: Number, min: 1 }
    },
  })
  @Field(() => RecurrencePattern, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrencePattern)
  recurrencePattern?: RecurrencePattern;

  @Prop({
    required: true,
    type: [{
      type: { type: String, enum: ReminderType, required: true },
      timing: { type: String, required: true },
      enabled: { type: Boolean, default: true }
    }],
    default: [],
  })
  @Field(() => [Reminder])
  @ValidateNested({ each: true })
  @Type(() => Reminder)
  reminders: Reminder[];

  @Prop({
    required: true,
    enum: SchedulingStatus,
    default: SchedulingStatus.PENDING,
    index: true,
  })
  @Field(() => SchedulingStatus)
  @IsEnum(SchedulingStatus)
  status: SchedulingStatus;

  @Prop({
    type: Date,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @Prop({
    type: String,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timeZone?: string; // User's timezone for accurate scheduling

  @Prop({
    type: Number,
    default: 0,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  estimatedMinutes?: number; // Estimated time to complete task

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const CardSchedulingSchema = SchemaFactory.createForClass(CardScheduling);

// Create compound indexes for efficient queries
CardSchedulingSchema.index({ cardId: 1 }, { unique: true }); // One schedule per card
CardSchedulingSchema.index({ dueDate: 1, status: 1 }); // For due date queries
CardSchedulingSchema.index({ status: 1, dueDate: 1 }); // For overdue detection
CardSchedulingSchema.index({ 'recurrencePattern.endDate': 1 }, { sparse: true }); // For recurring task cleanup

// Virtual for card relationship
CardSchedulingSchema.virtual('card', {
  ref: 'Card',
  localField: 'cardId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are serialized
CardSchedulingSchema.set('toJSON', { virtuals: true });
CardSchedulingSchema.set('toObject', { virtuals: true });

// Pre-save middleware for validation and status updates
CardSchedulingSchema.pre<SchedulingDocument>('save', function(next) {
  const now = new Date();
  
  // Auto-update status based on due date
  if (this.dueDate && !this.completedAt) {
    if (this.dueDate < now && this.status === SchedulingStatus.PENDING) {
      this.status = SchedulingStatus.OVERDUE;
    }
  }
  
  // If marked as completed, set completedAt timestamp
  if (this.status === SchedulingStatus.COMPLETED && !this.completedAt) {
    this.completedAt = now;
  }
  
  // Clear completedAt if status changed from completed
  if (this.status !== SchedulingStatus.COMPLETED && this.completedAt) {
    this.completedAt = undefined;
  }
  
  // Validate recurrence pattern
  if (this.isRecurring && !this.recurrencePattern) {
    const error = new Error('Recurrence pattern is required for recurring tasks');
    return next(error);
  }
  
  // Validate that start date is before due date
  if (this.startDate && this.dueDate && this.startDate > this.dueDate) {
    const error = new Error('Start date cannot be after due date');
    return next(error);
  }
  
  next();
});

// Static methods for common queries
CardSchedulingSchema.statics.findOverdue = function() {
  return this.find({
    status: SchedulingStatus.PENDING,
    dueDate: { $lt: new Date() }
  });
};

CardSchedulingSchema.statics.findDueSoon = function(hours: number = 24) {
  const soon = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.find({
    status: SchedulingStatus.PENDING,
    dueDate: { $gte: new Date(), $lte: soon }
  });
};

// Transform output to include id and exclude MongoDB internals
CardSchedulingSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

CardSchedulingSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
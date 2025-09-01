import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, Int } from '@nestjs/graphql';

export type UserSessionDocument = UserSession & Document;

@Schema({ timestamps: true })
@ObjectType()
export class UserSession {
  @Field(() => String)
  _id: string;

  @Prop({ required: true, index: true })
  @Field()
  sessionId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  @Field(() => String, { nullable: true })
  userId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Board', index: true })
  @Field(() => String, { nullable: true })
  boardId?: string;

  @Prop({ required: true, index: true })
  @Field()
  startTime: Date;

  @Prop({ index: true })
  @Field({ nullable: true })
  endTime?: Date;

  @Prop({ default: 0 })
  @Field(() => Int)
  pageViews: number;

  @Prop({ default: 0 })
  @Field(() => Int)
  events: number;

  @Prop()
  @Field({ nullable: true })
  userAgent?: string;

  @Prop()
  @Field({ nullable: true })
  ipAddress?: string;

  @Prop()
  @Field({ nullable: true })
  referrer?: string;

  @Prop()
  @Field({ nullable: true })
  landingPage?: string;

  @Prop()
  @Field({ nullable: true })
  exitPage?: string;

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  visitedPages: string[];

  @Prop({ type: Object, default: {} })
  @Field(() => String)
  metadata: Record<string, any>;

  @Prop({ default: false })
  @Field()
  isBounce: boolean;

  @Prop()
  @Field({ nullable: true })
  country?: string;

  @Prop()
  @Field({ nullable: true })
  city?: string;

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

export const UserSessionSchema = SchemaFactory.createForClass(UserSession);

// Create compound indexes for better query performance
UserSessionSchema.index({ userId: 1, startTime: -1 });
UserSessionSchema.index({ boardId: 1, startTime: -1 });
UserSessionSchema.index({ sessionId: 1 }, { unique: true });
UserSessionSchema.index({ startTime: -1 });
UserSessionSchema.index({ endTime: -1 });
UserSessionSchema.index({ userId: 1, boardId: 1, startTime: -1 });

// Add methods to calculate session duration
UserSessionSchema.methods.getDuration = function() {
  if (!this.endTime) return null;
  return this.endTime.getTime() - this.startTime.getTime();
};

UserSessionSchema.methods.getDurationInSeconds = function() {
  const duration = this.getDuration();
  return duration ? Math.floor(duration / 1000) : null;
};

UserSessionSchema.methods.getDurationInMinutes = function() {
  const duration = this.getDuration();
  return duration ? Math.floor(duration / (1000 * 60)) : null;
};

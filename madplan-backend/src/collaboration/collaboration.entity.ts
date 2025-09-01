import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum SharePermission {
  VIEW = 'view',
  COMMENT = 'comment',
  EDIT = 'edit',
  ADMIN = 'admin',
}

export enum ShareStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum InviteMethod {
  EMAIL = 'email',
  LINK = 'link',
  DIRECT = 'direct',
}

registerEnumType(SharePermission, {
  name: 'SharePermission',
});

registerEnumType(ShareStatus, {
  name: 'ShareStatus',
});

registerEnumType(InviteMethod, {
  name: 'InviteMethod',
});

@Schema()
@ObjectType()
export class BoardShare {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  sharedBy: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @Field(() => ID, { nullable: true })
  sharedWith?: string;

  @Prop()
  @Field({ nullable: true })
  email?: string;

  @Prop({ required: true, enum: SharePermission })
  @Field(() => SharePermission)
  permission: SharePermission;

  @Prop({ required: true, enum: ShareStatus, default: ShareStatus.PENDING })
  @Field(() => ShareStatus)
  status: ShareStatus;

  @Prop({ enum: InviteMethod, default: InviteMethod.EMAIL })
  @Field(() => InviteMethod)
  inviteMethod: InviteMethod;

  @Prop()
  @Field({ nullable: true })
  shareToken?: string;

  @Prop()
  @Field({ nullable: true })
  shareLink?: string;

  @Prop()
  @Field({ nullable: true })
  expiresAt?: Date;

  @Prop({ default: Date.now })
  @Field()
  createdAt: Date;

  @Prop()
  @Field({ nullable: true })
  acceptedAt?: Date;

  @Prop()
  @Field({ nullable: true })
  lastAccessedAt?: Date;

  @Prop({ default: false })
  @Field()
  isLinkShare: boolean;

  @Prop()
  @Field({ nullable: true })
  message?: string;
}

@Schema()
@ObjectType()
export class BoardActivity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  userId: string;

  @Prop({ required: true })
  @Field()
  action: string;

  @Prop({ required: true })
  @Field()
  entityType: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID, { nullable: true })
  entityId?: string;

  @Prop({ type: Object })
  @Field({ nullable: true })
  details?: any;

  @Prop({ default: Date.now })
  @Field()
  timestamp: Date;

  @Prop()
  @Field({ nullable: true })
  ipAddress?: string;

  @Prop()
  @Field({ nullable: true })
  userAgent?: string;
}

export type BoardShareDocument = BoardShare & Document;
export type BoardActivityDocument = BoardActivity & Document;
export const BoardShareSchema = SchemaFactory.createForClass(BoardShare);
export const BoardActivitySchema = SchemaFactory.createForClass(BoardActivity);

BoardShareSchema.index({ boardId: 1, status: 1 });
BoardShareSchema.index({ sharedWith: 1, status: 1 });
BoardShareSchema.index({ shareToken: 1 });
BoardShareSchema.index({ email: 1, status: 1 });
BoardShareSchema.index({ expiresAt: 1 });

BoardActivitySchema.index({ boardId: 1, timestamp: -1 });
BoardActivitySchema.index({ userId: 1, timestamp: -1 });
BoardActivitySchema.index({ entityType: 1, entityId: 1 });
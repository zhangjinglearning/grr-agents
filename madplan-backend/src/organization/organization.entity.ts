import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType, Int } from '@nestjs/graphql';

export enum LabelColor {
  RED = 'red',
  ORANGE = 'orange',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  PURPLE = 'purple',
  PINK = 'pink',
  GRAY = 'gray',
  BROWN = 'brown',
  TEAL = 'teal',
}

export enum Priority {
  LOWEST = 'lowest',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  HIGHEST = 'highest',
  CRITICAL = 'critical',
}

export enum CustomFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  USER = 'user',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
}

registerEnumType(LabelColor, {
  name: 'LabelColor',
});

registerEnumType(Priority, {
  name: 'Priority',
});

registerEnumType(CustomFieldType, {
  name: 'CustomFieldType',
});

@Schema()
@ObjectType()
export class Label {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true })
  @Field()
  name: string;

  @Prop({ required: true, enum: LabelColor })
  @Field(() => LabelColor)
  color: LabelColor;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  createdBy: string;

  @Prop()
  @Field({ nullable: true })
  description?: string;

  @Prop({ default: Date.now })
  @Field()
  createdAt: Date;

  @Prop({ default: 0 })
  @Field(() => Int)
  usageCount: number;

  @Prop({ default: true })
  @Field()
  isActive: boolean;
}

@Schema()
@ObjectType()
export class CustomFieldOption {
  @Prop({ required: true })
  @Field()
  label: string;

  @Prop({ required: true })
  @Field()
  value: string;

  @Prop({ required: true, enum: LabelColor })
  @Field(() => LabelColor)
  color: LabelColor;

  @Prop({ default: 0 })
  @Field(() => Int)
  position: number;
}

@Schema()
@ObjectType()
export class CustomField {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true })
  @Field()
  name: string;

  @Prop({ required: true, enum: CustomFieldType })
  @Field(() => CustomFieldType)
  type: CustomFieldType;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  @Field(() => ID)
  createdBy: string;

  @Prop()
  @Field({ nullable: true })
  description?: string;

  @Prop({ default: false })
  @Field()
  isRequired: boolean;

  @Prop({ default: true })
  @Field()
  isActive: boolean;

  @Prop({ default: 0 })
  @Field(() => Int)
  position: number;

  @Prop({ type: [CustomFieldOption] })
  @Field(() => [CustomFieldOption], { nullable: true })
  options?: CustomFieldOption[];

  @Prop()
  @Field({ nullable: true })
  defaultValue?: string;

  @Prop()
  @Field({ nullable: true })
  placeholder?: string;

  @Prop({ default: Date.now })
  @Field()
  createdAt: Date;

  @Prop()
  @Field({ nullable: true })
  updatedAt?: Date;
}

@Schema()
@ObjectType()
export class CustomFieldValue {
  @Prop({ required: true, type: Types.ObjectId, ref: 'CustomField' })
  @Field(() => ID)
  fieldId: string;

  @Prop({ required: true })
  @Field()
  fieldName: string;

  @Prop({ required: true, enum: CustomFieldType })
  @Field(() => CustomFieldType)
  fieldType: CustomFieldType;

  @Prop()
  @Field({ nullable: true })
  value?: string;

  @Prop({ type: [String] })
  @Field(() => [String], { nullable: true })
  multiValue?: string[];

  @Prop({ default: Date.now })
  @Field()
  updatedAt: Date;
}

@Schema()
@ObjectType()
export class CardOrganization {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Card' })
  @Field(() => ID)
  cardId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Label' }] })
  @Field(() => [ID])
  labelIds: string[];

  @Prop({ enum: Priority })
  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Prop({ type: [CustomFieldValue] })
  @Field(() => [CustomFieldValue])
  customFieldValues: CustomFieldValue[];

  @Prop({ type: [String] })
  @Field(() => [String])
  tags: string[];

  @Prop()
  @Field({ nullable: true })
  estimatedHours?: number;

  @Prop()
  @Field({ nullable: true })
  actualHours?: number;

  @Prop()
  @Field({ nullable: true })
  storyPoints?: number;

  @Prop({ default: Date.now })
  @Field()
  createdAt: Date;

  @Prop({ default: Date.now })
  @Field()
  updatedAt: Date;
}

@Schema()
@ObjectType()
export class BoardOrganizationSettings {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Board' })
  @Field(() => ID)
  boardId: string;

  @Prop({ default: true })
  @Field()
  enableLabels: boolean;

  @Prop({ default: true })
  @Field()
  enablePriorities: boolean;

  @Prop({ default: true })
  @Field()
  enableCustomFields: boolean;

  @Prop({ default: true })
  @Field()
  enableTags: boolean;

  @Prop({ default: true })
  @Field()
  enableEstimation: boolean;

  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  availablePriorities: Priority[];

  @Prop({ default: Priority.MEDIUM })
  @Field(() => Priority)
  defaultPriority: Priority;

  @Prop({ default: 10 })
  @Field(() => Int)
  maxLabelsPerCard: number;

  @Prop({ default: 20 })
  @Field(() => Int)
  maxCustomFieldsPerBoard: number;

  @Prop({ default: Date.now })
  @Field()
  createdAt: Date;

  @Prop({ default: Date.now })
  @Field()
  updatedAt: Date;
}

export type LabelDocument = Label & Document;
export type CustomFieldDocument = CustomField & Document;
export type CardOrganizationDocument = CardOrganization & Document;
export type BoardOrganizationSettingsDocument = BoardOrganizationSettings & Document;

export const LabelSchema = SchemaFactory.createForClass(Label);
export const CustomFieldSchema = SchemaFactory.createForClass(CustomField);
export const CardOrganizationSchema = SchemaFactory.createForClass(CardOrganization);
export const BoardOrganizationSettingsSchema = SchemaFactory.createForClass(BoardOrganizationSettings);

// Indexes for performance
LabelSchema.index({ boardId: 1, name: 1 }, { unique: true });
LabelSchema.index({ boardId: 1, isActive: 1 });
LabelSchema.index({ usageCount: -1 });

CustomFieldSchema.index({ boardId: 1, name: 1 }, { unique: true });
CustomFieldSchema.index({ boardId: 1, position: 1 });
CustomFieldSchema.index({ boardId: 1, isActive: 1 });

CardOrganizationSchema.index({ cardId: 1 }, { unique: true });
CardOrganizationSchema.index({ boardId: 1 });
CardOrganizationSchema.index({ labelIds: 1 });
CardOrganizationSchema.index({ priority: 1 });
CardOrganizationSchema.index({ tags: 1 });

BoardOrganizationSettingsSchema.index({ boardId: 1 }, { unique: true });
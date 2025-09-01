import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsBoolean, IsEnum, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type TemplateDocument = CardTemplate & Document;

export enum TemplateCategory {
  TASK = 'task',
  BUG = 'bug', 
  MEETING = 'meeting',
  FEATURE = 'feature',
  RESEARCH = 'research',
  CUSTOM = 'custom'
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Register enums for GraphQL
registerEnumType(TemplateCategory, {
  name: 'TemplateCategory',
  description: 'Categories for organizing card templates'
});

registerEnumType(Priority, {
  name: 'Priority',
  description: 'Priority levels for cards'
});

@ObjectType()
export class TemplateContent {
  @Field()
  @IsString()
  title: string;

  @Field()
  @IsString() 
  description: string;

  @Field(() => [String])
  @IsString({ each: true })
  labels: string[];

  @Field(() => Priority)
  @IsEnum(Priority)
  priority: Priority;

  @Field()
  customFields: string; // JSON string for flexible custom fields

  @Field(() => [String])
  @IsString({ each: true })
  checklistItems: string[];

  @Field(() => [String])
  @IsString({ each: true })
  attachmentTypes: string[];
}

@Schema({
  timestamps: true,
  collection: 'card_templates',
})
@ObjectType()
export class CardTemplate {
  @Field(() => ID)
  id: string;

  @Prop({
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
  })
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 500,
  })
  @Field()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Prop({
    required: true,
    enum: TemplateCategory,
    default: TemplateCategory.CUSTOM,
  })
  @Field(() => TemplateCategory)
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @Prop({
    required: true,
    default: false,
  })
  @Field()
  @IsBoolean()
  isPublic: boolean;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'User',
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @Prop({
    required: true,
    type: {
      title: { type: String, required: true },
      description: { type: String, required: true },
      labels: [String],
      priority: { type: String, enum: Priority, default: Priority.MEDIUM },
      customFields: { type: String, default: '{}' }, // JSON string
      checklistItems: [String],
      attachmentTypes: [String],
    },
  })
  @Field(() => TemplateContent)
  @ValidateNested()
  @Type(() => TemplateContent)
  content: TemplateContent;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  @Field()
  @IsNumber()
  usageCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const CardTemplateSchema = SchemaFactory.createForClass(CardTemplate);

// Create compound index for efficient template discovery
CardTemplateSchema.index({ category: 1, isPublic: 1, createdBy: 1 });

// Create text search index for template search
CardTemplateSchema.index({ 
  name: 'text', 
  description: 'text',
  'content.title': 'text',
  'content.description': 'text'
});

// Create index for popular templates (by usage count)
CardTemplateSchema.index({ usageCount: -1, isPublic: 1 });

// Virtual for creator relationship
CardTemplateSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are serialized
CardTemplateSchema.set('toJSON', { virtuals: true });
CardTemplateSchema.set('toObject', { virtuals: true });

// Pre-save middleware for validation and cleanup
CardTemplateSchema.pre<TemplateDocument>('save', function(next) {
  // Ensure name and description are trimmed
  if (this.name) {
    this.name = this.name.trim();
  }
  if (this.description) {
    this.description = this.description.trim();
  }
  
  // Validate custom fields is valid JSON
  if (this.content?.customFields) {
    try {
      JSON.parse(this.content.customFields);
    } catch (error) {
      this.content.customFields = '{}';
    }
  }
  
  next();
});

// Transform output to include id and exclude MongoDB internals
CardTemplateSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

CardTemplateSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
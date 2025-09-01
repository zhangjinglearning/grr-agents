import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export type SearchIndexDocument = SearchIndex & Document;

export enum SearchItemType {
  BOARD = 'board',
  LIST = 'list',
  CARD = 'card',
  COMMENT = 'comment'
}

export enum SearchResultStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

// Register enums for GraphQL
registerEnumType(SearchItemType, {
  name: 'SearchItemType',
  description: 'Types of searchable items'
});

registerEnumType(SearchResultStatus, {
  name: 'SearchResultStatus',
  description: 'Status of search results'
});

@ObjectType()
export class SearchMetadata {
  @Field({ nullable: true })
  priority?: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => [String])
  assignees: string[];

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  boardTitle?: string;

  @Field({ nullable: true })
  listTitle?: string;
}

@Schema({
  timestamps: true,
  collection: 'search_index',
})
@ObjectType()
export class SearchIndex {
  @Field(() => ID)
  id: string;

  @Prop({
    required: true,
    type: String,
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  itemId: string; // ID of the actual item (board, list, card, comment)

  @Prop({
    required: true,
    enum: SearchItemType,
    index: true,
  })
  @Field(() => SearchItemType)
  @IsEnum(SearchItemType)
  type: SearchItemType;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
    index: 'text',
  })
  @Field()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 5000,
    index: 'text',
  })
  @Field()
  @IsString()
  @IsNotEmpty()
  content: string;

  @Prop({
    type: [String],
    default: [],
    index: true,
  })
  @Field(() => [String])
  tags: string[];

  @Prop({
    type: [String],
    default: [],
    index: true,
  })
  @Field(() => [String])
  labels: string[];

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'User',
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Board',
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @Prop({
    required: false,
    type: Types.ObjectId,
    ref: 'List',
    index: true,
  })
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  listId?: string;

  @Prop({
    required: true,
    enum: SearchResultStatus,
    default: SearchResultStatus.ACTIVE,
    index: true,
  })
  @Field(() => SearchResultStatus)
  @IsEnum(SearchResultStatus)
  status: SearchResultStatus;

  @Prop({
    required: false,
    type: {
      priority: String,
      dueDate: Date,
      assignees: [String],
      status: String,
      boardTitle: String,
      listTitle: String,
    },
  })
  @Field(() => SearchMetadata, { nullable: true })
  @IsOptional()
  metadata?: SearchMetadata;

  @Prop({
    required: true,
    default: 0,
    index: true,
  })
  @Field()
  @IsNumber()
  searchScore: number; // Relevance score for ranking

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const SearchIndexSchema = SchemaFactory.createForClass(SearchIndex);

// Create compound indexes for efficient search queries
SearchIndexSchema.index({ 
  title: 'text', 
  content: 'text', 
  tags: 'text', 
  labels: 'text' 
}, {
  weights: {
    title: 10,      // Title matches are most important
    content: 5,     // Content matches are important
    tags: 8,        // Tag matches are very important
    labels: 6       // Label matches are important
  },
  name: 'search_text_index'
});

// Create compound indexes for filtering
SearchIndexSchema.index({ ownerId: 1, type: 1, status: 1 });
SearchIndexSchema.index({ boardId: 1, type: 1, status: 1 });
SearchIndexSchema.index({ 'metadata.dueDate': 1, status: 1 }, { sparse: true });
SearchIndexSchema.index({ 'metadata.priority': 1, status: 1 }, { sparse: true });
SearchIndexSchema.index({ searchScore: -1, createdAt: -1 }); // For relevance ranking

// Virtual relationships
SearchIndexSchema.virtual('owner', {
  ref: 'User',
  localField: 'ownerId',
  foreignField: '_id',
  justOne: true,
});

SearchIndexSchema.virtual('board', {
  ref: 'Board',
  localField: 'boardId',
  foreignField: '_id',
  justOne: true,
});

SearchIndexSchema.virtual('list', {
  ref: 'List',
  localField: 'listId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are serialized
SearchIndexSchema.set('toJSON', { virtuals: true });
SearchIndexSchema.set('toObject', { virtuals: true });

// Pre-save middleware for search score calculation
SearchIndexSchema.pre<SearchIndexDocument>('save', function(next) {
  // Calculate base search score based on content quality
  let score = 0;
  
  // Score based on title length and quality
  if (this.title && this.title.length > 5) {
    score += 10;
  }
  
  // Score based on content richness
  if (this.content && this.content.length > 20) {
    score += 15;
  }
  
  // Score based on tags and labels
  score += this.tags.length * 5;
  score += this.labels.length * 3;
  
  // Boost score for items with metadata
  if (this.metadata) {
    score += 10;
    if (this.metadata.dueDate) score += 5;
    if (this.metadata.priority) score += 3;
  }
  
  this.searchScore = score;
  next();
});

// Transform output to include id and exclude MongoDB internals
SearchIndexSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

SearchIndexSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
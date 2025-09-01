import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export type CardDocument = Card & Document;

@Schema({
  timestamps: true,
  collection: 'cards',
})
@ObjectType()
export class Card {
  @Field(() => ID)
  id: string;

  @Prop({
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 1000,
    validate: {
      validator: function(v: string) {
        return v && v.trim().length > 0;
      },
      message: 'Card content cannot be empty'
    }
  })
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Card content is required' })
  @MinLength(1, { message: 'Card content must be at least 1 character long' })
  @MaxLength(1000, { message: 'Card content must be at most 1000 characters long' })
  content: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'List',
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'List ID is required' })
  listId: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Board',
    index: true,
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Board ID is required' })
  boardId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const CardSchema = SchemaFactory.createForClass(Card);

// Add compound index for efficient queries
CardSchema.index({ listId: 1, createdAt: 1 });

// Add text search index for content search (future enhancement)
CardSchema.index({ content: 'text' });

// Virtual for list relationship
CardSchema.virtual('list', {
  ref: 'List',
  localField: 'listId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are serialized
CardSchema.set('toJSON', { virtuals: true });
CardSchema.set('toObject', { virtuals: true });

// Pre-save middleware to ensure content is trimmed
CardSchema.pre<CardDocument>('save', function(next) {
  if (this.content) {
    this.content = this.content.trim();
  }
  next();
});
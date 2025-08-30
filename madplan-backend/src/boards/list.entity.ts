import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { IsString, IsNotEmpty, IsArray } from "class-validator";
import { Card } from "./card.entity";

export type ListDocument = List & Document;

@Schema({
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: "lists",
})
@ObjectType()
export class List {
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
  title: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: "Board",
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @Prop({
    type: [String],
    default: [],
  })
  @Field(() => [ID])
  @IsArray()
  cardOrder: string[];

  // Virtual field for cards relationship - populated at runtime
  @Field(() => [Card], { nullable: true })
  cards?: Card[];

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}

export const ListSchema = SchemaFactory.createForClass(List);

// Create index on boardId for optimized board list queries
ListSchema.index({ boardId: 1 });

// Create compound index for boardId + createdAt for sorted list retrieval
ListSchema.index({ boardId: 1, createdAt: 1 });

// Transform the toJSON output to include id and exclude MongoDB internals
ListSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Transform the toObject output similarly
ListSchema.set("toObject", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Virtual for cards relationship
ListSchema.virtual('cards', {
  ref: 'Card',
  localField: '_id',
  foreignField: 'listId',
});
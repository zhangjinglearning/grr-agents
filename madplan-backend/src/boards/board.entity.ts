import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { List } from "./list.entity";
import { BoardTheme } from "../themes/theme.entity";

export type BoardDocument = Board & Document;

@Schema({
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: "boards",
})
@ObjectType()
export class Board {
  @Field(() => ID)
  id: string;

  @Prop({
    required: true,
    trim: true,
    minlength: 1,
  })
  @Field()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: "User",
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: "User",
  })
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @Prop({
    type: [String],
    default: [],
  })
  @Field(() => [ID])
  @IsArray()
  listOrder: string[];

  @Prop({ 
    type: BoardTheme,
    required: false,
    default: () => ({ themeId: "spirited-away" }) // Default theme
  })
  @Field(() => BoardTheme, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoardTheme)
  theme?: BoardTheme;

  // Virtual field for lists relationship - populated at runtime
  @Field(() => [List])
  lists?: List[];

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}

export const BoardSchema = SchemaFactory.createForClass(Board);

// Create index on ownerId for optimized query performance
BoardSchema.index({ ownerId: 1 });

// Create compound index for ownerId + title for unique board names per user
BoardSchema.index({ ownerId: 1, title: 1 }, { unique: false });

// Transform the toJSON output to include id and exclude MongoDB internals
BoardSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Transform the toObject output similarly
BoardSchema.set("toObject", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

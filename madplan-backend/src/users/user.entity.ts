import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';

export type UserDocument = User & Document;

@Schema({
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'users',
})
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
  })
  @Field()
  @IsEmail()
  email: string;

  @Prop({
    required: true,
    minlength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string; // This will be hashed before storage

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Create unique index on email for performance and constraint enforcement
UserSchema.index({ email: 1 }, { unique: true });

// Pre-save middleware to ensure email is lowercase and trimmed
UserSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// Transform the toJSON output to exclude password and include id
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password; // Never expose password in API responses
    return ret;
  },
});

// Transform the toObject output similarly
UserSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password; // Never expose password
    return ret;
  },
});
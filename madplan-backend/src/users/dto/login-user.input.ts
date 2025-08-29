import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

@InputType()
export class LoginUserInput {
  @Field()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @Field()
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;
}
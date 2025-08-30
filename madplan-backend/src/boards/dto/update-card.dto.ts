import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional } from 'class-validator';

@InputType()
export class UpdateCardInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Card ID is required' })
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Card content must be at least 1 character long' })
  @MaxLength(1000, { message: 'Card content must be at most 1000 characters long' })
  content?: string;
}
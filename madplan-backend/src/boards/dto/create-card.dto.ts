import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateCardInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'List ID is required' })
  listId: string;

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Card content is required' })
  @MinLength(1, { message: 'Card content must be at least 1 character long' })
  @MaxLength(1000, { message: 'Card content must be at most 1000 characters long' })
  content: string;
}
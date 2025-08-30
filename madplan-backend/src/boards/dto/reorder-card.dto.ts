import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

@InputType()
export class ReorderCardInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Card ID is required' })
  cardId: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Source list ID is required' })
  sourceListId: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Destination list ID is required' })
  destListId: string;

  @Field(() => Int)
  @IsInt({ message: 'New index must be an integer' })
  @Min(0, { message: 'New index must be non-negative' })
  newIndex: number;
}
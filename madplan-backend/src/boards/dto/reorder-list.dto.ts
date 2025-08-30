import { InputType, Field, ID, Int } from "@nestjs/graphql";
import { IsNotEmpty, IsString, IsInt, Min } from "class-validator";

@InputType()
export class ReorderListInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  listId: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  newIndex: number;
}
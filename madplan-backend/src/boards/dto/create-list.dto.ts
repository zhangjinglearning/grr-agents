import { InputType, Field, ID } from "@nestjs/graphql";
import { IsNotEmpty, IsString, Length } from "class-validator";

@InputType()
export class CreateListInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100, {
    message: "List title must be between 1 and 100 characters",
  })
  title: string;
}
import { InputType, Field, ID } from "@nestjs/graphql";
import { IsNotEmpty, IsString, Length, IsOptional } from "class-validator";

@InputType()
export class UpdateListInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100, {
    message: "List title must be between 1 and 100 characters",
  })
  title?: string;
}
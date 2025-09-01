import { InputType, Field, ID } from "@nestjs/graphql";
import { IsNotEmpty, IsString, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ThemeCustomizations } from "../theme.entity";

@InputType()
export class ThemeCustomizationsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  backgroundVariant?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  cardStyle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  animationIntensity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  typographyScale?: string;
}

@InputType()
export class UpdateBoardThemeInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  themeId: string;

  @Field(() => ThemeCustomizationsInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeCustomizationsInput)
  customizations?: ThemeCustomizationsInput;
}
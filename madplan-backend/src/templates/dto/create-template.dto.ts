import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsBoolean, IsEnum, IsOptional, ValidateNested, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateCategory, Priority } from '../template.entity';

@InputType()
export class CreateTemplateContentInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @Field(() => [String], { defaultValue: [] })
  @IsString({ each: true })
  labels: string[];

  @Field(() => Priority, { defaultValue: Priority.MEDIUM })
  @IsEnum(Priority)
  priority: Priority;

  @Field({ defaultValue: '{}' })
  @IsString()
  customFields: string; // JSON string for flexible custom fields

  @Field(() => [String], { defaultValue: [] })
  @IsString({ each: true })
  checklistItems: string[];

  @Field(() => [String], { defaultValue: [] })
  @IsString({ each: true })
  attachmentTypes: string[];
}

@InputType()
export class CreateTemplateInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @Field(() => TemplateCategory, { defaultValue: TemplateCategory.CUSTOM })
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @Field({ defaultValue: false })
  @IsBoolean()
  isPublic: boolean;

  @Field(() => CreateTemplateContentInput)
  @ValidateNested()
  @Type(() => CreateTemplateContentInput)
  content: CreateTemplateContentInput;
}
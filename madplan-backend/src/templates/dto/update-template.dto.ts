import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { CreateTemplateInput, CreateTemplateContentInput } from './create-template.dto';

@InputType()
export class UpdateTemplateContentInput extends PartialType(CreateTemplateContentInput) {}

@InputType()
export class UpdateTemplateInput extends PartialType(CreateTemplateInput) {
  @Field()
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field(() => UpdateTemplateContentInput, { nullable: true })
  @IsOptional()
  content?: UpdateTemplateContentInput;
}
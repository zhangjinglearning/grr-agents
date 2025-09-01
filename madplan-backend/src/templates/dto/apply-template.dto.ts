import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

@InputType()
export class ApplyTemplateInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  listId: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  titleOverride?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  customData?: string; // JSON string for any template-specific customization
}
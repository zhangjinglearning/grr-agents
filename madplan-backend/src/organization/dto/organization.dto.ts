import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsEnum, IsString, IsBoolean, IsArray, IsNumber, Min, Max } from 'class-validator';
import { LabelColor, Priority, CustomFieldType } from '../organization.entity';

@InputType()
export class CreateLabelInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field(() => LabelColor)
  @IsEnum(LabelColor)
  color: LabelColor;

  @Field(() => ID)
  @IsNotEmpty()
  boardId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class UpdateLabelInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => LabelColor, { nullable: true })
  @IsOptional()
  @IsEnum(LabelColor)
  color?: LabelColor;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class CustomFieldOptionInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  label: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  value: string;

  @Field(() => LabelColor)
  @IsEnum(LabelColor)
  color: LabelColor;

  @Field(() => Int, { defaultValue: 0 })
  @IsNumber()
  @Min(0)
  position: number;
}

@InputType()
export class CreateCustomFieldInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field(() => CustomFieldType)
  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @Field(() => ID)
  @IsNotEmpty()
  boardId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  isRequired: boolean;

  @Field(() => [CustomFieldOptionInput], { nullable: true })
  @IsOptional()
  @IsArray()
  options?: CustomFieldOptionInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  placeholder?: string;
}

@InputType()
export class UpdateCustomFieldInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => [CustomFieldOptionInput], { nullable: true })
  @IsOptional()
  @IsArray()
  options?: CustomFieldOptionInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  placeholder?: string;
}

@InputType()
export class CustomFieldValueInput {
  @Field(() => ID)
  @IsNotEmpty()
  fieldId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  fieldName: string;

  @Field(() => CustomFieldType)
  @IsEnum(CustomFieldType)
  fieldType: CustomFieldType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  value?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  multiValue?: string[];
}

@InputType()
export class UpdateCardOrganizationInput {
  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  labelIds?: string[];

  @Field(() => Priority, { nullable: true })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @Field(() => [CustomFieldValueInput], { nullable: true })
  @IsOptional()
  @IsArray()
  customFieldValues?: CustomFieldValueInput[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualHours?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storyPoints?: number;
}

@InputType()
export class OrganizationQueryInput {
  @Field(() => ID)
  @IsNotEmpty()
  boardId: string;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  labelIds?: string[];

  @Field(() => Priority, { nullable: true })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

@InputType()
export class UpdateBoardOrganizationSettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableLabels?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enablePriorities?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableCustomFields?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableTags?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableEstimation?: boolean;

  @Field(() => [Priority], { nullable: true })
  @IsOptional()
  @IsArray()
  availablePriorities?: Priority[];

  @Field(() => Priority, { nullable: true })
  @IsOptional()
  @IsEnum(Priority)
  defaultPriority?: Priority;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxLabelsPerCard?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxCustomFieldsPerBoard?: number;
}
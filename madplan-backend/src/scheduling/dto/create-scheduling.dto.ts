import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsBoolean, IsEnum, IsOptional, IsNumber, IsDate, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurrenceType, ReminderType } from '../scheduling.entity';

@InputType()
export class CreateRecurrencePatternInput {
  @Field(() => RecurrenceType)
  @IsEnum(RecurrenceType)
  type: RecurrenceType;

  @Field()
  @IsNumber()
  @Min(1)
  @Max(365)
  interval: number;

  @Field(() => [Number], { nullable: true })
  @IsOptional()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  occurrences?: number;
}

@InputType()
export class CreateReminderInput {
  @Field(() => ReminderType)
  @IsEnum(ReminderType)
  type: ReminderType;

  @Field()
  @IsString()
  @IsNotEmpty()
  timing: string;

  @Field({ defaultValue: true })
  @IsBoolean()
  enabled: boolean;
}

@InputType()
export class CreateSchedulingInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  cardId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ defaultValue: false })
  @IsBoolean()
  isRecurring: boolean;

  @Field(() => CreateRecurrencePatternInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRecurrencePatternInput)
  recurrencePattern?: CreateRecurrencePatternInput;

  @Field(() => [CreateReminderInput], { defaultValue: [] })
  @ValidateNested({ each: true })
  @Type(() => CreateReminderInput)
  reminders: CreateReminderInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timeZone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedMinutes?: number;
}
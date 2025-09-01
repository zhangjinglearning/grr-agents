import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { CreateSchedulingInput, CreateRecurrencePatternInput, CreateReminderInput } from './create-scheduling.dto';
import { SchedulingStatus } from '../scheduling.entity';

@InputType()
export class UpdateRecurrencePatternInput extends PartialType(CreateRecurrencePatternInput) {}

@InputType()
export class UpdateReminderInput extends PartialType(CreateReminderInput) {}

@InputType()
export class UpdateSchedulingInput extends PartialType(CreateSchedulingInput) {
  @Field()
  @IsString()
  @IsNotEmpty()
  cardId: string;

  @Field(() => UpdateRecurrencePatternInput, { nullable: true })
  @IsOptional()
  recurrencePattern?: UpdateRecurrencePatternInput;

  @Field(() => [UpdateReminderInput], { nullable: true })
  @IsOptional()
  reminders?: UpdateReminderInput[];

  @Field(() => SchedulingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SchedulingStatus)
  status?: SchedulingStatus;
}
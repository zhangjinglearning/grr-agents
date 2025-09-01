import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsEmail, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { SharePermission, InviteMethod } from '../collaboration.entity';

@InputType()
export class CreateShareInput {
  @Field(() => ID)
  @IsNotEmpty()
  boardId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  sharedWith?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => SharePermission)
  @IsEnum(SharePermission)
  permission: SharePermission;

  @Field(() => InviteMethod, { defaultValue: InviteMethod.EMAIL })
  @IsEnum(InviteMethod)
  inviteMethod: InviteMethod;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @Field({ defaultValue: false })
  @IsBoolean()
  isLinkShare: boolean;

  @Field({ nullable: true })
  @IsOptional()
  message?: string;
}

@InputType()
export class UpdateShareInput {
  @Field(() => SharePermission, { nullable: true })
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @Field({ nullable: true })
  @IsOptional()
  status?: string;
}

@InputType()
export class ShareQueryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => SharePermission, { nullable: true })
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;

  @Field({ nullable: true })
  @IsOptional()
  boardId?: string;
}

@InputType()
export class ActivityQueryInput {
  @Field(() => ID)
  @IsNotEmpty()
  boardId: string;

  @Field({ defaultValue: 50 })
  @IsOptional()
  limit?: number;

  @Field({ nullable: true })
  @IsOptional()
  action?: string;

  @Field({ nullable: true })
  @IsOptional()
  entityType?: string;
}
import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDate, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchItemType, SearchResultStatus } from '../search.entity';

@InputType()
export class SearchFilters {
  @Field(() => [SearchItemType], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SearchItemType, { each: true })
  types?: SearchItemType[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  boardIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  priorities?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueBefore?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueAfter?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAfter?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdBefore?: Date;

  @Field(() => SearchResultStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SearchResultStatus)
  status?: SearchResultStatus;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignees?: string[];
}

@InputType()
export class SearchSortOptions {
  @Field({ defaultValue: 'relevance' })
  @IsString()
  sortBy: string; // 'relevance', 'date', 'title', 'priority'

  @Field({ defaultValue: 'desc' })
  @IsString()
  sortOrder: string; // 'asc', 'desc'
}

@InputType()
export class SearchQueryInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  query: string;

  @Field(() => SearchFilters, { nullable: true })
  @IsOptional()
  filters?: SearchFilters;

  @Field(() => SearchSortOptions, { nullable: true })
  @IsOptional()
  sort?: SearchSortOptions;

  @Field({ defaultValue: 50 })
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number;

  @Field({ defaultValue: 0 })
  @IsNumber()
  @Min(0)
  offset: number;

  @Field({ defaultValue: false })
  @IsOptional()
  includeHighlights?: boolean; // Whether to include search term highlights
}
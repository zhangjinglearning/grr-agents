import { ObjectType, Field } from '@nestjs/graphql';
import { SearchIndex } from '../search.entity';

@ObjectType()
export class SearchHighlight {
  @Field()
  field: string; // Which field contains the highlight (title, content, etc.)

  @Field()
  snippet: string; // Text snippet with highlight markers

  @Field()
  startIndex: number;

  @Field()
  endIndex: number;
}

@ObjectType()
export class SearchResult extends SearchIndex {
  @Field()
  relevanceScore: number; // Calculated relevance score for this query

  @Field(() => [SearchHighlight], { nullable: true })
  highlights?: SearchHighlight[];

  @Field({ nullable: true })
  snippet?: string; // Short snippet of relevant content
}

@ObjectType()
export class SearchFacet {
  @Field()
  field: string; // The field this facet represents

  @Field()
  value: string; // The facet value

  @Field()
  count: number; // Number of results with this facet value

  @Field()
  selected: boolean; // Whether this facet is currently selected
}

@ObjectType()
export class SearchAggregations {
  @Field(() => [SearchFacet])
  types: SearchFacet[];

  @Field(() => [SearchFacet])
  boards: SearchFacet[];

  @Field(() => [SearchFacet])
  labels: SearchFacet[];

  @Field(() => [SearchFacet])
  priorities: SearchFacet[];

  @Field(() => [SearchFacet])
  statuses: SearchFacet[];
}

@ObjectType()
export class SearchSuggestion {
  @Field()
  text: string;

  @Field()
  type: string; // 'completion', 'correction', 'related'

  @Field()
  score: number;
}

@ObjectType()
export class SearchResponse {
  @Field(() => [SearchResult])
  results: SearchResult[];

  @Field()
  totalCount: number;

  @Field()
  query: string;

  @Field()
  executionTime: number; // Search execution time in milliseconds

  @Field(() => SearchAggregations)
  aggregations: SearchAggregations;

  @Field(() => [SearchSuggestion])
  suggestions: SearchSuggestion[];

  @Field()
  hasMore: boolean; // Whether there are more results available
}
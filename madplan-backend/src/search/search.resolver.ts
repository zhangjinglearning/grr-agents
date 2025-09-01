import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchQueryInput } from './dto/search-query.dto';
import { SearchResponse } from './dto/search-results.dto';

@Resolver()
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => SearchResponse)
  @UseGuards(JwtAuthGuard)
  async searchGlobal(
    @Args('input') input: SearchQueryInput,
    @Context() context: any,
  ): Promise<SearchResponse> {
    const userId = context.req.user.userId;
    return this.searchService.searchGlobal(input, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async rebuildSearchIndex(
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    await this.searchService.rebuildUserIndex(userId);
    return true;
  }
}
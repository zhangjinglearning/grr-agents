import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchIndex, SearchIndexDocument, SearchItemType, SearchResultStatus } from './search.entity';
import { Board, BoardDocument } from '../boards/board.entity';
import { List, ListDocument } from '../boards/list.entity';
import { Card, CardDocument } from '../boards/card.entity';
import { SearchQueryInput } from './dto/search-query.dto';
import { SearchResponse, SearchResult, SearchAggregations, SearchFacet, SearchSuggestion } from './dto/search-results.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(SearchIndex.name) private searchIndexModel: Model<SearchIndexDocument>,
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    @InjectModel(List.name) private listModel: Model<ListDocument>,
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
  ) {}

  /**
   * Perform global search across all user's content
   */
  async searchGlobal(input: SearchQueryInput, userId: string): Promise<SearchResponse> {
    const startTime = Date.now();
    this.logger.log(`Performing global search for query "${input.query}" by user ${userId}`);

    try {
      // Build MongoDB aggregation pipeline
      const pipeline = this.buildSearchPipeline(input, userId);
      
      // Execute search
      const searchResults = await this.searchIndexModel.aggregate(pipeline).exec();
      
      // Extract results and metadata
      const results = searchResults[0]?.results || [];
      const totalCount = searchResults[0]?.totalCount || 0;
      
      // Build search response
      const response: SearchResponse = {
        results: await this.enrichSearchResults(results, input),
        totalCount,
        query: input.query,
        executionTime: Date.now() - startTime,
        aggregations: await this.buildAggregations(input, userId),
        suggestions: await this.generateSuggestions(input.query, userId),
        hasMore: (input.offset + input.limit) < totalCount,
      };

      this.logger.log(`Search completed in ${response.executionTime}ms, found ${totalCount} results`);
      return response;
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Search failed: ${error.message}`);
    }
  }

  /**
   * Build MongoDB aggregation pipeline for search
   */
  private buildSearchPipeline(input: SearchQueryInput, userId: string): any[] {
    const pipeline: any[] = [];

    // Match stage - filter by user access and basic criteria
    const matchStage: any = {
      ownerId: userId,
      status: SearchResultStatus.ACTIVE,
    };

    // Apply filters
    if (input.filters) {
      if (input.filters.types && input.filters.types.length > 0) {
        matchStage.type = { $in: input.filters.types };
      }
      
      if (input.filters.boardIds && input.filters.boardIds.length > 0) {
        matchStage.boardId = { $in: input.filters.boardIds };
      }
      
      if (input.filters.labels && input.filters.labels.length > 0) {
        matchStage.labels = { $in: input.filters.labels };
      }
      
      if (input.filters.priorities && input.filters.priorities.length > 0) {
        matchStage['metadata.priority'] = { $in: input.filters.priorities };
      }
      
      if (input.filters.dueBefore || input.filters.dueAfter) {
        matchStage['metadata.dueDate'] = {};
        if (input.filters.dueBefore) {
          matchStage['metadata.dueDate'].$lt = input.filters.dueBefore;
        }
        if (input.filters.dueAfter) {
          matchStage['metadata.dueDate'].$gt = input.filters.dueAfter;
        }
      }
      
      if (input.filters.createdBefore || input.filters.createdAfter) {
        matchStage.createdAt = {};
        if (input.filters.createdBefore) {
          matchStage.createdAt.$lt = input.filters.createdBefore;
        }
        if (input.filters.createdAfter) {
          matchStage.createdAt.$gt = input.filters.createdAfter;
        }
      }
    }

    // Text search stage
    if (input.query.trim()) {
      pipeline.push({
        $match: {
          ...matchStage,
          $text: { $search: input.query }
        }
      });
      
      // Add text search score
      pipeline.push({
        $addFields: {
          relevanceScore: { $meta: 'textScore' }
        }
      });
    } else {
      pipeline.push({ $match: matchStage });
      pipeline.push({
        $addFields: {
          relevanceScore: '$searchScore'
        }
      });
    }

    // Sort stage
    const sortStage: any = {};
    if (input.sort) {
      switch (input.sort.sortBy) {
        case 'relevance':
          sortStage.relevanceScore = input.sort.sortOrder === 'asc' ? 1 : -1;
          break;
        case 'date':
          sortStage.createdAt = input.sort.sortOrder === 'asc' ? 1 : -1;
          break;
        case 'title':
          sortStage.title = input.sort.sortOrder === 'asc' ? 1 : -1;
          break;
        case 'priority':
          sortStage['metadata.priority'] = input.sort.sortOrder === 'asc' ? 1 : -1;
          break;
        default:
          sortStage.relevanceScore = -1;
      }
    } else {
      sortStage.relevanceScore = -1;
      sortStage.createdAt = -1;
    }

    // Facet aggregation
    pipeline.push({
      $facet: {
        results: [
          { $sort: sortStage },
          { $skip: input.offset },
          { $limit: input.limit }
        ],
        totalCount: [
          { $count: 'count' }
        ]
      }
    });

    // Transform totalCount
    pipeline.push({
      $addFields: {
        totalCount: { $arrayElemAt: ['$totalCount.count', 0] }
      }
    });

    return pipeline;
  }

  /**
   * Enrich search results with additional data and highlights
   */
  private async enrichSearchResults(results: any[], input: SearchQueryInput): Promise<SearchResult[]> {
    const enrichedResults: SearchResult[] = [];

    for (const result of results) {
      const searchResult: SearchResult = {
        ...result,
        relevanceScore: result.relevanceScore || result.searchScore,
      };

      // Add snippet
      searchResult.snippet = this.generateSnippet(result.content, input.query);

      // Add highlights if requested
      if (input.includeHighlights) {
        searchResult.highlights = this.generateHighlights(result, input.query);
      }

      enrichedResults.push(searchResult);
    }

    return enrichedResults;
  }

  /**
   * Generate search aggregations for faceted search
   */
  private async buildAggregations(input: SearchQueryInput, userId: string): Promise<SearchAggregations> {
    const baseMatch = {
      ownerId: userId,
      status: SearchResultStatus.ACTIVE,
    };

    // Add text search if query provided
    if (input.query.trim()) {
      (baseMatch as any).$text = { $search: input.query };
    }

    const aggregations = await this.searchIndexModel.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          types: [
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          boards: [
            { $group: { _id: { boardId: '$boardId', boardTitle: '$metadata.boardTitle' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          labels: [
            { $unwind: '$labels' },
            { $group: { _id: '$labels', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 }
          ],
          priorities: [
            { $match: { 'metadata.priority': { $exists: true } } },
            { $group: { _id: '$metadata.priority', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          statuses: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]).exec();

    const agg = aggregations[0];

    return {
      types: this.buildFacets(agg.types, input.filters?.types),
      boards: this.buildBoardFacets(agg.boards, input.filters?.boardIds),
      labels: this.buildFacets(agg.labels, input.filters?.labels),
      priorities: this.buildFacets(agg.priorities, input.filters?.priorities),
      statuses: this.buildFacets(agg.statuses, [input.filters?.status].filter(Boolean)),
    };
  }

  /**
   * Build facet objects from aggregation results
   */
  private buildFacets(aggResults: any[], selectedValues?: string[]): SearchFacet[] {
    return aggResults.map(item => ({
      field: 'generic',
      value: item._id,
      count: item.count,
      selected: selectedValues?.includes(item._id) || false,
    }));
  }

  /**
   * Build board facets with titles
   */
  private buildBoardFacets(aggResults: any[], selectedValues?: string[]): SearchFacet[] {
    return aggResults.map(item => ({
      field: 'board',
      value: item._id.boardId,
      count: item.count,
      selected: selectedValues?.includes(item._id.boardId) || false,
    }));
  }

  /**
   * Generate search suggestions
   */
  private async generateSuggestions(query: string, userId: string): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    try {
      // Get popular search terms from user's content
      const popularTerms = await this.searchIndexModel.aggregate([
        { 
          $match: { 
            ownerId: userId,
            status: SearchResultStatus.ACTIVE 
          } 
        },
        { $unwind: '$labels' },
        { $group: { _id: '$labels', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).exec();

      // Add label suggestions
      popularTerms.forEach(term => {
        if (term._id.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            text: term._id,
            type: 'completion',
            score: term.count
          });
        }
      });

      // Add board title suggestions
      const boards = await this.boardModel.find({ ownerId: userId }).select('title').exec();
      boards.forEach(board => {
        if (board.title.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            text: board.title,
            type: 'completion',
            score: 5
          });
        }
      });

    } catch (error) {
      this.logger.warn(`Failed to generate suggestions: ${error.message}`);
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Generate content snippet for search results
   */
  private generateSnippet(content: string, query: string): string {
    const words = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    // Find the best position for snippet
    let bestPosition = 0;
    let maxMatches = 0;
    
    for (let i = 0; i < content.length - 150; i += 10) {
      const snippet = contentLower.substring(i, i + 150);
      const matches = words.filter(word => snippet.includes(word)).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestPosition = i;
      }
    }

    let snippet = content.substring(bestPosition, bestPosition + 150);
    
    // Clean up snippet boundaries
    const spaceIndex = snippet.indexOf(' ', 10);
    if (spaceIndex > 0) {
      snippet = snippet.substring(spaceIndex + 1);
    }
    
    const lastSpaceIndex = snippet.lastIndexOf(' ', snippet.length - 10);
    if (lastSpaceIndex > 0) {
      snippet = snippet.substring(0, lastSpaceIndex);
    }

    return snippet + (content.length > bestPosition + 150 ? '...' : '');
  }

  /**
   * Generate highlights for search terms
   */
  private generateHighlights(result: any, query: string): any[] {
    const highlights = [];
    const words = query.toLowerCase().split(/\s+/);

    // Check title for highlights
    const titleLower = result.title.toLowerCase();
    words.forEach(word => {
      const index = titleLower.indexOf(word);
      if (index >= 0) {
        highlights.push({
          field: 'title',
          snippet: this.highlightText(result.title, word, index),
          startIndex: index,
          endIndex: index + word.length,
        });
      }
    });

    // Check content for highlights
    const contentLower = result.content.toLowerCase();
    words.forEach(word => {
      const index = contentLower.indexOf(word);
      if (index >= 0) {
        highlights.push({
          field: 'content',
          snippet: this.highlightText(result.content, word, index, 100),
          startIndex: index,
          endIndex: index + word.length,
        });
      }
    });

    return highlights;
  }

  /**
   * Highlight search terms in text
   */
  private highlightText(text: string, term: string, index: number, contextLength: number = 50): string {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + term.length + contextLength);
    
    let snippet = text.substring(start, end);
    
    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    // Highlight the term (using markers that frontend can style)
    const termIndex = snippet.toLowerCase().indexOf(term.toLowerCase());
    if (termIndex >= 0) {
      snippet = snippet.substring(0, termIndex) + 
                '<mark>' + snippet.substring(termIndex, termIndex + term.length) + '</mark>' +
                snippet.substring(termIndex + term.length);
    }
    
    return snippet;
  }

  /**
   * Index a board for search
   */
  async indexBoard(board: any): Promise<void> {
    this.logger.log(`Indexing board ${board.id} for search`);

    try {
      const searchDoc = {
        itemId: board.id,
        type: SearchItemType.BOARD,
        title: board.title,
        content: board.title, // Boards mainly searchable by title
        tags: [],
        labels: [],
        ownerId: board.ownerId,
        boardId: board.id,
        status: SearchResultStatus.ACTIVE,
        metadata: {
          boardTitle: board.title,
        },
      };

      await this.searchIndexModel.findOneAndUpdate(
        { itemId: board.id, type: SearchItemType.BOARD },
        searchDoc,
        { upsert: true, new: true }
      ).exec();

      this.logger.log(`Board ${board.id} indexed successfully`);
    } catch (error) {
      this.logger.error(`Failed to index board: ${error.message}`, error.stack);
    }
  }

  /**
   * Index a list for search
   */
  async indexList(list: any, board: any): Promise<void> {
    this.logger.log(`Indexing list ${list.id} for search`);

    try {
      const searchDoc = {
        itemId: list.id,
        type: SearchItemType.LIST,
        title: list.title,
        content: list.title,
        tags: [],
        labels: [],
        ownerId: board.ownerId,
        boardId: board.id,
        listId: list.id,
        status: SearchResultStatus.ACTIVE,
        metadata: {
          boardTitle: board.title,
          listTitle: list.title,
        },
      };

      await this.searchIndexModel.findOneAndUpdate(
        { itemId: list.id, type: SearchItemType.LIST },
        searchDoc,
        { upsert: true, new: true }
      ).exec();

      this.logger.log(`List ${list.id} indexed successfully`);
    } catch (error) {
      this.logger.error(`Failed to index list: ${error.message}`, error.stack);
    }
  }

  /**
   * Index a card for search
   */
  async indexCard(card: any, list: any, board: any, scheduling?: any): Promise<void> {
    this.logger.log(`Indexing card ${card.id} for search`);

    try {
      // Extract labels and tags from card content
      const labels = this.extractLabels(card.content);
      const tags = this.extractTags(card.content);

      const searchDoc = {
        itemId: card.id,
        type: SearchItemType.CARD,
        title: this.extractCardTitle(card.content),
        content: card.content,
        tags,
        labels,
        ownerId: board.ownerId,
        boardId: board.id,
        listId: list.id,
        status: SearchResultStatus.ACTIVE,
        metadata: {
          priority: scheduling?.priority,
          dueDate: scheduling?.dueDate,
          assignees: this.extractAssignees(card.content),
          status: scheduling?.status,
          boardTitle: board.title,
          listTitle: list.title,
        },
      };

      await this.searchIndexModel.findOneAndUpdate(
        { itemId: card.id, type: SearchItemType.CARD },
        searchDoc,
        { upsert: true, new: true }
      ).exec();

      this.logger.log(`Card ${card.id} indexed successfully`);
    } catch (error) {
      this.logger.error(`Failed to index card: ${error.message}`, error.stack);
    }
  }

  /**
   * Remove item from search index
   */
  async removeFromIndex(itemId: string, type: SearchItemType): Promise<void> {
    this.logger.log(`Removing ${type} ${itemId} from search index`);

    try {
      await this.searchIndexModel.findOneAndUpdate(
        { itemId, type },
        { status: SearchResultStatus.DELETED },
        { new: true }
      ).exec();

      this.logger.log(`${type} ${itemId} removed from search index`);
    } catch (error) {
      this.logger.error(`Failed to remove from index: ${error.message}`, error.stack);
    }
  }

  /**
   * Rebuild search index for a user
   */
  async rebuildUserIndex(userId: string): Promise<void> {
    this.logger.log(`Rebuilding search index for user ${userId}`);

    try {
      // Clear existing index for user
      await this.searchIndexModel.deleteMany({ ownerId: userId }).exec();

      // Reindex all user's boards
      const boards = await this.boardModel.find({ ownerId: userId }).exec();
      
      for (const board of boards) {
        await this.indexBoard(board);
        
        // Index lists in this board
        const lists = await this.listModel.find({ boardId: board.id }).exec();
        
        for (const list of lists) {
          await this.indexList(list, board);
          
          // Index cards in this list
          const cards = await this.cardModel.find({ listId: list.id }).exec();
          
          for (const card of cards) {
            await this.indexCard(card, list, board);
          }
        }
      }

      this.logger.log(`Search index rebuilt successfully for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to rebuild search index: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to rebuild search index: ${error.message}`);
    }
  }

  // Helper methods for content extraction
  private extractCardTitle(content: string): string {
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim() || content.substring(0, 50);
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  }

  private extractLabels(content: string): string[] {
    // Extract labels from content (look for #hashtags)
    const labelMatches = content.match(/#[\w-]+/g) || [];
    return labelMatches.map(label => label.substring(1));
  }

  private extractTags(content: string): string[] {
    // Extract @mentions and other tag patterns
    const mentionMatches = content.match(/@[\w-]+/g) || [];
    return mentionMatches.map(mention => mention.substring(1));
  }

  private extractAssignees(content: string): string[] {
    // Extract assignee mentions
    const assigneeMatches = content.match(/@[\w.-]+/g) || [];
    return assigneeMatches.map(assignee => assignee.substring(1));
  }
}
import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SearchService } from './search.service';
import { Board, BoardDocument } from '../boards/board.entity';
import { List, ListDocument } from '../boards/list.entity';
import { Card, CardDocument } from '../boards/card.entity';
import { SearchIndex, SearchIndexDocument, SearchItemType } from './search.entity';

@Injectable()
export class IndexingService implements OnModuleInit {
  private readonly logger = new Logger(IndexingService.name);
  private isIndexing = false;

  constructor(
    @InjectModel(SearchIndex.name) private searchIndexModel: Model<SearchIndexDocument>,
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    @InjectModel(List.name) private listModel: Model<ListDocument>,
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
    private searchService: SearchService,
  ) {}

  async onModuleInit() {
    // Check if search index needs initialization
    await this.checkAndInitializeIndex();
  }

  /**
   * Check if search index is properly initialized
   */
  private async checkAndInitializeIndex(): Promise<void> {
    try {
      const indexCount = await this.searchIndexModel.countDocuments().exec();
      const boardCount = await this.boardModel.countDocuments().exec();

      this.logger.log(`Search index has ${indexCount} documents, ${boardCount} boards exist`);

      // If we have boards but no search index, rebuild
      if (boardCount > 0 && indexCount === 0) {
        this.logger.log('Search index appears empty, triggering rebuild...');
        await this.rebuildCompleteIndex();
      }
    } catch (error) {
      this.logger.error(`Failed to check search index: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle board creation/update events
   */
  async handleBoardChange(boardId: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    this.logger.log(`Handling board ${operation} for ${boardId}`);

    try {
      if (operation === 'delete') {
        await this.removeItemsFromIndex(boardId, 'board');
        return;
      }

      const board = await this.boardModel.findById(boardId).exec();
      if (board) {
        await this.searchService.indexBoard(board);
      }
    } catch (error) {
      this.logger.error(`Failed to handle board change: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle list creation/update events
   */
  async handleListChange(listId: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    this.logger.log(`Handling list ${operation} for ${listId}`);

    try {
      if (operation === 'delete') {
        await this.removeItemsFromIndex(listId, 'list');
        return;
      }

      const list = await this.listModel.findById(listId).exec();
      if (list) {
        const board = await this.boardModel.findById(list.boardId).exec();
        if (board) {
          await this.searchService.indexList(list, board);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle list change: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle card creation/update events
   */
  async handleCardChange(cardId: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    this.logger.log(`Handling card ${operation} for ${cardId}`);

    try {
      if (operation === 'delete') {
        await this.removeItemsFromIndex(cardId, 'card');
        return;
      }

      const card = await this.cardModel.findById(cardId).exec();
      if (card) {
        const list = await this.listModel.findById(card.listId).exec();
        if (list) {
          const board = await this.boardModel.findById(list.boardId).exec();
          if (board) {
            // TODO: Fetch scheduling data if available
            await this.searchService.indexCard(card, list, board);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle card change: ${error.message}`, error.stack);
    }
  }

  /**
   * Remove items from search index
   */
  private async removeItemsFromIndex(itemId: string, scope: 'board' | 'list' | 'card'): Promise<void> {
    try {
      let filter: any;

      switch (scope) {
        case 'board':
          // Remove board and all its contents
          filter = { boardId: itemId };
          break;
        case 'list':
          // Remove list and all its cards
          filter = { $or: [{ itemId }, { listId: itemId }] };
          break;
        case 'card':
          // Remove just the card
          filter = { itemId };
          break;
      }

      const result = await this.searchIndexModel.deleteMany(filter).exec();
      this.logger.log(`Removed ${result.deletedCount} items from search index for ${scope} ${itemId}`);
    } catch (error) {
      this.logger.error(`Failed to remove items from index: ${error.message}`, error.stack);
    }
  }

  /**
   * Rebuild complete search index (scheduled task)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async rebuildCompleteIndex(): Promise<void> {
    if (this.isIndexing) {
      this.logger.log('Indexing already in progress, skipping...');
      return;
    }

    this.isIndexing = true;
    this.logger.log('Starting complete search index rebuild...');

    try {
      // Get all boards
      const boards = await this.boardModel.find().exec();
      let totalIndexed = 0;

      for (const board of boards) {
        try {
          // Index the board
          await this.searchService.indexBoard(board);
          totalIndexed++;

          // Get all lists for this board
          const lists = await this.listModel.find({ boardId: board.id }).exec();

          for (const list of lists) {
            try {
              // Index the list
              await this.searchService.indexList(list, board);
              totalIndexed++;

              // Get all cards for this list
              const cards = await this.cardModel.find({ listId: list.id }).exec();

              for (const card of cards) {
                try {
                  // Index the card
                  await this.searchService.indexCard(card, list, board);
                  totalIndexed++;
                } catch (cardError) {
                  this.logger.error(`Failed to index card ${card.id}: ${cardError.message}`);
                }
              }
            } catch (listError) {
              this.logger.error(`Failed to index list ${list.id}: ${listError.message}`);
            }
          }
        } catch (boardError) {
          this.logger.error(`Failed to index board ${board.id}: ${boardError.message}`);
        }
      }

      // Clean up orphaned index entries
      await this.cleanupOrphanedEntries();

      this.logger.log(`Search index rebuild completed. Indexed ${totalIndexed} items.`);
    } catch (error) {
      this.logger.error(`Failed to rebuild search index: ${error.message}`, error.stack);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Clean up orphaned search index entries
   */
  private async cleanupOrphanedEntries(): Promise<void> {
    this.logger.log('Cleaning up orphaned search index entries...');

    try {
      let cleanedCount = 0;

      // Find all search index entries
      const searchEntries = await this.searchIndexModel.find().exec();

      for (const entry of searchEntries) {
        let exists = false;

        switch (entry.type) {
          case SearchItemType.BOARD:
            exists = await this.boardModel.exists({ _id: entry.itemId });
            break;
          case SearchItemType.LIST:
            exists = await this.listModel.exists({ _id: entry.itemId });
            break;
          case SearchItemType.CARD:
            exists = await this.cardModel.exists({ _id: entry.itemId });
            break;
        }

        if (!exists) {
          await this.searchIndexModel.findByIdAndDelete(entry.id).exec();
          cleanedCount++;
        }
      }

      this.logger.log(`Cleaned up ${cleanedCount} orphaned search index entries`);
    } catch (error) {
      this.logger.error(`Failed to cleanup orphaned entries: ${error.message}`, error.stack);
    }
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<any> {
    try {
      const stats = await this.searchIndexModel.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalScore: { $sum: '$searchScore' },
            avgScore: { $avg: '$searchScore' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]).exec();

      const totalEntries = await this.searchIndexModel.countDocuments().exec();

      return {
        totalEntries,
        byType: stats,
        isIndexing: this.isIndexing,
        lastUpdate: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get indexing stats: ${error.message}`, error.stack);
      return null;
    }
  }
}
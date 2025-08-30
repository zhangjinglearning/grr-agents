import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Board, BoardDocument } from "./board.entity";
import { List, ListDocument } from "./list.entity";
import { Card, CardDocument } from "./card.entity";
import { CreateListInput } from "./dto/create-list.dto";
import { UpdateListInput } from "./dto/update-list.dto";
import { ReorderListInput } from "./dto/reorder-list.dto";
import { CreateCardInput } from "./dto/create-card.dto";
import { UpdateCardInput } from "./dto/update-card.dto";
import { ReorderCardInput } from "./dto/reorder-card.dto";

@Injectable()
export class BoardsService {
  private readonly logger = new Logger(BoardsService.name);

  constructor(
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    @InjectModel(List.name) private listModel: Model<ListDocument>,
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
  ) {}

  /**
   * Create a new board for the authenticated user
   */
  async createBoard(title: string, ownerId: string): Promise<Board> {
    this.logger.log(`Creating board "${title}" for user ${ownerId}`);

    try {
      const board = new this.boardModel({
        title: title.trim(),
        ownerId,
        listOrder: [], // Initialize with empty list order
      });

      const savedBoard = await board.save();
      this.logger.log(`Board created successfully: ${savedBoard.id}`);
      return savedBoard;
    } catch (error) {
      this.logger.error(
        `Failed to create board: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all boards for a specific user
   */
  async getBoardsByUser(userId: string): Promise<Board[]> {
    this.logger.log(`Fetching boards for user ${userId}`);

    try {
      const boards = await this.boardModel
        .find({ ownerId: userId })
        .sort({ createdAt: -1 }) // Most recent first
        .exec();

      this.logger.log(`Found ${boards.length} boards for user ${userId}`);
      return boards;
    } catch (error) {
      this.logger.error(
        `Failed to fetch boards for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a single board by ID with ownership validation
   */
  async getBoardById(boardId: string, userId: string): Promise<Board> {
    this.logger.log(`Fetching board ${boardId} for user ${userId}`);

    try {
      const board = await this.boardModel.findById(boardId).exec();

      if (!board) {
        throw new NotFoundException(`Board with ID ${boardId} not found`);
      }

      if (board.ownerId !== userId) {
        throw new ForbiddenException(
          "You do not have permission to access this board",
        );
      }

      this.logger.log(`Board ${boardId} fetched successfully`);
      return board;
    } catch (error) {
      this.logger.error(
        `Failed to fetch board ${boardId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a board with ownership validation
   */
  async deleteBoard(boardId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting board ${boardId} for user ${userId}`);

    try {
      const board = await this.boardModel.findById(boardId).exec();

      if (!board) {
        throw new NotFoundException(`Board with ID ${boardId} not found`);
      }

      if (board.ownerId !== userId) {
        throw new ForbiddenException(
          "You do not have permission to delete this board",
        );
      }

      await this.boardModel.findByIdAndDelete(boardId).exec();
      this.logger.log(`Board ${boardId} deleted successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete board ${boardId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ==================== List Operations ====================

  /**
   * Create a new list for a specific board with ownership validation
   */
  async createList(input: CreateListInput, userId: string): Promise<List> {
    const { boardId, title } = input;
    this.logger.log(`Creating list "${title}" for board ${boardId} by user ${userId}`);

    try {
      // Validate board exists and user owns it
      const board = await this.getBoardById(boardId, userId);

      const list = new this.listModel({
        title: title.trim(),
        boardId,
        cardOrder: [],
      });

      const savedList = await list.save();

      // Update board's listOrder to include the new list
      await this.boardModel.findByIdAndUpdate(
        boardId,
        { $push: { listOrder: savedList.id } },
        { new: true }
      ).exec();

      this.logger.log(`List created successfully: ${savedList.id}`);
      return savedList;
    } catch (error) {
      this.logger.error(
        `Failed to create list: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a list with ownership validation
   */
  async updateList(input: UpdateListInput, userId: string): Promise<List> {
    const { id, title } = input;
    this.logger.log(`Updating list ${id} by user ${userId}`);

    try {
      const list = await this.listModel.findById(id).exec();

      if (!list) {
        throw new NotFoundException(`List with ID ${id} not found`);
      }

      // Validate board ownership through list's boardId
      await this.getBoardById(list.boardId, userId);

      // Update only provided fields
      if (title !== undefined) {
        list.title = title.trim();
      }

      const updatedList = await list.save();
      this.logger.log(`List ${id} updated successfully`);
      return updatedList;
    } catch (error) {
      this.logger.error(
        `Failed to update list ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a list with board ownership validation and listOrder cleanup
   */
  async deleteList(listId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting list ${listId} by user ${userId}`);

    try {
      const list = await this.listModel.findById(listId).exec();

      if (!list) {
        throw new NotFoundException(`List with ID ${listId} not found`);
      }

      // Validate board ownership through list's boardId
      await this.getBoardById(list.boardId, userId);

      // Remove list from board's listOrder
      await this.boardModel.findByIdAndUpdate(
        list.boardId,
        { $pull: { listOrder: listId } },
        { new: true }
      ).exec();

      // Delete the list
      await this.listModel.findByIdAndDelete(listId).exec();

      this.logger.log(`List ${listId} deleted successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete list ${listId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Reorder a list within a board
   */
  async reorderList(input: ReorderListInput, userId: string): Promise<Board> {
    const { listId, newIndex } = input;
    this.logger.log(`Reordering list ${listId} to index ${newIndex} by user ${userId}`);

    try {
      const list = await this.listModel.findById(listId).exec();

      if (!list) {
        throw new NotFoundException(`List with ID ${listId} not found`);
      }

      // Validate board ownership
      const board = await this.getBoardById(list.boardId, userId);

      // Validate list belongs to the board
      if (!board.listOrder.includes(listId)) {
        throw new BadRequestException(`List ${listId} does not belong to board ${board.id}`);
      }

      // Validate newIndex is within bounds
      if (newIndex < 0 || newIndex >= board.listOrder.length) {
        throw new BadRequestException(`Invalid index: ${newIndex}. Must be between 0 and ${board.listOrder.length - 1}`);
      }

      // Reorder the listOrder array
      const currentIndex = board.listOrder.indexOf(listId);
      const newListOrder = [...board.listOrder];
      
      // Remove from current position and insert at new position
      newListOrder.splice(currentIndex, 1);
      newListOrder.splice(newIndex, 0, listId);

      // Update board with new listOrder
      const updatedBoard = await this.boardModel.findByIdAndUpdate(
        board.id,
        { listOrder: newListOrder },
        { new: true }
      ).exec();

      this.logger.log(`List ${listId} reordered successfully`);
      return updatedBoard;
    } catch (error) {
      this.logger.error(
        `Failed to reorder list ${listId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get lists for a specific board with proper ordering
   */
  async getListsByBoard(boardId: string, userId: string): Promise<List[]> {
    this.logger.log(`Fetching lists for board ${boardId} by user ${userId}`);

    try {
      // Validate board ownership
      const board = await this.getBoardById(boardId, userId);

      // Get all lists for the board
      const lists = await this.listModel
        .find({ boardId })
        .sort({ createdAt: 1 }) // Default sort by creation time
        .exec();

      // Sort lists according to board's listOrder
      const sortedLists = board.listOrder
        .map(listId => lists.find(list => list.id === listId))
        .filter(list => list !== undefined) as List[];

      // Add any lists not in listOrder (edge case)
      const unorderedLists = lists.filter(
        list => !board.listOrder.includes(list.id)
      );

      this.logger.log(`Found ${sortedLists.length + unorderedLists.length} lists for board ${boardId}`);
      return [...sortedLists, ...unorderedLists];
    } catch (error) {
      this.logger.error(
        `Failed to fetch lists for board ${boardId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ==================== Card Operations ====================

  /**
   * Create a new card for a specific list with ownership validation
   */
  async createCard(input: CreateCardInput, userId: string): Promise<Card> {
    const { listId, content } = input;
    this.logger.log(`Creating card "${content.substring(0, 50)}..." for list ${listId} by user ${userId}`);

    try {
      // Validate list exists and user owns the associated board
      const list = await this.listModel.findById(listId).exec();
      if (!list) {
        throw new NotFoundException(`List with ID ${listId} not found`);
      }

      // Validate board ownership through list's boardId
      await this.getBoardById(list.boardId, userId);

      const card = new this.cardModel({
        content: content.trim(),
        listId,
      });

      const savedCard = await card.save();

      // Update list's cardOrder to include the new card
      await this.listModel.findByIdAndUpdate(
        listId,
        { $push: { cardOrder: savedCard.id } },
        { new: true }
      ).exec();

      this.logger.log(`Card created successfully: ${savedCard.id}`);
      return savedCard;
    } catch (error) {
      this.logger.error(
        `Failed to create card: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a card with ownership validation
   */
  async updateCard(input: UpdateCardInput, userId: string): Promise<Card> {
    const { id, content } = input;
    this.logger.log(`Updating card ${id} by user ${userId}`);

    try {
      const card = await this.cardModel.findById(id).exec();

      if (!card) {
        throw new NotFoundException(`Card with ID ${id} not found`);
      }

      // Validate list ownership through card's listId
      const list = await this.listModel.findById(card.listId).exec();
      if (!list) {
        throw new NotFoundException(`List with ID ${card.listId} not found`);
      }

      // Validate board ownership through list's boardId
      await this.getBoardById(list.boardId, userId);

      // Update only provided fields
      if (content !== undefined) {
        card.content = content.trim();
      }

      const updatedCard = await card.save();
      this.logger.log(`Card ${id} updated successfully`);
      return updatedCard;
    } catch (error) {
      this.logger.error(
        `Failed to update card ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a card with list ownership validation and cardOrder cleanup
   */
  async deleteCard(cardId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting card ${cardId} by user ${userId}`);

    try {
      const card = await this.cardModel.findById(cardId).exec();

      if (!card) {
        throw new NotFoundException(`Card with ID ${cardId} not found`);
      }

      // Validate list ownership through card's listId
      const list = await this.listModel.findById(card.listId).exec();
      if (!list) {
        throw new NotFoundException(`List with ID ${card.listId} not found`);
      }

      // Validate board ownership through list's boardId
      await this.getBoardById(list.boardId, userId);

      // Remove card from list's cardOrder
      await this.listModel.findByIdAndUpdate(
        card.listId,
        { $pull: { cardOrder: cardId } },
        { new: true }
      ).exec();

      // Delete the card
      await this.cardModel.findByIdAndDelete(cardId).exec();

      this.logger.log(`Card ${cardId} deleted successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete card ${cardId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Reorder a card within or between lists
   */
  async reorderCard(input: ReorderCardInput, userId: string): Promise<Board> {
    const { cardId, sourceListId, destListId, newIndex } = input;
    this.logger.log(`Reordering card ${cardId} from list ${sourceListId} to list ${destListId} at index ${newIndex} by user ${userId}`);

    try {
      const card = await this.cardModel.findById(cardId).exec();
      if (!card) {
        throw new NotFoundException(`Card with ID ${cardId} not found`);
      }

      // Validate card belongs to source list
      if (card.listId !== sourceListId) {
        throw new BadRequestException(`Card ${cardId} does not belong to source list ${sourceListId}`);
      }

      const sourceList = await this.listModel.findById(sourceListId).exec();
      if (!sourceList) {
        throw new NotFoundException(`Source list with ID ${sourceListId} not found`);
      }

      const destList = await this.listModel.findById(destListId).exec();
      if (!destList) {
        throw new NotFoundException(`Destination list with ID ${destListId} not found`);
      }

      // Validate both lists belong to the same board and user owns it
      if (sourceList.boardId !== destList.boardId) {
        throw new BadRequestException(`Source and destination lists must belong to the same board`);
      }

      const board = await this.getBoardById(sourceList.boardId, userId);

      // Validate newIndex is within bounds for destination list
      if (newIndex < 0 || newIndex > destList.cardOrder.length) {
        throw new BadRequestException(`Invalid index: ${newIndex}. Must be between 0 and ${destList.cardOrder.length}`);
      }

      // Remove card from source list's cardOrder
      const sourceCardOrder = [...sourceList.cardOrder];
      const cardIndex = sourceCardOrder.indexOf(cardId);
      if (cardIndex === -1) {
        throw new BadRequestException(`Card ${cardId} not found in source list's cardOrder`);
      }
      sourceCardOrder.splice(cardIndex, 1);

      // Add card to destination list's cardOrder at new index
      const destCardOrder = sourceListId === destListId ? sourceCardOrder : [...destList.cardOrder];
      destCardOrder.splice(newIndex, 0, cardId);

      // Update card's listId if moving between lists
      if (sourceListId !== destListId) {
        await this.cardModel.findByIdAndUpdate(
          cardId,
          { listId: destListId },
          { new: true }
        ).exec();
      }

      // Update source list cardOrder (if different from destination)
      if (sourceListId !== destListId) {
        await this.listModel.findByIdAndUpdate(
          sourceListId,
          { cardOrder: sourceCardOrder },
          { new: true }
        ).exec();
      }

      // Update destination list cardOrder
      await this.listModel.findByIdAndUpdate(
        destListId,
        { cardOrder: destCardOrder },
        { new: true }
      ).exec();

      this.logger.log(`Card ${cardId} reordered successfully`);
      return board;
    } catch (error) {
      this.logger.error(
        `Failed to reorder card ${cardId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get cards for a specific list with proper ordering
   */
  async getCardsByList(listId: string, userId: string): Promise<Card[]> {
    this.logger.log(`Fetching cards for list ${listId} by user ${userId}`);

    try {
      // Validate list ownership
      const list = await this.listModel.findById(listId).exec();
      if (!list) {
        throw new NotFoundException(`List with ID ${listId} not found`);
      }

      // Validate board ownership through list's boardId
      await this.getBoardById(list.boardId, userId);

      // Get all cards for the list
      const cards = await this.cardModel
        .find({ listId })
        .sort({ createdAt: 1 }) // Default sort by creation time
        .exec();

      // Sort cards according to list's cardOrder
      const sortedCards = list.cardOrder
        .map(cardId => cards.find(card => card.id === cardId))
        .filter(card => card !== undefined) as Card[];

      // Add any cards not in cardOrder (edge case)
      const unorderedCards = cards.filter(
        card => !list.cardOrder.includes(card.id)
      );

      this.logger.log(`Found ${sortedCards.length + unorderedCards.length} cards for list ${listId}`);
      return [...sortedCards, ...unorderedCards];
    } catch (error) {
      this.logger.error(
        `Failed to fetch cards for list ${listId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

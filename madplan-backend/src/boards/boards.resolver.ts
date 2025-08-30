import { Resolver, Query, Mutation, Args, Context, ResolveField, Parent } from "@nestjs/graphql";
import { UseGuards, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Board } from "./board.entity";
import { List } from "./list.entity";
import { Card } from "./card.entity";
import { BoardsService } from "./boards.service";
import { CreateListInput } from "./dto/create-list.dto";
import { UpdateListInput } from "./dto/update-list.dto";
import { ReorderListInput } from "./dto/reorder-list.dto";
import { CreateCardInput } from "./dto/create-card.dto";
import { UpdateCardInput } from "./dto/update-card.dto";
import { ReorderCardInput } from "./dto/reorder-card.dto";

@Resolver(() => Board)
@UseGuards(AuthGuard("jwt"))
export class BoardsResolver {
  private readonly logger = new Logger(BoardsResolver.name);

  constructor(private readonly boardsService: BoardsService) {}

  @Mutation(() => Board)
  async createBoard(
    @Args("title") title: string,
    @Context() context: any,
  ): Promise<Board> {
    const userId = context.req.user.id;
    this.logger.log(`Creating board "${title}" for user ${userId}`);

    return this.boardsService.createBoard(title, userId);
  }

  @Query(() => [Board])
  async myBoards(@Context() context: any): Promise<Board[]> {
    const userId = context.req.user.id;
    this.logger.log(`Fetching boards for user ${userId}`);

    return this.boardsService.getBoardsByUser(userId);
  }

  @Query(() => Board, { nullable: true })
  async board(
    @Args("id") id: string,
    @Context() context: any,
  ): Promise<Board | null> {
    const userId = context.req.user.id;
    this.logger.log(`Fetching board ${id} for user ${userId}`);

    try {
      return await this.boardsService.getBoardById(id, userId);
    } catch (error) {
      this.logger.error(`Failed to fetch board ${id}: ${error.message}`);
      return null;
    }
  }

  @Mutation(() => Boolean)
  async deleteBoard(
    @Args("id") id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.id;
    this.logger.log(`Deleting board ${id} for user ${userId}`);

    return this.boardsService.deleteBoard(id, userId);
  }

  // ==================== Field Resolvers ====================

  @ResolveField(() => [List])
  async lists(@Parent() board: Board, @Context() context: any): Promise<List[]> {
    const userId = context.req.user.id;
    return this.boardsService.getListsByBoard(board.id, userId);
  }

  // ==================== List Mutations ====================

  @Mutation(() => List)
  async createList(
    @Args("input") input: CreateListInput,
    @Context() context: any,
  ): Promise<List> {
    const userId = context.req.user.id;
    this.logger.log(`Creating list "${input.title}" for board ${input.boardId} by user ${userId}`);

    return this.boardsService.createList(input, userId);
  }

  @Mutation(() => List)
  async updateList(
    @Args("input") input: UpdateListInput,
    @Context() context: any,
  ): Promise<List> {
    const userId = context.req.user.id;
    this.logger.log(`Updating list ${input.id} by user ${userId}`);

    return this.boardsService.updateList(input, userId);
  }

  @Mutation(() => Boolean)
  async deleteList(
    @Args("id") id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.id;
    this.logger.log(`Deleting list ${id} by user ${userId}`);

    return this.boardsService.deleteList(id, userId);
  }

  @Mutation(() => Board)
  async reorderList(
    @Args("input") input: ReorderListInput,
    @Context() context: any,
  ): Promise<Board> {
    const userId = context.req.user.id;
    this.logger.log(`Reordering list ${input.listId} to index ${input.newIndex} by user ${userId}`);

    return this.boardsService.reorderList(input, userId);
  }

  // ==================== List Queries ====================

  @Query(() => [List])
  async boardLists(
    @Args("boardId") boardId: string,
    @Context() context: any,
  ): Promise<List[]> {
    const userId = context.req.user.id;
    this.logger.log(`Fetching lists for board ${boardId} by user ${userId}`);

    return this.boardsService.getListsByBoard(boardId, userId);
  }

  // ==================== Card Mutations ====================

  @Mutation(() => Card)
  async createCard(
    @Args("input") input: CreateCardInput,
    @Context() context: any,
  ): Promise<Card> {
    const userId = context.req.user.id;
    this.logger.log(`Creating card for list ${input.listId} by user ${userId}`);

    return this.boardsService.createCard(input, userId);
  }

  @Mutation(() => Card)
  async updateCard(
    @Args("input") input: UpdateCardInput,
    @Context() context: any,
  ): Promise<Card> {
    const userId = context.req.user.id;
    this.logger.log(`Updating card ${input.id} by user ${userId}`);

    return this.boardsService.updateCard(input, userId);
  }

  @Mutation(() => Boolean)
  async deleteCard(
    @Args("id") id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.id;
    this.logger.log(`Deleting card ${id} by user ${userId}`);

    return this.boardsService.deleteCard(id, userId);
  }

  @Mutation(() => Board)
  async reorderCard(
    @Args("input") input: ReorderCardInput,
    @Context() context: any,
  ): Promise<Board> {
    const userId = context.req.user.id;
    this.logger.log(`Reordering card ${input.cardId} by user ${userId}`);

    return this.boardsService.reorderCard(input, userId);
  }

  // ==================== Card Queries ====================

  @Query(() => [Card])
  async listCards(
    @Args("listId") listId: string,
    @Context() context: any,
  ): Promise<Card[]> {
    const userId = context.req.user.id;
    this.logger.log(`Fetching cards for list ${listId} by user ${userId}`);

    return this.boardsService.getCardsByList(listId, userId);
  }
}

@Resolver(() => List)
@UseGuards(AuthGuard("jwt"))
export class ListsResolver {
  private readonly logger = new Logger(ListsResolver.name);

  constructor(private readonly boardsService: BoardsService) {}

  // ==================== List Field Resolvers ====================
  @ResolveField(() => [Card])
  async cards(@Parent() list: List, @Context() context: any): Promise<Card[]> {
    const userId = context.req.user.id;
    return this.boardsService.getCardsByList(list.id, userId);
  }
}

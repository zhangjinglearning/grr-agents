import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';
import { BoardShare, BoardActivity } from './collaboration.entity';
import { CreateShareInput, UpdateShareInput, ShareQueryInput, ActivityQueryInput } from './dto/collaboration.dto';

@Resolver(() => BoardShare)
export class CollaborationResolver {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Mutation(() => BoardShare)
  @UseGuards(JwtAuthGuard)
  async createBoardShare(
    @Args('input') input: CreateShareInput,
    @Context() context: any,
  ): Promise<BoardShare> {
    const userId = context.req.user.userId;
    return this.collaborationService.createShare(input, userId);
  }

  @Mutation(() => BoardShare)
  async acceptBoardShare(
    @Args('shareToken') shareToken: string,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
  ): Promise<BoardShare> {
    return this.collaborationService.acceptShare(shareToken, userId);
  }

  @Mutation(() => BoardShare)
  @UseGuards(JwtAuthGuard)
  async updateBoardShare(
    @Args('shareId', { type: () => ID }) shareId: string,
    @Args('input') input: UpdateShareInput,
    @Context() context: any,
  ): Promise<BoardShare> {
    const userId = context.req.user.userId;
    return this.collaborationService.updateShare(shareId, input, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async revokeBoardShare(
    @Args('shareId', { type: () => ID }) shareId: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    return this.collaborationService.revokeShare(shareId, userId);
  }

  @Query(() => [BoardShare])
  @UseGuards(JwtAuthGuard)
  async getBoardShares(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Context() context: any,
  ): Promise<BoardShare[]> {
    const userId = context.req.user.userId;
    return this.collaborationService.getBoardShares(boardId, userId);
  }

  @Query(() => [BoardShare])
  @UseGuards(JwtAuthGuard)
  async getSharedBoards(
    @Context() context: any,
    @Args('query', { nullable: true }) query?: ShareQueryInput,
  ): Promise<BoardShare[]> {
    const userId = context.req.user.userId;
    return this.collaborationService.getSharedWithMe(userId, query);
  }

  @Query(() => [BoardActivity])
  @UseGuards(JwtAuthGuard)
  async getBoardActivity(
    @Args('input') input: ActivityQueryInput,
    @Context() context: any,
  ): Promise<BoardActivity[]> {
    const userId = context.req.user.userId;
    return this.collaborationService.getBoardActivity(input.boardId, userId, input.limit);
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async generateShareLink(
    @Context() context: any,
    @Args('boardId', { type: () => ID }) boardId: string,
    @Args('permission') permission: string,
    @Args('expiresAt', { nullable: true }) expiresAt?: Date,
  ): Promise<string> {
    const userId = context.req.user.userId;
    return this.collaborationService.generateShareLink(boardId, userId, permission as any, expiresAt);
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getCollaborationStats(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Context() context: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    return this.collaborationService.getCollaborationStats(boardId, userId);
  }
}
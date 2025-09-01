import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchedulingService } from './scheduling.service';
import { CardScheduling, SchedulingStatus } from './scheduling.entity';
import { CreateSchedulingInput } from './dto/create-scheduling.dto';
import { UpdateSchedulingInput } from './dto/update-scheduling.dto';

@Resolver(() => CardScheduling)
export class SchedulingResolver {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Mutation(() => CardScheduling)
  @UseGuards(JwtAuthGuard)
  async createScheduling(
    @Args('input') input: CreateSchedulingInput,
    @Context() context: any,
  ): Promise<CardScheduling> {
    const userId = context.req.user.userId;
    return this.schedulingService.createScheduling(input, userId);
  }

  @Query(() => CardScheduling, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async getCardScheduling(
    @Args('cardId') cardId: string,
    @Context() context: any,
  ): Promise<CardScheduling | null> {
    const userId = context.req.user.userId;
    return this.schedulingService.getCardScheduling(cardId, userId);
  }

  @Mutation(() => CardScheduling)
  @UseGuards(JwtAuthGuard)
  async updateScheduling(
    @Args('input') input: UpdateSchedulingInput,
    @Context() context: any,
  ): Promise<CardScheduling> {
    const userId = context.req.user.userId;
    return this.schedulingService.updateScheduling(input, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteScheduling(
    @Args('cardId') cardId: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    return this.schedulingService.deleteScheduling(cardId, userId);
  }

  @Query(() => [CardScheduling])
  @UseGuards(JwtAuthGuard)
  async getUserScheduledCards(
    @Args('status', { type: () => SchedulingStatus, nullable: true }) status: SchedulingStatus,
    @Args('dueBefore', { type: () => Date, nullable: true }) dueBefore: Date,
    @Args('dueAfter', { type: () => Date, nullable: true }) dueAfter: Date,
    @Args('limit', { type: () => Number, defaultValue: 50 }) limit: number,
    @Context() context: any,
  ): Promise<CardScheduling[]> {
    const userId = context.req.user.userId;
    return this.schedulingService.getUserScheduledCards(userId, status, dueBefore, dueAfter, limit);
  }

  @Query(() => [CardScheduling])
  @UseGuards(JwtAuthGuard)
  async getOverdueCards(
    @Context() context: any,
  ): Promise<CardScheduling[]> {
    const userId = context.req.user.userId;
    return this.schedulingService.getOverdueCards(userId);
  }

  @Query(() => [CardScheduling])
  @UseGuards(JwtAuthGuard)
  async getCardsDueSoon(
    @Args('hours', { type: () => Number, defaultValue: 24 }) hours: number,
    @Context() context: any,
  ): Promise<CardScheduling[]> {
    const userId = context.req.user.userId;
    return this.schedulingService.getCardsDueSoon(userId, hours);
  }

  @Mutation(() => CardScheduling)
  @UseGuards(JwtAuthGuard)
  async markCardCompleted(
    @Args('cardId') cardId: string,
    @Context() context: any,
  ): Promise<CardScheduling> {
    const userId = context.req.user.userId;
    return this.schedulingService.markCardCompleted(cardId, userId);
  }
}
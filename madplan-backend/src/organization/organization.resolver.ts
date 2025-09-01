import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';
import {
  Label,
  CustomField,
  CardOrganization,
  BoardOrganizationSettings,
} from './organization.entity';
import {
  CreateLabelInput,
  UpdateLabelInput,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  UpdateCardOrganizationInput,
  OrganizationQueryInput,
  UpdateBoardOrganizationSettingsInput,
} from './dto/organization.dto';

@Resolver(() => Label)
export class LabelResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Mutation(() => Label)
  @UseGuards(JwtAuthGuard)
  async createLabel(
    @Args('input') input: CreateLabelInput,
    @Context() context: any,
  ): Promise<Label> {
    const userId = context.req.user.userId;
    return this.organizationService.createLabel(input, userId);
  }

  @Mutation(() => Label)
  @UseGuards(JwtAuthGuard)
  async updateLabel(
    @Args('labelId', { type: () => ID }) labelId: string,
    @Args('input') input: UpdateLabelInput,
    @Context() context: any,
  ): Promise<Label> {
    const userId = context.req.user.userId;
    return this.organizationService.updateLabel(labelId, input, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteLabel(
    @Args('labelId', { type: () => ID }) labelId: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    return this.organizationService.deleteLabel(labelId, userId);
  }

  @Query(() => [Label])
  @UseGuards(JwtAuthGuard)
  async getBoardLabels(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Context() context: any,
  ): Promise<Label[]> {
    const userId = context.req.user.userId;
    return this.organizationService.getBoardLabels(boardId, userId);
  }
}

@Resolver(() => CustomField)
export class CustomFieldResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Mutation(() => CustomField)
  @UseGuards(JwtAuthGuard)
  async createCustomField(
    @Args('input') input: CreateCustomFieldInput,
    @Context() context: any,
  ): Promise<CustomField> {
    const userId = context.req.user.userId;
    return this.organizationService.createCustomField(input, userId);
  }

  @Mutation(() => CustomField)
  @UseGuards(JwtAuthGuard)
  async updateCustomField(
    @Args('fieldId', { type: () => ID }) fieldId: string,
    @Args('input') input: UpdateCustomFieldInput,
    @Context() context: any,
  ): Promise<CustomField> {
    const userId = context.req.user.userId;
    return this.organizationService.updateCustomField(fieldId, input, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteCustomField(
    @Args('fieldId', { type: () => ID }) fieldId: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    return this.organizationService.deleteCustomField(fieldId, userId);
  }

  @Query(() => [CustomField])
  @UseGuards(JwtAuthGuard)
  async getBoardCustomFields(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Context() context: any,
  ): Promise<CustomField[]> {
    const userId = context.req.user.userId;
    return this.organizationService.getBoardCustomFields(boardId, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async reorderCustomFields(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Args('fieldIds', { type: () => [ID] }) fieldIds: string[],
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    return this.organizationService.reorderCustomFields(boardId, fieldIds, userId);
  }
}

@Resolver(() => CardOrganization)
export class CardOrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Mutation(() => CardOrganization)
  @UseGuards(JwtAuthGuard)
  async updateCardOrganization(
    @Args('cardId', { type: () => ID }) cardId: string,
    @Args('input') input: UpdateCardOrganizationInput,
    @Context() context: any,
  ): Promise<CardOrganization> {
    const userId = context.req.user.userId;
    return this.organizationService.updateCardOrganization(cardId, input, userId);
  }

  @Query(() => CardOrganization, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async getCardOrganization(
    @Args('cardId', { type: () => ID }) cardId: string,
    @Context() context: any,
  ): Promise<CardOrganization | null> {
    const userId = context.req.user.userId;
    return this.organizationService.getCardOrganization(cardId, userId);
  }

  @Query(() => [CardOrganization])
  @UseGuards(JwtAuthGuard)
  async getOrganizedCards(
    @Args('query') query: OrganizationQueryInput,
    @Context() context: any,
  ): Promise<CardOrganization[]> {
    const userId = context.req.user.userId;
    return this.organizationService.getOrganizedCards(query, userId);
  }
}

@Resolver(() => BoardOrganizationSettings)
export class BoardOrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Query(() => BoardOrganizationSettings)
  @UseGuards(JwtAuthGuard)
  async getBoardOrganizationSettings(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Context() context: any,
  ): Promise<BoardOrganizationSettings> {
    const userId = context.req.user.userId;
    return this.organizationService.getBoardOrganizationSettings(boardId, userId);
  }

  @Mutation(() => BoardOrganizationSettings)
  @UseGuards(JwtAuthGuard)
  async updateBoardOrganizationSettings(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Args('input') input: UpdateBoardOrganizationSettingsInput,
    @Context() context: any,
  ): Promise<BoardOrganizationSettings> {
    const userId = context.req.user.userId;
    return this.organizationService.updateBoardOrganizationSettings(boardId, input, userId);
  }

  @Query(() => Object)
  @UseGuards(JwtAuthGuard)
  async getBoardOrganizationSummary(
    @Args('boardId', { type: () => ID }) boardId: string,
    @Context() context: any,
  ): Promise<any> {
    const userId = context.req.user.userId;
    return this.organizationService.getBoardOrganizationSummary(boardId, userId);
  }
}
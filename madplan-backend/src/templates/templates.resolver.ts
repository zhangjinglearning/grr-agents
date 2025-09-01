import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, ParseEnumPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { CardTemplate, TemplateCategory } from './template.entity';
import { Card } from '../boards/card.entity';
import { CreateTemplateInput } from './dto/create-template.dto';
import { UpdateTemplateInput } from './dto/update-template.dto';
import { ApplyTemplateInput } from './dto/apply-template.dto';

@Resolver(() => CardTemplate)
export class TemplatesResolver {
  constructor(private readonly templatesService: TemplatesService) {}

  @Mutation(() => CardTemplate)
  @UseGuards(JwtAuthGuard)
  async createTemplate(
    @Args('input') input: CreateTemplateInput,
    @Context() context: any,
  ): Promise<CardTemplate> {
    const userId = context.req.user.userId;
    return this.templatesService.createTemplate(input, userId);
  }

  @Query(() => [CardTemplate])
  @UseGuards(JwtAuthGuard)
  async getUserTemplates(
    @Args('category', { type: () => TemplateCategory, nullable: true }) 
    category: TemplateCategory,
    @Context() context: any,
  ): Promise<CardTemplate[]> {
    const userId = context.req.user.userId;
    return this.templatesService.getUserTemplates(userId, category);
  }

  @Query(() => [CardTemplate])
  async getPopularTemplates(
    @Args('limit', { type: () => Number, defaultValue: 10 }) limit: number,
  ): Promise<CardTemplate[]> {
    return this.templatesService.getPopularTemplates(limit);
  }

  @Query(() => CardTemplate)
  @UseGuards(JwtAuthGuard)
  async getTemplate(
    @Args('id') id: string,
    @Context() context: any,
  ): Promise<CardTemplate> {
    const userId = context.req.user.userId;
    return this.templatesService.getTemplate(id, userId);
  }

  @Mutation(() => CardTemplate)
  @UseGuards(JwtAuthGuard)
  async updateTemplate(
    @Args('input') input: UpdateTemplateInput,
    @Context() context: any,
  ): Promise<CardTemplate> {
    const userId = context.req.user.userId;
    return this.templatesService.updateTemplate(input, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteTemplate(
    @Args('id') id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    return this.templatesService.deleteTemplate(id, userId);
  }

  @Mutation(() => Card)
  @UseGuards(JwtAuthGuard)
  async applyTemplate(
    @Args('input') input: ApplyTemplateInput,
    @Context() context: any,
  ): Promise<Card> {
    const userId = context.req.user.userId;
    return this.templatesService.applyTemplate(input, userId);
  }

  @Query(() => [CardTemplate])
  @UseGuards(JwtAuthGuard)
  async searchTemplates(
    @Args('query') query: string,
    @Args('limit', { type: () => Number, defaultValue: 20 }) limit: number,
    @Context() context: any,
  ): Promise<CardTemplate[]> {
    const userId = context.req.user.userId;
    return this.templatesService.searchTemplates(query, userId, limit);
  }
}
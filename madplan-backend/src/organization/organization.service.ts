import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Label,
  LabelDocument,
  CustomField,
  CustomFieldDocument,
  CardOrganization,
  CardOrganizationDocument,
  BoardOrganizationSettings,
  BoardOrganizationSettingsDocument,
  Priority,
  CustomFieldType,
  LabelColor,
} from './organization.entity';
import { Board, BoardDocument } from '../boards/board.entity';
import { Card, CardDocument } from '../boards/card.entity';
import {
  CreateLabelInput,
  UpdateLabelInput,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  UpdateCardOrganizationInput,
  OrganizationQueryInput,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @InjectModel(Label.name) private labelModel: Model<LabelDocument>,
    @InjectModel(CustomField.name) private customFieldModel: Model<CustomFieldDocument>,
    @InjectModel(CardOrganization.name) private cardOrganizationModel: Model<CardOrganizationDocument>,
    @InjectModel(BoardOrganizationSettings.name) private settingsModel: Model<BoardOrganizationSettingsDocument>,
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  // Label Management
  async createLabel(input: CreateLabelInput, userId: string): Promise<Label> {
    await this.validateBoardAccess(input.boardId, userId);

    const settings = await this.getOrCreateBoardSettings(input.boardId);
    if (!settings.enableLabels) {
      throw new BadRequestException('Labels are disabled for this board');
    }

    const existingLabel = await this.labelModel.findOne({
      boardId: input.boardId,
      name: input.name,
      isActive: true,
    }).exec();

    if (existingLabel) {
      throw new BadRequestException('Label with this name already exists');
    }

    const label = new this.labelModel({
      ...input,
      createdBy: userId,
    });

    const savedLabel = await label.save();

    this.eventEmitter.emit('label.created', {
      boardId: input.boardId,
      labelId: savedLabel.id,
      userId,
    });

    return savedLabel;
  }

  async updateLabel(labelId: string, input: UpdateLabelInput, userId: string): Promise<Label> {
    const label = await this.labelModel.findById(labelId).exec();
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    await this.validateBoardAccess(label.boardId, userId);

    if (input.name && input.name !== label.name) {
      const existingLabel = await this.labelModel.findOne({
        boardId: label.boardId,
        name: input.name,
        isActive: true,
        _id: { $ne: labelId },
      }).exec();

      if (existingLabel) {
        throw new BadRequestException('Label with this name already exists');
      }
    }

    Object.assign(label, input);
    const updatedLabel = await label.save();

    this.eventEmitter.emit('label.updated', {
      boardId: label.boardId,
      labelId,
      userId,
      changes: input,
    });

    return updatedLabel;
  }

  async deleteLabel(labelId: string, userId: string): Promise<boolean> {
    const label = await this.labelModel.findById(labelId).exec();
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    await this.validateBoardAccess(label.boardId, userId);

    // Soft delete - mark as inactive
    label.isActive = false;
    await label.save();

    // Remove from all cards
    await this.cardOrganizationModel.updateMany(
      { boardId: label.boardId },
      { $pull: { labelIds: labelId } }
    ).exec();

    this.eventEmitter.emit('label.deleted', {
      boardId: label.boardId,
      labelId,
      userId,
    });

    return true;
  }

  async getBoardLabels(boardId: string, userId: string): Promise<Label[]> {
    await this.validateBoardAccess(boardId, userId);

    return this.labelModel.find({
      boardId,
      isActive: true,
    }).sort({ usageCount: -1, name: 1 }).exec();
  }

  // Custom Field Management
  async createCustomField(input: CreateCustomFieldInput, userId: string): Promise<CustomField> {
    await this.validateBoardAccess(input.boardId, userId);

    const settings = await this.getOrCreateBoardSettings(input.boardId);
    if (!settings.enableCustomFields) {
      throw new BadRequestException('Custom fields are disabled for this board');
    }

    const fieldCount = await this.customFieldModel.countDocuments({
      boardId: input.boardId,
      isActive: true,
    }).exec();

    if (fieldCount >= settings.maxCustomFieldsPerBoard) {
      throw new BadRequestException(`Maximum ${settings.maxCustomFieldsPerBoard} custom fields allowed per board`);
    }

    const existingField = await this.customFieldModel.findOne({
      boardId: input.boardId,
      name: input.name,
      isActive: true,
    }).exec();

    if (existingField) {
      throw new BadRequestException('Custom field with this name already exists');
    }

    const maxPosition = await this.customFieldModel.findOne({
      boardId: input.boardId,
      isActive: true,
    }).sort({ position: -1 }).exec();

    const customField = new this.customFieldModel({
      ...input,
      createdBy: userId,
      position: (maxPosition?.position ?? -1) + 1,
    });

    const savedField = await customField.save();

    this.eventEmitter.emit('customField.created', {
      boardId: input.boardId,
      fieldId: savedField.id,
      userId,
    });

    return savedField;
  }

  async updateCustomField(fieldId: string, input: UpdateCustomFieldInput, userId: string): Promise<CustomField> {
    const field = await this.customFieldModel.findById(fieldId).exec();
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    await this.validateBoardAccess(field.boardId, userId);

    if (input.name && input.name !== field.name) {
      const existingField = await this.customFieldModel.findOne({
        boardId: field.boardId,
        name: input.name,
        isActive: true,
        _id: { $ne: fieldId },
      }).exec();

      if (existingField) {
        throw new BadRequestException('Custom field with this name already exists');
      }
    }

    Object.assign(field, input);
    field.updatedAt = new Date();
    const updatedField = await field.save();

    this.eventEmitter.emit('customField.updated', {
      boardId: field.boardId,
      fieldId,
      userId,
      changes: input,
    });

    return updatedField;
  }

  async deleteCustomField(fieldId: string, userId: string): Promise<boolean> {
    const field = await this.customFieldModel.findById(fieldId).exec();
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    await this.validateBoardAccess(field.boardId, userId);

    // Soft delete - mark as inactive
    field.isActive = false;
    field.updatedAt = new Date();
    await field.save();

    // Remove field values from all cards
    await this.cardOrganizationModel.updateMany(
      { boardId: field.boardId },
      { $pull: { customFieldValues: { fieldId } } }
    ).exec();

    this.eventEmitter.emit('customField.deleted', {
      boardId: field.boardId,
      fieldId,
      userId,
    });

    return true;
  }

  async getBoardCustomFields(boardId: string, userId: string): Promise<CustomField[]> {
    await this.validateBoardAccess(boardId, userId);

    return this.customFieldModel.find({
      boardId,
      isActive: true,
    }).sort({ position: 1 }).exec();
  }

  async reorderCustomFields(boardId: string, fieldIds: string[], userId: string): Promise<boolean> {
    await this.validateBoardAccess(boardId, userId);

    const bulkOps = fieldIds.map((fieldId, index) => ({
      updateOne: {
        filter: { _id: fieldId, boardId },
        update: { position: index, updatedAt: new Date() },
      },
    }));

    await this.customFieldModel.bulkWrite(bulkOps);

    this.eventEmitter.emit('customFields.reordered', {
      boardId,
      fieldIds,
      userId,
    });

    return true;
  }

  // Card Organization Management
  async updateCardOrganization(cardId: string, input: UpdateCardOrganizationInput, userId: string): Promise<CardOrganization> {
    const card = await this.cardModel.findById(cardId).exec();
    if (!card) {
      throw new NotFoundException('Card not found');
    }

    await this.validateBoardAccess(card.boardId, userId);

    let cardOrg = await this.cardOrganizationModel.findOne({ cardId }).exec();

    if (!cardOrg) {
      cardOrg = new this.cardOrganizationModel({
        cardId,
        boardId: card.boardId,
        labelIds: [],
        customFieldValues: [],
        tags: [],
      });
    }

    // Validate label IDs
    if (input.labelIds) {
      const validLabels = await this.labelModel.find({
        _id: { $in: input.labelIds },
        boardId: card.boardId,
        isActive: true,
      }).exec();

      if (validLabels.length !== input.labelIds.length) {
        throw new BadRequestException('One or more labels are invalid');
      }

      // Update usage count for labels
      await this.labelModel.updateMany(
        { _id: { $in: input.labelIds } },
        { $inc: { usageCount: 1 } }
      ).exec();

      // Decrease usage count for removed labels
      const removedLabels = cardOrg.labelIds.filter(id => !input.labelIds.includes(id));
      if (removedLabels.length > 0) {
        await this.labelModel.updateMany(
          { _id: { $in: removedLabels } },
          { $inc: { usageCount: -1 } }
        ).exec();
      }
    }

    // Validate custom field values
    if (input.customFieldValues) {
      const fieldIds = input.customFieldValues.map(v => v.fieldId);
      const validFields = await this.customFieldModel.find({
        _id: { $in: fieldIds },
        boardId: card.boardId,
        isActive: true,
      }).exec();

      if (validFields.length !== fieldIds.length) {
        throw new BadRequestException('One or more custom fields are invalid');
      }

      // Validate field values
      for (const fieldValue of input.customFieldValues) {
        const field = validFields.find(f => f.id === fieldValue.fieldId);
        if (field && !this.validateFieldValue(field, fieldValue.value, fieldValue.multiValue)) {
          throw new BadRequestException(`Invalid value for field "${field.name}"`);
        }
      }
    }

    // Update card organization
    Object.assign(cardOrg, input);
    cardOrg.updatedAt = new Date();
    const savedCardOrg = await cardOrg.save();

    this.eventEmitter.emit('cardOrganization.updated', {
      cardId,
      boardId: card.boardId,
      userId,
      changes: input,
    });

    return savedCardOrg;
  }

  async getCardOrganization(cardId: string, userId: string): Promise<CardOrganization | null> {
    const card = await this.cardModel.findById(cardId).exec();
    if (!card) {
      throw new NotFoundException('Card not found');
    }

    await this.validateBoardAccess(card.boardId, userId);

    return this.cardOrganizationModel.findOne({ cardId })
      .populate('labelIds')
      .exec();
  }

  // Board Organization Settings
  async getBoardOrganizationSettings(boardId: string, userId: string): Promise<BoardOrganizationSettings> {
    await this.validateBoardAccess(boardId, userId);
    return this.getOrCreateBoardSettings(boardId);
  }

  async updateBoardOrganizationSettings(
    boardId: string,
    settings: Partial<BoardOrganizationSettings>,
    userId: string,
  ): Promise<BoardOrganizationSettings> {
    await this.validateBoardAccess(boardId, userId);

    let boardSettings = await this.settingsModel.findOne({ boardId }).exec();

    if (!boardSettings) {
      boardSettings = new this.settingsModel({
        boardId,
        ...settings,
      });
    } else {
      Object.assign(boardSettings, settings);
      boardSettings.updatedAt = new Date();
    }

    const savedSettings = await boardSettings.save();

    this.eventEmitter.emit('boardOrganizationSettings.updated', {
      boardId,
      userId,
      settings,
    });

    return savedSettings;
  }

  // Query and Filtering
  async getOrganizedCards(query: OrganizationQueryInput, userId: string): Promise<any> {
    await this.validateBoardAccess(query.boardId, userId);

    const filter: any = { boardId: query.boardId };

    if (query.labelIds && query.labelIds.length > 0) {
      filter.labelIds = { $in: query.labelIds };
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    const cardOrgs = await this.cardOrganizationModel.find(filter)
      .populate('labelIds')
      .populate('cardId')
      .sort({ updatedAt: -1 })
      .limit(query.limit || 100)
      .exec();

    return cardOrgs;
  }

  async getBoardOrganizationSummary(boardId: string, userId: string): Promise<any> {
    await this.validateBoardAccess(boardId, userId);

    const [labelStats, priorityStats, fieldStats] = await Promise.all([
      this.cardOrganizationModel.aggregate([
        { $match: { boardId } },
        { $unwind: '$labelIds' },
        { $group: { _id: '$labelIds', count: { $sum: 1 } } },
        { $lookup: { from: 'labels', localField: '_id', foreignField: '_id', as: 'label' } },
        { $unwind: '$label' },
        { $project: { name: '$label.name', color: '$label.color', count: 1 } },
        { $sort: { count: -1 } },
      ]).exec(),

      this.cardOrganizationModel.aggregate([
        { $match: { boardId, priority: { $exists: true } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec(),

      this.customFieldModel.countDocuments({ boardId, isActive: true }).exec(),
    ]);

    const totalCards = await this.cardOrganizationModel.countDocuments({ boardId }).exec();

    return {
      totalCards,
      labelStats,
      priorityStats,
      customFieldCount: fieldStats,
    };
  }

  // Helper Methods
  private async validateBoardAccess(boardId: string, userId: string): Promise<void> {
    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.createdBy !== userId) {
      // TODO: Check collaboration permissions
      throw new ForbiddenException('Access denied');
    }
  }

  private async getOrCreateBoardSettings(boardId: string): Promise<BoardOrganizationSettings> {
    let settings = await this.settingsModel.findOne({ boardId }).exec();

    if (!settings) {
      settings = new this.settingsModel({
        boardId,
        availablePriorities: Object.values(Priority),
      });
      await settings.save();
    }

    return settings;
  }

  private validateFieldValue(field: CustomField, value?: string, multiValue?: string[]): boolean {
    if (field.isRequired && !value && (!multiValue || multiValue.length === 0)) {
      return false;
    }

    if (!value && (!multiValue || multiValue.length === 0)) {
      return true; // Optional field with no value is valid
    }

    switch (field.type) {
      case CustomFieldType.NUMBER:
        return !isNaN(Number(value));
      
      case CustomFieldType.EMAIL:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
      
      case CustomFieldType.URL:
        try {
          new URL(value || '');
          return true;
        } catch {
          return false;
        }
      
      case CustomFieldType.PHONE:
        return /^[\+]?[1-9][\d]{0,15}$/.test(value || '');
      
      case CustomFieldType.SELECT:
        return field.options?.some(opt => opt.value === value) || false;
      
      case CustomFieldType.MULTI_SELECT:
        return multiValue?.every(val => field.options?.some(opt => opt.value === val)) || false;
      
      case CustomFieldType.BOOLEAN:
        return value === 'true' || value === 'false';
      
      default:
        return true; // TEXT, DATE, USER are handled by frontend validation
    }
  }
}
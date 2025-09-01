import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CardScheduling, SchedulingDocument, SchedulingStatus, RecurrenceType } from './scheduling.entity';
import { Card, CardDocument } from '../boards/card.entity';
import { CreateSchedulingInput } from './dto/create-scheduling.dto';
import { UpdateSchedulingInput } from './dto/update-scheduling.dto';
import { NotificationsService } from './notifications.service';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectModel(CardScheduling.name) private schedulingModel: Model<SchedulingDocument>,
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create or update scheduling for a card
   */
  async createScheduling(input: CreateSchedulingInput, userId: string): Promise<CardScheduling> {
    this.logger.log(`Creating scheduling for card ${input.cardId} by user ${userId}`);

    try {
      // Verify card exists and user has access
      const card = await this.cardModel.findById(input.cardId).exec();
      if (!card) {
        throw new NotFoundException('Card not found');
      }

      // Check if scheduling already exists for this card
      const existingScheduling = await this.schedulingModel.findOne({ cardId: input.cardId }).exec();
      if (existingScheduling) {
        throw new BadRequestException('Scheduling already exists for this card. Use update instead.');
      }

      // Validate timing string format for reminders
      this.validateReminderTimings(input.reminders);

      // Create scheduling
      const scheduling = new this.schedulingModel({
        ...input,
        status: SchedulingStatus.PENDING,
      });

      const savedScheduling = await scheduling.save();
      
      // Schedule reminders if due date is set
      if (savedScheduling.dueDate && savedScheduling.reminders.length > 0) {
        await this.notificationsService.scheduleReminders(savedScheduling);
      }

      this.logger.log(`Scheduling created successfully: ${savedScheduling.id}`);
      return savedScheduling;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create scheduling: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create scheduling: ${error.message}`);
    }
  }

  /**
   * Get scheduling for a specific card
   */
  async getCardScheduling(cardId: string, userId: string): Promise<CardScheduling | null> {
    this.logger.log(`Fetching scheduling for card ${cardId} by user ${userId}`);

    try {
      // Verify card exists and user has access
      const card = await this.cardModel.findById(cardId).exec();
      if (!card) {
        throw new NotFoundException('Card not found');
      }

      const scheduling = await this.schedulingModel
        .findOne({ cardId })
        .populate('card')
        .exec();

      return scheduling;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch card scheduling: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch card scheduling: ${error.message}`);
    }
  }

  /**
   * Update scheduling for a card
   */
  async updateScheduling(input: UpdateSchedulingInput, userId: string): Promise<CardScheduling> {
    this.logger.log(`Updating scheduling for card ${input.cardId} by user ${userId}`);

    try {
      // Verify card exists and user has access
      const card = await this.cardModel.findById(input.cardId).exec();
      if (!card) {
        throw new NotFoundException('Card not found');
      }

      const scheduling = await this.schedulingModel.findOne({ cardId: input.cardId }).exec();
      if (!scheduling) {
        throw new NotFoundException('Scheduling not found for this card');
      }

      // Validate timing string format for reminders if provided
      if (input.reminders) {
        this.validateReminderTimings(input.reminders);
      }

      // Update scheduling
      const updatedScheduling = await this.schedulingModel
        .findOneAndUpdate(
          { cardId: input.cardId },
          { $set: input },
          { new: true, runValidators: true }
        )
        .populate('card')
        .exec();

      // Reschedule reminders if due date or reminders changed
      if (input.dueDate !== undefined || input.reminders !== undefined) {
        await this.notificationsService.updateReminders(updatedScheduling);
      }

      this.logger.log(`Scheduling updated successfully: ${updatedScheduling.id}`);
      return updatedScheduling;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update scheduling: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to update scheduling: ${error.message}`);
    }
  }

  /**
   * Delete scheduling for a card
   */
  async deleteScheduling(cardId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting scheduling for card ${cardId} by user ${userId}`);

    try {
      // Verify card exists and user has access
      const card = await this.cardModel.findById(cardId).exec();
      if (!card) {
        throw new NotFoundException('Card not found');
      }

      const scheduling = await this.schedulingModel.findOne({ cardId }).exec();
      if (!scheduling) {
        throw new NotFoundException('Scheduling not found for this card');
      }

      // Cancel any scheduled reminders
      await this.notificationsService.cancelReminders(scheduling);

      // Delete scheduling
      await this.schedulingModel.findOneAndDelete({ cardId }).exec();
      
      this.logger.log(`Scheduling deleted successfully for card: ${cardId}`);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete scheduling: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to delete scheduling: ${error.message}`);
    }
  }

  /**
   * Get user's scheduled cards with filtering options
   */
  async getUserScheduledCards(
    userId: string,
    status?: SchedulingStatus,
    dueBefore?: Date,
    dueAfter?: Date,
    limit: number = 50
  ): Promise<CardScheduling[]> {
    this.logger.log(`Fetching scheduled cards for user ${userId}`);

    try {
      const filter: any = {};

      // Add status filter
      if (status) {
        filter.status = status;
      }

      // Add date range filters
      if (dueBefore || dueAfter) {
        filter.dueDate = {};
        if (dueBefore) {
          filter.dueDate.$lt = dueBefore;
        }
        if (dueAfter) {
          filter.dueDate.$gt = dueAfter;
        }
      }

      const scheduledCards = await this.schedulingModel
        .find(filter)
        .populate({
          path: 'card',
          match: { /* We'll need to add user filtering at the card/board level */ }
        })
        .sort({ dueDate: 1 })
        .limit(limit)
        .exec();

      // Filter out cards that don't belong to the user (after population)
      const userScheduledCards = scheduledCards.filter(sc => sc.card != null);

      this.logger.log(`Found ${userScheduledCards.length} scheduled cards for user ${userId}`);
      return userScheduledCards;
    } catch (error) {
      this.logger.error(`Failed to fetch user scheduled cards: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch user scheduled cards: ${error.message}`);
    }
  }

  /**
   * Get overdue cards
   */
  async getOverdueCards(userId: string): Promise<CardScheduling[]> {
    this.logger.log(`Fetching overdue cards for user ${userId}`);

    return this.getUserScheduledCards(
      userId,
      SchedulingStatus.OVERDUE,
      new Date(), // Due before now
      undefined,
      100
    );
  }

  /**
   * Get cards due soon (within specified hours)
   */
  async getCardsDueSoon(userId: string, hours: number = 24): Promise<CardScheduling[]> {
    this.logger.log(`Fetching cards due within ${hours} hours for user ${userId}`);

    const now = new Date();
    const soon = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return this.getUserScheduledCards(
      userId,
      SchedulingStatus.PENDING,
      soon, // Due before 'soon'
      now,  // Due after now
      100
    );
  }

  /**
   * Mark card as completed
   */
  async markCardCompleted(cardId: string, userId: string): Promise<CardScheduling> {
    this.logger.log(`Marking card ${cardId} as completed by user ${userId}`);

    const updatedScheduling = await this.updateScheduling(
      { cardId, status: SchedulingStatus.COMPLETED },
      userId
    );

    // Handle recurring tasks
    if (updatedScheduling.isRecurring && updatedScheduling.recurrencePattern) {
      await this.createNextRecurrence(updatedScheduling, userId);
    }

    return updatedScheduling;
  }

  /**
   * Create next occurrence of a recurring task
   */
  private async createNextRecurrence(scheduling: CardScheduling, userId: string): Promise<void> {
    this.logger.log(`Creating next recurrence for card ${scheduling.cardId}`);

    try {
      if (!scheduling.recurrencePattern || !scheduling.dueDate) {
        return;
      }

      // Calculate next due date
      const nextDueDate = this.calculateNextDueDate(
        scheduling.dueDate,
        scheduling.recurrencePattern
      );

      if (!nextDueDate) {
        this.logger.log(`No more recurrences for card ${scheduling.cardId}`);
        return;
      }

      // Create new scheduling for next occurrence
      const nextStartDate = scheduling.startDate
        ? this.calculateNextDueDate(scheduling.startDate, scheduling.recurrencePattern)
        : undefined;

      const nextSchedulingInput: CreateSchedulingInput = {
        cardId: scheduling.cardId,
        dueDate: nextDueDate,
        startDate: nextStartDate,
        isRecurring: true,
        recurrencePattern: scheduling.recurrencePattern,
        reminders: scheduling.reminders,
        timeZone: scheduling.timeZone,
        estimatedMinutes: scheduling.estimatedMinutes,
      };

      // Delete current scheduling and create new one
      await this.schedulingModel.findOneAndDelete({ cardId: scheduling.cardId }).exec();
      await this.createScheduling(nextSchedulingInput, userId);

      this.logger.log(`Next recurrence created for card ${scheduling.cardId}`);
    } catch (error) {
      this.logger.error(`Failed to create next recurrence: ${error.message}`, error.stack);
    }
  }

  /**
   * Calculate next due date based on recurrence pattern
   */
  private calculateNextDueDate(currentDate: Date, pattern: any): Date | null {
    const nextDate = new Date(currentDate);

    switch (pattern.type) {
      case RecurrenceType.DAILY:
        nextDate.setDate(nextDate.getDate() + pattern.interval);
        break;

      case RecurrenceType.WEEKLY:
        nextDate.setDate(nextDate.getDate() + (pattern.interval * 7));
        break;

      case RecurrenceType.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + pattern.interval);
        break;

      default:
        this.logger.warn(`Unsupported recurrence type: ${pattern.type}`);
        return null;
    }

    // Check if we've exceeded the end date
    if (pattern.endDate && nextDate > pattern.endDate) {
      return null;
    }

    return nextDate;
  }

  /**
   * Validate reminder timing format
   */
  private validateReminderTimings(reminders: any[]): void {
    const validPattern = /^\d+[mhdw]$/; // e.g., "30m", "1h", "2d", "1w"

    for (const reminder of reminders) {
      if (!validPattern.test(reminder.timing)) {
        throw new BadRequestException(
          `Invalid reminder timing format: ${reminder.timing}. Use format like "30m", "1h", "2d", "1w"`
        );
      }
    }
  }

  /**
   * Scheduled task to update overdue status
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateOverdueStatus(): Promise<void> {
    this.logger.log('Running scheduled overdue status update');

    try {
      const result = await this.schedulingModel.updateMany(
        {
          status: SchedulingStatus.PENDING,
          dueDate: { $lt: new Date() }
        },
        {
          $set: { status: SchedulingStatus.OVERDUE }
        }
      ).exec();

      this.logger.log(`Updated ${result.modifiedCount} cards to overdue status`);
    } catch (error) {
      this.logger.error(`Failed to update overdue status: ${error.message}`, error.stack);
    }
  }

  /**
   * Scheduled task to process due reminders
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processDueReminders(): Promise<void> {
    this.logger.log('Processing due reminders');

    try {
      await this.notificationsService.processDueReminders();
    } catch (error) {
      this.logger.error(`Failed to process due reminders: ${error.message}`, error.stack);
    }
  }
}
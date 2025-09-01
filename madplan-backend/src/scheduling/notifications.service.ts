import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CardScheduling, SchedulingDocument, ReminderType } from './scheduling.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private scheduledReminders = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(CardScheduling.name) private schedulingModel: Model<SchedulingDocument>,
  ) {}

  /**
   * Schedule reminders for a card
   */
  async scheduleReminders(scheduling: CardScheduling): Promise<void> {
    this.logger.log(`Scheduling reminders for card ${scheduling.cardId}`);

    if (!scheduling.dueDate || scheduling.reminders.length === 0) {
      return;
    }

    // Cancel existing reminders for this card
    await this.cancelReminders(scheduling);

    for (const reminder of scheduling.reminders) {
      if (!reminder.enabled) continue;

      const reminderTime = this.calculateReminderTime(scheduling.dueDate, reminder.timing);
      
      if (reminderTime > new Date()) {
        const timeoutId = setTimeout(() => {
          this.sendReminder(scheduling, reminder);
        }, reminderTime.getTime() - Date.now());

        // Store timeout ID for later cancellation
        const reminderKey = `${scheduling.cardId}-${reminder.type}-${reminder.timing}`;
        this.scheduledReminders.set(reminderKey, timeoutId);

        this.logger.log(`Scheduled ${reminder.type} reminder for card ${scheduling.cardId} at ${reminderTime}`);
      } else {
        this.logger.log(`Reminder time ${reminderTime} has already passed for card ${scheduling.cardId}`);
      }
    }
  }

  /**
   * Cancel all reminders for a card
   */
  async cancelReminders(scheduling: CardScheduling): Promise<void> {
    this.logger.log(`Canceling reminders for card ${scheduling.cardId}`);

    for (const reminder of scheduling.reminders) {
      const reminderKey = `${scheduling.cardId}-${reminder.type}-${reminder.timing}`;
      const timeoutId = this.scheduledReminders.get(reminderKey);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.scheduledReminders.delete(reminderKey);
        this.logger.log(`Canceled ${reminder.type} reminder for card ${scheduling.cardId}`);
      }
    }
  }

  /**
   * Update reminders for a card
   */
  async updateReminders(scheduling: CardScheduling): Promise<void> {
    this.logger.log(`Updating reminders for card ${scheduling.cardId}`);

    // Cancel existing reminders
    await this.cancelReminders(scheduling);

    // Schedule new reminders
    await this.scheduleReminders(scheduling);
  }

  /**
   * Process due reminders (called by scheduled task)
   */
  async processDueReminders(): Promise<void> {
    this.logger.log('Processing due reminders');

    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000); // Next 15 minutes

      // Find cards with due dates in the next 15 minutes
      const upcomingSchedules = await this.schedulingModel
        .find({
          dueDate: { $gte: now, $lte: soon },
          status: { $ne: 'completed' }
        })
        .populate('card')
        .exec();

      for (const schedule of upcomingSchedules) {
        for (const reminder of schedule.reminders) {
          if (!reminder.enabled) continue;

          const reminderTime = this.calculateReminderTime(schedule.dueDate!, reminder.timing);
          
          // Check if this reminder should fire now (within 1 minute tolerance)
          if (Math.abs(reminderTime.getTime() - now.getTime()) <= 60000) {
            await this.sendReminder(schedule, reminder);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process due reminders: ${error.message}`, error.stack);
    }
  }

  /**
   * Calculate when a reminder should be sent
   */
  private calculateReminderTime(dueDate: Date, timing: string): Date {
    const reminderDate = new Date(dueDate);
    
    // Parse timing string (e.g., "1h", "30m", "1d", "1w")
    const match = timing.match(/^(\d+)([mhdw])$/);
    if (!match) {
      throw new Error(`Invalid timing format: ${timing}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': // minutes
        reminderDate.setMinutes(reminderDate.getMinutes() - value);
        break;
      case 'h': // hours
        reminderDate.setHours(reminderDate.getHours() - value);
        break;
      case 'd': // days
        reminderDate.setDate(reminderDate.getDate() - value);
        break;
      case 'w': // weeks
        reminderDate.setDate(reminderDate.getDate() - (value * 7));
        break;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }

    return reminderDate;
  }

  /**
   * Send a reminder notification
   */
  private async sendReminder(scheduling: CardScheduling, reminder: any): Promise<void> {
    this.logger.log(`Sending ${reminder.type} reminder for card ${scheduling.cardId}`);

    try {
      const card = (scheduling as any).card;
      const cardTitle = card?.content || 'Untitled Card';
      
      const reminderData = {
        cardId: scheduling.cardId,
        cardTitle,
        dueDate: scheduling.dueDate,
        reminderType: reminder.type,
        timing: reminder.timing,
      };

      switch (reminder.type) {
        case ReminderType.EMAIL:
          await this.sendEmailReminder(reminderData);
          break;
        case ReminderType.PUSH:
          await this.sendPushReminder(reminderData);
          break;
        case ReminderType.IN_APP:
          await this.sendInAppReminder(reminderData);
          break;
        default:
          this.logger.warn(`Unsupported reminder type: ${reminder.type}`);
      }

      this.logger.log(`${reminder.type} reminder sent successfully for card ${scheduling.cardId}`);
    } catch (error) {
      this.logger.error(`Failed to send reminder: ${error.message}`, error.stack);
    }
  }

  /**
   * Send email reminder (placeholder implementation)
   */
  private async sendEmailReminder(data: any): Promise<void> {
    // TODO: Integrate with email service (SendGrid, Nodemailer, etc.)
    this.logger.log(`EMAIL REMINDER: Card "${data.cardTitle}" is due ${data.timing} (${data.dueDate})`);
  }

  /**
   * Send push notification reminder (placeholder implementation)
   */
  private async sendPushReminder(data: any): Promise<void> {
    // TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
    this.logger.log(`PUSH REMINDER: Card "${data.cardTitle}" is due ${data.timing} (${data.dueDate})`);
  }

  /**
   * Send in-app reminder (placeholder implementation)
   */
  private async sendInAppReminder(data: any): Promise<void> {
    // TODO: Integrate with WebSocket or real-time notification system
    this.logger.log(`IN-APP REMINDER: Card "${data.cardTitle}" is due ${data.timing} (${data.dueDate})`);
  }
}
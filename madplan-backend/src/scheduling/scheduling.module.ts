import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CardScheduling, CardSchedulingSchema } from './scheduling.entity';
import { Card, CardSchema } from '../boards/card.entity';
import { SchedulingService } from './scheduling.service';
import { SchedulingResolver } from './scheduling.resolver';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardScheduling.name, schema: CardSchedulingSchema },
      { name: Card.name, schema: CardSchema },
    ]),
    ScheduleModule.forRoot(), // Enable scheduled tasks
  ],
  providers: [SchedulingService, SchedulingResolver, NotificationsService],
  exports: [SchedulingService, NotificationsService],
})
export class SchedulingModule {}
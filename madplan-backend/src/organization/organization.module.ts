import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Label,
  LabelSchema,
  CustomField,
  CustomFieldSchema,
  CardOrganization,
  CardOrganizationSchema,
  BoardOrganizationSettings,
  BoardOrganizationSettingsSchema,
} from './organization.entity';
import { Board, BoardSchema } from '../boards/board.entity';
import { Card, CardSchema } from '../boards/card.entity';
import { OrganizationService } from './organization.service';
import {
  LabelResolver,
  CustomFieldResolver,
  CardOrganizationResolver,
  BoardOrganizationResolver,
} from './organization.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Label.name, schema: LabelSchema },
      { name: CustomField.name, schema: CustomFieldSchema },
      { name: CardOrganization.name, schema: CardOrganizationSchema },
      { name: BoardOrganizationSettings.name, schema: BoardOrganizationSettingsSchema },
      { name: Board.name, schema: BoardSchema },
      { name: Card.name, schema: CardSchema },
    ]),
  ],
  providers: [
    OrganizationService,
    LabelResolver,
    CustomFieldResolver,
    CardOrganizationResolver,
    BoardOrganizationResolver,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
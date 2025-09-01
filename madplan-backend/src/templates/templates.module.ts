import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardTemplate, CardTemplateSchema } from './template.entity';
import { Card, CardSchema } from '../boards/card.entity';
import { TemplatesService } from './templates.service';
import { TemplatesResolver } from './templates.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardTemplate.name, schema: CardTemplateSchema },
      { name: Card.name, schema: CardSchema },
    ]),
  ],
  providers: [TemplatesService, TemplatesResolver],
  exports: [TemplatesService],
})
export class TemplatesModule {}
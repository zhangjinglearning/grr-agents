import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchIndex, SearchIndexSchema } from './search.entity';
import { Board, BoardSchema } from '../boards/board.entity';
import { List, ListSchema } from '../boards/list.entity';
import { Card, CardSchema } from '../boards/card.entity';
import { SearchService } from './search.service';
import { SearchResolver } from './search.resolver';
import { IndexingService } from './indexing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SearchIndex.name, schema: SearchIndexSchema },
      { name: Board.name, schema: BoardSchema },
      { name: List.name, schema: ListSchema },
      { name: Card.name, schema: CardSchema },
    ]),
  ],
  providers: [SearchService, SearchResolver, IndexingService],
  exports: [SearchService, IndexingService],
})
export class SearchModule {}
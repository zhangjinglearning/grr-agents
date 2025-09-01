import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Board, BoardSchema } from "./board.entity";
import { List, ListSchema } from "./list.entity";
import { Card, CardSchema } from "./card.entity";
import { BoardsService } from "./boards.service";
import { BoardsResolver, ListsResolver } from "./boards.resolver";
import { ThemesModule } from "../themes/themes.module";

@Module({
  imports: [
    // Register Board, List, and Card schemas with MongoDB
    MongooseModule.forFeature([
      { name: Board.name, schema: BoardSchema },
      { name: List.name, schema: ListSchema },
      { name: Card.name, schema: CardSchema },
    ]),
    ThemesModule, // Import ThemesModule to access ThemesService
  ],
  providers: [BoardsService, BoardsResolver, ListsResolver],
  exports: [
    BoardsService, // Export service for potential use in other modules
  ],
})
export class BoardsModule {}

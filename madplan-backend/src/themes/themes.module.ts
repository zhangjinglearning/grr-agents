import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Theme, ThemeSchema } from "./theme.entity";
import { ThemesService } from "./themes.service";
import { ThemesResolver } from "./themes.resolver";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Theme.name, schema: ThemeSchema }
    ]),
  ],
  providers: [ThemesService, ThemesResolver],
  exports: [ThemesService], // Export service for use in other modules
})
export class ThemesModule {}
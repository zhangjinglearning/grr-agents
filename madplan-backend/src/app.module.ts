import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppResolver } from "./app.resolver";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { BoardsModule } from "./boards/boards.module";
import { ThemesModule } from "./themes/themes.module";
import { TemplatesModule } from "./templates/templates.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { SearchModule } from "./search/search.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { OrganizationModule } from "./organization/organization.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // MongoDB connection
    MongooseModule.forRoot(
      process.env.MONGODB_URI || "mongodb://localhost:27017/madplan",
    ),

    // Event emitter for real-time features
    EventEmitterModule.forRoot(),

    // GraphQL configuration
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: process.env.NODE_ENV !== "production",
      introspection: true,
    }),

    // Feature modules
    UsersModule,
    AuthModule,
    BoardsModule,
    ThemesModule,
    TemplatesModule,
    SchedulingModule,
    SearchModule,
    CollaborationModule,
    OrganizationModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppResolver],
})
export class AppModule {}

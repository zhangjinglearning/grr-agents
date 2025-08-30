import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./user.entity";
import { UsersService } from "./users.service";
import { UsersResolver } from "./users.resolver";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    // Register User schema with MongoDB
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Forward reference to avoid circular dependency
    forwardRef(() => AuthModule),
  ],
  providers: [UsersService, UsersResolver],
  exports: [
    UsersService, // Export service for use in AuthModule
  ],
})
export class UsersModule {}

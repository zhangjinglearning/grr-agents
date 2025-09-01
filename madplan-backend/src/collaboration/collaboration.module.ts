import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { BoardShare, BoardShareSchema, BoardActivity, BoardActivitySchema } from './collaboration.entity';
import { Board, BoardSchema } from '../boards/board.entity';
import { CollaborationService } from './collaboration.service';
import { CollaborationResolver } from './collaboration.resolver';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BoardShare.name, schema: BoardShareSchema },
      { name: BoardActivity.name, schema: BoardActivitySchema },
      { name: Board.name, schema: BoardSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [CollaborationService, CollaborationResolver, RealtimeGateway],
  exports: [CollaborationService, RealtimeGateway],
})
export class CollaborationModule {}
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { CollaborationService } from './collaboration.service';
import { SharePermission } from './collaboration.entity';
import { OnEvent } from '@nestjs/event-emitter';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  boardRooms?: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/boards',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    private collaborationService: CollaborationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket, ...args: any[]) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.userId;
      client.boardRooms = new Set();

      this.connectedClients.set(client.id, client);
      this.logger.log(`Client connected: ${client.userId}`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.boardRooms) {
      client.boardRooms.forEach(room => {
        client.leave(room);
        this.server.to(room).emit('user_left', {
          userId: client.userId,
          boardId: room.replace('board:', ''),
        });
      });
    }

    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.userId}`);
  }

  @SubscribeMessage('join_board')
  async handleJoinBoard(
    @MessageBody() data: { boardId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { boardId } = data;
    
    if (!client.userId) {
      return { error: 'Not authenticated' };
    }

    try {
      const hasAccess = await this.collaborationService.checkBoardAccess(boardId, client.userId);
      if (!hasAccess) {
        return { error: 'Access denied' };
      }

      const room = `board:${boardId}`;
      await client.join(room);
      client.boardRooms?.add(room);

      this.server.to(room).emit('user_joined', {
        userId: client.userId,
        boardId,
        permission: hasAccess,
      });

      await this.collaborationService.logActivity({
        boardId,
        userId: client.userId,
        action: 'board_joined',
        entityType: 'realtime_session',
      });

      return { success: true, room };
    } catch (error) {
      this.logger.error(`Failed to join board ${boardId}: ${error.message}`);
      return { error: 'Failed to join board' };
    }
  }

  @SubscribeMessage('leave_board')
  async handleLeaveBoard(
    @MessageBody() data: { boardId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { boardId } = data;
    const room = `board:${boardId}`;
    
    await client.leave(room);
    client.boardRooms?.delete(room);

    this.server.to(room).emit('user_left', {
      userId: client.userId,
      boardId,
    });

    if (client.userId) {
      await this.collaborationService.logActivity({
        boardId,
        userId: client.userId,
        action: 'board_left',
        entityType: 'realtime_session',
      });
    }

    return { success: true };
  }

  @SubscribeMessage('cursor_move')
  async handleCursorMove(
    @MessageBody() data: { boardId: string; x: number; y: number; elementId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { boardId, x, y, elementId } = data;
    const room = `board:${boardId}`;

    client.to(room).emit('cursor_update', {
      userId: client.userId,
      x,
      y,
      elementId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('start_editing')
  async handleStartEditing(
    @MessageBody() data: { boardId: string; elementId: string; elementType: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { boardId, elementId, elementType } = data;
    const room = `board:${boardId}`;

    client.to(room).emit('editing_started', {
      userId: client.userId,
      elementId,
      elementType,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('stop_editing')
  async handleStopEditing(
    @MessageBody() data: { boardId: string; elementId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { boardId, elementId } = data;
    const room = `board:${boardId}`;

    client.to(room).emit('editing_stopped', {
      userId: client.userId,
      elementId,
      timestamp: new Date(),
    });
  }

  // Event listeners for board changes
  @OnEvent('board.updated')
  async handleBoardUpdated(payload: { boardId: string; userId: string; changes: any }) {
    const room = `board:${payload.boardId}`;
    this.server.to(room).emit('board_updated', {
      boardId: payload.boardId,
      userId: payload.userId,
      changes: payload.changes,
      timestamp: new Date(),
    });
  }

  @OnEvent('list.created')
  @OnEvent('list.updated')
  @OnEvent('list.deleted')
  async handleListChange(payload: { boardId: string; listId: string; action: string; data?: any }) {
    const room = `board:${payload.boardId}`;
    this.server.to(room).emit('list_changed', {
      action: payload.action,
      listId: payload.listId,
      data: payload.data,
      timestamp: new Date(),
    });
  }

  @OnEvent('card.created')
  @OnEvent('card.updated')
  @OnEvent('card.deleted')
  @OnEvent('card.moved')
  async handleCardChange(payload: { boardId: string; cardId: string; action: string; data?: any }) {
    const room = `board:${payload.boardId}`;
    this.server.to(room).emit('card_changed', {
      action: payload.action,
      cardId: payload.cardId,
      data: payload.data,
      timestamp: new Date(),
    });
  }

  @OnEvent('board.shared')
  async handleBoardShared(payload: { boardId: string; shareId: string; sharedBy: string }) {
    const room = `board:${payload.boardId}`;
    this.server.to(room).emit('board_shared', {
      shareId: payload.shareId,
      sharedBy: payload.sharedBy,
      timestamp: new Date(),
    });
  }

  @OnEvent('board.share.accepted')
  async handleShareAccepted(payload: { boardId: string; shareId: string; userId?: string }) {
    const room = `board:${payload.boardId}`;
    this.server.to(room).emit('user_joined_board', {
      userId: payload.userId,
      shareId: payload.shareId,
      timestamp: new Date(),
    });
  }

  @OnEvent('board.activity')
  async handleBoardActivity(payload: { boardId: string; userId: string; action: string; timestamp: Date }) {
    const room = `board:${payload.boardId}`;
    this.server.to(room).emit('activity_logged', {
      userId: payload.userId,
      action: payload.action,
      timestamp: payload.timestamp,
    });
  }

  // Utility methods
  async broadcastToBoardUsers(boardId: string, event: string, data: any) {
    const room = `board:${boardId}`;
    this.server.to(room).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  async getConnectedUsers(boardId: string): Promise<string[]> {
    const room = `board:${boardId}`;
    const sockets = await this.server.in(room).fetchSockets();
    return sockets
      .map(socket => (socket as any).userId)
      .filter(userId => userId);
  }

  async notifyUserDirectly(userId: string, event: string, data: any) {
    const userClients = Array.from(this.connectedClients.values())
      .filter(client => client.userId === userId);

    userClients.forEach(client => {
      client.emit(event, {
        ...data,
        timestamp: new Date(),
      });
    });
  }
}
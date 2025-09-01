import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BoardShare, BoardShareDocument, BoardActivity, BoardActivityDocument, SharePermission, ShareStatus, InviteMethod } from './collaboration.entity';
import { Board, BoardDocument } from '../boards/board.entity';
import { CreateShareInput, UpdateShareInput, ShareQueryInput } from './dto/collaboration.dto';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    @InjectModel(BoardShare.name) private shareModel: Model<BoardShareDocument>,
    @InjectModel(BoardActivity.name) private activityModel: Model<BoardActivityDocument>,
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createShare(input: CreateShareInput, userId: string): Promise<BoardShare> {
    const board = await this.boardModel.findById(input.boardId).exec();
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.createdBy !== userId) {
      throw new ForbiddenException('Only board owner can share boards');
    }

    if (input.email && input.isLinkShare) {
      throw new BadRequestException('Cannot specify email for link shares');
    }

    const shareToken = uuidv4();
    const shareLink = input.isLinkShare ? 
      `${process.env.FRONTEND_URL}/boards/shared/${shareToken}` : undefined;

    const share = new this.shareModel({
      boardId: input.boardId,
      sharedBy: userId,
      sharedWith: input.sharedWith,
      email: input.email,
      permission: input.permission,
      inviteMethod: input.inviteMethod,
      shareToken,
      shareLink,
      expiresAt: input.expiresAt,
      isLinkShare: input.isLinkShare || false,
      message: input.message,
    });

    const savedShare = await share.save();

    await this.logActivity({
      boardId: input.boardId,
      userId,
      action: 'share_created',
      entityType: 'board_share',
      entityId: savedShare.id,
      details: {
        permission: input.permission,
        inviteMethod: input.inviteMethod,
        isLinkShare: input.isLinkShare,
      },
    });

    this.eventEmitter.emit('board.shared', {
      boardId: input.boardId,
      shareId: savedShare.id,
      sharedBy: userId,
      permission: input.permission,
    });

    return savedShare;
  }

  async acceptShare(shareToken: string, userId?: string): Promise<BoardShare> {
    const share = await this.shareModel.findOne({
      shareToken,
      status: ShareStatus.PENDING,
    }).exec();

    if (!share) {
      throw new NotFoundException('Invalid or expired share link');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      share.status = ShareStatus.EXPIRED;
      await share.save();
      throw new BadRequestException('Share link has expired');
    }

    if (!share.isLinkShare && userId) {
      share.sharedWith = userId;
    }

    share.status = ShareStatus.ACTIVE;
    share.acceptedAt = new Date();
    share.lastAccessedAt = new Date();

    const updatedShare = await share.save();

    await this.logActivity({
      boardId: share.boardId,
      userId: userId || 'anonymous',
      action: 'share_accepted',
      entityType: 'board_share',
      entityId: share.id,
      details: {
        permission: share.permission,
        acceptedAt: share.acceptedAt,
      },
    });

    this.eventEmitter.emit('board.share.accepted', {
      boardId: share.boardId,
      shareId: share.id,
      userId,
    });

    return updatedShare;
  }

  async updateShare(shareId: string, input: UpdateShareInput, userId: string): Promise<BoardShare> {
    const share = await this.shareModel.findById(shareId).exec();
    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const board = await this.boardModel.findById(share.boardId).exec();
    if (!board || board.createdBy !== userId) {
      throw new ForbiddenException('Only board owner can update shares');
    }

    if (input.permission !== undefined) {
      share.permission = input.permission;
    }
    if (input.status !== undefined) {
      share.status = input.status;
    }
    if (input.expiresAt !== undefined) {
      share.expiresAt = input.expiresAt;
    }

    const updatedShare = await share.save();

    await this.logActivity({
      boardId: share.boardId,
      userId,
      action: 'share_updated',
      entityType: 'board_share',
      entityId: shareId,
      details: {
        permission: input.permission,
        status: input.status,
        expiresAt: input.expiresAt,
      },
    });

    this.eventEmitter.emit('board.share.updated', {
      boardId: share.boardId,
      shareId,
      userId,
      permission: share.permission,
    });

    return updatedShare;
  }

  async revokeShare(shareId: string, userId: string): Promise<boolean> {
    const share = await this.shareModel.findById(shareId).exec();
    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const board = await this.boardModel.findById(share.boardId).exec();
    if (!board || board.createdBy !== userId) {
      throw new ForbiddenException('Only board owner can revoke shares');
    }

    share.status = ShareStatus.REVOKED;
    await share.save();

    await this.logActivity({
      boardId: share.boardId,
      userId,
      action: 'share_revoked',
      entityType: 'board_share',
      entityId: shareId,
      details: {
        revokedAt: new Date(),
      },
    });

    this.eventEmitter.emit('board.share.revoked', {
      boardId: share.boardId,
      shareId,
      userId,
    });

    return true;
  }

  async getBoardShares(boardId: string, userId: string): Promise<BoardShare[]> {
    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const hasAccess = await this.checkBoardAccess(boardId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.shareModel.find({
      boardId,
      status: { $in: [ShareStatus.ACTIVE, ShareStatus.PENDING] },
    }).exec();
  }

  async getSharedWithMe(userId: string, query?: ShareQueryInput): Promise<BoardShare[]> {
    const filter: any = {
      $or: [
        { sharedWith: userId },
        { email: query?.email },
      ],
      status: ShareStatus.ACTIVE,
    };

    if (query?.permission) {
      filter.permission = query.permission;
    }

    return this.shareModel.find(filter)
      .populate('boardId')
      .sort({ lastAccessedAt: -1 })
      .exec();
  }

  async checkBoardAccess(boardId: string, userId: string): Promise<SharePermission | null> {
    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      return null;
    }

    if (board.createdBy === userId) {
      return SharePermission.ADMIN;
    }

    const share = await this.shareModel.findOne({
      boardId,
      $or: [{ sharedWith: userId }, { isLinkShare: true }],
      status: ShareStatus.ACTIVE,
    }).exec();

    if (!share) {
      return null;
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return null;
    }

    share.lastAccessedAt = new Date();
    await share.save();

    return share.permission;
  }

  async hasPermission(boardId: string, userId: string, requiredPermission: SharePermission): Promise<boolean> {
    const userPermission = await this.checkBoardAccess(boardId, userId);
    if (!userPermission) {
      return false;
    }

    const permissionLevels = {
      [SharePermission.VIEW]: 1,
      [SharePermission.COMMENT]: 2,
      [SharePermission.EDIT]: 3,
      [SharePermission.ADMIN]: 4,
    };

    return permissionLevels[userPermission] >= permissionLevels[requiredPermission];
  }

  async logActivity(activity: {
    boardId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<BoardActivity> {
    const activityRecord = new this.activityModel(activity);
    const savedActivity = await activityRecord.save();

    this.eventEmitter.emit('board.activity', {
      boardId: activity.boardId,
      userId: activity.userId,
      action: activity.action,
      timestamp: savedActivity.timestamp,
    });

    return savedActivity;
  }

  async getBoardActivity(boardId: string, userId: string, limit = 50): Promise<BoardActivity[]> {
    const hasAccess = await this.checkBoardAccess(boardId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.activityModel.find({ boardId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'username email')
      .exec();
  }

  async generateShareLink(boardId: string, userId: string, permission: SharePermission, expiresAt?: Date): Promise<string> {
    const board = await this.boardModel.findById(boardId).exec();
    if (!board || board.createdBy !== userId) {
      throw new ForbiddenException('Only board owner can generate share links');
    }

    const shareToken = uuidv4();
    const shareLink = `${process.env.FRONTEND_URL}/boards/shared/${shareToken}`;

    const share = new this.shareModel({
      boardId,
      sharedBy: userId,
      permission,
      shareToken,
      shareLink,
      expiresAt,
      isLinkShare: true,
      inviteMethod: InviteMethod.LINK,
      status: ShareStatus.ACTIVE,
    });

    await share.save();

    await this.logActivity({
      boardId,
      userId,
      action: 'share_link_generated',
      entityType: 'board_share',
      entityId: share.id,
      details: {
        permission,
        expiresAt,
        shareLink,
      },
    });

    return shareLink;
  }

  async cleanupExpiredShares(): Promise<number> {
    const result = await this.shareModel.updateMany(
      {
        expiresAt: { $lt: new Date() },
        status: { $in: [ShareStatus.ACTIVE, ShareStatus.PENDING] },
      },
      { status: ShareStatus.EXPIRED }
    ).exec();

    this.logger.log(`Cleaned up ${result.modifiedCount} expired shares`);
    return result.modifiedCount;
  }

  async getCollaborationStats(boardId: string, userId: string): Promise<any> {
    const hasAccess = await this.checkBoardAccess(boardId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const stats = await this.shareModel.aggregate([
      { $match: { boardId, status: ShareStatus.ACTIVE } },
      {
        $group: {
          _id: '$permission',
          count: { $sum: 1 },
        }
      }
    ]).exec();

    const activityCount = await this.activityModel.countDocuments({
      boardId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }).exec();

    return {
      totalShares: stats.reduce((sum, stat) => sum + stat.count, 0),
      byPermission: stats,
      recentActivity: activityCount,
    };
  }
}
export enum SharePermission {
  VIEW = 'view',
  COMMENT = 'comment',
  EDIT = 'edit',
  ADMIN = 'admin',
}

export enum ShareStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum InviteMethod {
  EMAIL = 'email',
  LINK = 'link',
  DIRECT = 'direct',
}

export interface BoardShare {
  id: string;
  boardId: string;
  sharedBy: string;
  sharedWith?: string;
  email?: string;
  permission: SharePermission;
  status: ShareStatus;
  inviteMethod: InviteMethod;
  shareToken?: string;
  shareLink?: string;
  expiresAt?: Date;
  createdAt: Date;
  acceptedAt?: Date;
  lastAccessedAt?: Date;
  isLinkShare: boolean;
  message?: string;
}

export interface BoardActivity {
  id: string;
  boardId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateShareInput {
  boardId: string;
  sharedWith?: string;
  email?: string;
  permission: SharePermission;
  inviteMethod: InviteMethod;
  expiresAt?: Date;
  isLinkShare: boolean;
  message?: string;
}

export interface UpdateShareInput {
  permission?: SharePermission;
  expiresAt?: Date;
  status?: ShareStatus;
}

export interface ShareQueryInput {
  email?: string;
  permission?: SharePermission;
  boardId?: string;
}

export interface ActivityQueryInput {
  boardId: string;
  limit?: number;
  action?: string;
  entityType?: string;
}

export interface CollaborationStats {
  totalShares: number;
  byPermission: Array<{
    _id: SharePermission;
    count: number;
  }>;
  recentActivity: number;
}
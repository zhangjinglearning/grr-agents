import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnalyticsEventDocument = AnalyticsEvent & Document;

export enum EventCategory {
  USER_ACTION = 'user_action',
  BUSINESS_EVENT = 'business_event',
  SYSTEM_EVENT = 'system_event',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  FEATURE_FLAG = 'feature_flag',
  CONVERSION = 'conversion'
}

export enum EventAction {
  // User Actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_RESET = 'password_reset',
  
  // Board Actions
  BOARD_CREATE = 'board_create',
  BOARD_UPDATE = 'board_update',
  BOARD_DELETE = 'board_delete',
  BOARD_VIEW = 'board_view',
  BOARD_SHARE = 'board_share',
  
  // Card Actions
  CARD_CREATE = 'card_create',
  CARD_UPDATE = 'card_update',
  CARD_DELETE = 'card_delete',
  CARD_MOVE = 'card_move',
  CARD_ASSIGN = 'card_assign',
  
  // List Actions
  LIST_CREATE = 'list_create',
  LIST_UPDATE = 'list_update',
  LIST_DELETE = 'list_delete',
  LIST_REORDER = 'list_reorder',
  
  // Collaboration
  COMMENT_ADD = 'comment_add',
  MENTION = 'mention',
  NOTIFICATION_SEND = 'notification_send',
  
  // System Events
  API_CALL = 'api_call',
  PAGE_VIEW = 'page_view',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  
  // Business Events
  SUBSCRIPTION_START = 'subscription_start',
  SUBSCRIPTION_CANCEL = 'subscription_cancel',
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  
  // Feature Usage
  FEATURE_USED = 'feature_used',
  EXPERIMENT_VIEW = 'experiment_view',
  A_B_TEST_CONVERSION = 'a_b_test_conversion'
}

@Schema({
  timestamps: true,
  collection: 'analytics_events',
})
export class AnalyticsEvent {
  @Prop({ required: true, enum: EventCategory, index: true })
  eventCategory: EventCategory;

  @Prop({ required: true, enum: EventAction, index: true })
  eventAction: EventAction;

  @Prop({ required: false, index: true })
  userId?: string;

  @Prop({ required: false, index: true })
  sessionId?: string;

  @Prop({ required: false })
  anonymousId?: string;

  @Prop({ required: false })
  deviceId?: string;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;

  @Prop({
    type: Object,
    default: {},
    required: false
  })
  properties: {
    // Resource IDs
    boardId?: string;
    cardId?: string;
    listId?: string;
    organizationId?: string;
    
    // Event specific data
    value?: number;
    currency?: string;
    duration?: number;
    
    // User context
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    city?: string;
    timezone?: string;
    language?: string;
    
    // Technical context
    platform?: string;
    browser?: string;
    browserVersion?: string;
    os?: string;
    deviceType?: string;
    screenResolution?: string;
    
    // Business context
    subscriptionTier?: string;
    accountType?: string;
    featureFlags?: string[];
    experimentVariant?: string;
    
    // Performance data
    pageLoadTime?: number;
    apiResponseTime?: number;
    errorCode?: string;
    errorMessage?: string;
    
    // Custom properties
    [key: string]: any;
  };

  @Prop({
    type: Object,
    required: false,
    default: {}
  })
  metadata: {
    source?: string;
    version?: string;
    environment?: string;
    correlation_id?: string;
    trace_id?: string;
    campaign?: string;
    referrer?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    [key: string]: any;
  };

  @Prop({ default: false })
  processed: boolean;

  @Prop({ required: false })
  processedAt?: Date;

  @Prop({
    type: [String],
    default: [],
    index: true
  })
  tags: string[];
}

export const AnalyticsEventSchema = SchemaFactory.createForClass(AnalyticsEvent);

// Indexes for performance
AnalyticsEventSchema.index({ timestamp: -1, eventCategory: 1, eventAction: 1 });
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 }, { sparse: true });
AnalyticsEventSchema.index({ sessionId: 1, timestamp: 1 }, { sparse: true });
AnalyticsEventSchema.index({ 'properties.boardId': 1, timestamp: -1 }, { sparse: true });
AnalyticsEventSchema.index({ processed: 1, timestamp: 1 });

// TTL index for data retention (optional - keep events for 2 years)
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years
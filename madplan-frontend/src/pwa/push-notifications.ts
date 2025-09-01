/**
 * Push Notifications Service
 * Comprehensive push notification system for PWA
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: NotificationAction[];
  silent?: boolean;
  requireInteraction?: boolean;
  tag?: string;
  renotify?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationSettings {
  enabled: boolean;
  taskReminders: boolean;
  collaborationUpdates: boolean;
  systemNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  frequency: 'all' | 'important' | 'minimal';
  sound: boolean;
  vibration: boolean;
}

class PushNotificationService {
  private vapidPublicKey: string = '';
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private pushSubscription: PushSubscription | null = null;
  private notificationSettings: NotificationSettings;

  // Default notification settings
  private defaultSettings: NotificationSettings = {
    enabled: true,
    taskReminders: true,
    collaborationUpdates: true,
    systemNotifications: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    frequency: 'important',
    sound: true,
    vibration: true
  };

  // Predefined notification types
  private notificationTemplates = {
    taskReminder: {
      icon: '/icons/notification-task.png',
      badge: '/icons/badge-task.png',
      actions: [
        { action: 'view', title: 'View Task', icon: '/icons/action-view.png' },
        { action: 'complete', title: 'Mark Complete', icon: '/icons/action-complete.png' },
        { action: 'snooze', title: 'Snooze 1h', icon: '/icons/action-snooze.png' }
      ],
      vibrate: [200, 100, 200],
      requireInteraction: true
    },
    collaboration: {
      icon: '/icons/notification-collab.png',
      badge: '/icons/badge-collab.png',
      actions: [
        { action: 'view', title: 'View Board', icon: '/icons/action-view.png' },
        { action: 'reply', title: 'Reply', icon: '/icons/action-reply.png' }
      ],
      vibrate: [100, 50, 100],
      requireInteraction: false
    },
    system: {
      icon: '/icons/notification-system.png',
      badge: '/icons/badge-system.png',
      actions: [
        { action: 'view', title: 'View Details', icon: '/icons/action-view.png' }
      ],
      vibrate: [150],
      requireInteraction: false
    },
    boardUpdate: {
      icon: '/icons/notification-board.png',
      badge: '/icons/badge-board.png',
      actions: [
        { action: 'view', title: 'View Board', icon: '/icons/action-view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' }
      ],
      vibrate: [100],
      requireInteraction: false
    },
    cardAssigned: {
      icon: '/icons/notification-assigned.png',
      badge: '/icons/badge-assigned.png',
      actions: [
        { action: 'view', title: 'View Card', icon: '/icons/action-view.png' },
        { action: 'accept', title: 'Accept', icon: '/icons/action-accept.png' },
        { action: 'decline', title: 'Decline', icon: '/icons/action-decline.png' }
      ],
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true
    }
  };

  constructor(vapidPublicKey: string) {
    this.vapidPublicKey = vapidPublicKey;
    this.notificationSettings = this.loadSettings();
    this.initialize();
  }

  /**
   * Initialize push notification service
   */
  private async initialize(): Promise<void> {
    try {
      // Check for service worker support
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported');
      }

      // Check for push messaging support
      if (!('PushManager' in window)) {
        throw new Error('Push messaging is not supported');
      }

      // Get service worker registration
      this.serviceWorkerRegistration = await navigator.serviceWorker.ready;

      // Load existing subscription
      await this.loadExistingSubscription();

      console.log('Push notification service initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * Request notification permissions
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted');
      await this.enableNotifications();
    } else {
      console.log('Notification permission denied');
      this.notificationSettings.enabled = false;
      this.saveSettings();
    }

    return permission;
  }

  /**
   * Enable push notifications
   */
  async enableNotifications(): Promise<PushSubscriptionData | null> {
    try {
      if (!this.serviceWorkerRegistration) {
        throw new Error('Service worker not available');
      }

      if (this.getPermissionStatus() !== 'granted') {
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }

      // Subscribe to push notifications
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.pushSubscription = subscription;
      this.notificationSettings.enabled = true;
      this.saveSettings();

      // Convert subscription to sendable format
      const subscriptionData = this.subscriptionToData(subscription);

      // Send subscription to server
      await this.sendSubscriptionToServer(subscriptionData);

      console.log('Push notifications enabled');
      return subscriptionData;
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      throw error;
    }
  }

  /**
   * Disable push notifications
   */
  async disableNotifications(): Promise<void> {
    try {
      if (this.pushSubscription) {
        await this.pushSubscription.unsubscribe();
        this.pushSubscription = null;
      }

      // Notify server about unsubscription
      await this.removeSubscriptionFromServer();

      this.notificationSettings.enabled = false;
      this.saveSettings();

      console.log('Push notifications disabled');
    } catch (error) {
      console.error('Failed to disable push notifications:', error);
    }
  }

  /**
   * Show local notification
   */
  async showNotification(
    type: keyof typeof this.notificationTemplates,
    payload: Partial<NotificationPayload>
  ): Promise<void> {
    if (!this.canShowNotification(type)) {
      return;
    }

    const template = this.notificationTemplates[type];
    const notification: NotificationPayload = {
      ...template,
      ...payload,
      timestamp: Date.now()
    };

    // Apply user settings
    if (!this.notificationSettings.sound) {
      notification.silent = true;
    }

    if (!this.notificationSettings.vibration) {
      notification.vibrate = [];
    }

    try {
      if (this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          image: notification.image,
          data: notification.data,
          actions: notification.actions,
          silent: notification.silent,
          requireInteraction: notification.requireInteraction,
          tag: notification.tag,
          renotify: notification.renotify,
          vibrate: notification.vibrate
        });
      } else {
        // Fallback to browser notification
        new Notification(notification.title, notification);
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(
    type: keyof typeof this.notificationTemplates,
    payload: Partial<NotificationPayload>,
    delay: number
  ): Promise<number> {
    const timeoutId = window.setTimeout(async () => {
      await this.showNotification(type, payload);
    }, delay);

    return timeoutId;
  }

  /**
   * Cancel scheduled notification
   */
  cancelScheduledNotification(timeoutId: number): void {
    clearTimeout(timeoutId);
  }

  /**
   * Get notification settings
   */
  getSettings(): NotificationSettings {
    return { ...this.notificationSettings };
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<void> {
    this.notificationSettings = { ...this.notificationSettings, ...newSettings };
    this.saveSettings();

    // If notifications are being enabled, request permission
    if (newSettings.enabled && !this.pushSubscription) {
      await this.enableNotifications();
    }

    // If notifications are being disabled, unsubscribe
    if (newSettings.enabled === false && this.pushSubscription) {
      await this.disableNotifications();
    }
  }

  /**
   * Test notification
   */
  async testNotification(): Promise<void> {
    await this.showNotification('system', {
      title: 'Test Notification',
      body: 'Push notifications are working correctly!',
      tag: 'test-notification'
    });
  }

  /**
   * Get push subscription data
   */
  getSubscriptionData(): PushSubscriptionData | null {
    if (!this.pushSubscription) return null;
    return this.subscriptionToData(this.pushSubscription);
  }

  /**
   * Check if notification can be shown based on settings
   */
  private canShowNotification(type: keyof typeof this.notificationTemplates): boolean {
    if (!this.notificationSettings.enabled) {
      return false;
    }

    // Check quiet hours
    if (this.notificationSettings.quietHours.enabled && this.isQuietHours()) {
      return false;
    }

    // Check specific notification types
    switch (type) {
      case 'taskReminder':
        return this.notificationSettings.taskReminders;
      case 'collaboration':
      case 'boardUpdate':
      case 'cardAssigned':
        return this.notificationSettings.collaborationUpdates;
      case 'system':
        return this.notificationSettings.systemNotifications;
      default:
        return true;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMinute] = this.notificationSettings.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = this.notificationSettings.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      // Same day quiet hours
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Load existing push subscription
   */
  private async loadExistingSubscription(): Promise<void> {
    try {
      if (!this.serviceWorkerRegistration) return;

      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      this.pushSubscription = subscription;
      
      if (subscription) {
        console.log('Existing push subscription loaded');
      }
    } catch (error) {
      console.error('Failed to load existing subscription:', error);
    }
  }

  /**
   * Convert subscription to sendable data
   */
  private subscriptionToData(subscription: PushSubscription): PushSubscriptionData {
    const rawKey = subscription.getKey('p256dh');
    const rawAuthSecret = subscription.getKey('auth');

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: rawKey ? btoa(String.fromCharCode(...new Uint8Array(rawKey))) : '',
        auth: rawAuthSecret ? btoa(String.fromCharCode(...new Uint8Array(rawAuthSecret))) : ''
      }
    };
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription,
          settings: this.notificationSettings
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('Subscription sent to server');
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscription from server');
      }

      console.log('Subscription removed from server');
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): NotificationSettings {
    try {
      const stored = localStorage.getItem('notification-settings');
      if (stored) {
        return { ...this.defaultSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
    return { ...this.defaultSettings };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('notification-settings', JSON.stringify(this.notificationSettings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }
}

// Export singleton instance
let pushNotificationService: PushNotificationService;

export function initializePushNotifications(vapidPublicKey: string): PushNotificationService {
  if (!pushNotificationService) {
    pushNotificationService = new PushNotificationService(vapidPublicKey);
  }
  return pushNotificationService;
}

export function getPushNotificationService(): PushNotificationService | null {
  return pushNotificationService || null;
}

// Vue composable
export function usePushNotifications() {
  const service = getPushNotificationService();

  if (!service) {
    console.warn('Push notification service not initialized');
    return {
      isSupported: () => false,
      isEnabled: () => false,
      enable: () => Promise.reject(new Error('Service not initialized')),
      disable: () => Promise.resolve(),
      showNotification: () => Promise.resolve(),
      getSettings: () => ({}),
      updateSettings: () => Promise.resolve()
    };
  }

  return {
    isSupported: () => service.isSupported(),
    isEnabled: () => service.getSettings().enabled,
    enable: () => service.enableNotifications(),
    disable: () => service.disableNotifications(),
    showNotification: (type: keyof typeof service['notificationTemplates'], payload: Partial<NotificationPayload>) =>
      service.showNotification(type, payload),
    scheduleNotification: (type: keyof typeof service['notificationTemplates'], payload: Partial<NotificationPayload>, delay: number) =>
      service.scheduleNotification(type, payload, delay),
    cancelNotification: (timeoutId: number) => service.cancelScheduledNotification(timeoutId),
    getSettings: () => service.getSettings(),
    updateSettings: (settings: Partial<NotificationSettings>) => service.updateSettings(settings),
    testNotification: () => service.testNotification(),
    service
  };
}
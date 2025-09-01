/**
 * Service Worker Registration and Management
 * Implements Story 4.2 offline capability requirements
 */

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  version?: string;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private status: ServiceWorkerStatus = {
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
  };
  
  private listeners = new Map<string, Set<Function>>();

  constructor() {
    this.initializeOnlineStatus();
    
    if (this.status.isSupported) {
      this.initializeServiceWorker();
    }
  }

  private initializeOnlineStatus(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.status.isOnline = true;
      this.emit('online-status-changed', true);
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.status.isOnline = false;
      this.emit('online-status-changed', false);
    });
  }

  private async initializeServiceWorker(): Promise<void> {
    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for updates
      });

      console.log('[SW Manager] Service worker registered:', this.registration.scope);
      this.status.isRegistered = true;

      // Handle updates
      this.setupUpdateHandling();
      
      // Setup message handling
      this.setupMessageHandling();

      // Get version
      await this.getServiceWorkerVersion();

      this.emit('registration-complete', this.registration);

    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error);
      this.emit('registration-failed', error);
    }
  }

  private setupUpdateHandling(): void {
    if (!this.registration) return;

    // Check for updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      
      if (newWorker) {
        console.log('[SW Manager] New service worker installing');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New version available
              console.log('[SW Manager] New service worker installed, update available');
              this.status.updateAvailable = true;
              this.emit('update-available', newWorker);
            } else {
              // First install
              console.log('[SW Manager] Service worker installed for the first time');
              this.emit('first-install', newWorker);
            }
          }
        });
      }
    });

    // Handle controlled event
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Manager] New service worker activated');
      this.status.updateAvailable = false;
      this.emit('update-activated');
      
      // Reload to get latest version
      if (this.shouldReloadOnUpdate()) {
        window.location.reload();
      }
    });
  }

  private setupMessageHandling(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      
      switch (data.type) {
        case 'SYNC_COMPLETED':
          console.log('[SW Manager] Background sync completed');
          this.emit('sync-completed', data);
          break;
          
        case 'CACHE_UPDATED':
          console.log('[SW Manager] Cache updated');
          this.emit('cache-updated', data);
          break;
          
        default:
          console.log('[SW Manager] Unknown message from SW:', data);
      }
    });
  }

  private async getServiceWorkerVersion(): Promise<void> {
    if (!this.registration?.active) return;

    try {
      const messageChannel = new MessageChannel();
      
      const versionPromise = new Promise<string>((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.version) {
            resolve(event.data.version);
          } else {
            reject(new Error('No version received'));
          }
        };
        
        setTimeout(() => reject(new Error('Version request timeout')), 5000);
      });

      this.registration.active.postMessage(
        { type: 'GET_VERSION' }, 
        [messageChannel.port2]
      );

      this.status.version = await versionPromise;
      console.log('[SW Manager] Service worker version:', this.status.version);

    } catch (error) {
      console.warn('[SW Manager] Failed to get service worker version:', error);
    }
  }

  private shouldReloadOnUpdate(): boolean {
    // Only reload if user hasn't been active recently
    const lastActivity = localStorage.getItem('last-activity');
    if (!lastActivity) return true;
    
    const timeSinceActivity = Date.now() - parseInt(lastActivity);
    return timeSinceActivity > 30000; // 30 seconds
  }

  // Public API methods
  public async activateUpdate(): Promise<void> {
    if (!this.registration?.waiting) {
      throw new Error('No update available to activate');
    }

    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.activated) {
        this.status.updateAvailable = false;
      }
    };

    this.registration.waiting.postMessage(
      { type: 'SKIP_WAITING' }, 
      [messageChannel.port2]
    );
  }

  public async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      await this.registration.update();
      return this.status.updateAvailable;
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error);
      return false;
    }
  }

  public triggerSync(): void {
    if (!this.registration?.sync) {
      console.warn('[SW Manager] Background sync not supported');
      return;
    }

    this.registration.sync.register('sync-boards').catch(error => {
      console.error('[SW Manager] Failed to register background sync:', error);
    });
  }

  public async clearCache(): Promise<void> {
    if (!this.registration?.active) {
      throw new Error('Service worker not active');
    }

    const messageChannel = new MessageChannel();
    
    const clearPromise = new Promise<void>((resolve, reject) => {
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error('Cache clear failed'));
        }
      };
      
      setTimeout(() => reject(new Error('Cache clear timeout')), 10000);
    });

    this.registration.active.postMessage(
      { type: 'CLEAR_CACHE' }, 
      [messageChannel.port2]
    );

    await clearPromise;
    console.log('[SW Manager] Cache cleared successfully');
  }

  public getStatus(): ServiceWorkerStatus {
    return { ...this.status };
  }

  public isOfflineCapable(): boolean {
    return this.status.isSupported && this.status.isRegistered;
  }

  // Event system
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SW Manager] Event listener error for ${event}:`, error);
        }
      });
    }
  }
}

// Singleton instance
const serviceWorkerManager = new ServiceWorkerManager();

// Export utilities for components
export const useServiceWorker = () => {
  return {
    getStatus: () => serviceWorkerManager.getStatus(),
    checkForUpdates: () => serviceWorkerManager.checkForUpdates(),
    activateUpdate: () => serviceWorkerManager.activateUpdate(),
    clearCache: () => serviceWorkerManager.clearCache(),
    triggerSync: () => serviceWorkerManager.triggerSync(),
    isOfflineCapable: () => serviceWorkerManager.isOfflineCapable(),
    on: (event: string, callback: Function) => serviceWorkerManager.on(event, callback),
    off: (event: string, callback: Function) => serviceWorkerManager.off(event, callback),
  };
};

export default serviceWorkerManager;
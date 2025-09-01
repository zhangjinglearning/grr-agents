/**
 * Data Synchronization Manager
 * Implements Story 4.2 offline capability and data synchronization requirements
 */

import { useCacheStrategy } from './cache-strategies';
import { useToast } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: 'board' | 'list' | 'card';
  resourceId: string;
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime?: number;
  errors: string[];
}

export interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  clientData: any;
  serverData: any;
  resolvedData?: any;
}

class SyncManager {
  private cache = useCacheStrategy();
  private toast = useToast();
  private pendingOperations: SyncOperation[] = [];
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingOperations: 0,
    errors: [],
  };
  private listeners = new Map<string, Set<Function>>();
  private syncInterval: number | null = null;
  private maxRetries = 3;
  private syncTimeoutId: number | null = null;

  constructor() {
    this.initializeSync();
    this.setupNetworkListeners();
    this.loadPendingOperations();
  }

  private initializeSync(): void {
    // Start periodic sync when online
    this.startPeriodicSync();
    
    // Listen for visibility changes to sync when app becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.syncStatus.isOnline) {
        this.triggerSync();
      }
    });

    console.log('[Sync Manager] Initialized');
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[Sync Manager] Connection restored');
      this.syncStatus.isOnline = true;
      this.emit('connection-changed', true);
      
      // Show connection restored toast
      this.toast.success('Connection restored. Syncing your changes...', {
        duration: 3000,
      });
      
      // Trigger sync after a short delay to allow network to stabilize
      setTimeout(() => this.triggerSync(), 1000);
    });

    window.addEventListener('offline', () => {
      console.log('[Sync Manager] Connection lost');
      this.syncStatus.isOnline = false;
      this.syncStatus.isSyncing = false;
      this.emit('connection-changed', false);
      
      // Show offline toast
      this.toast.warning('You are now offline. Changes will be saved locally.', {
        title: 'Connection Lost',
        duration: 5000,
      });
    });
  }

  // Queue operations for offline execution
  public async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries' | 'maxRetries'>): Promise<string> {
    const syncOperation: SyncOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
      retries: 0,
      maxRetries: this.maxRetries,
    };

    this.pendingOperations.push(syncOperation);
    this.updateSyncStatus();
    
    // Store pending operations persistently
    await this.storePendingOperations();

    // If online, try to sync immediately
    if (this.syncStatus.isOnline) {
      this.triggerSync();
    }

    console.log('[Sync Manager] Queued operation:', syncOperation.type, syncOperation.resource, syncOperation.resourceId);
    
    return syncOperation.id;
  }

  // Main sync method
  public async triggerSync(): Promise<void> {
    if (!this.syncStatus.isOnline || this.syncStatus.isSyncing) {
      return;
    }

    this.syncStatus.isSyncing = true;
    this.syncStatus.errors = [];
    this.emit('sync-started');

    try {
      console.log(`[Sync Manager] Starting sync with ${this.pendingOperations.length} pending operations`);
      
      // Process operations in chronological order
      const sortedOperations = [...this.pendingOperations].sort((a, b) => a.timestamp - b.timestamp);
      
      for (const operation of sortedOperations) {
        try {
          await this.processOperation(operation);
          this.removePendingOperation(operation.id);
        } catch (error) {
          await this.handleOperationError(operation, error as Error);
        }
      }

      // Update sync status
      this.syncStatus.lastSyncTime = Date.now();
      this.updateSyncStatus();
      
      // Store updated pending operations
      await this.storePendingOperations();

      console.log('[Sync Manager] Sync completed successfully');
      this.emit('sync-completed', { success: true });

    } catch (error) {
      console.error('[Sync Manager] Sync failed:', error);
      this.syncStatus.errors.push((error as Error).message);
      this.emit('sync-completed', { success: false, error });
      
      // Show error toast
      this.toast.error('Failed to sync some changes. Will retry automatically.', {
        title: 'Sync Error',
        duration: 5000,
      });
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    const authStore = useAuthStore();
    
    if (!authStore.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    const endpoint = this.getEndpointForOperation(operation);
    const method = this.getMethodForOperation(operation);

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: operation.type !== 'DELETE' ? JSON.stringify(operation.data) : undefined,
    });

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 409) {
        // Conflict - need resolution
        const serverData = await response.json();
        await this.handleConflict(operation, serverData);
        return;
      }
      
      if (response.status === 404 && operation.type !== 'CREATE') {
        // Resource not found - might have been deleted by another client
        console.warn(`[Sync Manager] Resource not found: ${operation.resource} ${operation.resourceId}`);
        return; // Skip this operation
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Update local cache with server response
    if (operation.type !== 'DELETE') {
      const updatedData = await response.json();
      await this.updateLocalCache(operation, updatedData);
    } else {
      await this.removeFromLocalCache(operation);
    }

    console.log(`[Sync Manager] Successfully processed ${operation.type} for ${operation.resource} ${operation.resourceId}`);
  }

  private async handleOperationError(operation: SyncOperation, error: Error): Promise<void> {
    operation.retries++;

    if (operation.retries >= operation.maxRetries) {
      console.error(`[Sync Manager] Operation failed permanently:`, operation, error);
      
      // Remove from pending operations
      this.removePendingOperation(operation.id);
      
      // Store as failed operation for user review
      await this.storeFailedOperation(operation, error);
      
      // Show error notification
      this.toast.error(`Failed to sync ${operation.type.toLowerCase()} for ${operation.resource}`, {
        title: 'Sync Failed',
        actions: [
          {
            label: 'Review',
            action: () => this.showFailedOperations(),
            variant: 'secondary',
          },
        ],
      });
    } else {
      console.warn(`[Sync Manager] Operation failed, retrying (${operation.retries}/${operation.maxRetries}):`, error);
      
      // Exponential backoff for retries
      const delay = Math.pow(2, operation.retries) * 1000;
      setTimeout(() => {
        if (this.syncStatus.isOnline) {
          this.triggerSync();
        }
      }, delay);
    }
  }

  private async handleConflict(operation: SyncOperation, serverData: any): Promise<void> {
    console.log('[Sync Manager] Handling conflict for:', operation.resource, operation.resourceId);
    
    const resolution: ConflictResolution = {
      strategy: 'client-wins', // Default strategy - could be configurable
      clientData: operation.data,
      serverData,
    };

    // Apply conflict resolution strategy
    switch (resolution.strategy) {
      case 'client-wins':
        // Force update with client data
        resolution.resolvedData = operation.data;
        break;
        
      case 'server-wins':
        // Use server data and update local cache
        resolution.resolvedData = serverData;
        await this.updateLocalCache(operation, serverData);
        return; // Don't retry the operation
        
      case 'merge':
        // Merge client and server data (simple merge)
        resolution.resolvedData = { ...serverData, ...operation.data };
        break;
        
      case 'manual':
        // Present conflict to user for manual resolution
        await this.presentConflictToUser(operation, resolution);
        return;
    }

    // Update operation data with resolved data and retry
    operation.data = resolution.resolvedData;
    operation.retries = 0; // Reset retries for conflict resolution
    
    // Retry the operation with resolved data
    await this.processOperation(operation);
  }

  private async presentConflictToUser(operation: SyncOperation, resolution: ConflictResolution): Promise<void> {
    // Show conflict resolution toast
    this.toast.warning(`Conflict detected in ${operation.resource}. Your changes may conflict with recent updates.`, {
      title: 'Sync Conflict',
      persistent: true,
      actions: [
        {
          label: 'Keep Mine',
          action: async () => {
            operation.data = resolution.clientData;
            await this.processOperation(operation);
          },
          variant: 'primary',
        },
        {
          label: 'Use Latest',
          action: async () => {
            await this.updateLocalCache(operation, resolution.serverData);
          },
          variant: 'secondary',
        },
      ],
    });
  }

  // Cache management
  private async updateLocalCache(operation: SyncOperation, data: any): Promise<void> {
    switch (operation.resource) {
      case 'board':
        await this.cache.cacheBoard(operation.resourceId, data);
        break;
      case 'list':
        await this.cache.cacheList(operation.resourceId, data);
        break;
      case 'card':
        await this.cache.cacheCard(operation.resourceId, data);
        break;
    }
  }

  private async removeFromLocalCache(operation: SyncOperation): Promise<void> {
    // Note: Cache strategy doesn't have direct delete methods, 
    // but we can mark items as deleted or let them expire
    console.log(`[Sync Manager] Should remove ${operation.resource} ${operation.resourceId} from cache`);
  }

  // Utility methods
  private getEndpointForOperation(operation: SyncOperation): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    
    switch (operation.resource) {
      case 'board':
        return operation.type === 'CREATE' 
          ? `${baseUrl}/graphql`
          : `${baseUrl}/graphql`;
      case 'list':
        return `${baseUrl}/graphql`;
      case 'card':
        return `${baseUrl}/graphql`;
      default:
        throw new Error(`Unknown resource type: ${operation.resource}`);
    }
  }

  private getMethodForOperation(operation: SyncOperation): string {
    // All GraphQL operations use POST
    return 'POST';
  }

  private generateOperationId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private removePendingOperation(id: string): void {
    this.pendingOperations = this.pendingOperations.filter(op => op.id !== id);
    this.updateSyncStatus();
  }

  private updateSyncStatus(): void {
    this.syncStatus.pendingOperations = this.pendingOperations.length;
    this.emit('status-changed', this.syncStatus);
  }

  // Persistent storage
  private async loadPendingOperations(): Promise<void> {
    try {
      const stored = localStorage.getItem('madplan_pending_operations');
      if (stored) {
        this.pendingOperations = JSON.parse(stored);
        this.updateSyncStatus();
        console.log(`[Sync Manager] Loaded ${this.pendingOperations.length} pending operations`);
      }
    } catch (error) {
      console.error('[Sync Manager] Failed to load pending operations:', error);
    }
  }

  private async storePendingOperations(): Promise<void> {
    try {
      localStorage.setItem('madplan_pending_operations', JSON.stringify(this.pendingOperations));
    } catch (error) {
      console.error('[Sync Manager] Failed to store pending operations:', error);
    }
  }

  private async storeFailedOperation(operation: SyncOperation, error: Error): Promise<void> {
    try {
      const failedOps = JSON.parse(localStorage.getItem('madplan_failed_operations') || '[]');
      failedOps.push({
        operation,
        error: error.message,
        timestamp: Date.now(),
      });
      
      // Keep only the last 20 failed operations
      const recentFailedOps = failedOps.slice(-20);
      localStorage.setItem('madplan_failed_operations', JSON.stringify(recentFailedOps));
    } catch (error) {
      console.error('[Sync Manager] Failed to store failed operation:', error);
    }
  }

  private showFailedOperations(): void {
    // TODO: Implement UI for reviewing failed operations
    console.log('[Sync Manager] Showing failed operations (UI not implemented)');
  }

  // Periodic sync
  private startPeriodicSync(): void {
    // Sync every 30 seconds when online
    this.syncInterval = window.setInterval(() => {
      if (this.syncStatus.isOnline && this.pendingOperations.length > 0) {
        this.triggerSync();
      }
    }, 30000);
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
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
          console.error(`[Sync Manager] Event listener error for ${event}:`, error);
        }
      });
    }
  }

  // Public API
  public getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public getPendingOperations(): SyncOperation[] {
    return [...this.pendingOperations];
  }

  public async forceSyncOperation(operationId: string): Promise<void> {
    const operation = this.pendingOperations.find(op => op.id === operationId);
    if (operation && this.syncStatus.isOnline) {
      try {
        await this.processOperation(operation);
        this.removePendingOperation(operationId);
        await this.storePendingOperations();
      } catch (error) {
        await this.handleOperationError(operation, error as Error);
      }
    }
  }

  public clearPendingOperations(): void {
    this.pendingOperations = [];
    this.updateSyncStatus();
    localStorage.removeItem('madplan_pending_operations');
  }

  public cleanup(): void {
    this.stopPeriodicSync();
    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
    }
  }
}

// Singleton sync manager
const syncManager = new SyncManager();

// Export utilities
export const useSyncManager = () => {
  return {
    queueOperation: (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries' | 'maxRetries'>) =>
      syncManager.queueOperation(operation),
    
    triggerSync: () => syncManager.triggerSync(),
    getSyncStatus: () => syncManager.getSyncStatus(),
    getPendingOperations: () => syncManager.getPendingOperations(),
    forceSyncOperation: (id: string) => syncManager.forceSyncOperation(id),
    clearPendingOperations: () => syncManager.clearPendingOperations(),
    
    on: (event: string, callback: Function) => syncManager.on(event, callback),
    off: (event: string, callback: Function) => syncManager.off(event, callback),
  };
};

export default syncManager;
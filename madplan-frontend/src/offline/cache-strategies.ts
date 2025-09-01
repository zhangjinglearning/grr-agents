/**
 * Cache Strategies for Offline Capability
 * Implements Story 4.2 offline capability and data synchronization requirements
 */

export interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
  version?: string;
  offline?: boolean; // Data modified offline
}

export interface CacheOptions {
  ttl?: number;
  maxItems?: number;
  strategy?: 'cache-first' | 'network-first' | 'cache-only' | 'network-only';
}

class CacheManager {
  private dbName = 'madplan-cache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private stores = {
    boards: 'boards-cache',
    lists: 'lists-cache',
    cards: 'cards-cache',
    themes: 'themes-cache',
    user: 'user-cache',
    api: 'api-cache',
  };

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Cache Manager] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for different data types
        Object.values(this.stores).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp');
            store.createIndex('offline', 'offline');
          }
        });

        console.log('[Cache Manager] Database schema updated');
      };
    });
  }

  // Generic cache operations
  public async set<T>(
    storeName: string,
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    const cacheItem: CacheItem<T> = {
      id: key,
      data,
      timestamp: Date.now(),
      ttl: options.ttl,
      offline: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.put(cacheItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async get<T>(storeName: string, key: string): Promise<CacheItem<T> | null> {
    if (!this.db) await this.initializeDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result as CacheItem<T> | undefined;
        
        if (!result) {
          resolve(null);
          return;
        }

        // Check if item has expired
        if (result.ttl && Date.now() - result.timestamp > result.ttl) {
          this.delete(storeName, key); // Clean up expired item
          resolve(null);
          return;
        }

        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getAll<T>(storeName: string): Promise<CacheItem<T>[]> {
    if (!this.db) await this.initializeDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as CacheItem<T>[];
        
        // Filter out expired items
        const validItems = results.filter(item => {
          if (item.ttl && Date.now() - item.timestamp > item.ttl) {
            this.delete(storeName, item.id); // Clean up expired item
            return false;
          }
          return true;
        });
        
        resolve(validItems);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async clear(storeName: string): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Board-specific cache operations
  public async cacheBoard(boardId: string, boardData: any): Promise<void> {
    return this.set(this.stores.boards, boardId, boardData, {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  public async getCachedBoard(boardId: string): Promise<any | null> {
    const cached = await this.get(this.stores.boards, boardId);
    return cached?.data || null;
  }

  public async getCachedBoards(): Promise<any[]> {
    const cached = await this.getAll(this.stores.boards);
    return cached.map(item => item.data);
  }

  // List-specific cache operations
  public async cacheList(listId: string, listData: any): Promise<void> {
    return this.set(this.stores.lists, listId, listData, {
      ttl: 12 * 60 * 60 * 1000, // 12 hours
    });
  }

  public async getCachedList(listId: string): Promise<any | null> {
    const cached = await this.get(this.stores.lists, listId);
    return cached?.data || null;
  }

  // Card-specific cache operations
  public async cacheCard(cardId: string, cardData: any): Promise<void> {
    return this.set(this.stores.cards, cardId, cardData, {
      ttl: 6 * 60 * 60 * 1000, // 6 hours
    });
  }

  public async getCachedCard(cardId: string): Promise<any | null> {
    const cached = await this.get(this.stores.cards, cardId);
    return cached?.data || null;
  }

  // Theme cache operations
  public async cacheTheme(themeId: string, themeData: any): Promise<void> {
    return this.set(this.stores.themes, themeId, themeData, {
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  public async getCachedTheme(themeId: string): Promise<any | null> {
    const cached = await this.get(this.stores.themes, themeId);
    return cached?.data || null;
  }

  public async getCachedThemes(): Promise<any[]> {
    const cached = await this.getAll(this.stores.themes);
    return cached.map(item => item.data);
  }

  // API response cache operations
  public async cacheApiResponse(url: string, response: any): Promise<void> {
    const cacheKey = this.generateCacheKey(url);
    return this.set(this.stores.api, cacheKey, response, {
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }

  public async getCachedApiResponse(url: string): Promise<any | null> {
    const cacheKey = this.generateCacheKey(url);
    const cached = await this.get(this.stores.api, cacheKey);
    return cached?.data || null;
  }

  // Offline modification tracking
  public async markOfflineModification(
    storeName: string,
    key: string,
    data: any
  ): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    const cacheItem: CacheItem = {
      id: key,
      data,
      timestamp: Date.now(),
      offline: true,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.put(cacheItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getOfflineModifications(storeName: string): Promise<CacheItem[]> {
    if (!this.db) await this.initializeDatabase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('offline');
      
      const request = index.getAll(true); // Get items where offline === true
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async clearOfflineModification(storeName: string, key: string): Promise<void> {
    const item = await this.get(storeName, key);
    if (item && item.offline) {
      item.offline = false;
      return this.set(storeName, key, item.data);
    }
  }

  // Cache management
  public async getStorageUsage(): Promise<{ used: number; total: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        total: estimate.quota || 0,
      };
    }
    return { used: 0, total: 0 };
  }

  public async cleanupExpiredItems(): Promise<void> {
    const storeNames = Object.values(this.stores);
    
    for (const storeName of storeNames) {
      try {
        await this.getAll(storeName); // This automatically cleans expired items
      } catch (error) {
        console.warn(`Failed to cleanup expired items in ${storeName}:`, error);
      }
    }
  }

  public async clearAllCache(): Promise<void> {
    const storeNames = Object.values(this.stores);
    
    for (const storeName of storeNames) {
      try {
        await this.clear(storeName);
      } catch (error) {
        console.warn(`Failed to clear cache for ${storeName}:`, error);
      }
    }
  }

  // Utility methods
  private generateCacheKey(url: string): string {
    // Simple URL-based cache key generation
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
  }

  // Check if we're currently offline
  public isOffline(): boolean {
    return !navigator.onLine;
  }

  // Get cache statistics
  public async getCacheStats(): Promise<{
    boards: number;
    lists: number;
    cards: number;
    themes: number;
    api: number;
    totalSize: number;
  }> {
    const stats = {
      boards: 0,
      lists: 0,
      cards: 0,
      themes: 0,
      api: 0,
      totalSize: 0,
    };

    try {
      const [boards, lists, cards, themes, api] = await Promise.all([
        this.getAll(this.stores.boards),
        this.getAll(this.stores.lists),
        this.getAll(this.stores.cards),
        this.getAll(this.stores.themes),
        this.getAll(this.stores.api),
      ]);

      stats.boards = boards.length;
      stats.lists = lists.length;
      stats.cards = cards.length;
      stats.themes = themes.length;
      stats.api = api.length;

      const usage = await this.getStorageUsage();
      stats.totalSize = usage.used;
    } catch (error) {
      console.warn('Failed to get cache statistics:', error);
    }

    return stats;
  }
}

// Singleton cache manager
const cacheManager = new CacheManager();

// Export cache strategies
export const useCacheStrategy = () => {
  return {
    // Cache management
    cacheBoard: (id: string, data: any) => cacheManager.cacheBoard(id, data),
    getCachedBoard: (id: string) => cacheManager.getCachedBoard(id),
    getCachedBoards: () => cacheManager.getCachedBoards(),
    
    cacheList: (id: string, data: any) => cacheManager.cacheList(id, data),
    getCachedList: (id: string) => cacheManager.getCachedList(id),
    
    cacheCard: (id: string, data: any) => cacheManager.cacheCard(id, data),
    getCachedCard: (id: string) => cacheManager.getCachedCard(id),
    
    cacheTheme: (id: string, data: any) => cacheManager.cacheTheme(id, data),
    getCachedTheme: (id: string) => cacheManager.getCachedTheme(id),
    getCachedThemes: () => cacheManager.getCachedThemes(),
    
    cacheApiResponse: (url: string, response: any) => cacheManager.cacheApiResponse(url, response),
    getCachedApiResponse: (url: string) => cacheManager.getCachedApiResponse(url),
    
    // Offline modifications
    markOfflineModification: (store: string, key: string, data: any) => 
      cacheManager.markOfflineModification(store, key, data),
    getOfflineModifications: (store: string) => cacheManager.getOfflineModifications(store),
    clearOfflineModification: (store: string, key: string) => 
      cacheManager.clearOfflineModification(store, key),
    
    // Utilities
    isOffline: () => cacheManager.isOffline(),
    getCacheStats: () => cacheManager.getCacheStats(),
    cleanupExpiredItems: () => cacheManager.cleanupExpiredItems(),
    clearAllCache: () => cacheManager.clearAllCache(),
    getStorageUsage: () => cacheManager.getStorageUsage(),
  };
};

export default cacheManager;
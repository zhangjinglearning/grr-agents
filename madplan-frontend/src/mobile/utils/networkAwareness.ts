/**
 * Network Awareness Service
 * Adaptive loading and performance based on network conditions
 */

export interface NetworkInformation {
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  downlinkMax?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface NetworkStatus {
  isOnline: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  quality: 'poor' | 'good' | 'excellent';
  dataLimit: 'unlimited' | 'limited' | 'strict';
}

export interface AdaptiveSettings {
  imageQuality: number; // 0.1 to 1.0
  videosEnabled: boolean;
  animationsEnabled: boolean;
  prefetchEnabled: boolean;
  compressionLevel: 'low' | 'medium' | 'high';
  maxConcurrentRequests: number;
  enableOfflineMode: boolean;
}

export interface DataUsageInfo {
  session: number;
  daily: number;
  weekly: number;
  monthly: number;
  lastReset: number;
}

class NetworkAwarenessService {
  private networkInfo: NetworkStatus;
  private adaptiveSettings: AdaptiveSettings;
  private dataUsage: DataUsageInfo;
  private onlineStatus: boolean = navigator.onLine;
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests: number = 0;

  constructor() {
    this.networkInfo = this.getNetworkInformation();
    this.adaptiveSettings = this.calculateAdaptiveSettings();
    this.dataUsage = this.loadDataUsage();
    this.initialize();
  }

  /**
   * Initialize network awareness service
   */
  private initialize(): void {
    this.setupNetworkListeners();
    this.startPeriodicChecks();
    this.setupDataUsageTracking();
  }

  /**
   * Get current network information
   */
  private getNetworkInformation(): NetworkStatus {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    const baseInfo: NetworkStatus = {
      isOnline: navigator.onLine,
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
      quality: 'good',
      dataLimit: 'unlimited'
    };

    if (connection) {
      baseInfo.effectiveType = connection.effectiveType || 'unknown';
      baseInfo.downlink = connection.downlink || 0;
      baseInfo.rtt = connection.rtt || 0;
      baseInfo.saveData = connection.saveData || false;
    }

    // Determine connection quality
    baseInfo.quality = this.determineConnectionQuality(baseInfo);
    
    // Determine data limit status
    baseInfo.dataLimit = this.determineDataLimit(baseInfo);

    return baseInfo;
  }

  /**
   * Determine connection quality based on metrics
   */
  private determineConnectionQuality(info: NetworkStatus): 'poor' | 'good' | 'excellent' {
    if (info.effectiveType === 'slow-2g' || info.effectiveType === '2g') {
      return 'poor';
    }
    
    if (info.effectiveType === '3g' || (info.downlink && info.downlink < 1.5)) {
      return 'poor';
    }
    
    if (info.effectiveType === '4g' && info.downlink && info.downlink > 10) {
      return 'excellent';
    }
    
    return 'good';
  }

  /**
   * Determine data limit based on connection and save data preference
   */
  private determineDataLimit(info: NetworkStatus): 'unlimited' | 'limited' | 'strict' {
    if (info.saveData) {
      return 'strict';
    }
    
    if (info.effectiveType === 'slow-2g' || info.effectiveType === '2g') {
      return 'strict';
    }
    
    if (info.effectiveType === '3g') {
      return 'limited';
    }
    
    return 'unlimited';
  }

  /**
   * Calculate adaptive settings based on network status
   */
  private calculateAdaptiveSettings(): AdaptiveSettings {
    const { quality, dataLimit, saveData } = this.networkInfo;
    
    const settings: AdaptiveSettings = {
      imageQuality: 1.0,
      videosEnabled: true,
      animationsEnabled: true,
      prefetchEnabled: true,
      compressionLevel: 'low',
      maxConcurrentRequests: 6,
      enableOfflineMode: false
    };

    // Adjust based on connection quality
    switch (quality) {
      case 'poor':
        settings.imageQuality = 0.3;
        settings.videosEnabled = false;
        settings.animationsEnabled = false;
        settings.prefetchEnabled = false;
        settings.compressionLevel = 'high';
        settings.maxConcurrentRequests = 2;
        settings.enableOfflineMode = true;
        break;
        
      case 'good':
        settings.imageQuality = 0.7;
        settings.videosEnabled = true;
        settings.animationsEnabled = true;
        settings.prefetchEnabled = true;
        settings.compressionLevel = 'medium';
        settings.maxConcurrentRequests = 4;
        break;
        
      case 'excellent':
        settings.imageQuality = 1.0;
        settings.videosEnabled = true;
        settings.animationsEnabled = true;
        settings.prefetchEnabled = true;
        settings.compressionLevel = 'low';
        settings.maxConcurrentRequests = 6;
        break;
    }

    // Apply data limit restrictions
    if (dataLimit === 'strict' || saveData) {
      settings.imageQuality = Math.min(settings.imageQuality, 0.4);
      settings.videosEnabled = false;
      settings.prefetchEnabled = false;
      settings.compressionLevel = 'high';
      settings.enableOfflineMode = true;
    } else if (dataLimit === 'limited') {
      settings.imageQuality = Math.min(settings.imageQuality, 0.7);
      settings.compressionLevel = 'medium';
    }

    return settings;
  }

  /**
   * Setup network event listeners
   */
  private setupNetworkListeners(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      this.onlineStatus = true;
      this.updateNetworkStatus();
    });

    window.addEventListener('offline', () => {
      this.onlineStatus = false;
      this.updateNetworkStatus();
    });

    // Connection change events
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.updateNetworkStatus();
      });
    }
  }

  /**
   * Start periodic network quality checks
   */
  private startPeriodicChecks(): void {
    // Check network quality every 30 seconds
    setInterval(() => {
      this.performNetworkQualityCheck();
    }, 30000);

    // Initial check
    setTimeout(() => {
      this.performNetworkQualityCheck();
    }, 1000);
  }

  /**
   * Perform network quality check using a small resource
   */
  private async performNetworkQualityCheck(): Promise<void> {
    if (!this.onlineStatus) return;

    try {
      const startTime = performance.now();
      const testUrl = '/api/ping?' + Date.now(); // Cache buster
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Update RTT estimation
      this.networkInfo.rtt = Math.round((this.networkInfo.rtt + responseTime) / 2);
      
      // Adjust quality based on response time
      if (responseTime > 2000) {
        this.networkInfo.quality = 'poor';
      } else if (responseTime > 1000) {
        this.networkInfo.quality = 'good';
      } else {
        this.networkInfo.quality = 'excellent';
      }
      
      this.adaptiveSettings = this.calculateAdaptiveSettings();
      this.notifyListeners();
      
    } catch (error) {
      console.warn('Network quality check failed:', error);
      this.networkInfo.quality = 'poor';
    }
  }

  /**
   * Update network status
   */
  private updateNetworkStatus(): void {
    this.networkInfo = this.getNetworkInformation();
    this.networkInfo.isOnline = this.onlineStatus;
    this.adaptiveSettings = this.calculateAdaptiveSettings();
    this.notifyListeners();
  }

  /**
   * Notify all listeners of network status change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.networkInfo);
      } catch (error) {
        console.error('Network status listener error:', error);
      }
    });
  }

  /**
   * Setup data usage tracking
   */
  private setupDataUsageTracking(): void {
    // Track fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      this.trackDataUsage(response);
      return response;
    };

    // Reset daily usage at midnight
    this.scheduleDataUsageReset();
  }

  /**
   * Track data usage from responses
   */
  private trackDataUsage(response: Response): void {
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      this.addDataUsage(bytes);
    }
  }

  /**
   * Add data usage
   */
  private addDataUsage(bytes: number): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;
    const oneMonthMs = 30 * oneDayMs;

    this.dataUsage.session += bytes;

    // Reset counters if needed
    if (now - this.dataUsage.lastReset > oneDayMs) {
      this.dataUsage.daily = bytes;
      this.dataUsage.lastReset = now;
    } else {
      this.dataUsage.daily += bytes;
    }

    if (now - this.dataUsage.lastReset > oneWeekMs) {
      this.dataUsage.weekly = bytes;
    } else {
      this.dataUsage.weekly += bytes;
    }

    if (now - this.dataUsage.lastReset > oneMonthMs) {
      this.dataUsage.monthly = bytes;
    } else {
      this.dataUsage.monthly += bytes;
    }

    this.saveDataUsage();
  }

  /**
   * Schedule data usage reset
   */
  private scheduleDataUsageReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyDataUsage();
      // Schedule next reset
      setInterval(() => {
        this.resetDailyDataUsage();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Reset daily data usage
   */
  private resetDailyDataUsage(): void {
    this.dataUsage.daily = 0;
    this.dataUsage.lastReset = Date.now();
    this.saveDataUsage();
  }

  /**
   * Load data usage from storage
   */
  private loadDataUsage(): DataUsageInfo {
    try {
      const stored = localStorage.getItem('data-usage');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load data usage:', error);
    }
    
    return {
      session: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Save data usage to storage
   */
  private saveDataUsage(): void {
    try {
      localStorage.setItem('data-usage', JSON.stringify(this.dataUsage));
    } catch (error) {
      console.error('Failed to save data usage:', error);
    }
  }

  /**
   * Add network status listener
   */
  addListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove network status listener
   */
  removeListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkInfo };
  }

  /**
   * Get current adaptive settings
   */
  getAdaptiveSettings(): AdaptiveSettings {
    return { ...this.adaptiveSettings };
  }

  /**
   * Get data usage information
   */
  getDataUsage(): DataUsageInfo {
    return { ...this.dataUsage };
  }

  /**
   * Queue request with network awareness
   */
  async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        if (this.activeRequests >= this.adaptiveSettings.maxConcurrentRequests) {
          // Queue for later
          this.requestQueue.push(executeRequest);
          return;
        }

        this.activeRequests++;
        
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          
          // Process queued requests
          if (this.requestQueue.length > 0) {
            const nextRequest = this.requestQueue.shift();
            if (nextRequest) {
              setTimeout(nextRequest, 0);
            }
          }
        }
      };

      executeRequest();
    });
  }

  /**
   * Get optimized image URL based on network conditions
   */
  getOptimizedImageUrl(originalUrl: string, width?: number, height?: number): string {
    const { imageQuality } = this.adaptiveSettings;
    const params = new URLSearchParams();
    
    // Add quality parameter
    params.set('q', Math.round(imageQuality * 100).toString());
    
    // Add dimensions if provided
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    
    // Add format optimization
    const supportsWebP = this.supportsWebP();
    const supportsAVIF = this.supportsAVIF();
    
    if (supportsAVIF) {
      params.set('format', 'avif');
    } else if (supportsWebP) {
      params.set('format', 'webp');
    }
    
    return `${originalUrl}?${params.toString()}`;
  }

  /**
   * Check WebP support
   */
  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('webp') > -1;
  }

  /**
   * Check AVIF support
   */
  private supportsAVIF(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/avif').indexOf('avif') > -1;
  }

  /**
   * Should prefetch resource based on network conditions
   */
  shouldPrefetch(): boolean {
    return this.adaptiveSettings.prefetchEnabled && 
           this.networkInfo.isOnline && 
           this.networkInfo.quality !== 'poor';
  }

  /**
   * Should show animations based on network conditions
   */
  shouldShowAnimations(): boolean {
    return this.adaptiveSettings.animationsEnabled;
  }

  /**
   * Should show videos based on network conditions
   */
  shouldShowVideos(): boolean {
    return this.adaptiveSettings.videosEnabled;
  }

  /**
   * Get compression level for requests
   */
  getCompressionLevel(): string {
    return this.adaptiveSettings.compressionLevel;
  }

  /**
   * Format data usage for display
   */
  formatDataUsage(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.clear();
    this.requestQueue.length = 0;
  }
}

// Export singleton instance
export const networkAwarenessService = new NetworkAwarenessService();

// Vue composable
export function useNetworkAwareness() {
  const addListener = (listener: (status: NetworkStatus) => void) => {
    networkAwarenessService.addListener(listener);
  };

  const removeListener = (listener: (status: NetworkStatus) => void) => {
    networkAwarenessService.removeListener(listener);
  };

  return {
    getNetworkStatus: () => networkAwarenessService.getNetworkStatus(),
    getAdaptiveSettings: () => networkAwarenessService.getAdaptiveSettings(),
    getDataUsage: () => networkAwarenessService.getDataUsage(),
    queueRequest: <T>(requestFn: () => Promise<T>) => networkAwarenessService.queueRequest(requestFn),
    getOptimizedImageUrl: (url: string, width?: number, height?: number) => 
      networkAwarenessService.getOptimizedImageUrl(url, width, height),
    shouldPrefetch: () => networkAwarenessService.shouldPrefetch(),
    shouldShowAnimations: () => networkAwarenessService.shouldShowAnimations(),
    shouldShowVideos: () => networkAwarenessService.shouldShowVideos(),
    formatDataUsage: (bytes: number) => networkAwarenessService.formatDataUsage(bytes),
    addListener,
    removeListener,
    service: networkAwarenessService
  };
}
/**
 * Mobile Performance Optimization Utilities
 * Comprehensive performance optimization for mobile devices
 */

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  tbt: number; // Total Blocking Time
  si: number; // Speed Index
}

export interface DeviceCapabilities {
  memory: number;
  cores: number;
  connection: string;
  connectionSpeed: number;
  isLowEndDevice: boolean;
  supportedFeatures: string[];
}

export interface OptimizationSettings {
  imageQuality: 'high' | 'medium' | 'low';
  animationLevel: 'full' | 'reduced' | 'disabled';
  prefetchLevel: 'aggressive' | 'moderate' | 'conservative';
  cacheStrategy: 'aggressive' | 'normal' | 'minimal';
  bundleSize: 'full' | 'optimized' | 'minimal';
}

class MobilePerformanceOptimizer {
  private performanceObserver: PerformanceObserver | null = null;
  private metrics: Partial<PerformanceMetrics> = {};
  private deviceCapabilities: DeviceCapabilities;
  private optimizationSettings: OptimizationSettings;
  private intersectionObserver: IntersectionObserver | null = null;
  private lazyLoadQueue: Set<HTMLElement> = new Set();
  private prefetchQueue: Set<string> = new Set();

  constructor() {
    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.optimizationSettings = this.getOptimizationSettings();
    this.initialize();
  }

  /**
   * Initialize performance optimization
   */
  private initialize(): void {
    this.setupPerformanceMonitoring();
    this.setupLazyLoading();
    this.setupPrefetching();
    this.applyPerformanceOptimizations();
    this.startPerformanceMonitoring();
  }

  /**
   * Detect device capabilities
   */
  private detectDeviceCapabilities(): DeviceCapabilities {
    const navigator = window.navigator as any;
    
    // Detect memory
    const memory = navigator.deviceMemory || 4; // Default to 4GB if unknown
    
    // Detect CPU cores
    const cores = navigator.hardwareConcurrency || 4; // Default to 4 cores if unknown
    
    // Detect connection
    const connection = (navigator.connection || navigator.mozConnection || navigator.webkitConnection) as any;
    const connectionType = connection?.effectiveType || 'unknown';
    const connectionSpeed = this.getConnectionSpeed(connectionType);
    
    // Determine if low-end device
    const isLowEndDevice = memory <= 2 || cores <= 2 || connectionSpeed < 1.0;
    
    // Detect supported features
    const supportedFeatures = this.detectSupportedFeatures();

    return {
      memory,
      cores,
      connection: connectionType,
      connectionSpeed,
      isLowEndDevice,
      supportedFeatures
    };
  }

  /**
   * Get connection speed estimate
   */
  private getConnectionSpeed(effectiveType: string): number {
    const speedMap: Record<string, number> = {
      'slow-2g': 0.25,
      '2g': 0.5,
      '3g': 1.0,
      '4g': 10.0,
      '5g': 20.0,
      'unknown': 4.0
    };
    
    return speedMap[effectiveType] || speedMap.unknown;
  }

  /**
   * Detect supported features
   */
  private detectSupportedFeatures(): string[] {
    const features: string[] = [];
    
    // Check for various web APIs
    if ('serviceWorker' in navigator) features.push('service-worker');
    if ('IntersectionObserver' in window) features.push('intersection-observer');
    if ('requestIdleCallback' in window) features.push('idle-callback');
    if ('PerformanceObserver' in window) features.push('performance-observer');
    if ('WebAssembly' in window) features.push('webassembly');
    if ('OffscreenCanvas' in window) features.push('offscreen-canvas');
    if ('ImageBitmap' in window) features.push('image-bitmap');
    if ('createImageBitmap' in window) features.push('create-image-bitmap');
    
    // Check for CSS features
    if (CSS.supports('display', 'grid')) features.push('css-grid');
    if (CSS.supports('display', 'flex')) features.push('css-flexbox');
    if (CSS.supports('backdrop-filter', 'blur(1px)')) features.push('backdrop-filter');
    if (CSS.supports('transform', 'translateZ(0)')) features.push('css-3d-transforms');
    
    return features;
  }

  /**
   * Get optimization settings based on device capabilities
   */
  private getOptimizationSettings(): OptimizationSettings {
    const { isLowEndDevice, connectionSpeed, memory } = this.deviceCapabilities;
    
    // Load user preferences if available
    const userSettings = this.loadUserSettings();
    if (userSettings) {
      return userSettings;
    }
    
    // Auto-configure based on device capabilities
    if (isLowEndDevice || connectionSpeed < 1.0) {
      return {
        imageQuality: 'low',
        animationLevel: 'reduced',
        prefetchLevel: 'conservative',
        cacheStrategy: 'minimal',
        bundleSize: 'minimal'
      };
    } else if (memory <= 4 || connectionSpeed < 4.0) {
      return {
        imageQuality: 'medium',
        animationLevel: 'reduced',
        prefetchLevel: 'moderate',
        cacheStrategy: 'normal',
        bundleSize: 'optimized'
      };
    } else {
      return {
        imageQuality: 'high',
        animationLevel: 'full',
        prefetchLevel: 'aggressive',
        cacheStrategy: 'aggressive',
        bundleSize: 'full'
      };
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        switch (entry.entryType) {
          case 'paint':
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime;
            }
            break;
          
          case 'largest-contentful-paint':
            this.metrics.lcp = entry.startTime;
            break;
          
          case 'first-input':
            this.metrics.fid = (entry as any).processingStart - entry.startTime;
            break;
          
          case 'layout-shift':
            if (!(entry as any).hadRecentInput) {
              this.metrics.cls = (this.metrics.cls || 0) + (entry as any).value;
            }
            break;
          
          case 'navigation':
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.ttfb = navEntry.responseStart - navEntry.fetchStart;
            break;
        }
      });
      
      this.reportMetrics();
    });

    try {
      this.performanceObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift', 'navigation'] });
    } catch (error) {
      console.warn('Some performance metrics not supported:', error);
    }
  }

  /**
   * Setup lazy loading for images and components
   */
  private setupLazyLoading(): void {
    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            this.loadElement(element);
            this.intersectionObserver?.unobserve(element);
            this.lazyLoadQueue.delete(element);
          }
        });
      },
      {
        rootMargin: this.getRootMargin(),
        threshold: 0.1
      }
    );
  }

  /**
   * Get root margin for lazy loading based on connection speed
   */
  private getRootMargin(): string {
    const { connectionSpeed } = this.deviceCapabilities;
    
    if (connectionSpeed >= 10) {
      return '200px'; // Aggressive preloading on fast connections
    } else if (connectionSpeed >= 4) {
      return '100px'; // Moderate preloading on medium connections
    } else {
      return '50px'; // Conservative preloading on slow connections
    }
  }

  /**
   * Setup prefetching for critical resources
   */
  private setupPrefetching(): void {
    if (this.optimizationSettings.prefetchLevel === 'conservative') {
      return; // Skip prefetching on conservative mode
    }

    // Prefetch critical routes
    this.prefetchCriticalRoutes();
    
    // Setup hover/focus prefetching
    this.setupHoverPrefetching();
    
    // Setup viewport prefetching
    this.setupViewportPrefetching();
  }

  /**
   * Apply various performance optimizations
   */
  private applyPerformanceOptimizations(): void {
    // Apply CSS optimizations
    this.applyCSSOptimizations();
    
    // Apply JavaScript optimizations
    this.applyJSOptimizations();
    
    // Apply image optimizations
    this.applyImageOptimizations();
    
    // Apply animation optimizations
    this.applyAnimationOptimizations();
    
    // Apply network optimizations
    this.applyNetworkOptimizations();
  }

  /**
   * Apply CSS optimizations
   */
  private applyCSSOptimizations(): void {
    // Add critical CSS class to body
    document.body.classList.add('performance-optimized');
    
    // Add device-specific classes
    document.body.classList.add(`memory-${this.deviceCapabilities.memory}gb`);
    document.body.classList.add(`cores-${this.deviceCapabilities.cores}`);
    document.body.classList.add(`connection-${this.deviceCapabilities.connection}`);
    
    if (this.deviceCapabilities.isLowEndDevice) {
      document.body.classList.add('low-end-device');
    }

    // Apply animation level
    document.body.classList.add(`animation-${this.optimizationSettings.animationLevel}`);
    
    // Disable expensive CSS features on low-end devices
    if (this.deviceCapabilities.isLowEndDevice) {
      this.disableExpensiveCSSFeatures();
    }
  }

  /**
   * Apply JavaScript optimizations
   */
  private applyJSOptimizations(): void {
    // Use requestIdleCallback for non-critical tasks
    if ('requestIdleCallback' in window) {
      this.setupIdleTaskQueue();
    }
    
    // Implement time slicing for heavy computations
    this.setupTimeSlicing();
    
    // Optimize event listeners
    this.optimizeEventListeners();
  }

  /**
   * Apply image optimizations
   */
  private applyImageOptimizations(): void {
    // Set up responsive images with appropriate sizes
    this.setupResponsiveImages();
    
    // Enable native lazy loading where supported
    this.enableNativeLazyLoading();
    
    // Set up image format optimization
    this.optimizeImageFormats();
  }

  /**
   * Apply animation optimizations
   */
  private applyAnimationOptimizations(): void {
    const { animationLevel } = this.optimizationSettings;
    
    if (animationLevel === 'disabled') {
      this.disableAllAnimations();
    } else if (animationLevel === 'reduced') {
      this.reduceAnimations();
    }
    
    // Use will-change property judiciously
    this.optimizeWillChange();
  }

  /**
   * Apply network optimizations
   */
  private applyNetworkOptimizations(): void {
    // Setup resource hints
    this.addResourceHints();
    
    // Setup adaptive loading
    this.setupAdaptiveLoading();
    
    // Setup compression headers
    this.setupCompression();
  }

  /**
   * Register element for lazy loading
   */
  registerLazyLoad(element: HTMLElement): void {
    if (!this.intersectionObserver) return;
    
    this.lazyLoadQueue.add(element);
    this.intersectionObserver.observe(element);
  }

  /**
   * Load element content
   */
  private loadElement(element: HTMLElement): void {
    // Handle images
    if (element.tagName === 'IMG') {
      const img = element as HTMLImageElement;
      const src = img.dataset.src;
      const srcset = img.dataset.srcset;
      
      if (src) {
        img.src = src;
        img.removeAttribute('data-src');
      }
      
      if (srcset) {
        img.srcset = srcset;
        img.removeAttribute('data-srcset');
      }
    }
    
    // Handle background images
    const bgSrc = element.dataset.bgSrc;
    if (bgSrc) {
      element.style.backgroundImage = `url(${bgSrc})`;
      element.removeAttribute('data-bg-src');
    }
    
    // Handle components
    const componentName = element.dataset.component;
    if (componentName) {
      this.loadComponent(element, componentName);
    }
  }

  /**
   * Load component dynamically
   */
  private async loadComponent(element: HTMLElement, componentName: string): Promise<void> {
    try {
      // Import component dynamically
      const component = await import(`@/components/${componentName}.vue`);
      
      // Mount component (this would be framework-specific)
      // This is a placeholder - actual implementation would depend on Vue 3 setup
      console.log(`Loading component: ${componentName}`, component);
      
      element.removeAttribute('data-component');
    } catch (error) {
      console.error(`Failed to load component: ${componentName}`, error);
    }
  }

  /**
   * Prefetch critical routes
   */
  private prefetchCriticalRoutes(): void {
    const criticalRoutes = [
      '/dashboard',
      '/boards',
      '/tasks'
    ];
    
    criticalRoutes.forEach(route => {
      this.prefetchRoute(route);
    });
  }

  /**
   * Setup hover prefetching
   */
  private setupHoverPrefetching(): void {
    let prefetchTimeout: number;
    
    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (!link || this.prefetchQueue.has(link.href)) return;
      
      prefetchTimeout = window.setTimeout(() => {
        this.prefetchRoute(link.href);
      }, 100); // Small delay to avoid excessive prefetching
    });
    
    document.addEventListener('mouseout', () => {
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
      }
    });
  }

  /**
   * Setup viewport prefetching
   */
  private setupViewportPrefetching(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const href = element.getAttribute('href');
          
          if (href && !this.prefetchQueue.has(href)) {
            this.prefetchRoute(href);
          }
        }
      });
    }, { rootMargin: '200px' });
    
    // Observe all links
    document.querySelectorAll('a[href]').forEach(link => {
      observer.observe(link);
    });
  }

  /**
   * Prefetch route
   */
  private prefetchRoute(href: string): void {
    if (this.prefetchQueue.has(href)) return;
    
    this.prefetchQueue.add(href);
    
    // Create link element for prefetching
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    
    document.head.appendChild(link);
    
    // Remove after a delay to avoid memory leaks
    setTimeout(() => {
      document.head.removeChild(link);
      this.prefetchQueue.delete(href);
    }, 60000); // Remove after 1 minute
  }

  /**
   * Disable expensive CSS features
   */
  private disableExpensiveCSSFeatures(): void {
    const style = document.createElement('style');
    style.innerHTML = `
      .low-end-device * {
        backdrop-filter: none !important;
        filter: none !important;
        transform: none !important;
        transition: none !important;
        animation: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup idle task queue
   */
  private setupIdleTaskQueue(): void {
    const idleTasks: (() => void)[] = [];
    
    const processIdleTasks = (deadline: IdleDeadline) => {
      while (deadline.timeRemaining() > 0 && idleTasks.length > 0) {
        const task = idleTasks.shift();
        if (task) task();
      }
      
      if (idleTasks.length > 0) {
        requestIdleCallback(processIdleTasks);
      }
    };
    
    // Expose global function to queue idle tasks
    (window as any).queueIdleTask = (task: () => void) => {
      idleTasks.push(task);
      if (idleTasks.length === 1) {
        requestIdleCallback(processIdleTasks);
      }
    };
  }

  /**
   * Setup time slicing for heavy computations
   */
  private setupTimeSlicing(): void {
    (window as any).timeSliceTask = async (
      task: () => void,
      chunkSize: number = 5
    ): Promise<void> => {
      return new Promise((resolve) => {
        let index = 0;
        
        const processChunk = () => {
          const start = performance.now();
          
          while (index < chunkSize && performance.now() - start < 5) {
            task();
            index++;
          }
          
          if (index < chunkSize) {
            setTimeout(processChunk, 0);
          } else {
            resolve();
          }
        };
        
        processChunk();
      });
    };
  }

  /**
   * Optimize event listeners
   */
  private optimizeEventListeners(): void {
    // Use passive listeners for touch events
    const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'scroll', 'wheel'];
    
    passiveEvents.forEach(eventType => {
      document.addEventListener(eventType, () => {}, { passive: true });
    });
    
    // Debounce resize events
    let resizeTimeout: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        window.dispatchEvent(new Event('debouncedResize'));
      }, 250);
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Report metrics periodically
    setInterval(() => {
      this.reportMetrics();
    }, 30000); // Every 30 seconds
    
    // Report on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.reportMetrics();
      }
    });
  }

  /**
   * Report performance metrics
   */
  private reportMetrics(): void {
    const metrics = {
      ...this.metrics,
      timestamp: Date.now(),
      deviceCapabilities: this.deviceCapabilities,
      optimizationSettings: this.optimizationSettings
    };
    
    // Send to analytics
    this.sendToAnalytics(metrics);
    
    // Log for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Metrics:', metrics);
    }
  }

  /**
   * Send metrics to analytics
   */
  private sendToAnalytics(metrics: any): void {
    // Implementation would send to your analytics service
    if ('navigator' in window && 'sendBeacon' in navigator) {
      const data = JSON.stringify(metrics);
      navigator.sendBeacon('/api/analytics/performance', data);
    }
  }

  /**
   * Load user settings
   */
  private loadUserSettings(): OptimizationSettings | null {
    try {
      const stored = localStorage.getItem('performance-settings');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save user settings
   */
  saveUserSettings(settings: Partial<OptimizationSettings>): void {
    this.optimizationSettings = { ...this.optimizationSettings, ...settings };
    
    try {
      localStorage.setItem('performance-settings', JSON.stringify(this.optimizationSettings));
    } catch (error) {
      console.error('Failed to save performance settings:', error);
    }
    
    // Apply new settings
    this.applyPerformanceOptimizations();
  }

  /**
   * Get current metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }

  /**
   * Get optimization settings
   */
  getOptimizationSettings(): OptimizationSettings {
    return { ...this.optimizationSettings };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    this.lazyLoadQueue.clear();
    this.prefetchQueue.clear();
  }

  // Additional optimization methods would be implemented here...
  private setupResponsiveImages(): void { /* Implementation */ }
  private enableNativeLazyLoading(): void { /* Implementation */ }
  private optimizeImageFormats(): void { /* Implementation */ }
  private disableAllAnimations(): void { /* Implementation */ }
  private reduceAnimations(): void { /* Implementation */ }
  private optimizeWillChange(): void { /* Implementation */ }
  private addResourceHints(): void { /* Implementation */ }
  private setupAdaptiveLoading(): void { /* Implementation */ }
  private setupCompression(): void { /* Implementation */ }
}

// Export singleton instance
export const mobilePerformanceOptimizer = new MobilePerformanceOptimizer();

// Vue composable
export function useMobilePerformance() {
  return {
    registerLazyLoad: (element: HTMLElement) => mobilePerformanceOptimizer.registerLazyLoad(element),
    getMetrics: () => mobilePerformanceOptimizer.getMetrics(),
    getDeviceCapabilities: () => mobilePerformanceOptimizer.getDeviceCapabilities(),
    getOptimizationSettings: () => mobilePerformanceOptimizer.getOptimizationSettings(),
    saveUserSettings: (settings: Partial<OptimizationSettings>) => mobilePerformanceOptimizer.saveUserSettings(settings),
    optimizer: mobilePerformanceOptimizer
  };
}
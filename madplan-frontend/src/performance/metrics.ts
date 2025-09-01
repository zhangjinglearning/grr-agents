/**
 * Performance Metrics Collection and Core Web Vitals Tracking
 * Implements Story 4.2 performance monitoring requirements
 */

export interface PerformanceMetrics {
  fcp: number;              // First Contentful Paint
  lcp: number;              // Largest Contentful Paint  
  fid: number;              // First Input Delay
  cls: number;              // Cumulative Layout Shift
  ttfb: number;             // Time to First Byte
  interactionDelay: number; // Custom interaction timing
  routeChangeTime: number;  // Route transition performance
}

export interface BundleMetrics {
  initialBundle: number;    // Initial JavaScript bundle size
  totalAssets: number;      // Total asset size loaded
  chunkLoadTime: number;    // Lazy chunk loading time
}

class PerformanceTracker {
  private metrics: Partial<PerformanceMetrics> = {};
  private observer: PerformanceObserver | null = null;
  private navigationStartTime = performance.now();

  constructor() {
    this.initializeTracking();
  }

  private initializeTracking(): void {
    // Track Core Web Vitals
    this.trackWebVitals();
    
    // Track route changes
    this.trackRouteChanges();
    
    // Track custom interactions
    this.trackInteractions();
  }

  private trackWebVitals(): void {
    // First Contentful Paint (FCP)
    this.observePerformanceEntry('paint', (entries) => {
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime;
          this.reportMetric('fcp', entry.startTime);
        }
      });
    });

    // Largest Contentful Paint (LCP)
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        this.metrics.lcp = lastEntry.startTime;
        this.reportMetric('lcp', lastEntry.startTime);
      }
    });

    // First Input Delay (FID)
    this.observePerformanceEntry('first-input', (entries) => {
      entries.forEach(entry => {
        this.metrics.fid = entry.processingStart - entry.startTime;
        this.reportMetric('fid', this.metrics.fid);
      });
    });

    // Cumulative Layout Shift (CLS)
    this.trackLayoutShift();

    // Time to First Byte (TTFB)
    this.trackTTFB();
  }

  private observePerformanceEntry(
    type: string, 
    callback: (entries: PerformanceEntry[]) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ entryTypes: [type] });
    } catch (error) {
      console.warn(`Performance observer not supported for ${type}:`, error);
    }
  }

  private trackLayoutShift(): void {
    let clsValue = 0;
    this.observePerformanceEntry('layout-shift', (entries) => {
      entries.forEach(entry => {
        // Only count layout shifts that occur without user input
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          this.metrics.cls = clsValue;
        }
      });
      
      if (clsValue > 0) {
        this.reportMetric('cls', clsValue);
      }
    });
  }

  private trackTTFB(): void {
    try {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navTiming) {
        this.metrics.ttfb = navTiming.responseStart - navTiming.requestStart;
        this.reportMetric('ttfb', this.metrics.ttfb);
      }
    } catch (error) {
      console.warn('Navigation timing not available:', error);
    }
  }

  private trackRouteChanges(): void {
    let routeStartTime = performance.now();
    
    // Listen for route changes (Vue Router integration)
    window.addEventListener('routeChangeStart', () => {
      routeStartTime = performance.now();
    });
    
    window.addEventListener('routeChangeComplete', () => {
      const routeChangeTime = performance.now() - routeStartTime;
      this.metrics.routeChangeTime = routeChangeTime;
      this.reportMetric('route-change-time', routeChangeTime);
    });
  }

  private trackInteractions(): void {
    const interactionStart = new Map<string, number>();

    // Track click interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const key = `click-${target.tagName}-${Date.now()}`;
      interactionStart.set(key, performance.now());

      // Track interaction delay with requestAnimationFrame
      requestAnimationFrame(() => {
        const delay = performance.now() - interactionStart.get(key)!;
        this.metrics.interactionDelay = delay;
        this.reportMetric('interaction-delay', delay);
        interactionStart.delete(key);
      });
    });
  }

  private reportMetric(name: string, value: number): void {
    // Report to console in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);
    }

    // Send to analytics service in production
    if (import.meta.env.PROD) {
      this.sendAnalytics(name, value);
    }

    // Check against performance budgets
    this.checkPerformanceBudgets(name, value);
  }

  private sendAnalytics(metric: string, value: number): void {
    // Integration point for analytics services
    // Could be Google Analytics, Mixpanel, custom analytics, etc.
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'performance_metric', {
          metric_name: metric,
          metric_value: Math.round(value),
        });
      }
    } catch (error) {
      console.warn('Failed to send analytics:', error);
    }
  }

  private checkPerformanceBudgets(metric: string, value: number): void {
    const budgets = {
      fcp: 1800,    // 1.8s budget for First Contentful Paint
      lcp: 2500,    // 2.5s budget for Largest Contentful Paint
      fid: 100,     // 100ms budget for First Input Delay
      cls: 0.1,     // 0.1 budget for Cumulative Layout Shift
      ttfb: 800,    // 800ms budget for Time to First Byte
      'interaction-delay': 50,    // 50ms budget for interaction delay
      'route-change-time': 300,   // 300ms budget for route changes
    };

    const budget = budgets[metric as keyof typeof budgets];
    if (budget && value > budget) {
      console.warn(`[Performance Budget] ${metric} exceeded budget: ${value.toFixed(2)}ms > ${budget}ms`);
      
      // Report budget violation
      if (import.meta.env.PROD) {
        this.sendAnalytics(`budget_violation_${metric}`, value);
      }
    }
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  public startTimer(label: string): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.reportMetric(`custom_timer_${label}`, duration);
      return duration;
    };
  }

  public markInteraction(name: string): void {
    performance.mark(`interaction_${name}_start`);
    
    requestAnimationFrame(() => {
      performance.mark(`interaction_${name}_end`);
      performance.measure(
        `interaction_${name}`,
        `interaction_${name}_start`,
        `interaction_${name}_end`
      );
      
      const measure = performance.getEntriesByName(`interaction_${name}`)[0];
      if (measure) {
        this.reportMetric(`interaction_${name}`, measure.duration);
      }
    });
  }

  public cleanup(): void {
    this.observer?.disconnect();
  }
}

// Singleton instance
const performanceTracker = new PerformanceTracker();

// Export utilities for components to use
export const usePerformanceTracking = () => {
  return {
    getMetrics: () => performanceTracker.getMetrics(),
    startTimer: (label: string) => performanceTracker.startTimer(label),
    markInteraction: (name: string) => performanceTracker.markInteraction(name),
  };
};

// Export for cleanup in tests
export const cleanupPerformanceTracking = () => {
  performanceTracker.cleanup();
};

export default performanceTracker;
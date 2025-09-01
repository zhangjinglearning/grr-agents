import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

export interface WebVitalsData {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface CoreWebVitalsThresholds {
  LCP: { good: number; poor: number };
  FID: { good: number; poor: number };
  CLS: { good: number; poor: number };
  FCP: { good: number; poor: number };
  TTFB: { good: number; poor: number };
}

// Core Web Vitals thresholds (in milliseconds for timing metrics)
const THRESHOLDS: CoreWebVitalsThresholds = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

class WebVitalsTracker {
  private analytics: any;
  private vitalsData: WebVitalsData[] = [];
  private isInitialized = false;
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.init();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private init(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    // Initialize analytics tracking
    this.initializeAnalytics();

    // Set up Core Web Vitals tracking
    this.setupCoreWebVitals();

    // Track additional performance metrics
    this.setupAdditionalMetrics();

    // Track user interactions
    this.setupUserInteractionTracking();

    this.isInitialized = true;
  }

  private initializeAnalytics(): void {
    // Initialize analytics services (Google Analytics 4, Mixpanel, etc.)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      this.analytics = (window as any).gtag;
    }
  }

  private setupCoreWebVitals(): void {
    const handleVital = (metric: Metric) => {
      const vitalsData = this.processMetric(metric);
      this.vitalsData.push(vitalsData);
      this.sendToAnalytics(vitalsData);
      this.sendToBackend(vitalsData);
      this.checkPerformanceBudgets(vitalsData);
    };

    // Track all Core Web Vitals
    getCLS(handleVital);
    getFID(handleVital);
    getFCP(handleVital);
    getLCP(handleVital);
    getTTFB(handleVital);
  }

  private processMetric(metric: Metric): WebVitalsData {
    const rating = this.getRating(metric.name as keyof CoreWebVitalsThresholds, metric.value);
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      name: metric.name,
      value: metric.value,
      rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: navigationEntry?.type || 'unknown',
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      connectionType: this.getConnectionType(),
      deviceMemory: this.getDeviceMemory(),
      hardwareConcurrency: navigator.hardwareConcurrency,
    };
  }

  private getRating(metricName: keyof CoreWebVitalsThresholds, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = THRESHOLDS[metricName];
    if (!thresholds) return 'good';

    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  }

  private getConnectionType(): string | undefined {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection?.effectiveType || connection?.type;
  }

  private getDeviceMemory(): number | undefined {
    return (navigator as any).deviceMemory;
  }

  private setupAdditionalMetrics(): void {
    // Track additional performance metrics
    this.trackResourceTiming();
    this.trackNavigationTiming();
    this.trackPaintTiming();
    this.trackLongTasks();
  }

  private trackResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.sendResourceMetric(entry as PerformanceResourceTiming);
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  private trackNavigationTiming(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.sendNavigationMetric(entry as PerformanceNavigationTiming);
          }
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
    }
  }

  private trackPaintTiming(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            this.sendPaintMetric(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });
    }
  }

  private trackLongTasks(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.sendLongTaskMetric(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  private setupUserInteractionTracking(): void {
    // Track user interactions that affect performance
    document.addEventListener('click', this.handleUserInteraction.bind(this));
    document.addEventListener('keydown', this.handleUserInteraction.bind(this));
    document.addEventListener('scroll', this.throttle(this.handleScrollInteraction.bind(this), 1000));
  }

  private handleUserInteraction(event: Event): void {
    const startTime = performance.now();
    
    requestAnimationFrame(() => {
      const duration = performance.now() - startTime;
      
      if (duration > 16) { // More than one frame (16ms at 60fps)
        this.sendInteractionMetric({
          type: event.type,
          duration,
          target: (event.target as Element)?.tagName || 'unknown',
          timestamp: Date.now(),
        });
      }
    });
  }

  private handleScrollInteraction(): void {
    const scrollY = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollPercentage = (scrollY / (documentHeight - windowHeight)) * 100;

    this.sendScrollMetric({
      scrollPercentage: Math.round(scrollPercentage),
      timestamp: Date.now(),
    });
  }

  private throttle(func: Function, limit: number): EventListener {
    let inThrottle: boolean;
    return function(this: any) {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    } as EventListener;
  }

  private sendToAnalytics(vitalsData: WebVitalsData): void {
    // Send to Google Analytics 4
    if (this.analytics && typeof this.analytics === 'function') {
      this.analytics('event', vitalsData.name, {
        event_category: 'Web Vitals',
        event_label: vitalsData.id,
        value: Math.round(vitalsData.name === 'CLS' ? vitalsData.value * 1000 : vitalsData.value),
        custom_parameter_rating: vitalsData.rating,
        custom_parameter_navigation_type: vitalsData.navigationType,
        custom_parameter_connection_type: vitalsData.connectionType,
      });
    }

    // Send to other analytics platforms
    this.sendToCustomAnalytics(vitalsData);
  }

  private sendToCustomAnalytics(vitalsData: WebVitalsData): void {
    // Send to custom analytics endpoint
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Web Vitals', {
        metric: vitalsData.name,
        value: vitalsData.value,
        rating: vitalsData.rating,
        url: vitalsData.url,
        sessionId: this.sessionId,
        userId: this.userId,
        timestamp: vitalsData.timestamp,
      });
    }
  }

  private async sendToBackend(vitalsData: WebVitalsData): Promise<void> {
    try {
      const endpoint = '/api/metrics/web-vitals';
      
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...vitalsData,
          sessionId: this.sessionId,
          userId: this.userId,
        }),
      });
    } catch (error) {
      console.warn('Failed to send web vitals to backend:', error);
    }
  }

  private sendResourceMetric(entry: PerformanceResourceTiming): void {
    const resourceMetric = {
      name: entry.name,
      type: 'resource',
      duration: entry.duration,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.sendToBackend(resourceMetric as any);
  }

  private sendNavigationMetric(entry: PerformanceNavigationTiming): void {
    const navigationMetric = {
      name: 'navigation',
      type: 'navigation',
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcpConnection: entry.connectEnd - entry.connectStart,
      serverResponse: entry.responseEnd - entry.requestStart,
      domProcessing: entry.domComplete - entry.domLoading,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.sendToBackend(navigationMetric as any);
  }

  private sendPaintMetric(entry: PerformanceEntry): void {
    const paintMetric = {
      name: entry.name,
      type: 'paint',
      startTime: entry.startTime,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.sendToBackend(paintMetric as any);
  }

  private sendLongTaskMetric(entry: PerformanceEntry): void {
    const longTaskMetric = {
      name: 'longtask',
      type: 'longtask',
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.sendToBackend(longTaskMetric as any);
  }

  private sendInteractionMetric(data: any): void {
    this.sendToBackend({
      name: 'interaction',
      type: 'interaction',
      ...data,
      sessionId: this.sessionId,
    } as any);
  }

  private sendScrollMetric(data: any): void {
    this.sendToBackend({
      name: 'scroll',
      type: 'scroll',
      ...data,
      sessionId: this.sessionId,
    } as any);
  }

  private checkPerformanceBudgets(vitalsData: WebVitalsData): void {
    // Check if metrics exceed performance budgets
    const budgetExceeded = vitalsData.rating === 'poor';
    
    if (budgetExceeded) {
      console.warn(`Performance budget exceeded for ${vitalsData.name}:`, vitalsData);
      
      // Send alert to monitoring system
      this.sendPerformanceAlert(vitalsData);
    }
  }

  private sendPerformanceAlert(vitalsData: WebVitalsData): void {
    // Send performance alert to monitoring system
    fetch('/api/alerts/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'performance_budget_exceeded',
        metric: vitalsData.name,
        value: vitalsData.value,
        threshold: THRESHOLDS[vitalsData.name as keyof CoreWebVitalsThresholds],
        url: vitalsData.url,
        sessionId: this.sessionId,
        timestamp: vitalsData.timestamp,
      }),
    }).catch(error => {
      console.warn('Failed to send performance alert:', error);
    });
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public getWebVitalsData(): WebVitalsData[] {
    return [...this.vitalsData];
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public generatePerformanceReport(): {
    summary: Record<string, { value: number; rating: string }>;
    recommendations: string[];
    score: number;
  } {
    const summary: Record<string, { value: number; rating: string }> = {};
    const recommendations: string[] = [];
    let totalScore = 0;
    let metricsCount = 0;

    // Process each metric
    this.vitalsData.forEach(metric => {
      summary[metric.name] = {
        value: metric.value,
        rating: metric.rating,
      };

      // Calculate score (good = 100, needs-improvement = 60, poor = 30)
      let score = 100;
      if (metric.rating === 'needs-improvement') score = 60;
      if (metric.rating === 'poor') score = 30;

      totalScore += score;
      metricsCount++;

      // Generate recommendations
      if (metric.rating !== 'good') {
        recommendations.push(...this.getRecommendations(metric));
      }
    });

    const overallScore = metricsCount > 0 ? Math.round(totalScore / metricsCount) : 100;

    return {
      summary,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      score: overallScore,
    };
  }

  private getRecommendations(metric: WebVitalsData): string[] {
    const recommendations: string[] = [];

    switch (metric.name) {
      case 'LCP':
        recommendations.push(
          'Optimize images with proper sizing and modern formats (WebP, AVIF)',
          'Implement lazy loading for below-the-fold images',
          'Use a CDN to serve static assets faster',
          'Minimize render-blocking resources (CSS, JavaScript)',
          'Consider server-side rendering for critical content'
        );
        break;
      
      case 'FID':
        recommendations.push(
          'Minimize JavaScript execution time',
          'Break up long-running tasks with setTimeout or requestIdleCallback',
          'Use code splitting to reduce initial JavaScript bundle size',
          'Remove unused JavaScript code',
          'Consider using a web worker for heavy computations'
        );
        break;
      
      case 'CLS':
        recommendations.push(
          'Set explicit dimensions for images and videos',
          'Avoid inserting content above existing content',
          'Use CSS aspect-ratio for dynamic content',
          'Preload custom fonts and use font-display: swap',
          'Reserve space for ads and embedded content'
        );
        break;
      
      case 'FCP':
        recommendations.push(
          'Minimize render-blocking resources',
          'Optimize critical CSS delivery',
          'Use resource hints (preload, prefetch, preconnect)',
          'Minimize server response times',
          'Enable text compression (gzip, brotli)'
        );
        break;
      
      case 'TTFB':
        recommendations.push(
          'Optimize server response times',
          'Use a Content Delivery Network (CDN)',
          'Enable caching at multiple levels',
          'Optimize database queries',
          'Consider edge computing solutions'
        );
        break;
    }

    return recommendations;
  }
}

// Create global instance
let webVitalsTracker: WebVitalsTracker;

export const initWebVitals = (userId?: string): WebVitalsTracker => {
  if (!webVitalsTracker) {
    webVitalsTracker = new WebVitalsTracker();
  }
  
  if (userId) {
    webVitalsTracker.setUserId(userId);
  }
  
  return webVitalsTracker;
};

export const getWebVitalsTracker = (): WebVitalsTracker | null => {
  return webVitalsTracker || null;
};

export { THRESHOLDS as WEB_VITALS_THRESHOLDS };
export default WebVitalsTracker;
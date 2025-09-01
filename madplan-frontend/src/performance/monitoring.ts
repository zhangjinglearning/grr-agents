/**
 * Performance Monitoring and Analytics Integration
 * Implements Story 4.2 performance monitoring and analytics requirements
 */

import performanceTracker from './metrics';

export interface PerformanceBudget {
  fcp: number;      // First Contentful Paint (ms)
  lcp: number;      // Largest Contentful Paint (ms)
  fid: number;      // First Input Delay (ms)
  cls: number;      // Cumulative Layout Shift (score)
  ttfb: number;     // Time to First Byte (ms)
  bundleSize: number; // Initial bundle size (bytes)
  routeChange: number; // Route change time (ms)
}

export interface PerformanceAlert {
  metric: string;
  value: number;
  budget: number;
  severity: 'warning' | 'critical';
  timestamp: number;
  context?: any;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  pageViews: number;
  interactions: number;
  errors: number;
  deviceInfo: {
    userAgent: string;
    viewport: { width: number; height: number };
    connection?: any;
    memory?: number;
  };
}

class PerformanceMonitor {
  private budgets: PerformanceBudget = {
    fcp: 1800,      // 1.8s
    lcp: 2500,      // 2.5s
    fid: 100,       // 100ms
    cls: 0.1,       // 0.1 score
    ttfb: 800,      // 800ms
    bundleSize: 500 * 1024, // 500KB
    routeChange: 300, // 300ms
  };

  private alerts: PerformanceAlert[] = [];
  private session: UserSession;
  private isMonitoring = false;
  private reportingEndpoint: string | null = null;

  constructor() {
    this.session = this.createSession();
    this.initializeMonitoring();
  }

  private createSession(): UserSession {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      sessionId,
      startTime: Date.now(),
      pageViews: 1,
      interactions: 0,
      errors: 0,
      deviceInfo: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        connection: (navigator as any).connection || (navigator as any).mozConnection,
        memory: (performance as any).memory?.usedJSHeapSize,
      },
    };
  }

  private initializeMonitoring(): void {
    this.isMonitoring = true;

    // Set up performance budgets monitoring
    this.setupBudgetMonitoring();

    // Track user interactions
    this.setupInteractionTracking();

    // Track route changes
    this.setupRouteTracking();

    // Track errors
    this.setupErrorTracking();

    // Send periodic reports
    this.setupPeriodicReporting();

    // Handle page unload
    this.setupUnloadHandling();

    console.log('[Performance Monitor] Monitoring initialized');
  }

  private setupBudgetMonitoring(): void {
    // Monitor Web Vitals against budgets
    const checkBudget = (metric: string, value: number) => {
      const budget = this.budgets[metric as keyof PerformanceBudget];
      
      if (budget && value > budget) {
        const severity: 'warning' | 'critical' = value > budget * 1.5 ? 'critical' : 'warning';
        
        this.createAlert(metric, value, budget, severity);
      }
    };

    // Listen for performance metrics from the tracker
    performanceTracker.on?.('metric', (data: { name: string; value: number }) => {
      checkBudget(data.name, data.value);
    });
  }

  private setupInteractionTracking(): void {
    // Track clicks
    document.addEventListener('click', () => {
      this.session.interactions++;
    });

    // Track keyboard interactions
    document.addEventListener('keydown', (event) => {
      // Only count meaningful interactions
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
        this.session.interactions++;
      }
    });

    // Track form submissions
    document.addEventListener('submit', () => {
      this.session.interactions++;
    });
  }

  private setupRouteTracking(): void {
    let routeStartTime = Date.now();

    // Track route change start
    window.addEventListener('beforeunload', () => {
      routeStartTime = Date.now();
    });

    // Track route change completion
    window.addEventListener('load', () => {
      const routeTime = Date.now() - routeStartTime;
      this.reportMetric('route_change_time', routeTime);
      this.session.pageViews++;
    });

    // Track SPA route changes (if using Vue Router)
    if (window.history?.pushState) {
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        routeStartTime = Date.now();
        originalPushState.apply(window.history, args);
        
        // Track completion after next tick
        setTimeout(() => {
          const routeTime = Date.now() - routeStartTime;
          // Use the performance monitor instance
          (window as any).__performanceMonitor?.reportMetric('spa_route_change', routeTime);
        }, 0);
      };
    }
  }

  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.session.errors++;
      this.reportError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.session.errors++;
      this.reportError({
        message: 'Unhandled Promise Rejection',
        reason: String(event.reason),
        stack: event.reason?.stack,
      });
    });
  }

  private setupPeriodicReporting(): void {
    // Report session data every 30 seconds
    setInterval(() => {
      if (this.isMonitoring) {
        this.sendSessionUpdate();
      }
    }, 30000);

    // Report performance data every 60 seconds
    setInterval(() => {
      if (this.isMonitoring) {
        this.sendPerformanceReport();
      }
    }, 60000);
  }

  private setupUnloadHandling(): void {
    const handleUnload = () => {
      this.session.endTime = Date.now();
      this.sendFinalReport();
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    // For mobile devices
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      }
    });
  }

  // Public API methods
  public setBudgets(budgets: Partial<PerformanceBudget>): void {
    this.budgets = { ...this.budgets, ...budgets };
    console.log('[Performance Monitor] Budgets updated:', this.budgets);
  }

  public setReportingEndpoint(endpoint: string): void {
    this.reportingEndpoint = endpoint;
    console.log('[Performance Monitor] Reporting endpoint set:', endpoint);
  }

  public reportMetric(name: string, value: number, context?: any): void {
    // Send to analytics
    this.sendAnalytics('performance_metric', {
      metric: name,
      value,
      context,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
    });

    // Check against budgets
    const budget = this.budgets[name as keyof PerformanceBudget];
    if (budget && value > budget) {
      this.createAlert(name, value, budget, value > budget * 1.5 ? 'critical' : 'warning');
    }
  }

  public reportError(error: any): void {
    this.sendAnalytics('performance_error', {
      error,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }

  public getSession(): UserSession {
    return { ...this.session };
  }

  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  public startUserTiming(label: string): () => void {
    const startTime = performance.now();
    performance.mark(`${label}_start`);

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      performance.mark(`${label}_end`);
      performance.measure(label, `${label}_start`, `${label}_end`);
      
      this.reportMetric(`user_timing_${label}`, duration);
      
      return duration;
    };
  }

  // Real User Monitoring (RUM)
  public trackPageLoad(): void {
    if (document.readyState === 'complete') {
      this.collectPageLoadMetrics();
    } else {
      window.addEventListener('load', () => {
        this.collectPageLoadMetrics();
      });
    }
  }

  private collectPageLoadMetrics(): void {
    // Navigation Timing
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navTiming) {
      this.reportMetric('dns_lookup', navTiming.domainLookupEnd - navTiming.domainLookupStart);
      this.reportMetric('tcp_connect', navTiming.connectEnd - navTiming.connectStart);
      this.reportMetric('request_response', navTiming.responseEnd - navTiming.requestStart);
      this.reportMetric('dom_processing', navTiming.domContentLoadedEventStart - navTiming.responseEnd);
      this.reportMetric('resource_loading', navTiming.loadEventStart - navTiming.domContentLoadedEventEnd);
    }

    // Resource Timing
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const resourceTypes: Record<string, number[]> = {};

    resources.forEach(resource => {
      const type = this.getResourceType(resource.name);
      if (!resourceTypes[type]) resourceTypes[type] = [];
      resourceTypes[type].push(resource.duration);
    });

    // Report average load times by resource type
    Object.entries(resourceTypes).forEach(([type, durations]) => {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      this.reportMetric(`resource_${type}_avg`, avgDuration);
    });
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.includes('.woff')) return 'font';
    if (url.includes('/api/') || url.includes('/graphql')) return 'api';
    return 'other';
  }

  // A/B Testing integration
  public trackExperiment(experimentId: string, variant: string): void {
    this.sendAnalytics('experiment_exposure', {
      experimentId,
      variant,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
    });
  }

  public trackConversion(experimentId: string, metric: string, value?: number): void {
    this.sendAnalytics('experiment_conversion', {
      experimentId,
      metric,
      value,
      sessionId: this.session.sessionId,
      timestamp: Date.now(),
    });
  }

  // Private helper methods
  private createAlert(metric: string, value: number, budget: number, severity: 'warning' | 'critical'): void {
    const alert: PerformanceAlert = {
      metric,
      value,
      budget,
      severity,
      timestamp: Date.now(),
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    this.alerts = this.alerts.slice(-100);

    // Log critical alerts
    if (severity === 'critical') {
      console.error(`[Performance Alert] CRITICAL: ${metric} = ${value.toFixed(2)}ms (budget: ${budget}ms)`);
    } else {
      console.warn(`[Performance Alert] WARNING: ${metric} = ${value.toFixed(2)}ms (budget: ${budget}ms)`);
    }

    // Send alert to monitoring service
    this.sendAnalytics('performance_alert', alert);
  }

  private async sendAnalytics(event: string, data: any): Promise<void> {
    try {
      // Google Analytics 4 integration
      if (typeof window.gtag === 'function') {
        window.gtag('event', event, {
          custom_parameter: JSON.stringify(data),
        });
      }

      // Custom analytics endpoint
      if (this.reportingEndpoint) {
        await fetch(this.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event,
            data,
            timestamp: Date.now(),
          }),
        });
      }

      // Development logging
      if (import.meta.env.DEV) {
        console.log(`[Analytics] ${event}:`, data);
      }

    } catch (error) {
      console.warn('[Performance Monitor] Failed to send analytics:', error);
    }
  }

  private sendSessionUpdate(): void {
    this.sendAnalytics('session_update', {
      session: this.session,
      metrics: performanceTracker.getMetrics?.(),
    });
  }

  private sendPerformanceReport(): void {
    this.sendAnalytics('performance_report', {
      sessionId: this.session.sessionId,
      metrics: performanceTracker.getMetrics?.(),
      alerts: this.alerts.filter(alert => Date.now() - alert.timestamp < 60000), // Last minute
    });
  }

  private sendFinalReport(): void {
    // Use sendBeacon for reliable delivery on page unload
    const data = JSON.stringify({
      event: 'session_end',
      session: { ...this.session, endTime: Date.now() },
      finalMetrics: performanceTracker.getMetrics?.(),
      totalAlerts: this.alerts.length,
    });

    if (navigator.sendBeacon && this.reportingEndpoint) {
      navigator.sendBeacon(this.reportingEndpoint, data);
    }
  }

  public cleanup(): void {
    this.isMonitoring = false;
    console.log('[Performance Monitor] Monitoring stopped');
  }
}

// Singleton performance monitor
const performanceMonitor = new PerformanceMonitor();

// Make it globally accessible for debugging
(window as any).__performanceMonitor = performanceMonitor;

// Export utilities
export const usePerformanceMonitoring = () => {
  return {
    setBudgets: (budgets: Partial<PerformanceBudget>) => performanceMonitor.setBudgets(budgets),
    setReportingEndpoint: (endpoint: string) => performanceMonitor.setReportingEndpoint(endpoint),
    
    reportMetric: (name: string, value: number, context?: any) => 
      performanceMonitor.reportMetric(name, value, context),
    
    reportError: (error: any) => performanceMonitor.reportError(error),
    
    startTiming: (label: string) => performanceMonitor.startUserTiming(label),
    
    trackPageLoad: () => performanceMonitor.trackPageLoad(),
    trackExperiment: (id: string, variant: string) => performanceMonitor.trackExperiment(id, variant),
    trackConversion: (id: string, metric: string, value?: number) => 
      performanceMonitor.trackConversion(id, metric, value),
    
    getSession: () => performanceMonitor.getSession(),
    getAlerts: () => performanceMonitor.getAlerts(),
    clearAlerts: () => performanceMonitor.clearAlerts(),
  };
};

export default performanceMonitor;
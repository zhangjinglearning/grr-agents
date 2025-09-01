/**
 * Mobile Performance Testing Suite
 * Comprehensive performance testing for mobile devices
 */

import { test, expect, devices } from '@playwright/test';

// Performance test configurations
const performanceTargets = {
  // Core Web Vitals
  fcp: 1800, // First Contentful Paint < 1.8s
  lcp: 2500, // Largest Contentful Paint < 2.5s
  fid: 100,  // First Input Delay < 100ms
  cls: 0.1,  // Cumulative Layout Shift < 0.1
  
  // Network timing
  ttfb: 800, // Time to First Byte < 800ms
  
  // Bundle sizes
  maxBundleSize: 500 * 1024, // 500KB initial bundle
  maxTotalSize: 2 * 1024 * 1024, // 2MB total
  
  // Memory usage
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB peak usage
  
  // Battery/CPU
  maxCpuUsage: 30, // 30% average CPU usage
};

const testDevices = [
  {
    name: 'iPhone 12',
    ...devices['iPhone 12'],
    connectionType: '4g'
  },
  {
    name: 'Galaxy S21',
    ...devices['Galaxy S21'],
    connectionType: '4g'
  },
  {
    name: 'iPhone SE',
    ...devices['iPhone SE'],
    connectionType: '3g' // Slower device, test with slower connection
  }
];

const networkConditions = {
  '4g': {
    offline: false,
    downloadThroughput: 10000000, // 10 Mbps
    uploadThroughput: 5000000,    // 5 Mbps
    latency: 50
  },
  '3g': {
    offline: false,
    downloadThroughput: 1500000,  // 1.5 Mbps
    uploadThroughput: 750000,     // 750 Kbps
    latency: 300
  },
  'slow-3g': {
    offline: false,
    downloadThroughput: 500000,   // 500 Kbps
    uploadThroughput: 500000,     // 500 Kbps
    latency: 2000
  }
};

// Core Web Vitals measurement utility
async function measureWebVitals(page: any) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals: any = {};
      let measurements = 0;
      const expectedMeasurements = 5;
      
      const checkComplete = () => {
        measurements++;
        if (measurements >= expectedMeasurements) {
          resolve(vitals);
        }
      };

      // First Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime;
            checkComplete();
          }
        });
      }).observe({ entryTypes: ['paint'] });

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          vitals.lcp = entry.startTime;
        });
        checkComplete();
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          vitals.fid = entry.processingStart - entry.startTime;
          checkComplete();
        });
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      new PerformanceObserver((list) => {
        let cumulativeScore = 0;
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            cumulativeScore += entry.value;
          }
        });
        vitals.cls = cumulativeScore;
        checkComplete();
      }).observe({ entryTypes: ['layout-shift'] });

      // Time to First Byte
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        vitals.ttfb = navigationEntry.responseStart - navigationEntry.fetchStart;
        checkComplete();
      }

      // Fallback timeout
      setTimeout(() => {
        resolve(vitals);
      }, 10000);
    });
  });
}

// Bundle size analysis
async function analyzeBundleSize(page: any) {
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return entries.map(entry => ({
      name: entry.name,
      size: (entry as any).transferSize || 0,
      type: entry.initiatorType,
      duration: entry.duration
    })).filter(resource => 
      resource.name.includes('.js') || 
      resource.name.includes('.css') ||
      resource.name.includes('.wasm')
    );
  });

  const jsSize = resources
    .filter(r => r.name.includes('.js'))
    .reduce((sum, r) => sum + r.size, 0);
    
  const cssSize = resources
    .filter(r => r.name.includes('.css'))
    .reduce((sum, r) => sum + r.size, 0);
    
  const totalSize = resources.reduce((sum, r) => sum + r.size, 0);

  return {
    javascript: jsSize,
    css: cssSize,
    total: totalSize,
    resources
  };
}

// Memory usage measurement
async function measureMemoryUsage(page: any) {
  return await page.evaluate(() => {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  });
}

// Performance tests for each device
for (const device of testDevices) {
  test.describe(`Performance - ${device.name}`, () => {
    test.use({ ...device });

    test('should meet Core Web Vitals targets', async ({ page, context }) => {
      // Set network conditions
      const networkCondition = networkConditions[device.connectionType as keyof typeof networkConditions];
      await context.route('**/*', async (route) => {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, networkCondition.latency / 10));
        await route.continue();
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const vitals = await measureWebVitals(page);

      console.log(`Performance metrics for ${device.name}:`, vitals);

      // Assert Core Web Vitals
      if (vitals.fcp) {
        expect(vitals.fcp).toBeLessThan(performanceTargets.fcp);
      }

      if (vitals.lcp) {
        expect(vitals.lcp).toBeLessThan(performanceTargets.lcp);
      }

      if (vitals.cls !== undefined) {
        expect(vitals.cls).toBeLessThan(performanceTargets.cls);
      }

      if (vitals.ttfb) {
        expect(vitals.ttfb).toBeLessThan(performanceTargets.ttfb);
      }
    });

    test('should have optimal bundle sizes', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const bundleAnalysis = await analyzeBundleSize(page);

      console.log(`Bundle analysis for ${device.name}:`, {
        javascript: `${(bundleAnalysis.javascript / 1024).toFixed(2)}KB`,
        css: `${(bundleAnalysis.css / 1024).toFixed(2)}KB`,
        total: `${(bundleAnalysis.total / 1024).toFixed(2)}KB`
      });

      // Assert bundle size targets
      expect(bundleAnalysis.javascript).toBeLessThan(performanceTargets.maxBundleSize);
      expect(bundleAnalysis.total).toBeLessThan(performanceTargets.maxTotalSize);

      // Check for efficient resource loading
      const jsResources = bundleAnalysis.resources.filter(r => r.name.includes('.js'));
      const mainBundle = jsResources.find(r => r.name.includes('main') || r.name.includes('app'));
      
      if (mainBundle) {
        expect(mainBundle.size).toBeLessThan(performanceTargets.maxBundleSize);
      }
    });

    test('should maintain acceptable memory usage', async ({ page }) => {
      const memoryMeasurements: any[] = [];

      // Navigate through multiple pages to test memory usage
      const routes = ['/dashboard', '/boards', '/boards/1', '/tasks', '/analytics'];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        
        // Force garbage collection if available
        await page.evaluate(() => {
          if ((window as any).gc) {
            (window as any).gc();
          }
        });

        const memoryUsage = await measureMemoryUsage(page);
        if (memoryUsage) {
          memoryMeasurements.push({
            route,
            ...memoryUsage
          });
        }

        // Interact with page to generate realistic memory usage
        await page.hover('button').catch(() => {});
        await page.waitForTimeout(1000);
      }

      if (memoryMeasurements.length > 0) {
        const peakMemory = Math.max(...memoryMeasurements.map(m => m.used));
        console.log(`Peak memory usage for ${device.name}: ${(peakMemory / 1024 / 1024).toFixed(2)}MB`);
        
        expect(peakMemory).toBeLessThan(performanceTargets.maxMemoryUsage);

        // Check for memory leaks (memory should not continuously grow)
        if (memoryMeasurements.length >= 3) {
          const firstMeasurement = memoryMeasurements[0].used;
          const lastMeasurement = memoryMeasurements[memoryMeasurements.length - 1].used;
          const growthRatio = lastMeasurement / firstMeasurement;
          
          // Memory shouldn't grow more than 2x during normal navigation
          expect(growthRatio).toBeLessThan(2);
        }
      }
    });

    test('should handle slow network conditions gracefully', async ({ page, context }) => {
      // Simulate slow 3G connection
      await context.route('**/*', async (route) => {
        // Add significant delay
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });

      const startTime = Date.now();
      await page.goto('/dashboard');

      // Check that loading states are shown
      const loadingElements = page.locator('.loading, .spinner, [data-loading="true"]');
      const hasLoadingState = await loadingElements.first().isVisible().catch(() => false);

      if (hasLoadingState) {
        // Loading should be shown initially
        await expect(loadingElements.first()).toBeVisible();
      }

      // Content should eventually load
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await expect(page.locator('main, .main-content')).toBeVisible();

      const loadTime = Date.now() - startTime;
      console.log(`Load time on slow network for ${device.name}: ${loadTime}ms`);

      // Should load within reasonable time even on slow network
      expect(loadTime).toBeLessThan(15000); // 15 seconds max
    });

    test('should efficiently handle image loading', async ({ page }) => {
      await page.goto('/boards/1'); // Page likely to have images
      await page.waitForLoadState('networkidle');

      // Check image lazy loading
      const images = page.locator('img[data-src], img[loading="lazy"]');
      const imageCount = await images.count();

      if (imageCount > 0) {
        // Images should use lazy loading attributes
        for (let i = 0; i < Math.min(imageCount, 5); i++) {
          const img = images.nth(i);
          const loading = await img.getAttribute('loading');
          const dataSrc = await img.getAttribute('data-src');
          
          // Should have lazy loading or data-src for lazy loading
          expect(loading === 'lazy' || !!dataSrc).toBeTruthy();
        }
      }

      // Check for responsive images
      const responsiveImages = page.locator('img[srcset], picture > img');
      const responsiveCount = await responsiveImages.count();

      if (responsiveCount > 0) {
        const img = responsiveImages.first();
        const srcset = await img.getAttribute('srcset');
        
        if (srcset) {
          // Should have multiple image sizes
          expect(srcset.split(',').length).toBeGreaterThan(1);
        }
      }
    });

    test('should optimize JavaScript execution', async ({ page }) => {
      let longTasksDetected = 0;
      
      // Monitor long tasks
      await page.addInitScript(() => {
        if ('PerformanceObserver' in window) {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (entry.duration > 50) { // Long task > 50ms
                (window as any).longTasksDetected = ((window as any).longTasksDetected || 0) + 1;
              }
            });
          }).observe({ entryTypes: ['longtask'] });
        }
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Interact with the page to trigger JavaScript execution
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(100);
        }
      }

      longTasksDetected = await page.evaluate(() => (window as any).longTasksDetected || 0);
      
      console.log(`Long tasks detected for ${device.name}: ${longTasksDetected}`);
      
      // Should minimize long tasks that block the main thread
      expect(longTasksDetected).toBeLessThan(5);
    });

    test('should handle concurrent user interactions efficiently', async ({ page }) => {
      await page.goto('/boards/1');
      await page.waitForLoadState('networkidle');

      const startTime = Date.now();
      
      // Simulate rapid user interactions
      const interactions = [
        () => page.click('button').catch(() => {}),
        () => page.hover('.kanban-card').catch(() => {}),
        () => page.fill('input', 'test').catch(() => {}),
        () => page.press('body', 'Escape').catch(() => {}),
        () => page.scroll('body', 0, 100).catch(() => {})
      ];

      // Execute interactions concurrently
      await Promise.all(interactions.map(interaction => interaction()));
      
      const interactionTime = Date.now() - startTime;
      
      // Page should remain responsive during concurrent interactions
      expect(interactionTime).toBeLessThan(1000);
      
      // Check if page is still interactive
      await expect(page.locator('body')).toBeVisible();
      
      // Try to interact with page after concurrent operations
      const clickableElement = page.locator('button, a').first();
      if (await clickableElement.isVisible()) {
        await expect(clickableElement).toBeEnabled();
      }
    });
  });
}

// Cross-device performance comparison
test.describe('Cross-Device Performance Comparison', () => {
  const performanceResults: any[] = [];

  for (const device of testDevices) {
    test(`collect performance data - ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext({ ...device });
      const page = await context.newPage();
      
      const startTime = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      const vitals = await measureWebVitals(page);
      const bundleAnalysis = await analyzeBundleSize(page);
      const memoryUsage = await measureMemoryUsage(page);
      
      performanceResults.push({
        device: device.name,
        loadTime,
        vitals,
        bundleSize: bundleAnalysis.total,
        memoryUsage: memoryUsage?.used || 0
      });
      
      await context.close();
    });
  }

  test('performance results should be within acceptable ranges across devices', async () => {
    expect(performanceResults).toHaveLength(testDevices.length);
    
    // Analyze performance across devices
    const loadTimes = performanceResults.map(r => r.loadTime);
    const maxLoadTime = Math.max(...loadTimes);
    const minLoadTime = Math.min(...loadTimes);
    
    console.log('Cross-device performance summary:', {
      devices: performanceResults.map(r => ({
        device: r.device,
        loadTime: r.loadTime,
        fcp: r.vitals.fcp,
        lcp: r.vitals.lcp,
        bundleSize: `${(r.bundleSize / 1024).toFixed(2)}KB`,
        memory: `${(r.memoryUsage / 1024 / 1024).toFixed(2)}MB`
      }))
    });
    
    // Performance variance shouldn't be too extreme across devices
    const loadTimeVariance = (maxLoadTime - minLoadTime) / minLoadTime;
    expect(loadTimeVariance).toBeLessThan(2); // Max 200% variance
    
    // All devices should meet minimum performance standards
    performanceResults.forEach(result => {
      if (result.vitals.lcp) {
        expect(result.vitals.lcp).toBeLessThan(performanceTargets.lcp * 1.5); // Allow 50% buffer for slower devices
      }
    });
  });
});
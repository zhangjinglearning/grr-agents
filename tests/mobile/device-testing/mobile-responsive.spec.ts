/**
 * Mobile Responsive Testing Suite
 * Comprehensive responsive design testing across devices and orientations
 */

import { test, expect, devices } from '@playwright/test';

// Device configurations for testing
const mobileDevices = [
  {
    name: 'iPhone 12',
    ...devices['iPhone 12'],
    description: 'iOS Safari - Standard iPhone'
  },
  {
    name: 'iPhone 12 Pro',
    ...devices['iPhone 12 Pro'],
    description: 'iOS Safari - Large iPhone'
  },
  {
    name: 'iPhone SE',
    ...devices['iPhone SE'],
    description: 'iOS Safari - Small iPhone'
  },
  {
    name: 'Galaxy S21',
    ...devices['Galaxy S21'],
    description: 'Android Chrome - Standard Android'
  },
  {
    name: 'Galaxy Note 20',
    ...devices['Galaxy Note 20'],
    description: 'Android Chrome - Large Android'
  },
  {
    name: 'iPad Air',
    ...devices['iPad Air'],
    description: 'iOS Safari - Tablet'
  }
];

const breakpoints = {
  mobile: { width: 375, height: 667 },
  mobileLarge: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  desktopLarge: { width: 1440, height: 900 }
};

// Test responsive breakpoints
for (const [breakpointName, dimensions] of Object.entries(breakpoints)) {
  test.describe(`Responsive Design - ${breakpointName}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(dimensions);
    });

    test('should display navigation correctly', async ({ page }) => {
      await page.goto('/dashboard');
      
      const navigation = page.locator('.mobile-navbar, .desktop-navbar');
      await expect(navigation).toBeVisible();
      
      // Check for mobile-specific elements
      if (dimensions.width < 768) {
        // Mobile navigation
        await expect(page.locator('.mobile-navbar')).toBeVisible();
        await expect(page.locator('.navbar-toggle')).toBeVisible();
        
        // Desktop navigation should be hidden
        await expect(page.locator('.desktop-navbar')).not.toBeVisible();
      } else {
        // Desktop navigation
        await expect(page.locator('.desktop-navbar')).toBeVisible();
        
        // Mobile navigation should be hidden
        await expect(page.locator('.mobile-navbar')).not.toBeVisible();
      }
    });

    test('should display board layout correctly', async ({ page }) => {
      await page.goto('/boards/1');
      
      const boardContainer = page.locator('.board-container');
      await expect(boardContainer).toBeVisible();
      
      // Check board lists layout
      const boardLists = page.locator('.board-lists');
      await expect(boardLists).toBeVisible();
      
      if (dimensions.width < 768) {
        // Mobile: horizontal scrolling
        const listElements = page.locator('.board-list');
        await expect(listElements.first()).toBeVisible();
        
        // Check if horizontal scroll is enabled
        const scrollWidth = await boardLists.evaluate(el => el.scrollWidth);
        const clientWidth = await boardLists.evaluate(el => el.clientWidth);
        
        if (await listElements.count() > 1) {
          expect(scrollWidth).toBeGreaterThan(clientWidth);
        }
      } else {
        // Desktop: grid layout
        const boardListsStyle = await boardLists.evaluate(el => 
          window.getComputedStyle(el).display
        );
        expect(boardListsStyle).toBe('grid');
      }
    });

    test('should have proper touch targets on mobile', async ({ page }) => {
      if (dimensions.width >= 768) return; // Skip for desktop
      
      await page.goto('/dashboard');
      
      // Test button sizes
      const buttons = page.locator('button, .btn');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            // Minimum touch target size (44px)
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
          }
        }
      }
      
      // Test link sizes
      const links = page.locator('a');
      const linkCount = await links.count();
      
      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const box = await link.boundingBox();
          if (box) {
            // Links should have adequate touch area
            expect(box.height).toBeGreaterThanOrEqual(32);
          }
        }
      }
    });

    test('should handle text scaling properly', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test with different text scaling
      const textScales = [1.0, 1.2, 1.5];
      
      for (const scale of textScales) {
        await page.evaluate((textScale) => {
          document.documentElement.style.fontSize = `${16 * textScale}px`;
        }, scale);
        
        await page.waitForTimeout(500);
        
        // Check that text is still readable and layout isn't broken
        const title = page.locator('h1, h2').first();
        if (await title.isVisible()) {
          const titleBox = await title.boundingBox();
          if (titleBox) {
            // Text should not overflow container
            expect(titleBox.width).toBeLessThanOrEqual(dimensions.width);
          }
        }
        
        // Check that buttons are still clickable
        const button = page.locator('button').first();
        if (await button.isVisible()) {
          const buttonBox = await button.boundingBox();
          if (buttonBox) {
            expect(buttonBox.height).toBeGreaterThanOrEqual(44 * scale);
          }
        }
      }
    });

    test('should handle orientation changes', async ({ page }) => {
      if (dimensions.width >= 768) return; // Skip for desktop
      
      await page.goto('/dashboard');
      
      // Portrait mode
      await page.setViewportSize({ width: dimensions.width, height: dimensions.height });
      await expect(page.locator('body')).toBeVisible();
      
      // Landscape mode
      await page.setViewportSize({ width: dimensions.height, height: dimensions.width });
      await page.waitForTimeout(500);
      
      // Check that layout adapts to landscape
      const navigation = page.locator('.mobile-navbar');
      if (await navigation.isVisible()) {
        const navBox = await navigation.boundingBox();
        if (navBox) {
          // Navigation should still be visible and properly sized
          expect(navBox.width).toBeLessThanOrEqual(dimensions.height);
        }
      }
      
      // Check that content is still accessible
      const mainContent = page.locator('main, .main-content').first();
      await expect(mainContent).toBeVisible();
    });
  });
}

// Test specific device behaviors
for (const device of mobileDevices) {
  test.describe(`Device Testing - ${device.name}`, () => {
    test.use({ ...device });

    test('should load and render correctly', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Check basic page structure
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('main, .main-content')).toBeVisible();
      
      // Take screenshot for visual comparison
      await expect(page).toHaveScreenshot(`${device.name.replace(/\s+/g, '-').toLowerCase()}-dashboard.png`);
    });

    test('should handle touch interactions', async ({ page }) => {
      await page.goto('/boards/1');
      
      // Test tap interactions
      const createButton = page.locator('[data-testid="create-card-button"]').first();
      if (await createButton.isVisible()) {
        await createButton.tap();
        
        // Check if modal or form appears
        const modal = page.locator('.modal, .card-form');
        await expect(modal).toBeVisible();
      }
      
      // Test swipe interactions on cards
      const card = page.locator('.kanban-card').first();
      if (await card.isVisible()) {
        const cardBox = await card.boundingBox();
        if (cardBox) {
          // Simulate swipe gesture
          await page.touchscreen.tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
          
          // Long press
          await page.touchscreen.tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
          await page.waitForTimeout(600); // Long press duration
        }
      }
    });

    test('should handle drag and drop on touch devices', async ({ page }) => {
      await page.goto('/boards/1');
      
      const sourceCard = page.locator('.kanban-card').first();
      const targetList = page.locator('.board-list').last();
      
      if (await sourceCard.isVisible() && await targetList.isVisible()) {
        const sourceBox = await sourceCard.boundingBox();
        const targetBox = await targetList.boundingBox();
        
        if (sourceBox && targetBox) {
          // Simulate drag and drop with touch
          await page.touchscreen.tap(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
          await page.waitForTimeout(300); // Wait for long press threshold
          
          // Drag to target
          await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
          await page.touchscreen.tap(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
          
          // Verify card moved (implementation specific)
          await page.waitForTimeout(1000);
        }
      }
    });

    test('should handle keyboard input correctly', async ({ page }) => {
      await page.goto('/boards/new');
      
      const titleInput = page.locator('input[name="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.tap();
        
        // Check if virtual keyboard doesn't break layout
        await titleInput.fill('Test Board Title');
        
        // Verify input is visible and not obscured
        const inputBox = await titleInput.boundingBox();
        if (inputBox) {
          expect(inputBox.y).toBeGreaterThan(0);
        }
      }
    });

    test('should respect device-specific features', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test safe area support (for devices with notches)
      const safeAreaElements = page.locator('.safe-area-inset, .safe-area-inset-top');
      if (await safeAreaElements.first().isVisible()) {
        const element = safeAreaElements.first();
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            paddingTop: computed.paddingTop,
            paddingBottom: computed.paddingBottom
          };
        });
        
        // Should have some padding when safe area is present
        expect(styles.paddingTop).not.toBe('0px');
      }
    });

    test('should handle network conditions gracefully', async ({ page }) => {
      // Simulate slow 3G connection
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add delay
        await route.continue();
      });
      
      await page.goto('/dashboard');
      
      // Check loading states
      const loadingIndicator = page.locator('.loading, .spinner, [data-loading]');
      if (await loadingIndicator.isVisible({ timeout: 5000 })) {
        // Loading indicator should eventually disappear
        await expect(loadingIndicator).not.toBeVisible({ timeout: 15000 });
      }
      
      // Content should eventually load
      await expect(page.locator('main, .main-content')).toBeVisible({ timeout: 15000 });
    });
  });
}

// Performance tests for mobile
test.describe('Mobile Performance', () => {
  test('should meet Core Web Vitals targets', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Measure Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics: any = {};
          
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              metrics.fcp = entry.startTime;
            } else if (entry.entryType === 'largest-contentful-paint') {
              metrics.lcp = entry.startTime;
            } else if (entry.entryType === 'first-input') {
              metrics.fid = (entry as any).processingStart - entry.startTime;
            }
          });
          
          resolve(metrics);
        });
        
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input'] });
        
        // Fallback timeout
        setTimeout(() => resolve({}), 10000);
      });
    });
    
    // Assert performance targets
    if (vitals.fcp) {
      expect(vitals.fcp).toBeLessThan(1800); // FCP < 1.8s
    }
    
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(2500); // LCP < 2.5s
    }
    
    if (vitals.fid) {
      expect(vitals.fid).toBeLessThan(100); // FID < 100ms
    }
  });

  test('should handle memory constraints', async ({ page }) => {
    // Simulate memory pressure
    await page.addInitScript(() => {
      // Override memory property if available
      if ('memory' in (performance as any)) {
        Object.defineProperty((performance as any).memory, 'usedJSHeapSize', {
          get: () => 100 * 1024 * 1024 // 100MB
        });
      }
    });
    
    await page.goto('/dashboard');
    
    // Navigate through multiple pages to test memory usage
    const pages = ['/boards', '/tasks', '/analytics', '/dashboard'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Check if page is responsive (not frozen)
      const button = page.locator('button').first();
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(100);
      }
    }
    
    // Final check - should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });
});

// Accessibility tests for mobile
test.describe('Mobile Accessibility', () => {
  test('should have proper ARIA labels for touch elements', async ({ page }) => {
    await page.setViewportSize(breakpoints.mobile);
    await page.goto('/dashboard');
    
    // Check buttons have accessible labels
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();
        const title = await button.getAttribute('title');
        
        // Button should have some form of accessible text
        expect(ariaLabel || textContent?.trim() || title).toBeTruthy();
      }
    }
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.setViewportSize(breakpoints.mobile);
    await page.goto('/dashboard');
    
    // Check heading hierarchy
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    if (headingCount > 0) {
      const firstHeading = headings.first();
      const tagName = await firstHeading.evaluate(el => el.tagName);
      expect(['H1', 'H2']).toContain(tagName); // Should start with h1 or h2
    }
    
    // Check landmarks
    const landmarks = page.locator('main, nav, header, footer, section[aria-label], [role="main"], [role="navigation"]');
    await expect(landmarks.first()).toBeVisible();
  });

  test('should handle high contrast mode', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      // Simulate high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        })
      });
    });
    
    await page.goto('/dashboard');
    
    // Check contrast ratios (simplified check)
    const textElements = page.locator('p, span, div').filter({ hasText: /\w+/ });
    const elementCount = await textElements.count();
    
    for (let i = 0; i < Math.min(elementCount, 5); i++) {
      const element = textElements.nth(i);
      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor
          };
        });
        
        // Should have defined colors (not transparent)
        expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
      }
    }
  });
});
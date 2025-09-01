/**
 * Accessibility utilities for theme compliance validation
 * Ensures all themes meet WCAG 2.1 AA standards
 */

export interface ContrastCheckResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'FAIL';
  isAccessible: boolean;
}

export interface AccessibilityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  contrast: {
    textOnPrimary: ContrastCheckResult;
    textOnSecondary: ContrastCheckResult;
    textOnBackground: ContrastCheckResult;
  };
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate relative luminance of a color
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if contrast ratio meets WCAG standards
 */
export function checkContrast(color1: string, color2: string, isLargeText = false): ContrastCheckResult {
  const ratio = getContrastRatio(color1, color2);
  const minRatio = isLargeText ? 3.0 : 4.5;
  const aaaRatio = isLargeText ? 4.5 : 7.0;
  
  let level: 'AAA' | 'AA' | 'FAIL';
  if (ratio >= aaaRatio) {
    level = 'AAA';
  } else if (ratio >= minRatio) {
    level = 'AA';
  } else {
    level = 'FAIL';
  }
  
  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    isAccessible: ratio >= minRatio,
  };
}

/**
 * Validate theme accessibility compliance
 */
export function validateThemeAccessibility(theme: {
  colorPalette: {
    primary: string[];
    secondary: string[];
    accent: string[];
    neutral: string[];
  };
  backgrounds: {
    main: string;
    card: string;
    list: string;
  };
}): AccessibilityValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Extract primary colors for contrast checking
  const primaryColor = theme.colorPalette.primary[0];
  const secondaryColor = theme.colorPalette.secondary[0];
  const textColor = theme.colorPalette.neutral[0]; // Darkest neutral for text
  const backgroundColor = '#FFFFFF'; // Card background is typically white
  
  // Check contrast ratios
  const textOnPrimary = checkContrast(backgroundColor, primaryColor);
  const textOnSecondary = checkContrast(backgroundColor, secondaryColor);
  const textOnBackground = checkContrast(textColor, backgroundColor);
  
  // Validate contrast requirements
  if (!textOnPrimary.isAccessible) {
    errors.push(`Primary color contrast ratio (${textOnPrimary.ratio}:1) fails WCAG AA standard (4.5:1 minimum)`);
  } else if (textOnPrimary.level === 'AA') {
    warnings.push(`Primary color contrast ratio (${textOnPrimary.ratio}:1) meets AA but not AAA standard`);
  }
  
  if (!textOnSecondary.isAccessible) {
    errors.push(`Secondary color contrast ratio (${textOnSecondary.ratio}:1) fails WCAG AA standard (4.5:1 minimum)`);
  } else if (textOnSecondary.level === 'AA') {
    warnings.push(`Secondary color contrast ratio (${textOnSecondary.ratio}:1) meets AA but not AAA standard`);
  }
  
  if (!textOnBackground.isAccessible) {
    errors.push(`Text on background contrast ratio (${textOnBackground.ratio}:1) fails WCAG AA standard (4.5:1 minimum)`);
  }
  
  // Check color differentiation for color-blind users
  if (getContrastRatio(primaryColor, secondaryColor) < 3.0) {
    warnings.push('Primary and secondary colors may be difficult to distinguish for color-blind users');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    contrast: {
      textOnPrimary,
      textOnSecondary,
      textOnBackground,
    },
  };
}

/**
 * Apply accessibility enhancements to theme
 */
export function applyAccessibilityEnhancements(): void {
  // Respect user's motion preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    document.documentElement.style.setProperty('--transition-fast', '0.01ms');
    document.documentElement.style.setProperty('--transition-normal', '0.01ms');
    document.documentElement.style.setProperty('--transition-slow', '0.01ms');
  }
  
  // Respect user's contrast preferences
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  if (prefersHighContrast) {
    document.documentElement.classList.add('high-contrast');
  }
  
  // Apply focus management
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.documentElement.classList.add('keyboard-navigation');
    }
  });
  
  document.addEventListener('mousedown', () => {
    document.documentElement.classList.remove('keyboard-navigation');
  });
}

/**
 * Announce theme change to screen readers
 */
export function announceThemeChange(themeName: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = `Theme changed to ${themeName}`;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Validate if element is keyboard accessible
 */
export function validateKeyboardAccessibility(element: HTMLElement): boolean {
  const tabIndex = element.tabIndex;
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  
  // Check if element is focusable
  const focusableElements = ['input', 'button', 'select', 'textarea', 'a'];
  const focusableRoles = ['button', 'link', 'menuitem', 'tab'];
  
  return (
    tabIndex >= 0 ||
    focusableElements.includes(tagName) ||
    (role && focusableRoles.includes(role))
  );
}

/**
 * Generate accessibility report for theme
 */
export function generateAccessibilityReport(theme: any): string {
  const validation = validateThemeAccessibility(theme);
  
  let report = `Accessibility Report for ${theme.displayName}\n`;
  report += `=================================================\n\n`;
  
  report += `Overall Status: ${validation.isValid ? '✅ PASS' : '❌ FAIL'}\n\n`;
  
  report += `Contrast Ratios:\n`;
  report += `- Text on Primary: ${validation.contrast.textOnPrimary.ratio}:1 (${validation.contrast.textOnPrimary.level})\n`;
  report += `- Text on Secondary: ${validation.contrast.textOnSecondary.ratio}:1 (${validation.contrast.textOnSecondary.level})\n`;
  report += `- Text on Background: ${validation.contrast.textOnBackground.ratio}:1 (${validation.contrast.textOnBackground.level})\n\n`;
  
  if (validation.errors.length > 0) {
    report += `Errors:\n`;
    validation.errors.forEach(error => {
      report += `- ❌ ${error}\n`;
    });
    report += `\n`;
  }
  
  if (validation.warnings.length > 0) {
    report += `Warnings:\n`;
    validation.warnings.forEach(warning => {
      report += `- ⚠️ ${warning}\n`;
    });
    report += `\n`;
  }
  
  report += `WCAG 2.1 AA Compliance: ${validation.isValid ? 'COMPLIANT' : 'NON-COMPLIANT'}\n`;
  
  return report;
}
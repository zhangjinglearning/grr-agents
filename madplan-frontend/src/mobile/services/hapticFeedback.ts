/**
 * Haptic Feedback Service
 * Provides tactile feedback for mobile interactions
 */

export interface HapticOptions {
  intensity?: 'light' | 'medium' | 'heavy';
  pattern?: number | number[];
  fallback?: boolean;
}

export interface HapticPattern {
  vibrate: number | number[];
  description: string;
}

export type HapticEventType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'selection' 
  | 'impact' 
  | 'notification'
  | 'drag'
  | 'swipe'
  | 'longpress'
  | 'tap'
  | 'button'
  | 'toggle';

class HapticFeedbackService {
  private isEnabled: boolean = true;
  private isSupported: boolean = false;
  private userPreferences: Map<HapticEventType, boolean> = new Map();
  
  // Predefined haptic patterns
  private patterns: Record<HapticEventType, HapticPattern> = {
    success: {
      vibrate: [30, 50, 30],
      description: 'Success confirmation feedback'
    },
    error: {
      vibrate: [100, 50, 100, 50, 100],
      description: 'Error or failure feedback'
    },
    warning: {
      vibrate: [50, 30, 50],
      description: 'Warning or attention feedback'
    },
    selection: {
      vibrate: 20,
      description: 'Item selection feedback'
    },
    impact: {
      vibrate: 40,
      description: 'Physical interaction feedback'
    },
    notification: {
      vibrate: [80, 50, 80],
      description: 'Incoming notification feedback'
    },
    drag: {
      vibrate: 15,
      description: 'Drag operation start feedback'
    },
    swipe: {
      vibrate: 25,
      description: 'Swipe gesture feedback'
    },
    longpress: {
      vibrate: 60,
      description: 'Long press activation feedback'
    },
    tap: {
      vibrate: 10,
      description: 'Light tap feedback'
    },
    button: {
      vibrate: 30,
      description: 'Button press feedback'
    },
    toggle: {
      vibrate: [20, 10, 20],
      description: 'Toggle switch feedback'
    }
  };

  // Intensity multipliers
  private intensityMultipliers = {
    light: 0.5,
    medium: 1.0,
    heavy: 1.5
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize haptic feedback service
   */
  private initialize(): void {
    // Check for vibration API support
    this.isSupported = 'vibrate' in navigator && typeof navigator.vibrate === 'function';
    
    // Load user preferences from localStorage
    this.loadUserPreferences();
    
    // Check for system-level haptic preferences
    this.checkSystemPreferences();
    
    // Listen for settings changes
    this.setupEventListeners();
  }

  /**
   * Check if haptic feedback is available and enabled
   */
  isAvailable(): boolean {
    return this.isSupported && this.isEnabled;
  }

  /**
   * Trigger haptic feedback for a specific event type
   */
  trigger(
    eventType: HapticEventType, 
    options: HapticOptions = {}
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isAvailable()) {
        resolve(false);
        return;
      }

      // Check if this specific feedback type is enabled
      if (!this.isEventTypeEnabled(eventType)) {
        resolve(false);
        return;
      }

      try {
        const pattern = this.getPattern(eventType, options);
        const success = navigator.vibrate(pattern);
        
        // Log haptic feedback for debugging
        this.logFeedback(eventType, pattern, success);
        
        resolve(success);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Trigger custom haptic pattern
   */
  triggerCustom(
    pattern: number | number[], 
    options: HapticOptions = {}
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isAvailable()) {
        resolve(false);
        return;
      }

      try {
        const adjustedPattern = this.adjustPattern(pattern, options);
        const success = navigator.vibrate(adjustedPattern);
        resolve(success);
      } catch (error) {
        console.warn('Custom haptic feedback failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Stop all haptic feedback
   */
  stop(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isSupported) {
        resolve(false);
        return;
      }

      try {
        const success = navigator.vibrate(0);
        resolve(success);
      } catch (error) {
        console.warn('Failed to stop haptic feedback:', error);
        resolve(false);
      }
    });
  }

  /**
   * Enable haptic feedback
   */
  enable(): void {
    this.isEnabled = true;
    this.saveUserPreferences();
    this.dispatchSettingsChange();
  }

  /**
   * Disable haptic feedback
   */
  disable(): void {
    this.isEnabled = false;
    this.stop();
    this.saveUserPreferences();
    this.dispatchSettingsChange();
  }

  /**
   * Enable/disable specific haptic event types
   */
  setEventTypeEnabled(eventType: HapticEventType, enabled: boolean): void {
    this.userPreferences.set(eventType, enabled);
    this.saveUserPreferences();
    this.dispatchSettingsChange();
  }

  /**
   * Check if a specific event type is enabled
   */
  isEventTypeEnabled(eventType: HapticEventType): boolean {
    return this.userPreferences.get(eventType) !== false;
  }

  /**
   * Get all available haptic event types
   */
  getEventTypes(): HapticEventType[] {
    return Object.keys(this.patterns) as HapticEventType[];
  }

  /**
   * Get pattern description for an event type
   */
  getPatternDescription(eventType: HapticEventType): string {
    return this.patterns[eventType]?.description || 'Unknown pattern';
  }

  /**
   * Get current settings
   */
  getSettings(): {
    isSupported: boolean;
    isEnabled: boolean;
    eventTypes: Record<HapticEventType, boolean>;
  } {
    const eventTypes: Record<HapticEventType, boolean> = {} as any;
    
    for (const eventType of this.getEventTypes()) {
      eventTypes[eventType] = this.isEventTypeEnabled(eventType);
    }

    return {
      isSupported: this.isSupported,
      isEnabled: this.isEnabled,
      eventTypes
    };
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    this.isEnabled = true;
    this.userPreferences.clear();
    this.saveUserPreferences();
    this.dispatchSettingsChange();
  }

  /**
   * Test haptic feedback with a sample pattern
   */
  async test(eventType: HapticEventType = 'selection'): Promise<boolean> {
    if (!this.isSupported) {
      throw new Error('Haptic feedback is not supported on this device');
    }

    const success = await this.trigger(eventType);
    
    if (!success) {
      throw new Error('Failed to trigger haptic feedback - check device settings');
    }

    return success;
  }

  /**
   * Get pattern for event type with options applied
   */
  private getPattern(eventType: HapticEventType, options: HapticOptions): number | number[] {
    const basePattern = this.patterns[eventType]?.vibrate || 30;
    
    if (options.pattern) {
      return this.adjustPattern(options.pattern, options);
    }
    
    return this.adjustPattern(basePattern, options);
  }

  /**
   * Adjust pattern based on options
   */
  private adjustPattern(
    pattern: number | number[], 
    options: HapticOptions
  ): number | number[] {
    const intensity = options.intensity || 'medium';
    const multiplier = this.intensityMultipliers[intensity];

    if (typeof pattern === 'number') {
      return Math.round(pattern * multiplier);
    }

    return pattern.map(value => Math.round(value * multiplier));
  }

  /**
   * Load user preferences from storage
   */
  private loadUserPreferences(): void {
    try {
      const stored = localStorage.getItem('haptic-preferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        this.isEnabled = preferences.enabled !== false;
        
        if (preferences.eventTypes) {
          this.userPreferences.clear();
          Object.entries(preferences.eventTypes).forEach(([key, value]) => {
            this.userPreferences.set(key as HapticEventType, value as boolean);
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load haptic preferences:', error);
    }
  }

  /**
   * Save user preferences to storage
   */
  private saveUserPreferences(): void {
    try {
      const eventTypes: Record<string, boolean> = {};
      this.userPreferences.forEach((value, key) => {
        eventTypes[key] = value;
      });

      const preferences = {
        enabled: this.isEnabled,
        eventTypes
      };

      localStorage.setItem('haptic-preferences', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save haptic preferences:', error);
    }
  }

  /**
   * Check system-level preferences
   */
  private checkSystemPreferences(): void {
    // Check for reduced motion preference (affects haptics)
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // User prefers reduced motion, disable haptics by default
      if (!localStorage.getItem('haptic-preferences')) {
        this.isEnabled = false;
      }
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for reduced motion changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addEventListener('change', (e) => {
        if (e.matches && !localStorage.getItem('haptic-preferences')) {
          this.disable();
        }
      });
    }

    // Listen for visibility changes to stop haptics when app is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      }
    });

    // Listen for page unload to stop haptics
    window.addEventListener('beforeunload', () => {
      this.stop();
    });
  }

  /**
   * Log haptic feedback for debugging
   */
  private logFeedback(
    eventType: HapticEventType, 
    pattern: number | number[], 
    success: boolean
  ): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Haptic feedback:', {
        eventType,
        pattern,
        success,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Dispatch settings change event
   */
  private dispatchSettingsChange(): void {
    const event = new CustomEvent('haptic-settings-changed', {
      detail: this.getSettings()
    });
    window.dispatchEvent(event);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.userPreferences.clear();
  }
}

// Export singleton instance
export const hapticFeedbackService = new HapticFeedbackService();

// Vue composable for easy integration
export function useHapticFeedback() {
  const trigger = (eventType: HapticEventType, options?: HapticOptions) => {
    return hapticFeedbackService.trigger(eventType, options);
  };

  const triggerCustom = (pattern: number | number[], options?: HapticOptions) => {
    return hapticFeedbackService.triggerCustom(pattern, options);
  };

  const stop = () => {
    return hapticFeedbackService.stop();
  };

  const enable = () => {
    hapticFeedbackService.enable();
  };

  const disable = () => {
    hapticFeedbackService.disable();
  };

  const isAvailable = () => {
    return hapticFeedbackService.isAvailable();
  };

  const test = (eventType?: HapticEventType) => {
    return hapticFeedbackService.test(eventType);
  };

  const getSettings = () => {
    return hapticFeedbackService.getSettings();
  };

  return {
    trigger,
    triggerCustom,
    stop,
    enable,
    disable,
    isAvailable,
    test,
    getSettings,
    service: hapticFeedbackService
  };
}
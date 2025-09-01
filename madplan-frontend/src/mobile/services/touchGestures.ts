/**
 * Touch Gesture Service
 * Comprehensive touch and gesture handling for mobile interactions
 */

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface GestureOptions {
  threshold: number;
  maxDuration: number;
  minVelocity: number;
  preventDefault?: boolean;
}

export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  duration: number;
  startPoint: TouchPoint;
  endPoint: TouchPoint;
}

export interface PinchEvent {
  scale: number;
  center: TouchPoint;
  distance: number;
}

export interface LongPressEvent {
  point: TouchPoint;
  duration: number;
}

export interface DragEvent {
  startPoint: TouchPoint;
  currentPoint: TouchPoint;
  deltaX: number;
  deltaY: number;
  distance: number;
  velocity: number;
}

export type GestureEventType = 'swipe' | 'pinch' | 'longpress' | 'drag' | 'tap' | 'doubletap';

export interface GestureCallback<T = any> {
  (event: T, element: HTMLElement): void;
}

class TouchGestureService {
  private gestureHandlers = new Map<HTMLElement, Map<GestureEventType, GestureCallback>>();
  private touchStartData = new Map<number, TouchPoint>();
  private longPressTimers = new Map<HTMLElement, number>();
  private lastTapTime = 0;
  private lastTapElement: HTMLElement | null = null;

  // Default gesture options
  private defaultOptions: Record<GestureEventType, GestureOptions> = {
    swipe: {
      threshold: 50,
      maxDuration: 1000,
      minVelocity: 0.3,
      preventDefault: true
    },
    pinch: {
      threshold: 10,
      maxDuration: 2000,
      minVelocity: 0,
      preventDefault: true
    },
    longpress: {
      threshold: 500,
      maxDuration: 0,
      minVelocity: 0,
      preventDefault: false
    },
    drag: {
      threshold: 10,
      maxDuration: 0,
      minVelocity: 0,
      preventDefault: true
    },
    tap: {
      threshold: 10,
      maxDuration: 300,
      minVelocity: 0,
      preventDefault: false
    },
    doubletap: {
      threshold: 30,
      maxDuration: 300,
      minVelocity: 0,
      preventDefault: false
    }
  };

  /**
   * Register a gesture handler on an element
   */
  on<T>(
    element: HTMLElement,
    gestureType: GestureEventType,
    callback: GestureCallback<T>,
    options?: Partial<GestureOptions>
  ): void {
    if (!this.gestureHandlers.has(element)) {
      this.gestureHandlers.set(element, new Map());
      this.attachEventListeners(element);
    }

    const handlers = this.gestureHandlers.get(element)!;
    handlers.set(gestureType, callback);

    // Merge options
    const mergedOptions = {
      ...this.defaultOptions[gestureType],
      ...options
    };
    
    // Store options on element
    element.dataset[`gesture${gestureType}Options`] = JSON.stringify(mergedOptions);
  }

  /**
   * Remove a gesture handler from an element
   */
  off(element: HTMLElement, gestureType?: GestureEventType): void {
    const handlers = this.gestureHandlers.get(element);
    if (!handlers) return;

    if (gestureType) {
      handlers.delete(gestureType);
      delete element.dataset[`gesture${gestureType}Options`];
    } else {
      // Remove all handlers
      handlers.clear();
      this.removeEventListeners(element);
      this.gestureHandlers.delete(element);
      
      // Clear any active timers
      const timer = this.longPressTimers.get(element);
      if (timer) {
        clearTimeout(timer);
        this.longPressTimers.delete(element);
      }
    }
  }

  /**
   * Get gesture options for an element
   */
  private getOptions(element: HTMLElement, gestureType: GestureEventType): GestureOptions {
    const optionsData = element.dataset[`gesture${gestureType}Options`];
    if (optionsData) {
      try {
        return JSON.parse(optionsData);
      } catch {
        // Fall back to default options
      }
    }
    return this.defaultOptions[gestureType];
  }

  /**
   * Attach event listeners to an element
   */
  private attachEventListeners(element: HTMLElement): void {
    element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
  }

  /**
   * Remove event listeners from an element
   */
  private removeEventListeners(element: HTMLElement): void {
    element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
  }

  /**
   * Handle touch start event
   */
  private handleTouchStart(event: TouchEvent): void {
    const element = event.currentTarget as HTMLElement;
    const handlers = this.gestureHandlers.get(element);
    if (!handlers) return;

    const touches = Array.from(event.touches);
    const timestamp = Date.now();

    // Store touch start data
    touches.forEach((touch, index) => {
      this.touchStartData.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        timestamp
      });
    });

    // Handle long press
    if (handlers.has('longpress')) {
      const options = this.getOptions(element, 'longpress');
      const timer = window.setTimeout(() => {
        const touch = touches[0];
        const longPressEvent: LongPressEvent = {
          point: { x: touch.clientX, y: touch.clientY, timestamp },
          duration: Date.now() - timestamp
        };
        
        this.triggerHapticFeedback('medium');
        handlers.get('longpress')!(longPressEvent, element);
      }, options.threshold);
      
      this.longPressTimers.set(element, timer);
    }

    // Prevent default if needed
    const shouldPreventDefault = Array.from(handlers.keys()).some(gestureType => {
      const options = this.getOptions(element, gestureType);
      return options.preventDefault;
    });

    if (shouldPreventDefault) {
      event.preventDefault();
    }
  }

  /**
   * Handle touch move event
   */
  private handleTouchMove(event: TouchEvent): void {
    const element = event.currentTarget as HTMLElement;
    const handlers = this.gestureHandlers.get(element);
    if (!handlers) return;

    const touches = Array.from(event.touches);
    const timestamp = Date.now();

    // Cancel long press if touch moves too much
    const firstTouch = touches[0];
    const startData = this.touchStartData.get(firstTouch.identifier);
    
    if (startData) {
      const distance = this.calculateDistance(startData, {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
        timestamp
      });
      
      if (distance > this.getOptions(element, 'longpress').threshold) {
        this.clearLongPressTimer(element);
      }
    }

    // Handle drag gesture
    if (handlers.has('drag') && touches.length === 1 && startData) {
      const currentPoint = {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
        timestamp
      };

      const deltaX = currentPoint.x - startData.x;
      const deltaY = currentPoint.y - startData.y;
      const distance = this.calculateDistance(startData, currentPoint);
      const duration = timestamp - startData.timestamp;
      const velocity = duration > 0 ? distance / duration : 0;

      const dragEvent: DragEvent = {
        startPoint: startData,
        currentPoint,
        deltaX,
        deltaY,
        distance,
        velocity
      };

      handlers.get('drag')!(dragEvent, element);
    }

    // Handle pinch gesture
    if (handlers.has('pinch') && touches.length === 2) {
      const [touch1, touch2] = touches;
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
        timestamp
      };

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // Calculate scale based on initial distance
      const initialDistance = this.getInitialPinchDistance(touches);
      const scale = initialDistance > 0 ? distance / initialDistance : 1;

      const pinchEvent: PinchEvent = {
        scale,
        center,
        distance
      };

      handlers.get('pinch')!(pinchEvent, element);
    }

    // Prevent default if needed
    if (this.shouldPreventDefault(element, ['drag', 'pinch'])) {
      event.preventDefault();
    }
  }

  /**
   * Handle touch end event
   */
  private handleTouchEnd(event: TouchEvent): void {
    const element = event.currentTarget as HTMLElement;
    const handlers = this.gestureHandlers.get(element);
    if (!handlers) return;

    const changedTouches = Array.from(event.changedTouches);
    const timestamp = Date.now();

    // Clear long press timer
    this.clearLongPressTimer(element);

    // Handle swipe and tap gestures
    changedTouches.forEach(touch => {
      const startData = this.touchStartData.get(touch.identifier);
      if (!startData) return;

      const endPoint = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp
      };

      const distance = this.calculateDistance(startData, endPoint);
      const duration = timestamp - startData.timestamp;
      const velocity = duration > 0 ? distance / duration : 0;

      // Handle swipe
      if (handlers.has('swipe')) {
        const options = this.getOptions(element, 'swipe');
        
        if (distance >= options.threshold && 
            duration <= options.maxDuration && 
            velocity >= options.minVelocity) {
          
          const direction = this.getSwipeDirection(startData, endPoint);
          const swipeEvent: SwipeEvent = {
            direction,
            distance,
            velocity,
            duration,
            startPoint: startData,
            endPoint
          };

          this.triggerHapticFeedback('light');
          handlers.get('swipe')!(swipeEvent, element);
        }
      }

      // Handle tap and double tap
      const tapOptions = this.getOptions(element, 'tap');
      if (distance <= tapOptions.threshold && duration <= tapOptions.maxDuration) {
        
        // Check for double tap
        if (handlers.has('doubletap')) {
          const doubleTapOptions = this.getOptions(element, 'doubletap');
          const timeSinceLastTap = timestamp - this.lastTapTime;
          
          if (this.lastTapElement === element && 
              timeSinceLastTap <= doubleTapOptions.maxDuration) {
            
            // Double tap detected
            handlers.get('doubletap')!(endPoint, element);
            this.triggerHapticFeedback('medium');
            
            // Reset tap tracking
            this.lastTapTime = 0;
            this.lastTapElement = null;
          } else {
            // First tap or timeout
            this.lastTapTime = timestamp;
            this.lastTapElement = element;
            
            // Delayed single tap (in case double tap follows)
            setTimeout(() => {
              if (this.lastTapTime === timestamp && handlers.has('tap')) {
                handlers.get('tap')!(endPoint, element);
                this.triggerHapticFeedback('light');
              }
            }, doubleTapOptions.maxDuration);
          }
        } else if (handlers.has('tap')) {
          // Single tap only
          handlers.get('tap')!(endPoint, element);
          this.triggerHapticFeedback('light');
        }
      }

      // Clean up touch data
      this.touchStartData.delete(touch.identifier);
    });
  }

  /**
   * Handle touch cancel event
   */
  private handleTouchCancel(event: TouchEvent): void {
    const element = event.currentTarget as HTMLElement;
    const changedTouches = Array.from(event.changedTouches);

    // Clear long press timer
    this.clearLongPressTimer(element);

    // Clean up touch data
    changedTouches.forEach(touch => {
      this.touchStartData.delete(touch.identifier);
    });
  }

  /**
   * Calculate distance between two touch points
   */
  private calculateDistance(point1: TouchPoint, point2: TouchPoint): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Determine swipe direction
   */
  private getSwipeDirection(start: TouchPoint, end: TouchPoint): SwipeEvent['direction'] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }

  /**
   * Get initial distance for pinch gesture
   */
  private getInitialPinchDistance(touches: Touch[]): number {
    if (touches.length < 2) return 0;
    
    const [touch1, touch2] = touches;
    const start1 = this.touchStartData.get(touch1.identifier);
    const start2 = this.touchStartData.get(touch2.identifier);
    
    if (!start1 || !start2) return 0;
    
    return Math.sqrt(
      Math.pow(start2.x - start1.x, 2) +
      Math.pow(start2.y - start1.y, 2)
    );
  }

  /**
   * Check if default should be prevented
   */
  private shouldPreventDefault(element: HTMLElement, gestureTypes: GestureEventType[]): boolean {
    const handlers = this.gestureHandlers.get(element);
    if (!handlers) return false;

    return gestureTypes.some(gestureType => {
      if (handlers.has(gestureType)) {
        const options = this.getOptions(element, gestureType);
        return options.preventDefault;
      }
      return false;
    });
  }

  /**
   * Clear long press timer for an element
   */
  private clearLongPressTimer(element: HTMLElement): void {
    const timer = this.longPressTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      this.longPressTimers.delete(element);
    }
  }

  /**
   * Trigger haptic feedback if available
   */
  private triggerHapticFeedback(intensity: 'light' | 'medium' | 'heavy' = 'light'): void {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 30,
        medium: 50,
        heavy: 100
      };
      navigator.vibrate(patterns[intensity]);
    }
  }

  /**
   * Clean up all gesture handlers
   */
  destroy(): void {
    this.gestureHandlers.forEach((handlers, element) => {
      this.removeEventListeners(element);
      this.clearLongPressTimer(element);
    });
    
    this.gestureHandlers.clear();
    this.touchStartData.clear();
    this.longPressTimers.clear();
  }

  /**
   * Get gesture statistics for debugging
   */
  getStats(): {
    activeElements: number;
    activeGestures: number;
    activeTouches: number;
    activeLongPress: number;
  } {
    const activeGestures = Array.from(this.gestureHandlers.values())
      .reduce((sum, handlers) => sum + handlers.size, 0);

    return {
      activeElements: this.gestureHandlers.size,
      activeGestures,
      activeTouches: this.touchStartData.size,
      activeLongPress: this.longPressTimers.size
    };
  }
}

// Export singleton instance
export const touchGestureService = new TouchGestureService();

// Vue composable for easy integration
export function useTouchGestures() {
  const registerGesture = <T>(
    element: HTMLElement,
    gestureType: GestureEventType,
    callback: GestureCallback<T>,
    options?: Partial<GestureOptions>
  ) => {
    touchGestureService.on(element, gestureType, callback, options);
  };

  const unregisterGesture = (element: HTMLElement, gestureType?: GestureEventType) => {
    touchGestureService.off(element, gestureType);
  };

  return {
    registerGesture,
    unregisterGesture,
    gestureService: touchGestureService
  };
}
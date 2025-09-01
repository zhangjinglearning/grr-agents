/**
 * Toast Notification Store
 * Implements Story 4.2 user feedback requirements
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ToastAction } from '@/components/feedback/ToastNotification.vue';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title?: string;
  message: string;
  duration?: number; // 0 for persistent
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  closable?: boolean;
  showProgress?: boolean;
  actions?: ToastAction[];
  persistent?: boolean;
  createdAt: number;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  const maxToasts = ref(5); // Maximum number of toasts to show at once
  
  // Default configurations for different toast types
  const defaultConfigs = {
    success: { duration: 4000, type: 'success' as const },
    error: { duration: 8000, type: 'error' as const, persistent: false },
    warning: { duration: 6000, type: 'warning' as const },
    info: { duration: 5000, type: 'info' as const },
    loading: { duration: 0, type: 'loading' as const, persistent: true, closable: false },
  };

  // Generate unique ID for toasts
  const generateId = (): string => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add a new toast
  const addToast = (toast: Omit<Toast, 'id' | 'createdAt'>): string => {
    const id = generateId();
    
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
    };

    // Remove oldest toast if we're at the limit
    if (toasts.value.length >= maxToasts.value) {
      const oldestNonPersistent = toasts.value
        .filter(t => !t.persistent)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      
      if (oldestNonPersistent) {
        removeToast(oldestNonPersistent.id);
      }
    }

    toasts.value.push(newToast);
    
    // Auto-remove non-persistent toasts
    if (newToast.duration && newToast.duration > 0 && !newToast.persistent) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  };

  // Remove a toast by ID
  const removeToast = (id: string): void => {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  // Clear all toasts
  const clearAll = (): void => {
    toasts.value = [];
  };

  // Clear toasts by type
  const clearByType = (type: Toast['type']): void => {
    toasts.value = toasts.value.filter(toast => toast.type !== type);
  };

  // Update an existing toast
  const updateToast = (id: string, updates: Partial<Toast>): void => {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index > -1) {
      toasts.value[index] = { ...toasts.value[index], ...updates };
    }
  };

  // Convenience methods for different toast types
  const success = (message: string, options?: Partial<Toast>): string => {
    return addToast({
      ...defaultConfigs.success,
      ...options,
      message,
    });
  };

  const error = (message: string, options?: Partial<Toast>): string => {
    return addToast({
      ...defaultConfigs.error,
      ...options,
      message,
    });
  };

  const warning = (message: string, options?: Partial<Toast>): string => {
    return addToast({
      ...defaultConfigs.warning,
      ...options,
      message,
    });
  };

  const info = (message: string, options?: Partial<Toast>): string => {
    return addToast({
      ...defaultConfigs.info,
      ...options,
      message,
    });
  };

  const loading = (message: string, options?: Partial<Toast>): string => {
    return addToast({
      ...defaultConfigs.loading,
      ...options,
      message,
    });
  };

  // Advanced toast methods
  const confirmAction = (
    message: string,
    onConfirm: () => void,
    options?: Partial<Toast>
  ): string => {
    return addToast({
      type: 'warning',
      message,
      persistent: true,
      duration: 0,
      actions: [
        {
          label: 'Cancel',
          action: () => {}, // Toast will close automatically
          variant: 'secondary',
        },
        {
          label: 'Confirm',
          action: onConfirm,
          variant: 'primary',
        },
      ],
      ...options,
    });
  };

  const retryAction = (
    message: string,
    onRetry: () => void,
    options?: Partial<Toast>
  ): string => {
    return addToast({
      type: 'error',
      message,
      duration: 0,
      persistent: true,
      actions: [
        {
          label: 'Dismiss',
          action: () => {}, // Toast will close automatically
          variant: 'secondary',
        },
        {
          label: 'Retry',
          action: onRetry,
          variant: 'primary',
        },
      ],
      ...options,
    });
  };

  const undoAction = (
    message: string,
    onUndo: () => void,
    options?: Partial<Toast>
  ): string => {
    return addToast({
      type: 'info',
      message,
      duration: 8000,
      actions: [
        {
          label: 'Undo',
          action: onUndo,
          variant: 'primary',
        },
      ],
      ...options,
    });
  };

  // Network status toasts
  const showOfflineToast = (): string => {
    // Remove existing offline toasts
    clearByType('warning');
    
    return warning('You are currently offline. Some features may be limited.', {
      title: 'Connection Lost',
      persistent: true,
      duration: 0,
      actions: [
        {
          label: 'Refresh',
          action: () => window.location.reload(),
          variant: 'primary',
        },
      ],
    });
  };

  const showOnlineToast = (): string => {
    // Clear offline toasts
    toasts.value = toasts.value.filter(
      toast => toast.message !== 'You are currently offline. Some features may be limited.'
    );
    
    return success('Connection restored', {
      title: 'Back Online',
      duration: 3000,
    });
  };

  // Performance-related toasts
  const showSlowConnectionToast = (): string => {
    return warning('Slow connection detected. Consider switching to offline mode.', {
      title: 'Slow Connection',
      duration: 10000,
      actions: [
        {
          label: 'Enable Offline Mode',
          action: () => {
            // TODO: Implement offline mode toggle
            info('Offline mode enabled. You can still view and edit cached boards.');
          },
          variant: 'primary',
        },
      ],
    });
  };

  const showUpdateAvailableToast = (onUpdate: () => void): string => {
    return info('A new version of MadPlan is available.', {
      title: 'Update Available',
      persistent: true,
      duration: 0,
      actions: [
        {
          label: 'Later',
          action: () => {}, // Toast will close automatically
          variant: 'secondary',
        },
        {
          label: 'Update Now',
          action: onUpdate,
          variant: 'primary',
        },
      ],
    });
  };

  // Error handling with context
  const showApiError = (error: Error, context?: string): string => {
    const contextMessage = context ? ` while ${context}` : '';
    const message = `Something went wrong${contextMessage}. Please try again.`;
    
    return error(message, {
      title: 'Error',
      actions: [
        {
          label: 'Report Issue',
          action: () => {
            // TODO: Implement error reporting
            info('Error reported. Thank you for helping us improve MadPlan.');
          },
          variant: 'secondary',
        },
      ],
    });
  };

  const showValidationError = (message: string): string => {
    return error(message, {
      title: 'Validation Error',
      duration: 6000,
    });
  };

  // Batch operations
  const showBatchProgress = (
    operation: string,
    completed: number,
    total: number
  ): string => {
    const message = `${operation}: ${completed}/${total} completed`;
    const existingToast = toasts.value.find(
      toast => toast.title === 'Batch Operation' && toast.type === 'loading'
    );

    if (existingToast) {
      updateToast(existingToast.id, { message });
      return existingToast.id;
    }

    return loading(message, {
      title: 'Batch Operation',
      showProgress: true,
    });
  };

  const completeBatchOperation = (
    toastId: string,
    operation: string,
    total: number
  ): void => {
    removeToast(toastId);
    success(`${operation} completed successfully (${total} items)`, {
      title: 'Batch Operation Complete',
    });
  };

  return {
    // State
    toasts,
    maxToasts,
    
    // Core methods
    addToast,
    removeToast,
    updateToast,
    clearAll,
    clearByType,
    
    // Convenience methods
    success,
    error,
    warning,
    info,
    loading,
    
    // Advanced methods
    confirmAction,
    retryAction,
    undoAction,
    
    // Specialized methods
    showOfflineToast,
    showOnlineToast,
    showSlowConnectionToast,
    showUpdateAvailableToast,
    showApiError,
    showValidationError,
    showBatchProgress,
    completeBatchOperation,
  };
});

// Composable for easier use in components
export const useToast = () => {
  const toastStore = useToastStore();
  
  return {
    // Direct store access
    toasts: toastStore.toasts,
    
    // Methods
    success: toastStore.success,
    error: toastStore.error,
    warning: toastStore.warning,
    info: toastStore.info,
    loading: toastStore.loading,
    
    confirmAction: toastStore.confirmAction,
    retryAction: toastStore.retryAction,
    undoAction: toastStore.undoAction,
    
    showApiError: toastStore.showApiError,
    showValidationError: toastStore.showValidationError,
    
    remove: toastStore.removeToast,
    clearAll: toastStore.clearAll,
  };
};
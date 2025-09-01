/**
 * Enhanced Error Handling Utilities
 * Implements Story 4.2 error handling and user experience requirements
 */

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  boardId?: string;
  timestamp?: number;
  userAgent?: string;
  url?: string;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion: string;
  recoveryAction?: string;
  reportable: boolean;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  variant: 'primary' | 'secondary' | 'danger';
}

class ErrorHandler {
  private errorReports: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private maxReports = 50;

  // Convert technical errors to user-friendly messages
  public getUserFriendlyError(error: Error, context?: ErrorContext): UserFriendlyError {
    const errorMessage = error.message.toLowerCase();
    const errorType = this.classifyError(error, errorMessage);

    switch (errorType) {
      case 'network':
        return this.getNetworkError(error, context);
      case 'authentication':
        return this.getAuthenticationError(error, context);
      case 'validation':
        return this.getValidationError(error, context);
      case 'permission':
        return this.getPermissionError(error, context);
      case 'not-found':
        return this.getNotFoundError(error, context);
      case 'server':
        return this.getServerError(error, context);
      case 'client':
        return this.getClientError(error, context);
      default:
        return this.getGenericError(error, context);
    }
  }

  // Classify error types
  private classifyError(error: Error, message: string): string {
    // Network errors
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      error.name === 'NetworkError'
    ) {
      return 'network';
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('token') ||
      error.name === 'AuthenticationError'
    ) {
      return 'authentication';
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      error.name === 'ValidationError'
    ) {
      return 'validation';
    }

    // Permission errors
    if (
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('access denied') ||
      error.name === 'PermissionError'
    ) {
      return 'permission';
    }

    // Not found errors
    if (
      message.includes('not found') ||
      message.includes('404') ||
      error.name === 'NotFoundError'
    ) {
      return 'not-found';
    }

    // Server errors
    if (
      message.includes('server error') ||
      message.includes('500') ||
      message.includes('internal server') ||
      error.name === 'ServerError'
    ) {
      return 'server';
    }

    // Client errors
    if (
      message.includes('400') ||
      message.includes('bad request') ||
      error.name === 'ClientError'
    ) {
      return 'client';
    }

    return 'generic';
  }

  private getNetworkError(error: Error, context?: ErrorContext): UserFriendlyError {
    const operation = context?.operation || 'performing this action';
    
    return {
      title: 'Connection Problem',
      message: `We couldn't connect to our servers while ${operation}.`,
      suggestion: 'Check your internet connection and try again. If the problem persists, you can work offline with cached data.',
      recoveryAction: 'Try Again',
      reportable: false,
    };
  }

  private getAuthenticationError(error: Error, context?: ErrorContext): UserFriendlyError {
    return {
      title: 'Sign In Required',
      message: 'Your session has expired or you need to sign in to continue.',
      suggestion: 'Please sign in again to access your boards and continue working.',
      recoveryAction: 'Sign In',
      reportable: false,
    };
  }

  private getValidationError(error: Error, context?: ErrorContext): UserFriendlyError {
    const operation = context?.operation || 'saving your changes';
    
    return {
      title: 'Invalid Information',
      message: `We couldn't complete ${operation} because some information is missing or incorrect.`,
      suggestion: 'Please check your input and make sure all required fields are filled out correctly.',
      recoveryAction: 'Review & Fix',
      reportable: false,
    };
  }

  private getPermissionError(error: Error, context?: ErrorContext): UserFriendlyError {
    const operation = context?.operation || 'perform this action';
    
    return {
      title: 'Access Denied',
      message: `You don't have permission to ${operation}.`,
      suggestion: 'This board or feature may be restricted. Contact the board owner or your administrator for access.',
      recoveryAction: 'Contact Admin',
      reportable: false,
    };
  }

  private getNotFoundError(error: Error, context?: ErrorContext): UserFriendlyError {
    const resourceType = this.inferResourceType(context);
    
    return {
      title: `${resourceType} Not Found`,
      message: `The ${resourceType.toLowerCase()} you're looking for doesn't exist or has been removed.`,
      suggestion: 'It may have been deleted or moved. Try refreshing the page or check with your team members.',
      recoveryAction: 'Go Back',
      reportable: false,
    };
  }

  private getServerError(error: Error, context?: ErrorContext): UserFriendlyError {
    const operation = context?.operation || 'completing your request';
    
    return {
      title: 'Server Problem',
      message: `Our servers encountered a problem while ${operation}.`,
      suggestion: 'This is usually temporary. Please try again in a moment. If the problem continues, we\'ll investigate.',
      recoveryAction: 'Retry',
      reportable: true,
    };
  }

  private getClientError(error: Error, context?: ErrorContext): UserFriendlyError {
    return {
      title: 'Request Problem',
      message: 'Something went wrong with your request.',
      suggestion: 'Please check your input and try again. If you continue to see this error, try refreshing the page.',
      recoveryAction: 'Try Again',
      reportable: true,
    };
  }

  private getGenericError(error: Error, context?: ErrorContext): UserFriendlyError {
    const operation = context?.operation || 'completing your request';
    
    return {
      title: 'Something Went Wrong',
      message: `An unexpected error occurred while ${operation}.`,
      suggestion: 'Please try again. If the problem persists, try refreshing the page or contact support.',
      recoveryAction: 'Try Again',
      reportable: true,
    };
  }

  private inferResourceType(context?: ErrorContext): string {
    if (context?.boardId) return 'Board';
    if (context?.component?.includes('card')) return 'Card';
    if (context?.component?.includes('list')) return 'List';
    if (context?.operation?.includes('theme')) return 'Theme';
    return 'Resource';
  }

  // Generate recovery actions based on error type and context
  public getRecoveryActions(error: Error, context?: ErrorContext): ErrorRecoveryAction[] {
    const userFriendlyError = this.getUserFriendlyError(error, context);
    const actions: ErrorRecoveryAction[] = [];

    // Common actions based on error type
    if (error.message.includes('network') || error.message.includes('timeout')) {
      actions.push({
        label: 'Retry',
        action: () => this.retryLastAction(context),
        variant: 'primary',
      });
      
      actions.push({
        label: 'Work Offline',
        action: () => this.enableOfflineMode(),
        variant: 'secondary',
      });
    }

    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      actions.push({
        label: 'Sign In',
        action: () => this.redirectToLogin(),
        variant: 'primary',
      });
    }

    if (userFriendlyError.reportable) {
      actions.push({
        label: 'Report Issue',
        action: () => this.reportError(error, context),
        variant: 'secondary',
      });
    }

    // Generic fallback actions
    if (actions.length === 0) {
      actions.push({
        label: 'Try Again',
        action: () => this.retryLastAction(context),
        variant: 'primary',
      });
      
      actions.push({
        label: 'Refresh Page',
        action: () => window.location.reload(),
        variant: 'secondary',
      });
    }

    return actions;
  }

  // Error reporting
  public reportError(error: Error, context?: ErrorContext): void {
    const report = {
      error,
      context: {
        ...context,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
      timestamp: Date.now(),
    };

    // Store locally
    this.errorReports.push(report);
    
    // Keep only recent reports
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(-this.maxReports);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('madplan_error_reports', JSON.stringify(this.errorReports));
    } catch (e) {
      console.warn('Failed to store error reports:', e);
    }

    // Send to monitoring service (if available)
    this.sendErrorReport(report).catch(e => {
      console.warn('Failed to send error report:', e);
    });
  }

  private async sendErrorReport(report: any): Promise<void> {
    // TODO: Integrate with error monitoring service (e.g., Sentry, LogRocket)
    if (import.meta.env.DEV) {
      console.log('Error report:', report);
      return;
    }

    try {
      // Example integration with a monitoring service
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            message: report.error.message,
            stack: report.error.stack,
            name: report.error.name,
          },
          context: report.context,
          timestamp: report.timestamp,
        }),
      });
    } catch (e) {
      // Silently fail error reporting to avoid infinite loops
      console.warn('Error reporting failed:', e);
    }
  }

  // Recovery actions
  private async retryLastAction(context?: ErrorContext): Promise<void> {
    if (context?.operation) {
      // TODO: Implement retry logic based on operation type
      console.log('Retrying operation:', context.operation);
    }
  }

  private enableOfflineMode(): void {
    // TODO: Enable offline mode
    console.log('Enabling offline mode');
  }

  private redirectToLogin(): void {
    const currentPath = window.location.pathname;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  }

  // Get stored error reports for debugging
  public getErrorReports(): any[] {
    return [...this.errorReports];
  }

  // Clear error reports
  public clearErrorReports(): void {
    this.errorReports = [];
    localStorage.removeItem('madplan_error_reports');
  }

  // Load error reports from localStorage
  public loadStoredReports(): void {
    try {
      const stored = localStorage.getItem('madplan_error_reports');
      if (stored) {
        this.errorReports = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stored error reports:', e);
    }
  }
}

// Global error handler instance
const errorHandler = new ErrorHandler();

// Initialize error handling
export function initializeErrorHandling(): void {
  // Load stored error reports
  errorHandler.loadStoredReports();

  // Global error handling
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    const context: ErrorContext = {
      component: 'global',
      operation: 'script execution',
      url: event.filename,
    };
    
    errorHandler.reportError(error, context);
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const context: ErrorContext = {
      component: 'global',
      operation: 'promise rejection',
    };
    
    errorHandler.reportError(error, context);
  });

  console.log('[Error Handler] Initialized global error handling');
}

// Export utilities
export const useErrorHandling = () => {
  return {
    getUserFriendlyError: (error: Error, context?: ErrorContext) => 
      errorHandler.getUserFriendlyError(error, context),
    
    getRecoveryActions: (error: Error, context?: ErrorContext) => 
      errorHandler.getRecoveryActions(error, context),
    
    reportError: (error: Error, context?: ErrorContext) => 
      errorHandler.reportError(error, context),
    
    getErrorReports: () => errorHandler.getErrorReports(),
    clearErrorReports: () => errorHandler.clearErrorReports(),
  };
};

export default errorHandler;
<template>
  <div class="error-boundary">
    <!-- Normal content when no error -->
    <slot v-if="!hasError" />
    
    <!-- Error UI when error occurs -->
    <div v-else class="error-boundary-container">
      <div class="error-boundary-content">
        <!-- Error Icon and Header -->
        <div class="error-header">
          <div class="error-icon">
            <svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 class="error-title">Oops! Something went wrong</h2>
          <p class="error-subtitle">{{ getErrorMessage() }}</p>
        </div>

        <!-- Error Details (Development Mode) -->
        <div v-if="isDevelopment && errorDetails" class="error-details">
          <details class="error-details-disclosure">
            <summary class="error-details-summary">
              <span>Error Details</span>
              <svg class="w-5 h-5 transition-transform" :class="{ 'rotate-90': isDetailsOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </summary>
            
            <div class="error-details-content">
              <!-- Error Information -->
              <div class="error-info-section">
                <h4>Error Information:</h4>
                <div class="error-info-grid">
                  <div><strong>Type:</strong> {{ errorDetails.name || 'Unknown Error' }}</div>
                  <div><strong>Message:</strong> {{ errorDetails.message || 'No message available' }}</div>
                  <div><strong>Time:</strong> {{ formatDateTime(errorDetails.timestamp) }}</div>
                  <div v-if="errorDetails.component"><strong>Component:</strong> {{ errorDetails.component }}</div>
                </div>
              </div>

              <!-- Stack Trace -->
              <div v-if="errorDetails.stack" class="error-stack-section">
                <h4>Stack Trace:</h4>
                <pre class="error-stack"><code>{{ errorDetails.stack }}</code></pre>
              </div>

              <!-- Component Info -->
              <div v-if="errorDetails.info" class="error-component-section">
                <h4>Component Information:</h4>
                <pre class="error-component-info"><code>{{ errorDetails.info }}</code></pre>
              </div>

              <!-- Browser Info -->
              <div class="error-browser-section">
                <h4>Browser Information:</h4>
                <div class="error-info-grid">
                  <div><strong>User Agent:</strong> {{ getBrowserInfo().userAgent }}</div>
                  <div><strong>URL:</strong> {{ getBrowserInfo().url }}</div>
                  <div><strong>Viewport:</strong> {{ getBrowserInfo().viewport }}</div>
                </div>
              </div>
            </div>
          </details>
        </div>

        <!-- Error Actions -->
        <div class="error-actions">
          <!-- Retry Button -->
          <button
            @click="handleRetry"
            :disabled="isRetrying"
            class="btn-primary btn-lg error-action-button"
            type="button"
          >
            <svg v-if="isRetrying" class="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2m-15.356-2H9" />
            </svg>
            <svg v-else class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2m-15.356-2H9" />
            </svg>
            {{ isRetrying ? 'Retrying...' : 'Try Again' }}
          </button>

          <!-- Home Button -->
          <button
            @click="handleGoHome"
            class="btn-secondary btn-lg error-action-button"
            type="button"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Dashboard
          </button>

          <!-- Report Button (Development) -->
          <button
            v-if="isDevelopment"
            @click="handleReport"
            class="btn-outline error-action-button"
            type="button"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Copy Error Report
          </button>
        </div>

        <!-- Error Prevention Tips -->
        <div class="error-tips">
          <h4>What you can try:</h4>
          <ul class="error-tips-list">
            <li>Refresh the page or try again in a few moments</li>
            <li>Check your internet connection</li>
            <li>Clear your browser cache and cookies</li>
            <li>Try using a different browser</li>
            <li v-if="isDevelopment">Check the browser console for more details</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured, nextTick } from 'vue'
import { useRouter } from 'vue-router'

interface ErrorDetails {
  name?: string
  message?: string
  stack?: string
  component?: string
  timestamp: Date
  info?: string
}

interface Props {
  /**
   * Fallback component to render on error
   */
  fallback?: string
  /**
   * Enable/disable error reporting
   */
  enableReporting?: boolean
  /**
   * Maximum retry attempts
   */
  maxRetries?: number
}

const props = withDefaults(defineProps<Props>(), {
  fallback: undefined,
  enableReporting: true,
  maxRetries: 3
})

// Router
const router = useRouter()

// Component state
const hasError = ref(false)
const errorDetails = ref<ErrorDetails | null>(null)
const isRetrying = ref(false)
const retryCount = ref(0)
const isDetailsOpen = ref(false)

// Environment detection
const isDevelopment = computed(() => {
  return import.meta.env.DEV
})

// Error capture
onErrorCaptured((error: any, instance, info) => {
  console.error('Error caught by ErrorBoundary:', error)
  
  // Create error details
  errorDetails.value = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    component: instance?.$options.name || instance?.$?.type?.name || 'Unknown Component',
    timestamp: new Date(),
    info: info
  }
  
  hasError.value = true
  
  // Log error for development
  if (isDevelopment.value) {
    console.group('🚨 Error Boundary Details')
    console.error('Error:', error)
    console.log('Component:', instance)
    console.log('Info:', info)
    console.log('Timestamp:', errorDetails.value.timestamp)
    console.groupEnd()
  }
  
  // Report error if enabled
  if (props.enableReporting) {
    reportError(errorDetails.value)
  }
  
  // Prevent the error from propagating further
  return false
})

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection caught by ErrorBoundary:', event.reason)
  
  errorDetails.value = {
    name: 'UnhandledPromiseRejection',
    message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
    stack: event.reason?.stack,
    timestamp: new Date(),
    info: 'This error was caught from an unhandled promise rejection'
  }
  
  hasError.value = true
  
  if (props.enableReporting) {
    reportError(errorDetails.value)
  }
})

// Methods
const getErrorMessage = (): string => {
  if (!errorDetails.value) return 'An unexpected error occurred'
  
  const message = errorDetails.value.message
  
  // User-friendly messages for common errors
  if (message?.includes('ChunkLoadError') || message?.includes('Loading chunk')) {
    return 'Failed to load application resources. Please try refreshing the page.'
  }
  
  if (message?.includes('Network Error') || message?.includes('fetch')) {
    return 'Network connection error. Please check your internet connection and try again.'
  }
  
  if (message?.includes('Permission denied')) {
    return 'Permission error. Please ensure you have the necessary permissions.'
  }
  
  if (isDevelopment.value && message) {
    return message
  }
  
  return 'An unexpected error occurred. Please try again.'
}

const handleRetry = async () => {
  if (retryCount.value >= props.maxRetries) {
    console.warn('Maximum retry attempts reached')
    return
  }
  
  isRetrying.value = true
  retryCount.value++
  
  try {
    // Clear error state
    hasError.value = false
    errorDetails.value = null
    
    // Wait for next tick to ensure state is updated
    await nextTick()
    
    // Force component re-render by clearing error state
    setTimeout(() => {
      isRetrying.value = false
    }, 1000)
    
  } catch (error) {
    console.error('Retry failed:', error)
    isRetrying.value = false
    hasError.value = true
  }
}

const handleGoHome = () => {
  // Clear error state
  hasError.value = false
  errorDetails.value = null
  retryCount.value = 0
  
  // Navigate to dashboard
  router.push('/dashboard').catch(err => {
    console.error('Navigation to dashboard failed:', err)
    // If navigation fails, try to reload the page
    window.location.href = '/'
  })
}

const handleReport = async () => {
  if (!errorDetails.value) return
  
  const report = generateErrorReport(errorDetails.value)
  
  try {
    await navigator.clipboard.writeText(report)
    console.log('Error report copied to clipboard')
    
    // You could show a toast notification here
    // For now, just log it
  } catch (error) {
    console.error('Failed to copy error report:', error)
    
    // Fallback: log the report to console
    console.log('Error Report (copy manually):', report)
  }
}

const reportError = (error: ErrorDetails) => {
  // In a production app, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or your own error reporting endpoint
  
  if (isDevelopment.value) {
    console.log('📊 Error reported:', error)
  }
  
  // Example: Send to error tracking service
  // errorTrackingService.captureException(error)
}

const generateErrorReport = (error: ErrorDetails): string => {
  const browser = getBrowserInfo()
  
  return `
MadPlan Error Report
==================

Error Details:
- Type: ${error.name || 'Unknown'}
- Message: ${error.message || 'No message'}
- Time: ${formatDateTime(error.timestamp)}
- Component: ${error.component || 'Unknown'}

Browser Information:
- User Agent: ${browser.userAgent}
- URL: ${browser.url}
- Viewport: ${browser.viewport}

Stack Trace:
${error.stack || 'No stack trace available'}

Component Info:
${error.info || 'No component info available'}

Retry Count: ${retryCount.value}
Max Retries: ${props.maxRetries}
`.trim()
}

const getBrowserInfo = () => {
  return {
    userAgent: navigator.userAgent,
    url: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  }
}

const formatDateTime = (date: Date): string => {
  return date.toLocaleString()
}

// Expose methods for testing
defineExpose({
  hasError,
  errorDetails,
  retry: handleRetry,
  goHome: handleGoHome,
  clearError: () => {
    hasError.value = false
    errorDetails.value = null
    retryCount.value = 0
  }
})
</script>

<style scoped>
.error-boundary-container {
  @apply min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4;
}

.error-boundary-content {
  @apply max-w-2xl w-full bg-white/90 backdrop-blur-sm rounded-ghibli-xl shadow-ghibli-2xl border border-red-100 p-8;
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-header {
  @apply text-center mb-8;
}

.error-icon {
  @apply flex justify-center mb-4;
}

.error-title {
  @apply text-2xl font-bold text-gray-900 mb-2;
}

.error-subtitle {
  @apply text-gray-600 text-lg;
}

.error-details {
  @apply mb-8;
}

.error-details-disclosure {
  @apply border border-gray-200 rounded-ghibli bg-gray-50;
}

.error-details-summary {
  @apply px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between;
  list-style: none;
}

.error-details-summary::-webkit-details-marker {
  display: none;
}

.error-details-content {
  @apply px-4 pb-4 space-y-4;
}

.error-info-section,
.error-stack-section,
.error-component-section,
.error-browser-section {
  @apply space-y-2;
}

.error-info-section h4,
.error-stack-section h4,
.error-component-section h4,
.error-browser-section h4 {
  @apply font-semibold text-gray-900 text-sm uppercase tracking-wide;
}

.error-info-grid {
  @apply space-y-1 text-sm;
}

.error-info-grid div {
  @apply text-gray-700;
}

.error-stack,
.error-component-info {
  @apply bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.error-actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center mb-8;
}

.error-action-button {
  @apply flex-1 sm:flex-none;
}

.error-tips {
  @apply border-t border-gray-200 pt-6;
}

.error-tips h4 {
  @apply font-semibold text-gray-900 mb-3;
}

.error-tips-list {
  @apply space-y-2 text-sm text-gray-600;
}

.error-tips-list li {
  @apply flex items-start;
}

.error-tips-list li::before {
  @apply content-['•'] text-emerald-500 font-bold mr-2;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .error-boundary-content {
    @apply p-6;
  }
  
  .error-title {
    @apply text-xl;
  }
  
  .error-subtitle {
    @apply text-base;
  }
  
  .error-actions {
    @apply flex-col;
  }
  
  .error-stack,
  .error-component-info {
    @apply text-xs;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .error-boundary-content {
    @apply border-2 border-gray-800 bg-white;
  }
  
  .error-details-disclosure {
    @apply border-2 border-gray-800;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .error-boundary-content {
    animation: none;
  }
  
  * {
    @apply transition-none;
  }
}
</style>
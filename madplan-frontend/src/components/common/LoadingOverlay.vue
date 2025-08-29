<template>
  <teleport to="body">
    <transition
      name="loading-overlay"
      enter-active-class="loading-overlay-enter-active"
      leave-active-class="loading-overlay-leave-active"
      enter-from-class="loading-overlay-enter-from"
      leave-to-class="loading-overlay-leave-to"
    >
      <div
        v-if="visible"
        class="loading-overlay"
        :class="overlayClasses"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel"
        aria-describedby="loading-description"
        @click="handleOverlayClick"
        @keydown.esc="handleEscapeKey"
      >
        <!-- Background with blur effect -->
        <div class="loading-overlay-backdrop" :class="backdropClasses"></div>
        
        <!-- Loading content -->
        <div class="loading-overlay-content" :class="contentClasses">
          <!-- Loading spinner -->
          <div class="loading-spinner-section">
            <LoadingSpinner
              :variant="spinnerVariant"
              :size-variant="spinnerSize"
              :color="spinnerColor"
              :show-center="true"
            />
          </div>
          
          <!-- Loading message -->
          <div class="loading-message-section" id="loading-description">
            <h3 v-if="title" class="loading-title">{{ title }}</h3>
            <p v-if="message" class="loading-message">{{ message }}</p>
            
            <!-- Progress indicator -->
            <div v-if="showProgress && (progress !== undefined || steps.length > 0)" class="loading-progress">
              <!-- Numeric progress -->
              <div v-if="progress !== undefined" class="progress-section">
                <div class="progress-bar-container">
                  <div 
                    class="progress-bar"
                    :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
                  ></div>
                </div>
                <div class="progress-text">
                  {{ Math.round(progress) }}%
                </div>
              </div>
              
              <!-- Step-based progress -->
              <div v-else-if="steps.length > 0" class="steps-section">
                <div class="steps-list">
                  <div
                    v-for="(step, index) in steps"
                    :key="index"
                    class="step-item"
                    :class="{
                      'step-completed': index < currentStep,
                      'step-current': index === currentStep,
                      'step-pending': index > currentStep
                    }"
                  >
                    <!-- Step indicator -->
                    <div class="step-indicator">
                      <div v-if="index < currentStep" class="step-check">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </div>
                      <div v-else-if="index === currentStep" class="step-spinner">
                        <LoadingSpinner size-variant="xs" variant="simple" :show-center="false" />
                      </div>
                      <div v-else class="step-number">{{ index + 1 }}</div>
                    </div>
                    
                    <!-- Step label -->
                    <div class="step-label">{{ step }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Action buttons -->
          <div v-if="showCancel || showRetry" class="loading-actions">
            <button
              v-if="showCancel"
              @click="handleCancel"
              :disabled="cancelDisabled"
              class="loading-action-button cancel-button"
              type="button"
            >
              {{ cancelText }}
            </button>
            
            <button
              v-if="showRetry"
              @click="handleRetry"
              :disabled="retryDisabled"
              class="loading-action-button retry-button"
              type="button"
            >
              {{ retryText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

type OverlayVariant = 'default' | 'blur' | 'dark' | 'light' | 'glass'
type SpinnerVariant = 'simple' | 'ghibli' | 'complex' | 'magical'
type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  /**
   * Whether the overlay is visible
   */
  visible?: boolean
  /**
   * Loading title
   */
  title?: string
  /**
   * Loading message
   */
  message?: string
  /**
   * Visual variant of the overlay
   */
  variant?: OverlayVariant
  /**
   * Spinner variant
   */
  spinnerVariant?: SpinnerVariant
  /**
   * Spinner size
   */
  spinnerSize?: SpinnerSize
  /**
   * Spinner color
   */
  spinnerColor?: 'primary' | 'secondary' | 'accent' | 'white'
  /**
   * Show progress indicator
   */
  showProgress?: boolean
  /**
   * Progress percentage (0-100)
   */
  progress?: number
  /**
   * Progress steps
   */
  steps?: string[]
  /**
   * Current step index
   */
  currentStep?: number
  /**
   * Show cancel button
   */
  showCancel?: boolean
  /**
   * Cancel button text
   */
  cancelText?: string
  /**
   * Cancel button disabled state
   */
  cancelDisabled?: boolean
  /**
   * Show retry button
   */
  showRetry?: boolean
  /**
   * Retry button text
   */
  retryText?: string
  /**
   * Retry button disabled state
   */
  retryDisabled?: boolean
  /**
   * Allow dismissing by clicking overlay
   */
  dismissible?: boolean
  /**
   * Allow dismissing with escape key
   */
  escapeKeyClose?: boolean
  /**
   * Accessibility label
   */
  ariaLabel?: string
  /**
   * Z-index for the overlay
   */
  zIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  title: undefined,
  message: 'Please wait...',
  variant: 'default',
  spinnerVariant: 'ghibli',
  spinnerSize: 'lg',
  spinnerColor: 'primary',
  showProgress: false,
  progress: undefined,
  steps: () => [],
  currentStep: 0,
  showCancel: false,
  cancelText: 'Cancel',
  cancelDisabled: false,
  showRetry: false,
  retryText: 'Retry',
  retryDisabled: false,
  dismissible: false,
  escapeKeyClose: true,
  ariaLabel: 'Loading...',
  zIndex: 1000
})

// Emits
const emit = defineEmits<{
  cancel: []
  retry: []
  dismiss: []
}>()

// Component state
const overlayElement = ref<HTMLElement>()

// Computed properties
const overlayClasses = computed(() => [
  `variant-${props.variant}`,
  {
    'dismissible': props.dismissible
  }
])

const backdropClasses = computed(() => [
  `backdrop-${props.variant}`
])

const contentClasses = computed(() => [
  `content-${props.variant}`
])

// Focus management
let previousActiveElement: Element | null = null

// Methods
const handleOverlayClick = (event: MouseEvent) => {
  if (props.dismissible && event.target === overlayElement.value) {
    emit('dismiss')
  }
}

const handleEscapeKey = () => {
  if (props.escapeKeyClose && props.dismissible) {
    emit('dismiss')
  }
}

const handleCancel = () => {
  emit('cancel')
}

const handleRetry = () => {
  emit('retry')
}

const trapFocus = (event: KeyboardEvent) => {
  if (!props.visible || event.key !== 'Tab') return
  
  const focusableElements = overlayElement.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  
  if (!focusableElements || focusableElements.length === 0) return
  
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
  
  if (event.shiftKey) {
    if (document.activeElement === firstElement) {
      lastElement.focus()
      event.preventDefault()
    }
  } else {
    if (document.activeElement === lastElement) {
      firstElement.focus()
      event.preventDefault()
    }
  }
}

// Watchers
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // Store the currently focused element
    previousActiveElement = document.activeElement
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    
    // Focus the overlay
    setTimeout(() => {
      overlayElement.value?.focus()
    }, 100)
  } else {
    // Restore body scroll
    document.body.style.overflow = ''
    
    // Restore focus
    if (previousActiveElement && 'focus' in previousActiveElement) {
      (previousActiveElement as HTMLElement).focus()
    }
  }
})

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', trapFocus)
})

onUnmounted(() => {
  document.removeEventListener('keydown', trapFocus)
  // Restore body scroll if component is unmounted while overlay is visible
  if (props.visible) {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.loading-overlay {
  @apply fixed inset-0 flex items-center justify-center p-4;
  z-index: v-bind(zIndex);
}

.loading-overlay-backdrop {
  @apply absolute inset-0 transition-all duration-300 ease-in-out;
}

.backdrop-default {
  @apply bg-black/50;
}

.backdrop-blur {
  @apply bg-white/20 backdrop-blur-sm;
}

.backdrop-dark {
  @apply bg-gray-900/70;
}

.backdrop-light {
  @apply bg-white/70;
}

.backdrop-glass {
  @apply bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-md;
}

.loading-overlay-content {
  @apply relative z-10 max-w-md w-full text-center;
}

.content-default,
.content-blur,
.content-glass {
  @apply bg-white/90 backdrop-blur-sm rounded-ghibli-xl shadow-ghibli-2xl border border-emerald-100 p-8;
}

.content-dark {
  @apply bg-gray-800/90 backdrop-blur-sm rounded-ghibli-xl shadow-ghibli-2xl border border-gray-700 p-8 text-white;
}

.content-light {
  @apply bg-white/95 rounded-ghibli-xl shadow-ghibli-2xl border border-gray-200 p-8;
}

.loading-spinner-section {
  @apply mb-6;
}

.loading-message-section {
  @apply mb-6;
}

.loading-title {
  @apply text-xl font-semibold text-gray-900 mb-2;
}

.content-dark .loading-title {
  @apply text-white;
}

.loading-message {
  @apply text-gray-600;
}

.content-dark .loading-message {
  @apply text-gray-300;
}

.loading-progress {
  @apply mt-4;
}

.progress-section {
  @apply space-y-2;
}

.progress-bar-container {
  @apply w-full bg-emerald-100 rounded-full h-2 overflow-hidden;
}

.content-dark .progress-bar-container {
  @apply bg-gray-700;
}

.progress-bar {
  @apply bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300 ease-out;
}

.progress-text {
  @apply text-sm font-medium text-emerald-700;
}

.content-dark .progress-text {
  @apply text-emerald-400;
}

.steps-section {
  @apply mt-4;
}

.steps-list {
  @apply space-y-3;
}

.step-item {
  @apply flex items-center space-x-3;
}

.step-indicator {
  @apply flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium;
}

.step-completed .step-indicator {
  @apply bg-emerald-500 text-white;
}

.step-current .step-indicator {
  @apply bg-emerald-100 border-2 border-emerald-500;
}

.step-pending .step-indicator {
  @apply bg-gray-100 text-gray-500;
}

.content-dark .step-pending .step-indicator {
  @apply bg-gray-700 text-gray-400;
}

.step-check,
.step-spinner {
  @apply flex items-center justify-center;
}

.step-label {
  @apply text-sm font-medium;
}

.step-completed .step-label {
  @apply text-gray-500;
}

.step-current .step-label {
  @apply text-emerald-700;
}

.step-pending .step-label {
  @apply text-gray-400;
}

.content-dark .step-completed .step-label {
  @apply text-gray-400;
}

.content-dark .step-current .step-label {
  @apply text-emerald-400;
}

.content-dark .step-pending .step-label {
  @apply text-gray-500;
}

.loading-actions {
  @apply flex gap-3 justify-center;
}

.loading-action-button {
  @apply px-4 py-2 text-sm font-medium rounded-ghibli transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
}

.cancel-button {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500;
}

.content-dark .cancel-button {
  @apply bg-gray-700 text-gray-300 hover:bg-gray-600 focus:ring-gray-400;
}

.retry-button {
  @apply bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500;
}

/* Animations */
.loading-overlay-enter-active,
.loading-overlay-leave-active {
  @apply transition-all duration-300 ease-out;
}

.loading-overlay-enter-from,
.loading-overlay-leave-to {
  @apply opacity-0;
}

.loading-overlay-enter-from .loading-overlay-content,
.loading-overlay-leave-to .loading-overlay-content {
  @apply transform scale-90 opacity-0;
}

/* Accessibility */
.loading-overlay:focus {
  @apply outline-none;
}

/* Responsive */
@media (max-width: 640px) {
  .loading-overlay-content {
    @apply p-6 mx-4;
  }
  
  .loading-title {
    @apply text-lg;
  }
  
  .loading-message {
    @apply text-sm;
  }
  
  .loading-actions {
    @apply flex-col;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .loading-overlay-content {
    @apply border-2 border-gray-800;
  }
  
  .progress-bar-container {
    @apply bg-gray-300;
  }
  
  .progress-bar {
    @apply bg-black;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .loading-overlay-enter-active,
  .loading-overlay-leave-active {
    @apply transition-none;
  }
  
  .loading-overlay-enter-from .loading-overlay-content,
  .loading-overlay-leave-to .loading-overlay-content {
    @apply transform-none;
  }
  
  .progress-bar {
    @apply transition-none;
  }
}
</style>
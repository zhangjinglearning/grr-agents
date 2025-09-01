<template>
  <Teleport to="body">
    <Transition
      enter-active-class="toast-enter-active"
      leave-active-class="toast-leave-active"
      enter-from-class="toast-enter-from"
      leave-to-class="toast-leave-to"
    >
      <div
        v-if="visible"
        :class="containerClasses"
        role="alert"
        :aria-live="urgency"
        :aria-atomic="true"
      >
        <!-- Icon -->
        <div class="toast-icon">
          <CheckCircleIcon v-if="type === 'success'" class="w-5 h-5" />
          <ExclamationTriangleIcon v-else-if="type === 'warning'" class="w-5 h-5" />
          <XCircleIcon v-else-if="type === 'error'" class="w-5 h-5" />
          <InformationCircleIcon v-else-if="type === 'info'" class="w-5 h-5" />
          <LoadingSpinner v-else-if="type === 'loading'" variant="auto" size="sm" />
        </div>

        <!-- Content -->
        <div class="toast-content">
          <div class="toast-title" v-if="title">{{ title }}</div>
          <div class="toast-message">{{ message }}</div>
          
          <!-- Action buttons -->
          <div v-if="actions && actions.length > 0" class="toast-actions">
            <button
              v-for="action in actions"
              :key="action.label"
              :class="actionButtonClasses(action)"
              @click="handleActionClick(action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <!-- Progress indicator for timed toasts -->
        <div v-if="showProgress && duration" class="toast-progress">
          <div 
            class="toast-progress-bar"
            :style="{ animationDuration: `${duration}ms` }"
          ></div>
        </div>

        <!-- Close button -->
        <button
          v-if="closable"
          class="toast-close"
          @click="close"
          aria-label="Close notification"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/solid';
import LoadingSpinner from './LoadingSpinner.vue';
import { useThemeStore } from '@/stores/theme';

export interface ToastAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface Props {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title?: string;
  message: string;
  duration?: number; // 0 for persistent
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  closable?: boolean;
  showProgress?: boolean;
  actions?: ToastAction[];
  persistent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  duration: 5000,
  position: 'top-right',
  closable: true,
  showProgress: true,
  persistent: false,
});

const emit = defineEmits<{
  close: [id?: string];
  action: [action: ToastAction];
}>();

const themeStore = useThemeStore();
const visible = ref(true);
let timeoutId: number | null = null;

// Auto-close logic
onMounted(() => {
  if (props.duration > 0 && !props.persistent) {
    timeoutId = window.setTimeout(() => {
      close();
    }, props.duration);
  }
});

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
});

const urgency = computed(() => {
  switch (props.type) {
    case 'error':
      return 'assertive';
    case 'warning':
      return 'polite';
    default:
      return 'polite';
  }
});

const containerClasses = computed(() => [
  'toast-notification',
  `toast-${props.type}`,
  `toast-${props.position}`,
  {
    'with-progress': props.showProgress && props.duration > 0,
    'with-actions': props.actions && props.actions.length > 0,
  }
]);

const actionButtonClasses = (action: ToastAction) => [
  'toast-action-button',
  `variant-${action.variant || 'secondary'}`,
];

const close = () => {
  visible.value = false;
  setTimeout(() => {
    emit('close', props.id);
  }, 300); // Match transition duration
};

const handleActionClick = (action: ToastAction) => {
  action.action();
  emit('action', action);
  
  // Close toast after action unless it's persistent
  if (!props.persistent) {
    close();
  }
};
</script>

<style scoped>
.toast-notification {
  position: fixed;
  z-index: 10000;
  max-width: 400px;
  min-width: 300px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--color-gray-200, #e5e7eb);
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  backdrop-filter: blur(8px);
  
  /* Position variants */
  &.toast-top-right {
    top: 1rem;
    right: 1rem;
  }
  
  &.toast-top-left {
    top: 1rem;
    left: 1rem;
  }
  
  &.toast-bottom-right {
    bottom: 1rem;
    right: 1rem;
  }
  
  &.toast-bottom-left {
    bottom: 1rem;
    left: 1rem;
  }
  
  &.toast-top-center {
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
  }
  
  &.toast-bottom-center {
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
  }
  
  /* Type variants */
  &.toast-success {
    border-left: 4px solid var(--color-accent, #10b981);
    
    .toast-icon {
      color: var(--color-accent, #10b981);
    }
  }
  
  &.toast-error {
    border-left: 4px solid #ef4444;
    
    .toast-icon {
      color: #ef4444;
    }
  }
  
  &.toast-warning {
    border-left: 4px solid #f59e0b;
    
    .toast-icon {
      color: #f59e0b;
    }
  }
  
  &.toast-info {
    border-left: 4px solid var(--color-primary, #3b82f6);
    
    .toast-icon {
      color: var(--color-primary, #3b82f6);
    }
  }
  
  &.toast-loading {
    border-left: 4px solid var(--color-gray-400, #9ca3af);
  }
}

.toast-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-gray-900, #111827);
  margin-bottom: 0.25rem;
  line-height: 1.25;
}

.toast-message {
  font-size: 0.875rem;
  color: var(--color-gray-600, #6b7280);
  line-height: 1.4;
}

.toast-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.toast-action-button {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.variant-primary {
    background: var(--color-primary, #6366f1);
    color: white;
    
    &:hover {
      background: var(--color-primary-dark, #4f46e5);
    }
  }
  
  &.variant-secondary {
    background: var(--color-gray-100, #f3f4f6);
    color: var(--color-gray-700, #374151);
    
    &:hover {
      background: var(--color-gray-200, #e5e7eb);
    }
  }
  
  &.variant-danger {
    background: #ef4444;
    color: white;
    
    &:hover {
      background: #dc2626;
    }
  }
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-gray-400, #9ca3af);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--color-gray-100, #f3f4f6);
    color: var(--color-gray-600, #6b7280);
  }
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-gray-200, #e5e7eb);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.toast-progress-bar {
  height: 100%;
  background: var(--color-primary, #6366f1);
  width: 100%;
  transform-origin: left;
  animation: toastProgress linear forwards;
}

/* Ghibli theme enhancements */
[data-theme="spirited-away"] .toast-notification {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
  border: 1px solid rgba(107, 70, 193, 0.2);
}

[data-theme="totoro"] .toast-notification {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 253, 244, 0.95) 100%);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

[data-theme="howls-castle"] .toast-notification {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

[data-theme="kikis-delivery"] .toast-notification {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(254, 242, 242, 0.95) 100%);
  border: 1px solid rgba(14, 165, 233, 0.2);
}

/* Transitions */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Position-specific enter animations */
.toast-top-left .toast-enter-from,
.toast-bottom-left .toast-enter-from {
  transform: translateX(-100%);
}

.toast-top-left .toast-leave-to,
.toast-bottom-left .toast-leave-to {
  transform: translateX(-100%);
}

.toast-top-center .toast-enter-from,
.toast-bottom-center .toast-enter-from {
  transform: translateY(-100%) translateX(-50%);
}

.toast-top-center .toast-leave-to,
.toast-bottom-center .toast-leave-to {
  transform: translateY(100%) translateX(-50%);
}

/* Animations */
@keyframes toastProgress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-notification {
    left: 1rem !important;
    right: 1rem !important;
    max-width: calc(100vw - 2rem);
    min-width: unset;
    
    &.toast-top-center,
    &.toast-bottom-center {
      transform: none;
    }
  }
  
  .toast-actions {
    flex-direction: column;
  }
  
  .toast-action-button {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.2s ease !important;
  }
  
  .toast-enter-from,
  .toast-leave-to {
    transform: none !important;
  }
  
  .toast-progress-bar {
    animation: none !important;
    transform: scaleX(0);
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .toast-notification {
    background: white;
    border: 2px solid black;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  }
  
  .toast-title {
    color: black;
  }
  
  .toast-message {
    color: #333333;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .toast-notification {
    background: var(--color-gray-800, #1f2937);
    border-color: var(--color-gray-600, #4b5563);
    color: white;
  }
  
  .toast-title {
    color: white;
  }
  
  .toast-message {
    color: var(--color-gray-300, #d1d5db);
  }
  
  .toast-close {
    color: var(--color-gray-400, #9ca3af);
    
    &:hover {
      background: var(--color-gray-700, #374151);
      color: var(--color-gray-200, #e5e7eb);
    }
  }
}
</style>
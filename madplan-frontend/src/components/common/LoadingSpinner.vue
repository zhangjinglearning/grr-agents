<template>
  <div 
    class="loading-spinner-container"
    :class="containerClasses"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="status"
    :aria-label="ariaLabel"
  >
    <!-- Ghibli-inspired loading spinner with multiple rings -->
    <div class="spinner-wrapper" :style="{ width: `${size}px`, height: `${size}px` }">
      <!-- Outer ring -->
      <div 
        class="spinner-ring outer-ring"
        :class="[variant, sizeClass]"
        :style="ringStyles.outer"
      ></div>
      
      <!-- Middle ring -->
      <div 
        v-if="variant !== 'simple'"
        class="spinner-ring middle-ring"
        :class="[variant, sizeClass]"
        :style="ringStyles.middle"
      ></div>
      
      <!-- Inner ring -->
      <div 
        v-if="variant === 'complex'"
        class="spinner-ring inner-ring"
        :class="[variant, sizeClass]"
        :style="ringStyles.inner"
      ></div>
      
      <!-- Center dot -->
      <div 
        v-if="showCenter"
        class="spinner-center"
        :class="[variant, sizeClass]"
        :style="centerStyles"
      ></div>
    </div>
    
    <!-- Optional loading text -->
    <div 
      v-if="text" 
      class="loading-text"
      :class="textClasses"
    >
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SpinnerVariant = 'simple' | 'ghibli' | 'complex' | 'magical'
type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  /**
   * Size of the spinner
   */
  size?: number
  /**
   * Predefined size variant
   */
  sizeVariant?: SpinnerSize
  /**
   * Visual variant of the spinner
   */
  variant?: SpinnerVariant
  /**
   * Loading text to display
   */
  text?: string
  /**
   * Show center dot
   */
  showCenter?: boolean
  /**
   * Color theme
   */
  color?: 'primary' | 'secondary' | 'accent' | 'white'
  /**
   * Center the spinner in its container
   */
  centered?: boolean
  /**
   * Accessibility label
   */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: undefined,
  sizeVariant: 'md',
  variant: 'ghibli',
  text: undefined,
  showCenter: true,
  color: 'primary',
  centered: false,
  ariaLabel: 'Loading...'
})

// Computed properties
const actualSize = computed(() => {
  if (props.size) return props.size
  
  const sizeMap: Record<SpinnerSize, number> = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40
  }
  
  return sizeMap[props.sizeVariant]
})

const sizeClass = computed(() => `size-${props.sizeVariant}`)

const containerClasses = computed(() => [
  'loading-spinner',
  {
    'centered': props.centered,
    [`color-${props.color}`]: props.color,
    'with-text': props.text
  }
])

const textClasses = computed(() => [
  'loading-text',
  `text-${props.sizeVariant}`,
  `color-${props.color}`
])

const ringStyles = computed(() => {
  const size = actualSize.value
  
  return {
    outer: {
      width: `${size}px`,
      height: `${size}px`,
      animationDuration: '1.5s'
    },
    middle: {
      width: `${size * 0.7}px`,
      height: `${size * 0.7}px`,
      animationDuration: '1.2s',
      animationDirection: 'reverse'
    },
    inner: {
      width: `${size * 0.4}px`,
      height: `${size * 0.4}px`,
      animationDuration: '1s'
    }
  }
})

const centerStyles = computed(() => {
  const size = actualSize.value
  const centerSize = Math.max(2, size * 0.15)
  
  return {
    width: `${centerSize}px`,
    height: `${centerSize}px`
  }
})
</script>

<style scoped>
.loading-spinner-container {
  @apply inline-flex flex-col items-center justify-center;
}

.loading-spinner-container.centered {
  @apply w-full h-full;
}

.spinner-wrapper {
  @apply relative flex items-center justify-center;
}

.spinner-ring {
  @apply absolute border-2 rounded-full;
  animation: spin linear infinite;
}

/* Variants */
.spinner-ring.simple {
  @apply border-emerald-200 border-t-emerald-600;
}

.spinner-ring.ghibli {
  background: linear-gradient(45deg, transparent, currentColor, transparent);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.spinner-ring.ghibli::before {
  content: '';
  @apply absolute inset-0 rounded-full;
  background: linear-gradient(45deg, #10b981, #14b8a6, #06b6d4);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: xor;
  -webkit-mask-composite: xor;
}

.spinner-ring.complex {
  @apply border-2;
  border-color: rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-right-color: #14b8a6;
}

.spinner-ring.magical {
  background: conic-gradient(from 0deg, 
    transparent, 
    rgba(16, 185, 129, 0.3), 
    rgba(20, 184, 166, 0.6), 
    rgba(6, 182, 212, 0.3), 
    transparent
  );
  border: none;
  border-radius: 50%;
}

/* Ring positioning */
.outer-ring {
  @apply top-0 left-0;
}

.middle-ring {
  @apply top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2;
}

.inner-ring {
  @apply top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2;
}

.spinner-center {
  @apply absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full;
}

/* Color themes */
.color-primary .spinner-center {
  @apply bg-emerald-600;
}

.color-secondary .spinner-center {
  @apply bg-gray-600;
}

.color-accent .spinner-center {
  @apply bg-blue-600;
}

.color-white .spinner-center {
  @apply bg-white;
}

.color-primary .spinner-ring.simple {
  @apply border-emerald-200 border-t-emerald-600;
}

.color-secondary .spinner-ring.simple {
  @apply border-gray-200 border-t-gray-600;
}

.color-accent .spinner-ring.simple {
  @apply border-blue-200 border-t-blue-600;
}

.color-white .spinner-ring.simple {
  @apply border-white/30 border-t-white;
}

/* Size variants */
.size-xs .spinner-ring {
  @apply border;
}

.size-sm .spinner-ring {
  @apply border;
}

.size-md .spinner-ring {
  @apply border-2;
}

.size-lg .spinner-ring {
  @apply border-2;
}

.size-xl .spinner-ring {
  @apply border-4;
}

/* Loading text */
.loading-text {
  @apply mt-2 font-medium;
}

.loading-text.text-xs {
  @apply text-xs;
}

.loading-text.text-sm {
  @apply text-sm;
}

.loading-text.text-md {
  @apply text-base;
}

.loading-text.text-lg {
  @apply text-lg;
}

.loading-text.text-xl {
  @apply text-xl;
}

.loading-text.color-primary {
  @apply text-emerald-700;
}

.loading-text.color-secondary {
  @apply text-gray-700;
}

.loading-text.color-accent {
  @apply text-blue-700;
}

.loading-text.color-white {
  @apply text-white;
}

/* Animations */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Accessibility */
.loading-spinner-container[role="status"] {
  /* Announce to screen readers */
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .spinner-ring {
    animation-duration: 2s !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .spinner-ring.simple {
    @apply border-black border-t-black;
  }
  
  .spinner-center {
    @apply bg-black;
  }
  
  .loading-text {
    @apply text-black;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .loading-spinner-container.with-text {
    @apply space-y-1;
  }
  
  .loading-text {
    @apply text-sm;
  }
}
</style>
<template>
  <div 
    class="drop-zone-indicator"
    :class="[
      isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      isValid ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
      'transition-all duration-200 ease-in-out'
    ]"
    :aria-hidden="!isVisible"
    role="region"
    :aria-label="ariaLabel"
  >
    <div class="flex flex-col items-center justify-center p-4">
      <!-- Drop icon -->
      <div class="mb-2">
        <svg 
          class="w-8 h-8"
          :class="isValid ? 'text-emerald-500' : 'text-red-500'"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            v-if="isValid"
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M19 14l-7 7m0 0l-7-7m7 7V3" 
          />
          <path 
            v-else
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" 
          />
        </svg>
      </div>
      
      <!-- Drop text -->
      <p class="text-sm font-medium" :class="isValid ? 'text-emerald-700' : 'text-red-700'">
        {{ dropText }}
      </p>
      
      <!-- Additional hint text -->
      <p v-if="hintText" class="text-xs mt-1" :class="isValid ? 'text-emerald-600' : 'text-red-600'">
        {{ hintText }}
      </p>
    </div>
    
    <!-- Animated border for visual feedback -->
    <div 
      class="absolute inset-0 rounded-lg border-2 border-dashed animate-pulse"
      :class="isValid ? 'border-emerald-400' : 'border-red-400'"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  isVisible: boolean
  isValid?: boolean
  dropText?: string
  hintText?: string
  type?: 'list' | 'card'
}

const props = withDefaults(defineProps<Props>(), {
  isValid: true,
  dropText: 'Drop here',
  hintText: '',
  type: 'list'
})

// Computed properties
const ariaLabel = computed(() => {
  if (!props.isVisible) return ''
  
  const validText = props.isValid ? 'valid' : 'invalid'
  const typeText = props.type === 'list' ? 'list' : 'card'
  return `${validText} drop zone for ${typeText} - ${props.dropText}`
})
</script>

<style scoped>
.drop-zone-indicator {
  @apply relative bg-opacity-90 border-2 border-dashed rounded-lg min-h-[120px] flex items-center justify-center;
}

/* Enhanced visibility for touch devices */
@media (hover: none) and (pointer: coarse) {
  .drop-zone-indicator {
    @apply min-h-[140px] border-4;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .border-emerald-400 {
    @apply border-emerald-800 border-4;
  }
  
  .border-red-400 {
    @apply border-red-800 border-4;
  }
  
  .bg-emerald-50 {
    @apply bg-emerald-100;
  }
  
  .bg-red-50 {
    @apply bg-red-100;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    @apply animate-none;
  }
  
  .transition-all {
    @apply transition-none;
  }
}

/* Focus styles for accessibility */
.drop-zone-indicator:focus-within {
  @apply ring-2 ring-emerald-500 ring-offset-2;
}
</style>
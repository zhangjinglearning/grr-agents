<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="form-button"
    :class="buttonClasses"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-3 h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    
    <!-- Button content -->
    <span v-if="!loading">
      <slot>{{ text }}</slot>
    </span>
    <span v-else>
      {{ loadingText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  text?: string
  loadingText?: string
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  loadingText: 'Loading...',
  fullWidth: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => [
  // Base classes
  'inline-flex items-center justify-center font-semibold rounded-lg',
  'transition-all duration-200 ease-in-out',
  'focus:outline-none focus:ring-4 focus:ring-emerald-300',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
  
  // Size variants
  {
    'px-3 py-2 text-sm': props.size === 'sm',
    'px-6 py-3 text-base': props.size === 'md',
    'px-8 py-4 text-lg': props.size === 'lg'
  },
  
  // Width
  {
    'w-full': props.fullWidth
  },
  
  // Color variants
  {
    // Primary - Ghibli green
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800': 
      props.variant === 'primary' && !props.disabled,
    'shadow-lg hover:shadow-xl active:shadow-md transform hover:-translate-y-0.5 active:translate-y-0':
      props.variant === 'primary' && !props.disabled && !props.loading,
    
    // Secondary - softer green
    'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 active:bg-emerald-300':
      props.variant === 'secondary' && !props.disabled,
    
    // Outline
    'border-2 border-emerald-600 text-emerald-600 bg-transparent hover:bg-emerald-50 active:bg-emerald-100':
      props.variant === 'outline' && !props.disabled,
    
    // Ghost
    'text-emerald-600 bg-transparent hover:bg-emerald-50 active:bg-emerald-100':
      props.variant === 'ghost' && !props.disabled
  }
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
.form-button {
  /* Ghibli-inspired button styling */
  position: relative;
  overflow: hidden;
}

.form-button:not(:disabled):not(.loading)::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: left 0.5s;
}

.form-button:hover:not(:disabled):not(.loading)::before {
  left: 100%;
}

/* Primary button special styling */
.form-button.primary {
  background-image: linear-gradient(
    135deg,
    rgb(16, 185, 129) 0%,
    rgb(5, 150, 105) 100%
  );
}

.form-button.primary:hover {
  background-image: linear-gradient(
    135deg,
    rgb(5, 150, 105) 0%,
    rgb(4, 120, 87) 100%
  );
}
</style>
<template>
  <div class="form-input-container">
    <label 
      v-if="label" 
      :for="inputId" 
      class="block text-sm font-medium text-emerald-800 mb-2"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </label>
    
    <div class="relative">
      <input
        :id="inputId"
        :type="showPassword ? 'text' : type"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :aria-describedby="errorId"
        :aria-invalid="!!error"
        class="form-input"
        :class="inputClasses"
        @input="handleInput"
        @blur="handleBlur"
        @keydown.enter="$emit('enter')"
      />
      
      <!-- Password visibility toggle -->
      <button
        v-if="type === 'password'"
        type="button"
        class="absolute inset-y-0 right-0 pr-3 flex items-center"
        @click="togglePasswordVisibility"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
      >
        <svg
          class="h-5 w-5 text-emerald-600"
          :class="{ 'text-emerald-400': showPassword }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            v-if="!showPassword"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            v-if="!showPassword"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
          <path
            v-if="showPassword"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
          />
        </svg>
      </button>
    </div>
    
    <!-- Error message -->
    <p 
      v-if="error" 
      :id="errorId"
      class="mt-2 text-sm text-red-600"
      role="alert"
    >
      {{ error }}
    </p>
    
    <!-- Helper text -->
    <p 
      v-if="helperText && !error" 
      class="mt-2 text-sm text-emerald-600"
    >
      {{ helperText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  modelValue: string
  type?: 'text' | 'email' | 'password'
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  helperText?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  required: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'blur': [event: Event]
  'enter': []
}>()

const showPassword = ref(false)
const inputId = computed(() => props.id || `input-${Math.random().toString(36).substr(2, 9)}`)
const errorId = computed(() => `${inputId.value}-error`)

const inputClasses = computed(() => [
  'block w-full px-4 py-3 rounded-lg border-2 transition-colors duration-200',
  'placeholder-emerald-400 text-emerald-900',
  'focus:outline-none focus:ring-0',
  'disabled:bg-emerald-50 disabled:cursor-not-allowed',
  props.error
    ? 'border-red-300 bg-red-50 focus:border-red-500'
    : 'border-emerald-200 bg-white focus:border-emerald-500 hover:border-emerald-300'
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const handleBlur = (event: Event) => {
  emit('blur', event)
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>

<style scoped>
.form-input-container {
  @apply w-full;
}

.form-input {
  /* Ghibli-inspired styling with soft, natural colors */
  background-image: linear-gradient(to bottom, #ffffff, #f0fdf4);
  box-shadow: 
    0 1px 3px 0 rgba(16, 185, 129, 0.1),
    0 1px 2px 0 rgba(16, 185, 129, 0.06);
}

.form-input:focus {
  background-image: linear-gradient(to bottom, #ffffff, #ecfdf5);
  box-shadow: 
    0 0 0 3px rgba(16, 185, 129, 0.1),
    0 1px 3px 0 rgba(16, 185, 129, 0.2);
}
</style>
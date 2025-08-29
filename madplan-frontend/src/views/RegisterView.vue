<template>
  <FormCard
    title="Join MadPlan"
    subtitle="Create your account and start organizing your projects"
    max-width="md"
  >
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Email Input -->
      <FormInput
        v-model="form.email"
        type="email"
        label="Email Address"
        placeholder="Enter your email"
        required
        :error="errors.email"
        @blur="validateEmail"
      />
      
      <!-- Password Input -->
      <FormInput
        v-model="form.password"
        type="password"
        label="Password"
        placeholder="Create a password"
        required
        :error="errors.password"
        :helper-text="passwordHelperText"
        @blur="validatePassword"
      />
      
      <!-- Confirm Password Input -->
      <FormInput
        v-model="form.confirmPassword"
        type="password"
        label="Confirm Password"
        placeholder="Confirm your password"
        required
        :error="errors.confirmPassword"
        @blur="validateConfirmPassword"
        @enter="handleSubmit"
      />
      
      <!-- Password Strength Indicator -->
      <div v-if="form.password" class="password-strength">
        <div class="text-sm text-emerald-700 mb-2">Password strength:</div>
        <div class="flex space-x-1 mb-2">
          <div
            v-for="(segment, index) in 4"
            :key="index"
            class="flex-1 h-2 rounded-full"
            :class="passwordStrengthColor(index)"
          ></div>
        </div>
        <p class="text-xs text-emerald-600">{{ passwordStrengthText }}</p>
      </div>
      
      <!-- Error Message -->
      <div v-if="authError" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div class="ml-3">
            <p class="text-sm text-red-800">{{ authError }}</p>
          </div>
        </div>
      </div>
      
      <!-- Submit Button -->
      <FormButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="isLoading"
        :disabled="!isFormValid"
        loading-text="Creating Account..."
        full-width
      >
        Create Account
      </FormButton>
    </form>
    
    <template #footer>
      <div class="text-center">
        <p class="text-sm text-emerald-700">
          Already have an account?
          <router-link 
            to="/login" 
            class="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors duration-200"
          >
            Sign in here
          </router-link>
        </p>
      </div>
    </template>
  </FormCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import FormCard from '../components/forms/FormCard.vue'
import FormInput from '../components/forms/FormInput.vue'
import FormButton from '../components/forms/FormButton.vue'
import type { RegisterUserInput } from '../services/auth.service'

// Router and store
const router = useRouter()
const authStore = useAuthStore()

// Form state
const form = reactive({
  email: '',
  password: '',
  confirmPassword: ''
})

const errors = reactive({
  email: '',
  password: '',
  confirmPassword: ''
})

// Computed properties
const isLoading = computed(() => authStore.isLoading)
const authError = computed(() => authStore.error)
const isFormValid = computed(() => 
  form.email && 
  form.password && 
  form.confirmPassword &&
  !errors.email && 
  !errors.password && 
  !errors.confirmPassword
)

const passwordHelperText = computed(() => {
  if (!form.password) {
    return 'Must be at least 6 characters with uppercase, lowercase, and number'
  }
  return ''
})

// Password strength calculation
const passwordStrength = computed(() => {
  if (!form.password) return 0
  
  let strength = 0
  const password = form.password
  
  // Length check
  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  
  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^A-Za-z0-9]/.test(password)) strength++
  
  return Math.min(strength, 4)
})

const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value
  const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  return texts[strength] || 'Very Weak'
})

const passwordStrengthColor = (index: number) => {
  const strength = passwordStrength.value
  if (index < strength) {
    if (strength <= 1) return 'bg-red-400'
    if (strength <= 2) return 'bg-yellow-400'
    if (strength <= 3) return 'bg-blue-400'
    return 'bg-green-400'
  }
  return 'bg-gray-200'
}

// Validation functions
const validateEmail = () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!form.email) {
    errors.email = 'Email is required'
  } else if (!emailRegex.test(form.email)) {
    errors.email = 'Please enter a valid email address'
  } else {
    errors.email = ''
  }
}

const validatePassword = () => {
  if (!form.password) {
    errors.password = 'Password is required'
  } else if (form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  } else if (form.password.length > 128) {
    errors.password = 'Password must not exceed 128 characters'
  } else {
    errors.password = ''
  }
  
  // Revalidate confirm password if it exists
  if (form.confirmPassword) {
    validateConfirmPassword()
  }
}

const validateConfirmPassword = () => {
  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  } else {
    errors.confirmPassword = ''
  }
}

const validateForm = () => {
  validateEmail()
  validatePassword()
  validateConfirmPassword()
  return !errors.email && !errors.password && !errors.confirmPassword
}

// Form submission
const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  
  try {
    authStore.clearError()
    
    const registerData: RegisterUserInput = {
      email: form.email,
      password: form.password
    }
    
    await authStore.register(registerData)
    
    // Redirect to dashboard on success
    router.push('/dashboard')
  } catch (error) {
    // Error is handled by the store and displayed in the template
    console.error('Registration failed:', error)
  }
}

// Clear auth error when component mounts
onMounted(() => {
  authStore.clearError()
  
  // If user is already authenticated, redirect to dashboard
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
  }
})
</script>

<style scoped>
.password-strength {
  @apply bg-emerald-50 rounded-lg p-4 border border-emerald-200;
}
</style>
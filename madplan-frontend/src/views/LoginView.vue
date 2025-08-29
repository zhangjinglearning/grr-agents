<template>
  <FormCard
    title="Welcome Back"
    subtitle="Sign in to your MadPlan account"
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
        placeholder="Enter your password"
        required
        :error="errors.password"
        @blur="validatePassword"
        @enter="handleSubmit"
      />
      
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
        loading-text="Signing In..."
        full-width
      >
        Sign In
      </FormButton>
    </form>
    
    <template #footer>
      <div class="text-center">
        <p class="text-sm text-emerald-700">
          Don't have an account?
          <router-link 
            to="/register" 
            class="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors duration-200"
          >
            Sign up here
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
import type { LoginUserInput } from '../services/auth.service'

// Router and store
const router = useRouter()
const authStore = useAuthStore()

// Form state
const form = reactive<LoginUserInput>({
  email: '',
  password: ''
})

const errors = reactive({
  email: '',
  password: ''
})

// Computed properties
const isLoading = computed(() => authStore.isLoading)
const authError = computed(() => authStore.error)
const isFormValid = computed(() => 
  form.email && 
  form.password && 
  !errors.email && 
  !errors.password
)

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
}

const validateForm = () => {
  validateEmail()
  validatePassword()
  return !errors.email && !errors.password
}

// Form submission
const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  
  try {
    authStore.clearError()
    await authStore.login(form)
    
    // Redirect to dashboard on success
    router.push('/dashboard')
  } catch (error) {
    // Error is handled by the store and displayed in the template
    console.error('Login failed:', error)
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
/* Additional styles if needed */
</style>
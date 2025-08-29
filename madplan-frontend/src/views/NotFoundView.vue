<template>
  <div class="not-found-page min-h-screen flex items-center justify-center px-4 py-12">
    <div class="not-found-content max-w-2xl w-full text-center">
      <!-- Ghibli-inspired illustration -->
      <div class="illustration-section mb-8">
        <div class="floating-elements">
          <!-- Large 404 number with Ghibli styling -->
          <div class="error-number">
            <h1 class="text-9xl font-bold text-gradient-primary opacity-20 select-none">404</h1>
          </div>
          
          <!-- Floating decorative elements -->
          <div class="decorative-shapes">
            <div class="shape shape-1 float-gentle"></div>
            <div class="shape shape-2 float-delayed"></div>
            <div class="shape shape-3 float-gentle animation-delay-400"></div>
          </div>
        </div>
      </div>

      <!-- Content card -->
      <div class="card card-magical">
        <div class="content-section">
          <!-- Error icon -->
          <div class="error-icon mb-6">
            <div class="icon-container">
              <svg class="w-16 h-16 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.34 0-4.477.94-6.02 2.472A2.996 2.996 0 003 15a3 3 0 113.001 0h.003c.8 0 1.538-.235 2.164-.646a.5.5 0 01.832.646zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <!-- Error message -->
          <div class="message-section mb-8">
            <h2 class="error-title text-3xl font-bold text-emerald-900 mb-4">
              Oops! Page not found
            </h2>
            <p class="error-description text-lg text-emerald-700 mb-2">
              The page you're looking for seems to have wandered off into the magical forest.
            </p>
            <p class="error-suggestion text-emerald-600">
              Don't worry, let's help you find your way back!
            </p>
          </div>

          <!-- Action buttons -->
          <div class="actions-section">
            <div class="button-group flex flex-col sm:flex-row gap-4 justify-center">
              <router-link
                :to="dashboardRoute"
                class="btn-primary btn-lg"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {{ isAuthenticated ? 'Go to Dashboard' : 'Go to Login' }}
              </router-link>
              
              <button
                @click="handleGoBack"
                class="btn-secondary btn-lg"
                :disabled="!canGoBack"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Go Back
              </button>
            </div>

            <!-- Additional helpful links -->
            <div class="helpful-links mt-8">
              <h3 class="text-sm font-medium text-emerald-800 mb-3">Helpful links:</h3>
              <div class="links-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
                <router-link
                  v-if="isAuthenticated"
                  to="/dashboard"
                  class="helpful-link"
                >
                  Dashboard
                </router-link>
                <router-link
                  v-else
                  to="/login"
                  class="helpful-link"
                >
                  Login
                </router-link>
                <router-link
                  v-if="!isAuthenticated"
                  to="/register"
                  class="helpful-link"
                >
                  Sign Up
                </router-link>
                <button
                  @click="handleRefresh"
                  class="helpful-link"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error reporting (development only) -->
      <div v-if="isDevelopment" class="debug-section mt-8">
        <details class="debug-details">
          <summary class="debug-summary">Debug Information</summary>
          <div class="debug-content">
            <div class="debug-info">
              <p><strong>Attempted URL:</strong> {{ attemptedUrl }}</p>
              <p><strong>Referrer:</strong> {{ referrer || 'Direct navigation' }}</p>
              <p><strong>User Agent:</strong> {{ userAgent }}</p>
              <p><strong>Timestamp:</strong> {{ new Date().toLocaleString() }}</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import logger from '../utils/logger'

// Router and store
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated)

const isDevelopment = computed(() => import.meta.env.DEV)

const dashboardRoute = computed(() => isAuthenticated.value ? '/dashboard' : '/login')

const canGoBack = computed(() => window.history.length > 1)

const attemptedUrl = computed(() => route.fullPath)

const referrer = computed(() => document.referrer)

const userAgent = computed(() => navigator.userAgent)

// Methods
const handleGoBack = () => {
  if (canGoBack.value) {
    router.go(-1)
  } else {
    router.push(dashboardRoute.value)
  }
  
  logger.user('404-go-back', { 
    canGoBack: canGoBack.value, 
    redirectTo: dashboardRoute.value 
  })
}

const handleRefresh = () => {
  window.location.reload()
  logger.user('404-refresh', { url: attemptedUrl.value })
}

// Lifecycle
onMounted(() => {
  // Log 404 error
  logger.error('404 Page Not Found', {
    attemptedUrl: attemptedUrl.value,
    referrer: referrer.value,
    userAgent: userAgent.value,
    isAuthenticated: isAuthenticated.value,
    timestamp: new Date()
  })
  
  // Update document title
  document.title = 'Page Not Found - MadPlan'
})
</script>

<style scoped>
.not-found-page {
  /* Background with subtle pattern */
  @apply bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50;
  background-image: 
    radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(6, 182, 212, 0.05) 0%, transparent 50%);
}

.not-found-content {
  @apply relative;
}

.illustration-section {
  @apply relative;
}

.floating-elements {
  @apply relative;
}

.error-number {
  @apply relative z-10;
}

.decorative-shapes {
  @apply absolute inset-0 pointer-events-none;
}

.shape {
  @apply absolute bg-gradient-to-br opacity-20;
  border-radius: 50%;
}

.shape-1 {
  @apply w-20 h-20 from-emerald-400 to-teal-500 top-10 left-1/4;
}

.shape-2 {
  @apply w-12 h-12 from-green-400 to-emerald-500 top-20 right-1/3;
}

.shape-3 {
  @apply w-16 h-16 from-teal-400 to-cyan-500 bottom-10 left-1/3;
}

.content-section {
  @apply relative z-20;
}

.error-icon {
  @apply flex justify-center;
}

.icon-container {
  @apply w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center shadow-ghibli;
}

.error-title {
  @apply font-heading;
}

.error-description {
  @apply leading-relaxed;
}

.error-suggestion {
  @apply text-base;
}

.button-group {
  @apply items-center;
}

.helpful-links {
  @apply pt-6 border-t border-emerald-100;
}

.links-grid {
  @apply max-w-md mx-auto;
}

.helpful-link {
  @apply text-sm text-emerald-600 hover:text-emerald-800 hover:underline transition-colors duration-200 text-center;
}

/* Debug section */
.debug-section {
  @apply max-w-lg mx-auto;
}

.debug-details {
  @apply bg-gray-50 border border-gray-200 rounded-ghibli p-4;
}

.debug-summary {
  @apply cursor-pointer font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200;
}

.debug-content {
  @apply mt-3 pt-3 border-t border-gray-200;
}

.debug-info {
  @apply space-y-2 text-sm text-gray-600;
}

.debug-info p {
  @apply break-all;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .error-number h1 {
    @apply text-7xl;
  }
  
  .error-title {
    @apply text-2xl;
  }
  
  .error-description {
    @apply text-base;
  }
  
  .shape {
    @apply opacity-10;
  }
  
  .shape-1 {
    @apply w-16 h-16;
  }
  
  .shape-2 {
    @apply w-10 h-10;
  }
  
  .shape-3 {
    @apply w-12 h-12;
  }
  
  .button-group {
    @apply flex-col;
  }
  
  .links-grid {
    @apply grid-cols-2;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .shape {
    @apply opacity-30;
  }
  
  .error-number h1 {
    @apply opacity-40;
  }
  
  .icon-container {
    @apply border-2 border-gray-600;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .shape {
    animation: none !important;
  }
}

/* Animation delays */
.animation-delay-400 {
  animation-delay: 400ms;
}
</style>

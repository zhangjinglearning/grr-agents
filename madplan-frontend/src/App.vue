<template>
  <div id="app">
    <!-- Skip link for accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>
    
    <!-- Global Error Boundary -->
    <ErrorBoundary>
      <!-- Authentication-based layout rendering -->
      <template v-if="isAuthenticated">
        <!-- Authenticated layout with AppLayout -->
        <AppLayout 
          :loading="isGlobalLoading"
          :show-breadcrumbs="showBreadcrumbs"
        >
          <!-- Breadcrumb slot -->
          <template v-if="showBreadcrumbs" #breadcrumbs>
            <nav class="breadcrumb-nav" aria-label="Breadcrumb">
              <ol class="breadcrumb-list">
                <li v-for="(crumb, index) in breadcrumbs" :key="index" class="breadcrumb-item">
                  <router-link 
                    v-if="crumb.to && index < breadcrumbs.length - 1"
                    :to="crumb.to"
                    class="breadcrumb-link"
                  >
                    {{ crumb.label }}
                  </router-link>
                  <span v-else class="breadcrumb-current">{{ crumb.label }}</span>
                  <svg 
                    v-if="index < breadcrumbs.length - 1" 
                    class="breadcrumb-separator" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                  </svg>
                </li>
              </ol>
            </nav>
          </template>

          <!-- Main content with route transitions -->
          <transition 
            name="route" 
            mode="out-in"
            @enter="handleRouteEnter"
            @leave="handleRouteLeave"
          >
            <router-view 
              v-slot="{ Component, route }"
              :key="route.path"
            >
              <div id="main-content" tabindex="-1">
                <component :is="Component" />
              </div>
            </router-view>
          </transition>

          <!-- Footer slot (if needed in the future) -->
          <template #footer>
            <div v-if="showFooter" class="app-footer">
              <div class="footer-content">
                <p class="footer-text">
                  &copy; {{ currentYear }} MadPlan. Made with ✨ and Vue.js
                </p>
              </div>
            </div>
          </template>
        </AppLayout>
      </template>

      <!-- Unauthenticated layout (login/register pages) -->
      <template v-else>
        <div class="auth-layout min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
          <!-- Simple header for auth pages -->
          <header class="auth-header py-6">
            <div class="max-w-md mx-auto text-center">
              <div class="app-logo-section">
                <div class="app-logo w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-ghibli-lg mx-auto mb-3 flex items-center justify-center shadow-ghibli">
                  <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                  </svg>
                </div>
                <h1 class="text-gradient-primary text-3xl font-bold">MadPlan</h1>
              </div>
            </div>
          </header>

          <!-- Auth page content -->
          <main class="auth-main flex-1 flex items-center justify-center px-4 py-12">
            <transition name="auth-page" mode="out-in">
              <router-view v-slot="{ Component }">
                <component :is="Component" />
              </router-view>
            </transition>
          </main>
        </div>
      </template>
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import AppLayout from './components/layout/AppLayout.vue'
import ErrorBoundary from './components/common/ErrorBoundary.vue'
import logger from './utils/logger'

// Router and store
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Component state
const isGlobalLoading = ref(false)
const showFooter = ref(false)

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated)

const currentYear = computed(() => new Date().getFullYear())

const showBreadcrumbs = computed(() => {
  // Show breadcrumbs on dashboard and other authenticated pages (except auth pages)
  return isAuthenticated.value && route.path !== '/login' && route.path !== '/register'
})

const breadcrumbs = computed(() => {
  const crumbs = []
  
  // Generate breadcrumbs based on current route
  if (route.path === '/dashboard') {
    crumbs.push({ label: 'Dashboard', to: '/dashboard' })
  } else if (route.path.startsWith('/dashboard/')) {
    crumbs.push({ label: 'Dashboard', to: '/dashboard' })
    // Add more specific breadcrumbs based on route structure
    const segments = route.path.split('/').filter(Boolean)
    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i]
      const path = '/' + segments.slice(0, i + 1).join('/')
      crumbs.push({
        label: segment.charAt(0).toUpperCase() + segment.slice(1),
        to: i === segments.length - 1 ? undefined : path
      })
    }
  }
  
  return crumbs
})

// Methods
const handleRouteEnter = (element: Element) => {
  logger.component('App', 'route-enter', { route: route.path })
  
  // Focus main content for accessibility
  const mainContent = element.querySelector('#main-content') as HTMLElement
  if (mainContent) {
    mainContent.focus()
  }
}

const handleRouteLeave = () => {
  logger.component('App', 'route-leave', { route: route.path })
}

const updateGlobalLoading = (loading: boolean) => {
  isGlobalLoading.value = loading
}

// Watchers
watch(
  () => route.path,
  (newPath, oldPath) => {
    // Log route navigation
    logger.route(oldPath || 'initial', newPath)
    
    // Update document title based on route meta
    if (route.meta?.title) {
      document.title = route.meta.title as string
    }
    
    // Update global context for logging
    logger.setGlobalContext({
      route: newPath,
      component: route.name as string
    })
  },
  { immediate: true }
)

watch(isAuthenticated, (newValue, oldValue) => {
  logger.auth('authentication-state-changed', { 
    wasAuthenticated: oldValue, 
    isAuthenticated: newValue 
  })
  
  // Update global context
  logger.setGlobalContext({
    userId: authStore.user?.id,
    isAuthenticated: newValue
  })
})

// Lifecycle
onMounted(() => {
  logger.component('App', 'mounted', { 
    route: route.path,
    isAuthenticated: isAuthenticated.value
  })
  
  // Set initial global context
  logger.setGlobalContext({
    route: route.path,
    userId: authStore.user?.id,
    isAuthenticated: isAuthenticated.value
  })

  // Add performance monitoring
  logger.startPerformanceMark('app-initialization')
  
  // Initialize app-level features
  setTimeout(() => {
    logger.endPerformanceMark('app-initialization', { 
      initialRoute: route.path,
      isAuthenticated: isAuthenticated.value
    })
  }, 100)

  // Log app start
  logger.info('MadPlan application started', {
    version: import.meta.env.VITE_APP_VERSION || 'development',
    environment: import.meta.env.MODE,
    timestamp: new Date()
  })
})

// Expose methods for child components
defineExpose({
  updateGlobalLoading,
  isGlobalLoading: computed(() => isGlobalLoading.value)
})
</script>

<style scoped>
/* App-level styles */
#app {
  @apply min-h-screen font-sans antialiased;
}

/* Auth layout styles */
.auth-layout {
  @apply flex flex-col;
  min-height: 100vh;
}

.auth-header {
  @apply flex-shrink-0;
}

.auth-main {
  @apply flex-1;
}

.app-logo-section {
  @apply inline-block;
}

/* Footer styles */
.app-footer {
  @apply bg-white/50 backdrop-blur-sm border-t border-emerald-100 mt-8;
}

.footer-content {
  @apply max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8;
}

.footer-text {
  @apply text-center text-sm text-emerald-600;
}

/* Breadcrumb styles */
.breadcrumb-nav {
  @apply mb-4;
}

.breadcrumb-list {
  @apply flex items-center space-x-2 text-sm;
}

.breadcrumb-item {
  @apply flex items-center space-x-2;
}

.breadcrumb-link {
  @apply text-emerald-600 hover:text-emerald-800 transition-colors duration-200;
}

.breadcrumb-current {
  @apply text-emerald-900 font-medium;
}

.breadcrumb-separator {
  @apply w-4 h-4 text-emerald-400;
}

/* Route transition animations */
.route-enter-active,
.route-leave-active {
  @apply transition-all duration-300 ease-out;
}

.route-enter-from {
  @apply opacity-0 transform translate-x-4;
}

.route-leave-to {
  @apply opacity-0 transform -translate-x-4;
}

/* Auth page transitions */
.auth-page-enter-active,
.auth-page-leave-active {
  @apply transition-all duration-400 ease-out;
}

.auth-page-enter-from {
  @apply opacity-0 transform scale-95;
}

.auth-page-leave-to {
  @apply opacity-0 transform scale-105;
}

/* Accessibility improvements */
.skip-link:focus {
  @apply fixed top-4 left-4 z-50 px-4 py-2 bg-emerald-600 text-white rounded-ghibli shadow-ghibli-lg;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .breadcrumb-list {
    @apply text-xs;
  }
  
  .breadcrumb-separator {
    @apply w-3 h-3;
  }
  
  .auth-header {
    @apply py-4;
  }
  
  .auth-main {
    @apply px-4 py-8;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .app-footer {
    @apply bg-white border-t-2 border-gray-800;
  }
  
  .breadcrumb-link {
    @apply text-blue-700;
  }
  
  .breadcrumb-current {
    @apply text-black;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .route-enter-active,
  .route-leave-active,
  .auth-page-enter-active,
  .auth-page-leave-active {
    @apply transition-none;
  }
  
  .route-enter-from,
  .route-leave-to,
  .auth-page-enter-from,
  .auth-page-leave-to {
    @apply transform-none;
  }
}
</style>

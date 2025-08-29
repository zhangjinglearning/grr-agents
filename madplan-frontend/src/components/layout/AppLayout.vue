<template>
  <div class="app-shell min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
    <!-- Application Header -->
    <AppHeader />
    
    <!-- Main Content Area -->
    <main 
      class="main-content flex-1 transition-all duration-300 ease-in-out"
      :class="contentClasses"
      role="main"
      aria-label="Main application content"
    >
      <div class="content-wrapper max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <!-- Content Slot with Breadcrumb Support -->
        <div v-if="showBreadcrumbs" class="breadcrumb-area mb-6">
          <slot name="breadcrumbs" />
        </div>
        
        <!-- Main Content Slot -->
        <div class="main-content-area">
          <slot />
        </div>
        
        <!-- Optional Footer Slot -->
        <div v-if="$slots.footer" class="footer-area mt-8">
          <slot name="footer" />
        </div>
      </div>
    </main>
    
    <!-- Global Loading Overlay -->
    <LoadingOverlay v-if="isGlobalLoading" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import AppHeader from './AppHeader.vue'
import LoadingOverlay from '../common/LoadingOverlay.vue'

interface Props {
  /**
   * Whether to show the breadcrumb area
   */
  showBreadcrumbs?: boolean
  /**
   * Additional CSS classes for content area
   */
  contentClass?: string
  /**
   * Whether to show global loading state
   */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showBreadcrumbs: false,
  contentClass: '',
  loading: false
})

// Authentication store for global loading state
const authStore = useAuthStore()

// Computed properties
const isGlobalLoading = computed(() => props.loading || authStore.isLoading)

const contentClasses = computed(() => {
  return [
    'content-area',
    props.contentClass
  ].filter(Boolean).join(' ')
})
</script>

<style scoped>
.app-shell {
  /* Ensure the app shell takes full viewport height */
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  
  /* Enhanced Ghibli-inspired background with subtle animation */
  background: linear-gradient(135deg, 
    #f0fdf4 0%,    /* emerald-50 */
    #f0fdfa 25%,   /* teal-50 */
    #f0f9ff 50%,   /* sky-50 */
    #f0fdf4 75%,   /* emerald-50 */
    #ecfdf5 100%   /* emerald-100 */
  );
  background-size: 400% 400%;
  animation: ghibliGradient 20s ease infinite;
}

@keyframes ghibliGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.main-content {
  /* Flex grow to fill available space */
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  /* Ensure content wrapper also grows */
  flex: 1;
  display: flex;
  flex-direction: column;
}

.main-content-area {
  /* Main content takes available space */
  flex: 1;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .content-wrapper {
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .app-shell {
    background: #ffffff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .app-shell {
    animation: none;
  }
  
  .main-content {
    transition: none;
  }
}

/* Focus management */
.main-content:focus-within {
  outline: 2px solid #059669; /* emerald-600 */
  outline-offset: -2px;
}
</style>
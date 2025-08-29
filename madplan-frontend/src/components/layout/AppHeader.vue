<template>
  <header 
    class="app-header bg-white/90 backdrop-blur-sm shadow-lg border-b border-emerald-200/60 sticky top-0 z-50"
    role="banner"
    aria-label="Main navigation"
  >
    <nav class="header-nav max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" role="navigation">
      <div class="flex justify-between items-center h-16">
        <!-- App Branding -->
        <div class="flex items-center space-x-4">
          <div class="brand-section flex items-center space-x-3">
            <!-- App Logo/Icon -->
            <div class="app-logo w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            
            <!-- App Name -->
            <h1 class="app-title text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
              MadPlan
            </h1>
          </div>
          
          <!-- Page Title (Optional) -->
          <div v-if="pageTitle" class="page-title hidden md:block">
            <span class="text-sm text-emerald-600 font-medium">{{ pageTitle }}</span>
          </div>
        </div>

        <!-- User Section -->
        <div class="user-section flex items-center space-x-4">
          <!-- User Info -->
          <div v-if="user" class="user-info hidden sm:flex items-center space-x-3">
            <!-- User Avatar -->
            <div class="user-avatar w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-200">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            
            <!-- User Email -->
            <div class="user-details">
              <span class="text-sm font-medium text-emerald-800" :title="user.email">
                {{ userDisplayName }}
              </span>
            </div>
          </div>

          <!-- Logout Button -->
          <button
            @click="handleLogoutClick"
            :disabled="isLoggingOut"
            class="logout-btn inline-flex items-center px-3 py-2 border border-emerald-300 shadow-sm text-sm font-medium rounded-lg text-emerald-700 bg-white hover:bg-emerald-50 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
            :aria-label="isLoggingOut ? 'Signing out...' : 'Sign out of account'"
            type="button"
          >
            <svg 
              class="w-4 h-4 mr-2" 
              :class="{ 'animate-spin': isLoggingOut }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                v-if="!isLoggingOut"
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2m-15.356-2H9"
              />
            </svg>
            <span class="logout-text">{{ isLoggingOut ? 'Signing Out...' : 'Sign Out' }}</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Logout Confirmation Modal -->
    <div
      v-if="showLogoutModal"
      class="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <!-- Modal Backdrop -->
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm"
        @click="cancelLogout"
      ></div>
      
      <!-- Modal Content -->
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform transition-all">
          <!-- Modal Header -->
          <div class="flex items-center mb-4">
            <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mr-3">
              <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 id="logout-modal-title" class="text-lg font-semibold text-gray-900">
              Confirm Sign Out
            </h3>
          </div>
          
          <!-- Modal Body -->
          <div class="mb-6">
            <p class="text-gray-600">
              Are you sure you want to sign out? You'll need to sign in again to access your boards.
            </p>
          </div>
          
          <!-- Modal Actions -->
          <div class="flex space-x-3 justify-end">
            <button
              @click="cancelLogout"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
              type="button"
            >
              Cancel
            </button>
            <button
              @click="confirmLogout"
              :disabled="isLoggingOut"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              type="button"
            >
              {{ isLoggingOut ? 'Signing Out...' : 'Sign Out' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

interface Props {
  /**
   * Optional page title to display in header
   */
  pageTitle?: string
}

const props = defineProps<Props>()

// Router and store
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Component state
const isLoggingOut = ref(false)
const showLogoutModal = ref(false)

// Computed properties
const user = computed(() => authStore.user)

const userDisplayName = computed(() => {
  if (!user.value?.email) return 'User'
  
  // Extract name from email (before @)
  const emailPrefix = user.value.email.split('@')[0]
  
  // Capitalize first letter and replace dots/underscores with spaces
  return emailPrefix
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
})

// Methods
const handleLogoutClick = () => {
  showLogoutModal.value = true
}

const cancelLogout = () => {
  showLogoutModal.value = false
}

const confirmLogout = async () => {
  if (isLoggingOut.value) return
  
  isLoggingOut.value = true
  
  try {
    await authStore.logout()
    showLogoutModal.value = false
    
    // Redirect to login page
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
    // Handle logout error - maybe show a toast or keep the modal open
  } finally {
    isLoggingOut.value = false
  }
}

// Handle escape key to close modal
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showLogoutModal.value) {
    cancelLogout()
  }
}

// Add keyboard event listener for modal
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}
</script>

<style scoped>
/* Header styling with enhanced Ghibli theme */
.app-header {
  /* Glass morphism effect */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  
  /* Subtle shadow for depth */
  box-shadow: 
    0 1px 3px 0 rgba(16, 185, 129, 0.1),
    0 1px 2px 0 rgba(16, 185, 129, 0.06);
  
  /* Ensure header stays on top */
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Brand section animations */
.brand-section {
  transition: transform 0.2s ease;
}

.brand-section:hover {
  transform: translateY(-1px);
}

.app-logo {
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.app-logo:hover {
  transform: rotate(5deg) scale(1.05);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

/* App title gradient animation */
.app-title {
  background: linear-gradient(45deg, #047857, #0d9488, #047857);
  background-size: 200% 200%;
  animation: gradientShift 3s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* User section styling */
.user-avatar {
  transition: all 0.2s ease;
}

.user-avatar:hover {
  transform: scale(1.1);
  border-color: #059669; /* emerald-600 */
}

/* Logout button enhancements */
.logout-btn {
  transition: all 0.2s ease;
}

.logout-btn:hover {
  transform: translateY(-1px);
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .app-title {
    font-size: 1.5rem;
  }
  
  .user-details {
    display: none;
  }
  
  .logout-text {
    display: none;
  }
  
  .logout-btn {
    padding: 0.5rem;
    min-width: 2.5rem;
  }
}

/* Modal animations */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .app-header {
    background: #ffffff;
    border-bottom: 2px solid #000000;
  }
  
  .app-title {
    background: #000000;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .app-title {
    animation: none;
  }
  
  .app-logo,
  .brand-section,
  .logout-btn {
    transition: none;
  }
  
  .app-logo:hover {
    transform: none;
  }
}

/* Focus management */
.logout-btn:focus-visible {
  outline: 2px solid #059669;
  outline-offset: 2px;
}

/* Loading animation for logout button */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
<template>
  <!-- Navigation Header -->
  <nav class="bg-white shadow-sm border-b border-emerald-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-emerald-900">MadPlan</h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- User Info -->
          <div class="flex items-center space-x-3">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span class="text-sm font-medium text-emerald-800">{{ userEmail }}</span>
            </div>
            
            <!-- Logout Button -->
            <button
              @click="handleLogout"
              :disabled="isLoggingOut"
              data-testid="logout-button"
              class="inline-flex items-center px-3 py-2 border border-emerald-300 shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {{ isLoggingOut ? 'Signing Out...' : 'Sign Out' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100">
    <div class="px-4 py-6">
      <div class="max-w-7xl mx-auto">
        <div class="md:flex md:items-center md:justify-between">
          <div class="min-w-0 flex-1">
            <h2
              class="text-2xl font-bold leading-7 text-emerald-900 sm:truncate sm:text-3xl sm:tracking-tight"
            >
              Welcome back, {{ userName }}!
            </h2>
            <p class="mt-1 text-sm text-emerald-700">Manage your Kanban boards and stay organized</p>
          </div>
          <div class="mt-4 flex md:ml-4 md:mt-0">
            <button
              @click="showCreateBoardModal = true"
              :disabled="boardStore.isCreatingBoard"
              type="button"
              data-testid="create-board-button"
              class="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg 
                :class="{ 'animate-spin': boardStore.isCreatingBoard }"
                class="w-5 h-5 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {{ boardStore.isCreatingBoard ? 'Creating...' : 'Create Board' }}
            </button>
          </div>
        </div>

        <!-- Boards Section -->
        <div class="mt-8">
          <div class="bg-white overflow-hidden shadow-lg rounded-xl border border-emerald-200">
            <div class="px-6 py-8 sm:p-8">
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center">
                  <svg class="w-6 h-6 text-emerald-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 class="text-lg font-semibold text-emerald-900">Your Boards</h3>
                  <span v-if="boardStore.hasBoards" class="ml-2 bg-emerald-100 text-emerald-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                    {{ boardStore.boardCount }}
                  </span>
                </div>
                
                <!-- Refresh Button -->
                <button
                  @click="refreshBoards"
                  :disabled="boardStore.isLoading"
                  data-testid="refresh-button"
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <svg 
                    :class="{ 'animate-spin': boardStore.isLoading }"
                    class="w-4 h-4 mr-2" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {{ boardStore.isLoading ? 'Loading...' : 'Refresh' }}
                </button>
              </div>
              
              <!-- Error State -->
              <div v-if="boardStore.error && !boardStore.isLoading" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">
                      Error loading boards
                    </h3>
                    <div class="mt-2 text-sm text-red-700">
                      <p>{{ boardStore.error }}</p>
                    </div>
                    <div class="mt-4">
                      <button
                        @click="boardStore.clearError(); refreshBoards()"
                        data-testid="try-again-button"
                        class="bg-red-100 px-3 py-2 text-red-800 text-sm font-medium rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Loading State -->
              <div v-if="boardStore.isLoading && !boardStore.hasBoards" class="text-center py-12">
                <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-emerald-700">
                  <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading your boards...
                </div>
              </div>
              
              <!-- Boards Grid -->
              <div v-else-if="boardStore.hasBoards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <BoardCard
                  v-for="board in boardStore.sortedBoards"
                  :key="board.id"
                  :board="board"
                  :show-delete-button="true"
                  :show-created-date="true"
                  :is-deleting="boardStore.isDeletingBoard === board.id"
                  @click="navigateToBoard"
                  @delete="handleDeleteBoard"
                />
              </div>
              
              <!-- Empty State -->
              <div v-else class="text-center py-12">
                <svg class="mx-auto h-16 w-16 text-emerald-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h4 class="text-lg font-medium text-emerald-800 mb-2">No boards yet</h4>
                <p class="text-emerald-600 mb-6">Create your first board to start organizing your projects and tasks</p>
                
                <button
                  @click="showCreateBoardModal = true"
                  type="button"
                  data-testid="create-first-board-button"
                  class="inline-flex items-center px-6 py-3 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200"
                >
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Your First Board
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions Section -->
        <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Getting Started Card -->
          <div class="bg-white overflow-hidden shadow rounded-lg border border-emerald-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-sm font-medium text-emerald-900">Getting Started</h3>
                  <p class="text-sm text-emerald-600">Learn how to use MadPlan</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Templates Card -->
          <div class="bg-white overflow-hidden shadow rounded-lg border border-emerald-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-sm font-medium text-emerald-900">Board Templates</h3>
                  <p class="text-sm text-emerald-600">Start with pre-made layouts</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Settings Card -->
          <div class="bg-white overflow-hidden shadow rounded-lg border border-emerald-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div class="ml-4">
                  <h3 class="text-sm font-medium text-emerald-900">Account Settings</h3>
                  <p class="text-sm text-emerald-600">Manage your preferences</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Board Modal -->
  <CreateBoardModal
    :is-open="showCreateBoardModal"
    :is-creating="boardStore.isCreatingBoard"
    :error="createBoardError"
    @close="closeCreateBoardModal"
    @create="handleCreateBoard"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'
import BoardCard from '../components/boards/BoardCard.vue'
import CreateBoardModal from '../components/boards/CreateBoardModal.vue'
import type { Board } from '../services/board.service'

const router = useRouter()
const authStore = useAuthStore()
const boardStore = useBoardStore()

// Component state
const isLoggingOut = ref(false)
const showCreateBoardModal = ref(false)
const createBoardError = ref<string | null>(null)

// Computed properties
const userEmail = computed(() => authStore.user?.email || 'User')
const userName = computed(() => {
  const email = authStore.user?.email
  if (email) {
    return email.split('@')[0]
  }
  return 'User'
})

// Board management
const refreshBoards = async () => {
  try {
    await boardStore.fetchBoards()
  } catch (error) {
    console.error('Failed to refresh boards:', error)
  }
}

const handleCreateBoard = async (data: { title: string; description?: string }) => {
  createBoardError.value = null

  try {
    const newBoard = await boardStore.createBoard(data.title)
    if (newBoard) {
      closeCreateBoardModal()
      // Navigate to the new board
      router.push(`/board/${newBoard.id}`)
    }
  } catch (error: any) {
    createBoardError.value = error.message || 'Failed to create board'
    console.error('Failed to create board:', error)
  }
}

const navigateToBoard = (board: Board) => {
  router.push(`/board/${board.id}`)
}

const handleDeleteBoard = async (board: Board) => {
  try {
    await boardStore.deleteBoard(board.id)
  } catch (error: any) {
    console.error('Failed to delete board:', error)
    // Could show a toast notification here
    alert(`Failed to delete board: ${error.message || 'Unknown error'}`)
  }
}

const closeCreateBoardModal = () => {
  showCreateBoardModal.value = false
  createBoardError.value = null
}

// Logout handler
const handleLogout = async () => {
  isLoggingOut.value = true
  try {
    await authStore.logout()
    // Clear boards when logging out
    boardStore.clearBoards()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  } finally {
    isLoggingOut.value = false
  }
}

// Initialize boards on mount
onMounted(() => {
  if (authStore.isAuthenticated && !boardStore.hasBoards) {
    refreshBoards()
  }
})
</script>

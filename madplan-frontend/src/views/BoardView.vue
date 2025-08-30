<template>
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100">
    <!-- Navigation Header -->
    <nav class="bg-white shadow-sm border-b border-emerald-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <!-- Back to Dashboard -->
            <button
              @click="$router.push('/dashboard')"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 mr-4"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
            
            <!-- Board Title -->
            <div class="flex items-center">
              <svg class="w-6 h-6 text-emerald-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h1 class="text-xl font-bold text-emerald-900">
                {{ board?.title || 'Loading...' }}
              </h1>
            </div>
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
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="px-4 py-6">
      <div class="max-w-7xl mx-auto">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-20">
          <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-emerald-700">
            <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading board...
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-20">
          <div class="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
            <div class="flex flex-col items-center">
              <div class="flex-shrink-0 mb-4">
                <svg class="h-12 w-12 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-red-800 mb-2">
                Board not found
              </h3>
              <p class="text-red-700 mb-4 text-center">
                {{ error }}
              </p>
              <button
                @click="$router.push('/dashboard')"
                class="bg-red-100 px-4 py-2 text-red-800 text-sm font-medium rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        <!-- Board Content -->
        <div v-else-if="board" class="space-y-6">
          <!-- Board Header -->
          <div class="bg-white rounded-xl shadow-lg border border-emerald-200 p-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-2xl font-bold text-emerald-900 mb-2">{{ board.title }}</h2>
                <p class="text-emerald-600">Board ID: {{ board.id }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-emerald-600">{{ board.listOrder.length }} lists</p>
              </div>
            </div>
          </div>

          <!-- Lists Management -->
          <div class="space-y-4">
            <!-- Lists Container -->
            <div class="bg-white rounded-xl shadow-lg border border-emerald-200 p-6">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold text-emerald-900">Lists</h2>
                <div class="text-sm text-emerald-600">
                  {{ boardStore.listCount }} {{ boardStore.listCount === 1 ? 'list' : 'lists' }}
                </div>
              </div>

              <!-- Lists Loading State -->
              <div v-if="boardStore.isLoadingBoard" class="text-center py-12">
                <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-emerald-700">
                  <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading lists...
                </div>
              </div>

              <!-- Lists Horizontal Scroll Container -->
              <div v-else class="overflow-x-auto">
                <div class="flex space-x-4 pb-4 min-h-[300px]">
                  <!-- Existing Lists -->
                  <ListColumn
                    v-for="list in boardStore.orderedLists"
                    :key="list.id"
                    :list="list"
                    :is-updating="boardStore.isUpdatingList === list.id"
                    :is-deleting="boardStore.isDeletingList === list.id"
                    @update-title="handleUpdateList"
                    @delete="handleDeleteList"
                    class="group"
                  />

                  <!-- Create New List -->
                  <CreateListForm
                    :board-id="boardId"
                    :is-creating="boardStore.isCreatingList"
                    :error="createListError"
                    @create="handleCreateList"
                    @cancel="clearCreateListError"
                  />
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="!boardStore.isLoadingBoard && !boardStore.hasLists" class="text-center py-12">
                <svg class="mx-auto h-16 w-16 text-emerald-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 class="text-lg font-medium text-emerald-800 mb-2">No lists yet</h3>
                <p class="text-emerald-600 mb-4">Create your first list to start organizing your tasks</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'
import ListColumn from '../components/lists/ListColumn.vue'
import CreateListForm from '../components/lists/CreateListForm.vue'
import type { Board } from '../services/board.service'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const boardStore = useBoardStore()

// Component state
const board = ref<Board | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const createListError = ref<string | null>(null)

// Computed properties
const userEmail = computed(() => authStore.user?.email || 'User')
const boardId = computed(() => route.params.id as string)

// Load board data with lists
const loadBoard = async () => {
  if (!boardId.value) {
    error.value = 'Invalid board ID'
    isLoading.value = false
    return
  }

  try {
    isLoading.value = true
    error.value = null

    // Fetch board with lists using the store
    const fetchedBoard = await boardStore.fetchBoardWithLists(boardId.value)
    
    if (fetchedBoard) {
      board.value = fetchedBoard
    } else {
      error.value = 'Board not found or you do not have permission to access it.'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load board'
    console.error('Failed to load board:', err)
  } finally {
    isLoading.value = false
  }
}

// List management handlers
const handleCreateList = async (title: string) => {
  try {
    createListError.value = null
    await boardStore.createList(boardId.value, title)
  } catch (err: any) {
    createListError.value = err.message || 'Failed to create list'
    console.error('Failed to create list:', err)
  }
}

const handleUpdateList = async (listId: string, title: string) => {
  try {
    await boardStore.updateList(listId, title)
  } catch (err: any) {
    console.error('Failed to update list:', err)
    // The error will be handled by the store
  }
}

const handleDeleteList = async (listId: string) => {
  try {
    const confirmed = window.confirm('Are you sure you want to delete this list? This action cannot be undone.')
    if (confirmed) {
      await boardStore.deleteList(listId)
    }
  } catch (err: any) {
    console.error('Failed to delete list:', err)
    // The error will be handled by the store
  }
}

const clearCreateListError = () => {
  createListError.value = null
}

// Initialize board on mount
onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  loadBoard()
})
</script>
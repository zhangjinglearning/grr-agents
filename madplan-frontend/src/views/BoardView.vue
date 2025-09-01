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
            <!-- Realtime Indicators -->
            <RealtimeIndicators />
            
            <!-- Collaboration Actions -->
            <div class="flex items-center space-x-2">
              <button
                @click="showSearch = true"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              
              <button
                @click="showTemplates = true"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Templates
              </button>
              
              <button
                @click="showSharing = true"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Share
              </button>
            </div>
            
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
              <div v-else ref="scrollContainer" class="overflow-x-auto scroll-smooth">
                <VueDraggable
                  v-model="draggableLists"
                  group="lists"
                  :disabled="boardStore.isLoadingBoard || boardStore.isReorderingList"
                  item-key="id"
                  class="flex space-x-4 pb-4 min-h-[300px]"
                  ghost-class="ghost-list"
                  chosen-class="chosen-list"
                  drag-class="drag-list"
                  :animation="150"
                  :swap-threshold="0.65"
                  @start="handleListDragStart"
                  @end="handleListDragEnd"
                  @change="handleListReorder"
                >
                  <template #item="{ element: list }">
                    <ListColumn
                      :list="list"
                      :is-updating="boardStore.isUpdatingList === list.id"
                      :is-deleting="boardStore.isDeletingList === list.id"
                      :is-creating-card="boardStore.isCreatingCard === list.id"
                      :is-updating-card="boardStore.isUpdatingCard"
                      :is-deleting-card="boardStore.isDeletingCard"
                      :card-error="cardError"
                      :is-drag-over-list="boardStore.dragOverListId === list.id"
                      :dragged-card-id="boardStore.draggedCard?.id || null"
                      :is-dragging-list="boardStore.draggedList?.id === list.id"
                      @update-title="(listId: string, title: string) => handleUpdateList(listId, title)"
                      @delete="(listId: string) => handleDeleteList(listId)"
                      @create-card="(listId: string, content: string) => handleCreateCard(listId, content)"
                      @update-card="(cardId: string, content: string) => handleUpdateCard(cardId, content)"
                      @delete-card="(cardId: string) => handleDeleteCard(cardId)"
                      @card-form-cancel="clearCardError"
                      @card-drag-start="(card: any, sourceListId: string) => handleCardDragStart(card, sourceListId)"
                      @card-drag-end="handleCardDragEnd"
                      @card-reorder="(cardId: string, sourceListId: string, destListId: string, newIndex: number) => handleCardReorder(cardId, sourceListId, destListId, newIndex)"
                      class="group"
                    />
                  </template>
                  
                  <template #footer>
                    <CreateListForm
                      :board-id="boardId"
                      :is-creating="boardStore.isCreatingList"
                      :error="createListError"
                      @create="handleCreateList"
                      @cancel="clearCreateListError"
                    />
                  </template>
                </VueDraggable>
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
    
    <!-- Modals -->
    <teleport to="body">
      <!-- Global Search Modal -->
      <div v-if="showSearch" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showSearch = false"></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
          <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
            <GlobalSearch @close="showSearch = false" />
          </div>
        </div>
      </div>

      <!-- Templates Modal -->
      <div v-if="showTemplates" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showTemplates = false"></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
          <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
            <TemplateLibrary @close="showTemplates = false" />
          </div>
        </div>
      </div>

      <!-- Sharing Modal -->
      <div v-if="showSharing" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showSharing = false"></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
          <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
            <BoardSharing @close="showSharing = false" />
          </div>
        </div>
      </div>
    </teleport>

    <!-- Screen Reader Live Region for Announcements -->
    <div
      class="sr-only"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {{ screenReaderAnnouncement }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'
import { useRealtimeStore } from '../stores/realtime'
import { useCollaborationStore } from '../stores/collaboration'
import ListColumn from '../components/lists/ListColumn.vue'
import CreateListForm from '../components/lists/CreateListForm.vue'
import RealtimeIndicators from '../features/collaboration/RealtimeIndicators.vue'
import BoardSharing from '../features/collaboration/BoardSharing.vue'
import GlobalSearch from '../features/search/GlobalSearch.vue'
import TemplateLibrary from '../features/templates/TemplateLibrary.vue'
import VueDraggable from 'vuedraggable'
import type { Board } from '../services/board.service'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const realtimeStore = useRealtimeStore()
const collaborationStore = useCollaborationStore()

// Component state
const board = ref<Board | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const createListError = ref<string | null>(null)
const cardError = ref<string | null>(null)
const screenReaderAnnouncement = ref<string>('')

// Modal states
const showSearch = ref(false)
const showTemplates = ref(false)
const showSharing = ref(false)

// Computed properties
const userEmail = computed(() => authStore.user?.email || 'User')
const boardId = computed(() => route.params.id as string)

// Draggable lists computed property
const draggableLists = computed({
  get: () => boardStore.orderedLists,
  set: (value) => {
    // This will be handled by the @change event
  }
})

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

    // Fetch board with lists and cards using the store
    const fetchedBoard = await boardStore.fetchBoardWithListsAndCards(boardId.value)
    
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

// Card management handlers
const handleCreateCard = async (listId: string, content: string) => {
  try {
    cardError.value = null
    await boardStore.createCard(listId, content)
  } catch (err: any) {
    cardError.value = err.message || 'Failed to create card'
    console.error('Failed to create card:', err)
  }
}

const handleUpdateCard = async (cardId: string, content: string) => {
  try {
    await boardStore.updateCard(cardId, content)
  } catch (err: any) {
    console.error('Failed to update card:', err)
    // The error will be handled by the store
  }
}

const handleDeleteCard = async (cardId: string) => {
  try {
    const confirmed = window.confirm('Are you sure you want to delete this card?')
    if (confirmed) {
      await boardStore.deleteCard(cardId)
    }
  } catch (err: any) {
    console.error('Failed to delete card:', err)
    // The error will be handled by the store
  }
}

const clearCardError = () => {
  cardError.value = null
}

// Drag and drop handlers
const handleCardDragStart = (card: any, sourceListId: string) => {
  boardStore.startCardDrag(card, sourceListId)
}

const handleCardDragEnd = () => {
  boardStore.endCardDrag()
}

const handleCardReorder = async (cardId: string, sourceListId: string, destListId: string, newIndex: number) => {
  try {
    await boardStore.reorderCard(cardId, sourceListId, destListId, newIndex)
  } catch (err: any) {
    console.error('Failed to reorder card:', err)
    // The error will be handled by the store
  }
}

// Auto-scroll functionality
const scrollContainer = ref<HTMLElement | null>(null)
const isAutoScrolling = ref(false)
const autoScrollSpeed = 5
const scrollThreshold = 100

const handleAutoScroll = (clientX: number) => {
  if (!scrollContainer.value) return

  const containerRect = scrollContainer.value.getBoundingClientRect()
  const leftThreshold = containerRect.left + scrollThreshold
  const rightThreshold = containerRect.right - scrollThreshold

  if (clientX < leftThreshold) {
    // Scroll left
    isAutoScrolling.value = true
    const scrollLeft = () => {
      if (scrollContainer.value && isAutoScrolling.value) {
        scrollContainer.value.scrollLeft -= autoScrollSpeed
        requestAnimationFrame(scrollLeft)
      }
    }
    scrollLeft()
  } else if (clientX > rightThreshold) {
    // Scroll right
    isAutoScrolling.value = true
    const scrollRight = () => {
      if (scrollContainer.value && isAutoScrolling.value) {
        scrollContainer.value.scrollLeft += autoScrollSpeed
        requestAnimationFrame(scrollRight)
      }
    }
    scrollRight()
  } else {
    isAutoScrolling.value = false
  }
}

const stopAutoScroll = () => {
  isAutoScrolling.value = false
}

// List drag and drop handlers
const handleListDragStart = (event: any) => {
  const list = event.item.__vueParentComponent?.props?.list
  if (list) {
    boardStore.startListDrag(list)
    
    // Screen reader announcement
    screenReaderAnnouncement.value = `Started dragging list: ${list.title}`
    
    // Add mouse move listener for auto-scroll
    const handleMouseMove = (e: MouseEvent) => {
      handleAutoScroll(e.clientX)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    
    // Clean up listener on drag end
    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', cleanup)
      stopAutoScroll()
    }
    
    document.addEventListener('mouseup', cleanup)
    
    // Haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50) // Short vibration
    }
  }
}

const handleListDragEnd = () => {
  const draggedList = boardStore.draggedList
  boardStore.endListDrag()
  stopAutoScroll()
  
  // Screen reader announcement
  if (draggedList) {
    screenReaderAnnouncement.value = `Stopped dragging list: ${draggedList.title}`
  }
  
  // Success haptic feedback for mobile devices
  if (navigator.vibrate) {
    navigator.vibrate([50, 50, 50]) // Triple short vibration pattern
  }
}

const handleListReorder = async (event: any) => {
  if (event.moved) {
    const { element: list, newIndex } = event.moved
    try {
      await boardStore.reorderList(list.id, newIndex)
      
      // Screen reader announcement
      screenReaderAnnouncement.value = `Moved list "${list.title}" to position ${newIndex + 1}`
      
      // Success feedback
      if (navigator.vibrate) {
        navigator.vibrate(100) // Confirmation vibration
      }
    } catch (err: any) {
      console.error('Failed to reorder list:', err)
      
      // Error announcement
      screenReaderAnnouncement.value = `Failed to move list "${list.title}". Please try again.`
      
      // Error feedback
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]) // Error vibration pattern
      }
    }
  }
}

// Initialize board on mount
onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  await loadBoard()
  await initializeRealtime()
})

onUnmounted(() => {
  realtimeStore.leaveBoard()
  realtimeStore.disconnect()
})

// Initialize realtime features
const initializeRealtime = async () => {
  try {
    await realtimeStore.connect()
    await realtimeStore.joinBoard(boardId.value)
    
    // Set up realtime event handlers
    realtimeStore.onBoardUpdated((data) => {
      if (data.boardId === boardId.value) {
        boardStore.handleBoardUpdate(data)
      }
    })

    realtimeStore.onListChanged((data) => {
      boardStore.handleListChange(data)
    })

    realtimeStore.onCardChanged((data) => {
      boardStore.handleCardChange(data)
    })
  } catch (error) {
    console.error('Failed to initialize realtime:', error)
  }
}
</script>

<style scoped>
/* List drag-and-drop styles */
.ghost-list {
  @apply opacity-30 bg-emerald-50 border-emerald-300 border-dashed;
}

.chosen-list {
  @apply opacity-90 shadow-xl scale-105 rotate-2;
  transform-origin: center;
}

.drag-list {
  @apply opacity-80 shadow-2xl scale-110 rotate-3 z-50;
  transform-origin: center;
}

/* Smooth transitions for list movement */
.flip-list-move {
  transition: transform 0.5s;
}

/* Auto-scroll visual feedback */
.auto-scroll-indicator {
  @apply absolute top-1/2 transform -translate-y-1/2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center opacity-75 z-10;
}

.auto-scroll-left {
  @apply left-2;
}

.auto-scroll-right {
  @apply right-2;
}

/* Enhanced mobile drag feedback */
@media (hover: none) and (pointer: coarse) {
  .ghost-list {
    @apply opacity-50 scale-95 border-4; /* Enhanced visual feedback for touch */
  }

  .chosen-list {
    @apply opacity-95 shadow-2xl scale-110; /* More dramatic feedback for touch */
  }

  .drag-list {
    @apply opacity-85 shadow-2xl scale-115 z-50; /* Enhanced drag state for touch */
  }

  /* Larger touch targets and improved spacing */
  .flex.space-x-4 {
    @apply space-x-6; /* More space between lists for easier touch interaction */
  }

  /* Enhanced scroll indicators for touch */
  .overflow-x-auto {
    scrollbar-width: thick;
  }

  .overflow-x-auto::-webkit-scrollbar {
    height: 12px;
  }

  .overflow-x-auto::-webkit-scrollbar-thumb {
    @apply bg-emerald-400 rounded-full;
  }

  .overflow-x-auto::-webkit-scrollbar-track {
    @apply bg-emerald-100;
  }
}

/* Accessibility enhancements */
@media (prefers-reduced-motion: reduce) {
  .flip-list-move,
  .transition-all,
  .scroll-smooth {
    @apply transition-none;
  }

  /* Disable transforms that might cause motion sensitivity */
  .ghost-list,
  .chosen-list,
  .drag-list {
    @apply transform-none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .border-emerald-300 {
    @apply border-emerald-800 border-4;
  }

  .bg-emerald-50 {
    @apply bg-emerald-200;
  }

  .shadow-xl,
  .shadow-2xl {
    @apply shadow-black;
  }
}

/* Focus styles for keyboard navigation */
.vue-draggable:focus-within {
  @apply ring-2 ring-emerald-500 ring-offset-2;
}

/* Screen reader announcements */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Performance optimizations */
.will-change-transform {
  will-change: transform;
}

/* Smooth scrolling enhancement */
.scroll-smooth {
  scroll-behavior: smooth;
}
</style>
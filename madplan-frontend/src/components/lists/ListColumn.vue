<template>
  <div 
    class="bg-white rounded-lg shadow-sm border border-emerald-200 w-80 flex-shrink-0"
    :class="[
      isDragOverList ? 'border-emerald-400 bg-emerald-50' : '',
      isDraggingList ? 'opacity-90 shadow-xl scale-105 rotate-2' : '',
      'transition-all duration-200'
    ]"
  >
    <!-- List Header -->
    <div class="p-4 border-b border-emerald-100">
      <div class="flex items-center justify-between">
        <!-- Drag Handle -->
        <ListDragHandle
          v-if="!isEditing"
          :list-title="list.title"
          :is-dragging="isDraggingList"
          :disabled="isUpdating || isDeleting"
          class="mr-3"
        />
        
        <!-- List Title -->
        <div class="flex-1 mr-2">
          <div v-if="!isEditing" class="flex items-center">
            <h3 
              class="text-lg font-semibold text-emerald-900 cursor-pointer hover:text-emerald-700 transition-colors"
              @click="startEdit"
              @dblclick="startEdit"
            >
              {{ list.title }}
            </h3>
            <button
              @click="startEdit"
              class="ml-2 p-1 text-emerald-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit list title"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
          
          <!-- Edit Mode -->
          <div v-else class="flex items-center">
            <input
              ref="titleInput"
              v-model="editTitle"
              @keyup.enter="saveTitle"
              @keyup.escape="cancelEdit"
              @blur="saveTitle"
              class="flex-1 px-2 py-1 text-lg font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              :disabled="isUpdating"
            />
            <div class="ml-2 flex space-x-1">
              <button
                @click="saveTitle"
                :disabled="isUpdating || !editTitle.trim()"
                class="p-1 text-emerald-600 hover:text-emerald-800 disabled:text-emerald-400 disabled:cursor-not-allowed"
                title="Save"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                @click="cancelEdit"
                :disabled="isUpdating"
                class="p-1 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                title="Cancel"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <!-- List Actions -->
        <div v-if="!isEditing" class="flex items-center space-x-1">
          <button
            @click="$emit('delete', list.id)"
            :disabled="isDeleting"
            class="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:cursor-not-allowed"
            title="Delete list"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Loading indicator for title update -->
      <div v-if="isUpdating" class="mt-2">
        <div class="flex items-center text-sm text-emerald-600">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Updating...
        </div>
      </div>
    </div>

    <!-- List Content -->
    <div class="p-4 min-h-[200px] flex flex-col">
      <!-- Cards Area -->
      <div class="flex-1 mb-3">
        <!-- Draggable Cards List -->
        <draggable
          v-model="draggableCards"
          group="cards"
          :disabled="isUpdating || isDeleting"
          item-key="id"
          class="space-y-2 min-h-[100px]"
          :class="[
            isDragOverList && orderedCards.length === 0 ? 'border-2 border-dashed border-emerald-400 rounded-lg p-4' : ''
          ]"
          ghost-class="ghost-card"
          chosen-class="chosen-card"
          drag-class="drag-card"
          @start="handleDragStart"
          @end="handleDragEnd"
          @change="handleCardChange"
        >
          <template #item="{ element: card }">
            <CardItem
              :key="card.id"
              :card="card"
              :list-id="list.id"
              :is-updating="isUpdatingCard === card.id"
              :is-deleting="isDeletingCard === card.id"
              :is-dragging="draggedCardId === card.id"
              @update-content="(cardId, content) => $emit('update-card', cardId, content)"
              @delete="$emit('delete-card', $event)"
              @drag-start="handleCardDragStart"
              @drag-end="handleCardDragEnd"
            />
          </template>
          
          <!-- Empty state when no cards -->
          <template #header v-if="orderedCards.length === 0">
            <div 
              class="text-center py-8"
              role="region"
              :aria-label="isDragOverList ? 'Drop zone for cards' : 'Empty list'"
            >
              <svg class="mx-auto h-8 w-8 text-emerald-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-emerald-500 text-sm">
                {{ isDragOverList ? 'Drop card here' : 'No cards yet' }}
              </p>
              <!-- Screen reader announcement for drag state -->
              <div class="sr-only" aria-live="polite" aria-atomic="true">
                {{ isDragOverList ? 'Drop zone active for card placement' : '' }}
              </div>
            </div>
          </template>
        </draggable>
      </div>

      <!-- Create Card Form -->
      <CreateCardForm
        :list-id="list.id"
        :is-creating="isCreatingCard"
        :error="cardError"
        @create="(listId, content) => $emit('create-card', listId, content)"
        @cancel="$emit('card-form-cancel')"
      />
    </div>

    <!-- Delete confirmation overlay -->
    <div v-if="isDeleting" class="absolute inset-0 bg-red-50 bg-opacity-90 rounded-lg flex items-center justify-center">
      <div class="text-center p-4">
        <div class="flex items-center justify-center mb-2">
          <svg class="animate-spin h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-red-700 font-medium">Deleting list...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import draggable from 'vuedraggable'
import CardItem from '../cards/CardItem.vue'
import CreateCardForm from '../cards/CreateCardForm.vue'
import ListDragHandle from './ListDragHandle.vue'
import type { List, Card } from '../../services/board.service'

interface Props {
  list: List
  isUpdating?: boolean
  isDeleting?: boolean
  isCreatingCard?: boolean
  isUpdatingCard?: string | null
  isDeletingCard?: string | null
  cardError?: string | null
  isDragOverList?: boolean
  draggedCardId?: string | null
  isDraggingList?: boolean
}

interface Emits {
  (event: 'update-title', listId: string, title: string): void
  (event: 'delete', listId: string): void
  (event: 'create-card', listId: string, content: string): void
  (event: 'update-card', cardId: string, content: string): void
  (event: 'delete-card', cardId: string): void
  (event: 'card-form-cancel'): void
  (event: 'card-drag-start', card: Card, sourceListId: string): void
  (event: 'card-drag-end'): void
  (event: 'card-reorder', cardId: string, sourceListId: string, destListId: string, newIndex: number): void
}

const props = withDefaults(defineProps<Props>(), {
  isUpdating: false,
  isDeleting: false,
  isCreatingCard: false,
  isUpdatingCard: null,
  isDeletingCard: null,
  cardError: null,
  isDragOverList: false,
  draggedCardId: null,
  isDraggingList: false
})

const emit = defineEmits<Emits>()

// Component state
const isEditing = ref(false)
const editTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

// Computed properties
const orderedCards = computed((): Card[] => {
  if (!props.list.cards || !props.list.cardOrder) return []
  
  const cardMap = new Map(props.list.cards.map(card => [card.id, card]))
  return props.list.cardOrder
    .map(cardId => cardMap.get(cardId))
    .filter((card): card is Card => card !== undefined)
})

// Draggable cards - computed getter/setter for v-model
const draggableCards = computed({
  get: () => orderedCards.value,
  set: (value: Card[]) => {
    // This will be handled by the change event
  }
})

// Start editing mode
const startEdit = async () => {
  if (props.isUpdating || props.isDeleting) return
  
  isEditing.value = true
  editTitle.value = props.list.title
  
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

// Save title changes
const saveTitle = () => {
  const newTitle = editTitle.value.trim()
  
  if (!newTitle) {
    cancelEdit()
    return
  }
  
  if (newTitle === props.list.title) {
    cancelEdit()
    return
  }
  
  emit('update-title', props.list.id, newTitle)
  isEditing.value = false
}

// Cancel editing
const cancelEdit = () => {
  isEditing.value = false
  editTitle.value = ''
}

// Drag and drop handlers
const handleDragStart = (evt: any) => {
  // Called when dragging starts within this list
}

const handleDragEnd = (evt: any) => {
  // Called when dragging ends
}

const handleCardChange = (evt: any) => {
  if (evt.added) {
    // Card was dropped into this list from another list
    const { element: card, newIndex } = evt.added
    const sourceListId = card.listId // Original list ID
    emit('card-reorder', card.id, sourceListId, props.list.id, newIndex)
  } else if (evt.moved) {
    // Card was reordered within this list
    const { element: card, newIndex } = evt.moved
    emit('card-reorder', card.id, props.list.id, props.list.id, newIndex)
  }
  // evt.removed is handled by the source list
}

const handleCardDragStart = (card: Card, sourceListId: string) => {
  emit('card-drag-start', card, sourceListId)
}

const handleCardDragEnd = () => {
  emit('card-drag-end')
}
</script>

<style scoped>
/* Add hover effect for the entire list column */
.group:hover .opacity-0 {
  @apply opacity-100;
}

/* Drag and drop styles */
.ghost-card {
  @apply opacity-50 bg-emerald-50 border-emerald-300 border-dashed;
}

.chosen-card {
  @apply opacity-90 shadow-lg scale-105 rotate-2;
}

.drag-card {
  @apply opacity-80 shadow-2xl scale-110 rotate-3 z-50;
}

/* Drop zone highlighting */
.drag-over {
  @apply border-emerald-400 bg-emerald-50;
}

/* Smooth transitions */
.sortable-ghost {
  opacity: 0.4;
}

.sortable-chosen {
  opacity: 0.9;
}

.sortable-drag {
  opacity: 0.8;
}

/* Mobile and touch optimizations */
@media (hover: none) and (pointer: coarse) {
  /* Larger drop zones for touch */
  .min-h-[100px] {
    @apply min-h-[120px]; /* Larger minimum height for easier touch targeting */
  }
  
  /* Enhanced drag feedback for touch devices */
  .border-dashed {
    @apply border-4; /* Thicker borders for better visibility */
  }
  
  /* Larger touch targets */
  button {
    @apply min-w-[44px] min-h-[44px] p-3; /* WCAG recommended touch target size */
  }
}

/* Screen reader only class for announcements */
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

/* Focus styles for accessibility */
.draggable:focus-within {
  @apply ring-2 ring-emerald-500 ring-offset-2;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .border-emerald-400 {
    @apply border-emerald-800 border-4;
  }
  
  .bg-emerald-50 {
    @apply bg-emerald-100;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transition-colors,
  .transition-all {
    @apply transition-none;
  }
  
  .ghost-card,
  .chosen-card,
  .drag-card {
    @apply transform-none; /* Remove transforms for reduced motion */
  }
}
</style>
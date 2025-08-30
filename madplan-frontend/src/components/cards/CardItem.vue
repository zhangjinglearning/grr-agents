<template>
  <div 
    class="bg-white rounded-lg border border-emerald-200 shadow-sm hover:shadow-md transition-all group relative cursor-grab"
    :class="[
      isDragging ? 'opacity-50 shadow-lg rotate-2 scale-105 cursor-grabbing' : '',
      'transition-all duration-200'
    ]"
    draggable="true"
    :tabindex="isEditing ? -1 : 0"
    role="button"
    :aria-label="`Card: ${card.content}. Press Enter to edit, Delete to remove, or use drag handles to reorder.`"
    :aria-describedby="`card-${card.id}-description`"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragover.prevent
    @click="handleCardClick"
    @keydown="handleKeydown"
  >
    <!-- Card Content -->
    <div class="p-3">
      <!-- View Mode -->
      <div v-if="!isEditing" class="flex items-start justify-between">
        <div class="flex-1 mr-2">
          <p 
            class="text-gray-700 text-sm leading-relaxed break-words cursor-pointer"
            @dblclick="startEdit"
            :title="card.content"
            :id="`card-${card.id}-description`"
          >
            {{ card.content }}
          </p>
        </div>
        
        <!-- Card Actions (show on hover) -->
        <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            @click="startEdit"
            class="p-1 text-emerald-400 hover:text-emerald-600 rounded"
            title="Edit card"
            :disabled="isUpdating || isDeleting"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            @click="handleDelete"
            class="p-1 text-gray-400 hover:text-red-600 rounded"
            title="Delete card"
            :disabled="isUpdating || isDeleting"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Edit Mode -->
      <div v-else class="space-y-2">
        <textarea
          ref="contentInput"
          v-model="editContent"
          @keydown.enter.meta="saveContent"
          @keydown.enter.ctrl="saveContent"
          @keydown.escape="cancelEdit"
          class="w-full px-2 py-1 text-sm text-gray-700 bg-emerald-50 border border-emerald-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          :disabled="isUpdating"
          placeholder="Enter card content..."
          rows="2"
        ></textarea>
        
        <!-- Edit Actions -->
        <div class="flex justify-end space-x-2">
          <button
            @click="saveContent"
            :disabled="isUpdating || !editContent.trim()"
            class="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!isUpdating">Save</span>
            <span v-else class="flex items-center">
              <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          </button>
          <button
            @click="cancelEdit"
            :disabled="isUpdating"
            class="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation overlay -->
    <div v-if="showDeleteConfirm" class="absolute inset-0 bg-red-50 bg-opacity-95 rounded-lg flex items-center justify-center">
      <div class="text-center p-3">
        <p class="text-red-700 font-medium text-sm mb-3">Delete this card?</p>
        <div class="flex space-x-2 justify-center">
          <button
            @click="confirmDelete"
            :disabled="isDeleting"
            class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!isDeleting">Delete</span>
            <span v-else class="flex items-center">
              <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Deleting...
            </span>
          </button>
          <button
            @click="cancelDelete"
            :disabled="isDeleting"
            class="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Loading overlay for updates -->
    <div v-if="isUpdating && !isEditing" class="absolute inset-0 bg-emerald-50 bg-opacity-75 rounded-lg flex items-center justify-center">
      <div class="flex items-center text-sm text-emerald-600">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Updating...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { Card } from '../../services/board.service'

interface Props {
  card: Card
  listId: string
  isUpdating?: boolean
  isDeleting?: boolean
  isDragging?: boolean
}

interface Emits {
  (event: 'update-content', cardId: string, content: string): void
  (event: 'delete', cardId: string): void
  (event: 'drag-start', card: Card, listId: string): void
  (event: 'drag-end'): void
}

const props = withDefaults(defineProps<Props>(), {
  isUpdating: false,
  isDeleting: false,
  isDragging: false
})

const emit = defineEmits<Emits>()

// Component state
const isEditing = ref(false)
const editContent = ref('')
const showDeleteConfirm = ref(false)
const contentInput = ref<HTMLTextAreaElement | null>(null)

// Start editing mode
const startEdit = async () => {
  if (props.isUpdating || props.isDeleting) return
  
  isEditing.value = true
  editContent.value = props.card.content
  
  await nextTick()
  contentInput.value?.focus()
  contentInput.value?.select()
  
  // Auto-resize textarea
  if (contentInput.value) {
    contentInput.value.style.height = 'auto'
    contentInput.value.style.height = `${contentInput.value.scrollHeight}px`
  }
}

// Save content changes
const saveContent = () => {
  const newContent = editContent.value.trim()
  
  if (!newContent) {
    cancelEdit()
    return
  }
  
  if (newContent === props.card.content) {
    cancelEdit()
    return
  }
  
  emit('update-content', props.card.id, newContent)
  isEditing.value = false
}

// Cancel editing
const cancelEdit = () => {
  isEditing.value = false
  editContent.value = ''
}

// Handle delete button click
const handleDelete = () => {
  if (props.isUpdating || props.isDeleting) return
  showDeleteConfirm.value = true
}

// Confirm delete
const confirmDelete = () => {
  emit('delete', props.card.id)
  showDeleteConfirm.value = false
}

// Cancel delete
const cancelDelete = () => {
  showDeleteConfirm.value = false
}

// Auto-resize textarea on input
const handleTextareaInput = () => {
  if (contentInput.value) {
    contentInput.value.style.height = 'auto'
    contentInput.value.style.height = `${contentInput.value.scrollHeight}px`
  }
}

// Handle card click (start edit only if not dragging)
const handleCardClick = (event: MouseEvent) => {
  // Don't start edit if we're in the middle of a drag operation
  // or if clicking on action buttons
  const target = event.target as HTMLElement
  const isButton = target.closest('button')
  
  if (!props.isDragging && !isButton && !isEditing.value) {
    startEdit()
  }
}

// Handle drag start
const handleDragStart = (event: DragEvent) => {
  // Don't allow dragging if editing or in loading state
  if (isEditing.value || props.isUpdating || props.isDeleting || showDeleteConfirm.value) {
    event.preventDefault()
    return
  }

  // Set drag data
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', props.card.id)
    event.dataTransfer.setData('application/json', JSON.stringify({
      cardId: props.card.id,
      sourceListId: props.listId
    }))
  }

  emit('drag-start', props.card, props.listId)
}

// Handle drag end
const handleDragEnd = (event: DragEvent) => {
  emit('drag-end')
}

// Handle keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  // Skip if editing or disabled
  if (isEditing.value || props.isUpdating || props.isDeleting || showDeleteConfirm.value) {
    return
  }

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      startEdit()
      break
    case 'Delete':
    case 'Backspace':
      event.preventDefault()
      handleDelete()
      break
    case 'Escape':
      if (showDeleteConfirm.value) {
        event.preventDefault()
        cancelDelete()
      }
      break
  }
}
</script>

<style scoped>
/* Card hover effects */
.group:hover {
  @apply shadow-md;
}

/* Textarea auto-resize */
textarea {
  min-height: 2.5rem;
  max-height: 8rem;
  overflow-y: auto;
}

/* Mobile and touch optimizations */
@media (hover: none) and (pointer: coarse) {
  /* Touch device specific styles */
  .group {
    @apply p-4; /* Larger padding for easier touch targets */
  }
  
  .group:hover {
    @apply shadow-sm; /* Reduce hover effects on touch */
  }
  
  /* Larger touch targets for buttons */
  button {
    @apply min-w-[44px] min-h-[44px]; /* WCAG recommended minimum touch target size */
  }
  
  /* Enhanced drag feedback for touch */
  .cursor-grab {
    @apply cursor-pointer; /* Better cursor for touch */
  }
}

/* Focus styles for accessibility */
[tabindex="0"]:focus {
  @apply outline-none ring-2 ring-emerald-500 ring-offset-2;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .bg-white {
    @apply border-2 border-gray-800;
  }
  
  .text-emerald-600 {
    @apply text-emerald-800;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    @apply transition-none;
  }
}
</style>
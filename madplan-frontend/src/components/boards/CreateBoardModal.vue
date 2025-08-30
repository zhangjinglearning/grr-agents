<template>
  <!-- Modal Backdrop -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
    @click.self="handleClose"
  >
    <!-- Modal Content -->
    <div 
      class="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-emerald-200 transform transition-all"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-emerald-100">
        <h3 id="modal-title" class="text-xl font-semibold text-emerald-900">
          Create New Board
        </h3>
        <button
          @click="handleClose"
          class="text-emerald-400 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg p-1 transition-colors duration-200"
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <form @submit.prevent="handleSubmit" class="p-6">
        <div class="mb-6">
          <label for="boardTitle" class="block text-sm font-medium text-emerald-700 mb-2">
            Board Title
          </label>
          <input
            id="boardTitle"
            ref="titleInput"
            v-model="boardTitle"
            type="text"
            required
            maxlength="100"
            class="w-full px-4 py-3 border border-emerald-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors duration-200"
            placeholder="Enter board title..."
            :disabled="isCreating"
          />
          
          <!-- Character Count -->
          <div class="flex justify-between items-center mt-2">
            <p v-if="error" class="text-sm text-red-600">
              {{ error }}
            </p>
            <div class="flex-1"></div>
            <p class="text-xs text-emerald-500">
              {{ boardTitle.length }}/100
            </p>
          </div>
        </div>

        <!-- Board Description (Optional Enhancement) -->
        <div class="mb-6">
          <label for="boardDescription" class="block text-sm font-medium text-emerald-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            id="boardDescription"
            v-model="boardDescription"
            rows="3"
            maxlength="500"
            class="w-full px-4 py-3 border border-emerald-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors duration-200 resize-none"
            placeholder="What's this board for?"
            :disabled="isCreating"
          />
          <p class="text-xs text-emerald-500 mt-1">
            {{ boardDescription.length }}/500
          </p>
        </div>

        <!-- Modal Actions -->
        <div class="flex items-center justify-end space-x-3">
          <button
            type="button"
            @click="handleClose"
            :disabled="isCreating"
            class="px-6 py-3 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isCreating || !boardTitle.trim()"
            class="px-6 py-3 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
          >
            <svg 
              v-if="isCreating"
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isCreating ? 'Creating...' : 'Create Board' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

interface Props {
  isOpen: boolean
  isCreating?: boolean
  error?: string | null
}

interface Emits {
  (event: 'close'): void
  (event: 'create', data: { title: string; description?: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  isCreating: false,
  error: null
})

const emit = defineEmits<Emits>()

// Component state
const boardTitle = ref('')
const boardDescription = ref('')
const titleInput = ref<HTMLInputElement>()

// Watchers
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Focus the title input when modal opens
    await nextTick()
    titleInput.value?.focus()
  } else {
    // Reset form when modal closes
    boardTitle.value = ''
    boardDescription.value = ''
  }
})

// Event handlers
const handleClose = () => {
  if (!props.isCreating) {
    emit('close')
  }
}

const handleSubmit = () => {
  const title = boardTitle.value.trim()
  const description = boardDescription.value.trim()
  
  if (!title) {
    return
  }

  emit('create', {
    title,
    description: description || undefined
  })
}

// Handle escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.isOpen && !props.isCreating) {
    handleClose()
  }
}

// Add event listener for escape key
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}
</script>
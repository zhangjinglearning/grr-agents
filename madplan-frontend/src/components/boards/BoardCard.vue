<template>
  <div
    @click="handleClick"
    @keypress.enter="handleClick"
    tabindex="0"
    class="group cursor-pointer bg-white border-2 border-emerald-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-1"
    role="button"
    :aria-label="`Open board: ${board.title}`"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <h4 class="text-lg font-semibold text-emerald-900 truncate group-hover:text-emerald-800">
          {{ board.title }}
        </h4>
        <p class="text-sm text-emerald-600 mt-1">
          {{ listCountText }}
        </p>
        <p v-if="showCreatedDate" class="text-xs text-emerald-500 mt-1">
          Created {{ createdDateText }}
        </p>
      </div>
      <div class="flex-shrink-0 ml-4">
        <svg class="w-6 h-6 text-emerald-400 group-hover:text-emerald-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
    
    <!-- Board Actions -->
    <div class="mt-4 pt-4 border-t border-emerald-100">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-xs text-emerald-600">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Click to open
        </div>
        
        <!-- Board Options -->
        <div class="flex items-center space-x-2">
          <button
            v-if="showDeleteButton"
            @click.stop="handleDelete"
            :disabled="isDeleting"
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
            :aria-label="`Delete board: ${board.title}`"
          >
            <svg 
              :class="{ 'animate-spin': isDeleting }"
              class="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path v-if="!isDeleting" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          
          <div class="w-2 h-2 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Board } from '../../services/board.service'

interface Props {
  board: Board
  showDeleteButton?: boolean
  showCreatedDate?: boolean
  isDeleting?: boolean
}

interface Emits {
  (event: 'click', board: Board): void
  (event: 'delete', board: Board): void
}

const props = withDefaults(defineProps<Props>(), {
  showDeleteButton: false,
  showCreatedDate: false,
  isDeleting: false
})

const emit = defineEmits<Emits>()

// Computed properties
const listCountText = computed(() => {
  const count = props.board.listOrder.length
  return count === 1 ? '1 list' : `${count} lists`
})

const createdDateText = computed(() => {
  // This would be calculated from a createdAt date if available
  // For now, just return a placeholder
  return 'recently'
})

// Event handlers
const handleClick = () => {
  emit('click', props.board)
}

const handleDelete = async (event: Event) => {
  event.stopPropagation()
  
  // Show confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete the board "${props.board.title}"? This action cannot be undone.`)
  
  if (confirmed) {
    emit('delete', props.board)
  }
}
</script>
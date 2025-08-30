<template>
  <div class="bg-white rounded-lg shadow-sm border border-emerald-200 w-80 flex-shrink-0">
    <!-- List Header -->
    <div class="p-4 border-b border-emerald-100">
      <div class="flex items-center justify-between">
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
      <div class="flex-1 space-y-2 mb-3">
        <!-- Cards List -->
        <div v-if="orderedCards.length > 0" class="space-y-2">
          <CardItem
            v-for="card in orderedCards"
            :key="card.id"
            :card="card"
            :is-updating="isUpdatingCard === card.id"
            :is-deleting="isDeletingCard === card.id"
            @update-content="(cardId, content) => $emit('update-card', cardId, content)"
            @delete="$emit('delete-card', $event)"
          />
        </div>
        
        <!-- Empty state -->
        <div v-else class="text-center py-8">
          <svg class="mx-auto h-8 w-8 text-emerald-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-emerald-500 text-sm">No cards yet</p>
        </div>
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
import CardItem from '../cards/CardItem.vue'
import CreateCardForm from '../cards/CreateCardForm.vue'
import type { List, Card } from '../../services/board.service'

interface Props {
  list: List
  isUpdating?: boolean
  isDeleting?: boolean
  isCreatingCard?: boolean
  isUpdatingCard?: string | null
  isDeletingCard?: string | null
  cardError?: string | null
}

interface Emits {
  (event: 'update-title', listId: string, title: string): void
  (event: 'delete', listId: string): void
  (event: 'create-card', listId: string, content: string): void
  (event: 'update-card', cardId: string, content: string): void
  (event: 'delete-card', cardId: string): void
  (event: 'card-form-cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  isUpdating: false,
  isDeleting: false,
  isCreatingCard: false,
  isUpdatingCard: null,
  isDeletingCard: null,
  cardError: null
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
</script>

<style scoped>
/* Add hover effect for the entire list column */
.group:hover .opacity-0 {
  @apply opacity-100;
}
</style>
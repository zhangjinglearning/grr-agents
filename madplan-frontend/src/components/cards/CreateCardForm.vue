<template>
  <div class="border-t border-emerald-100 pt-3">
    <!-- Add Card Button (collapsed state) -->
    <div v-if="!isExpanded" class="flex items-center">
      <button
        @click="expand"
        :disabled="isCreating"
        class="flex items-center w-full px-3 py-2 text-sm text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add a card
      </button>
    </div>

    <!-- Create Card Form (expanded state) -->
    <div v-else class="space-y-3">
      <div class="space-y-2">
        <textarea
          ref="contentInput"
          v-model="newCardContent"
          @keydown.enter.meta="handleSubmit"
          @keydown.enter.ctrl="handleSubmit"
          @keydown.escape="collapse"
          @input="handleTextareaInput"
          class="w-full px-3 py-2 text-sm text-gray-700 bg-white border border-emerald-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-400"
          :disabled="isCreating"
          placeholder="Enter a title for this card..."
          rows="2"
        ></textarea>
        
        <!-- Character count and validation -->
        <div class="flex items-center justify-between text-xs">
          <div class="text-gray-500">
            {{ newCardContent.length }}/1000 characters
          </div>
          <div v-if="validationError" class="text-red-600">
            {{ validationError }}
          </div>
        </div>
      </div>
      
      <!-- Form Actions -->
      <div class="flex items-center space-x-2">
        <button
          @click="handleSubmit"
          :disabled="!canSubmit || isCreating"
          class="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          <span v-if="!isCreating">Add card</span>
          <span v-else class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Adding...
          </span>
        </button>
        
        <button
          @click="collapse"
          :disabled="isCreating"
          class="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors disabled:cursor-not-allowed"
          title="Cancel"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Error display -->
    <div v-if="error && isExpanded" class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-700">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

interface Props {
  listId: string
  isCreating?: boolean
  error?: string | null
}

interface Emits {
  (event: 'create', listId: string, content: string): void
  (event: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  isCreating: false,
  error: null
})

const emit = defineEmits<Emits>()

// Component state
const isExpanded = ref(false)
const newCardContent = ref('')
const contentInput = ref<HTMLTextAreaElement | null>(null)

// Validation
const validationError = computed(() => {
  if (!newCardContent.value.trim()) {
    return 'Card content is required'
  }
  if (newCardContent.value.length > 1000) {
    return 'Card content must be less than 1000 characters'
  }
  return null
})

const canSubmit = computed(() => {
  return newCardContent.value.trim() && !validationError.value && !props.isCreating
})

// Expand form
const expand = async () => {
  isExpanded.value = true
  await nextTick()
  contentInput.value?.focus()
}

// Collapse form
const collapse = () => {
  isExpanded.value = false
  newCardContent.value = ''
  emit('cancel')
}

// Handle form submission
const handleSubmit = () => {
  if (!canSubmit.value) return
  
  const content = newCardContent.value.trim()
  emit('create', props.listId, content)
  newCardContent.value = ''
}

// Auto-resize textarea
const handleTextareaInput = () => {
  if (contentInput.value) {
    contentInput.value.style.height = 'auto'
    contentInput.value.style.height = `${contentInput.value.scrollHeight}px`
  }
}

// Watch for successful creation to collapse form
watch(() => props.isCreating, (newVal, oldVal) => {
  // If it was creating and now it's not (successful creation)
  if (oldVal && !newVal && !props.error) {
    collapse()
  }
})

// Auto-expand on error
watch(() => props.error, (error) => {
  if (error && !isExpanded.value) {
    expand()
  }
})
</script>

<style scoped>
/* Textarea auto-resize */
textarea {
  min-height: 2.5rem;
  max-height: 8rem;
  overflow-y: auto;
}

/* Focus styles for better UX */
textarea:focus {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

/* Animation for expand/collapse */
.form-transition {
  transition: all 0.2s ease-in-out;
}
</style>
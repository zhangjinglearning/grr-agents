<template>
  <div class="bg-emerald-50 rounded-lg border-2 border-dashed border-emerald-300 w-80 flex-shrink-0 flex items-center justify-center min-h-[200px] transition-all hover:border-emerald-400 hover:bg-emerald-100">
    <!-- Add List Button (collapsed state) -->
    <div v-if="!isExpanded && !isCreating" class="text-center p-6">
      <button
        @click="expand"
        class="flex flex-col items-center space-y-2 text-emerald-600 hover:text-emerald-700 transition-colors group"
      >
        <div class="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center group-hover:bg-emerald-300 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <span class="text-sm font-medium">Add a list</span>
      </button>
    </div>

    <!-- Create List Form (expanded state) -->
    <div v-else-if="isExpanded || isCreating" class="w-full p-4">
      <div class="bg-white rounded-lg shadow-sm border border-emerald-200 p-4">
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Title Input -->
          <div>
            <label for="list-title" class="block text-sm font-medium text-emerald-800 mb-1">
              List title
            </label>
            <input
              id="list-title"
              ref="titleInput"
              v-model="title"
              type="text"
              placeholder="Enter list title..."
              maxlength="100"
              :disabled="isCreating"
              class="w-full px-3 py-2 border border-emerald-300 rounded-md shadow-sm placeholder-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
              required
            />
            <div class="mt-1 flex justify-between">
              <div v-if="titleError" class="text-red-600 text-xs">
                {{ titleError }}
              </div>
              <div class="text-xs text-emerald-500 ml-auto">
                {{ title.length }}/100
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-between items-center pt-2">
            <button
              type="button"
              @click="cancel"
              :disabled="isCreating"
              class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              :disabled="isCreating || !isValidTitle"
              class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              <span v-if="!isCreating">Add List</span>
              <span v-else class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            </button>
          </div>
        </form>

        <!-- Error Message -->
        <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">
                Failed to create list
              </h3>
              <div class="mt-1 text-sm text-red-700">
                {{ error }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

interface Props {
  boardId: string
  isCreating?: boolean
  error?: string | null
}

interface Emits {
  (event: 'create', title: string): void
  (event: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  isCreating: false,
  error: null
})

const emit = defineEmits<Emits>()

// Component state
const isExpanded = ref(false)
const title = ref('')
const titleError = ref<string | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)

// Computed properties
const isValidTitle = computed(() => {
  const trimmedTitle = title.value.trim()
  return trimmedTitle.length >= 1 && trimmedTitle.length <= 100
})

// Watch for title changes to clear error
watch(title, () => {
  if (titleError.value) {
    titleError.value = null
  }
})

// Watch for creation completion to reset form
watch(() => props.isCreating, (isCreating, wasCreating) => {
  if (wasCreating && !isCreating && !props.error) {
    // Successfully created - reset form
    reset()
  }
})

// Expand form
const expand = async () => {
  isExpanded.value = true
  await nextTick()
  titleInput.value?.focus()
}

// Handle form submission
const handleSubmit = () => {
  const trimmedTitle = title.value.trim()
  
  // Validate title
  if (!trimmedTitle) {
    titleError.value = 'List title is required'
    titleInput.value?.focus()
    return
  }
  
  if (trimmedTitle.length > 100) {
    titleError.value = 'List title must be 100 characters or less'
    titleInput.value?.focus()
    return
  }
  
  // Clear any previous error
  titleError.value = null
  
  // Emit create event
  emit('create', trimmedTitle)
}

// Cancel form
const cancel = () => {
  reset()
  emit('cancel')
}

// Reset form state
const reset = () => {
  isExpanded.value = false
  title.value = ''
  titleError.value = null
}

// Handle escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isExpanded.value) {
    cancel()
  }
}

// Add keyboard listener when component mounts
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}

// Clean up listener when component unmounts
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<style scoped>
/* Custom styles for the dashed border animation */
.border-dashed {
  background-image: linear-gradient(to right, currentColor 50%, transparent 50%);
  background-size: 10px 1px;
  background-repeat: repeat-x;
  background-position: top;
}
</style>
<template>
  <div 
    class="list-drag-handle"
    :class="[
      isDragging ? 'opacity-100 text-emerald-600 cursor-grabbing' : 'opacity-0 group-hover:opacity-100 text-emerald-400 hover:text-emerald-600 cursor-grab',
      'transition-all duration-200 select-none p-1'
    ]"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    :title="title"
    @keydown="handleKeydown"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <!-- Drag icon -->
    <svg 
      class="w-5 h-5" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24" 
      aria-hidden="true"
    >
      <path 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2" 
        d="M8 9h8M8 15h8" 
      />
    </svg>
    
    <!-- Screen reader instructions -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ screenReaderText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  listTitle: string
  isDragging?: boolean
  disabled?: boolean
  listIndex?: number
  totalLists?: number
}

interface Emits {
  (event: 'drag-start'): void
  (event: 'drag-end'): void
  (event: 'keyboard-move', direction: 'left' | 'right'): void
}

const props = withDefaults(defineProps<Props>(), {
  isDragging: false,
  disabled: false,
  listIndex: 0,
  totalLists: 1
})

const emit = defineEmits<Emits>()

// Component state
const isFocused = ref(false)
const isKeyboardDragging = ref(false)

// Computed properties
const ariaLabel = computed(() => {
  const position = `${props.listIndex + 1} of ${props.totalLists}`
  const baseLabel = `Drag handle for list: ${props.listTitle}. Position: ${position}.`
  
  if (props.disabled) {
    return `${baseLabel} Dragging disabled.`
  }
  
  if (isKeyboardDragging.value) {
    return `${baseLabel} Keyboard dragging active. Use arrow keys to move, Enter to drop, Escape to cancel.`
  }
  
  return `${baseLabel} Press Enter or Space to start keyboard dragging, or use mouse to drag.`
})

const title = computed(() => {
  if (props.disabled) return 'Drag disabled'
  return props.isDragging ? 'Currently dragging list' : 'Drag to reorder list'
})

const screenReaderText = computed(() => {
  if (!isFocused.value && !props.isDragging && !isKeyboardDragging.value) return ''
  
  if (props.isDragging) {
    return 'List is being dragged'
  }
  
  if (isKeyboardDragging.value) {
    return 'Keyboard dragging active. Use Left and Right arrow keys to move, Enter to confirm, Escape to cancel.'
  }
  
  if (isFocused.value) {
    return 'Drag handle focused. Press Enter or Space to start keyboard dragging.'
  }
  
  return ''
})

// Event handlers
const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return
  
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!isKeyboardDragging.value) {
        startKeyboardDrag()
      } else {
        endKeyboardDrag()
      }
      break
      
    case 'Escape':
      if (isKeyboardDragging.value) {
        event.preventDefault()
        cancelKeyboardDrag()
      }
      break
      
    case 'ArrowLeft':
      if (isKeyboardDragging.value) {
        event.preventDefault()
        emit('keyboard-move', 'left')
      }
      break
      
    case 'ArrowRight':
      if (isKeyboardDragging.value) {
        event.preventDefault()
        emit('keyboard-move', 'right')
      }
      break
  }
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
  if (isKeyboardDragging.value) {
    cancelKeyboardDrag()
  }
}

const startKeyboardDrag = () => {
  isKeyboardDragging.value = true
  emit('drag-start')
}

const endKeyboardDrag = () => {
  isKeyboardDragging.value = false
  emit('drag-end')
}

const cancelKeyboardDrag = () => {
  isKeyboardDragging.value = false
  // Don't emit drag-end for cancellation, let parent handle differently
}
</script>

<style scoped>
.list-drag-handle {
  /* Base styles applied via class bindings */
}

/* Enhanced touch targets for mobile */
@media (hover: none) and (pointer: coarse) {
  .list-drag-handle {
    @apply min-w-[44px] min-h-[44px] p-3; /* WCAG recommended touch target size */
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .text-emerald-400 {
    @apply text-emerald-800;
  }
  
  .text-emerald-600 {
    @apply text-emerald-900;
  }
  
  .hover\:text-emerald-600:hover {
    @apply text-emerald-900;
  }
}

/* Focus styles for accessibility */
.list-drag-handle:focus {
  @apply outline-none ring-2 ring-emerald-500 ring-offset-2 rounded;
}

/* Keyboard dragging visual feedback */
.list-drag-handle:focus-visible {
  @apply bg-emerald-50 rounded;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transition-all {
    @apply transition-none;
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
</style>
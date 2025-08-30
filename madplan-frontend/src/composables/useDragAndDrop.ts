import { ref, computed, type Ref } from 'vue'
import type { Card, ReorderCardInput } from '../services/board.service'

interface DragState {
  isDragging: boolean
  draggedCard: Card | null
  draggedFromListId: string | null
  dragOverListId: string | null
}

interface DragCallbacks {
  onReorderCard: (input: ReorderCardInput) => Promise<void>
  onOptimisticUpdate?: (cardId: string, sourceListId: string, destListId: string, newIndex: number) => void
  onRollback?: (cardId: string) => void
}

export function useDragAndDrop(callbacks: DragCallbacks) {
  // Drag state
  const dragState = ref<DragState>({
    isDragging: false,
    draggedCard: null,
    draggedFromListId: null,
    dragOverListId: null
  })

  // Computed properties for UI state
  const isDragging = computed(() => dragState.value.isDragging)
  const draggedCard = computed(() => dragState.value.draggedCard)
  const draggedFromListId = computed(() => dragState.value.draggedFromListId)
  const dragOverListId = computed(() => dragState.value.dragOverListId)

  // Start drag operation
  const startDrag = (card: Card, fromListId: string) => {
    dragState.value = {
      isDragging: true,
      draggedCard: card,
      draggedFromListId: fromListId,
      dragOverListId: null
    }
  }

  // End drag operation
  const endDrag = () => {
    dragState.value = {
      isDragging: false,
      draggedCard: null,
      draggedFromListId: null,
      dragOverListId: null
    }
  }

  // Set drag over state for visual feedback
  const setDragOver = (listId: string | null) => {
    if (dragState.value.isDragging) {
      dragState.value.dragOverListId = listId
    }
  }

  // Handle card drop
  const handleDrop = async (
    card: Card,
    sourceListId: string,
    destListId: string,
    newIndex: number
  ): Promise<boolean> => {
    try {
      // Optimistic update if callback provided
      if (callbacks.onOptimisticUpdate) {
        callbacks.onOptimisticUpdate(card.id, sourceListId, destListId, newIndex)
      }

      // Call backend API
      await callbacks.onReorderCard({
        cardId: card.id,
        sourceListId,
        destListId,
        newIndex
      })

      return true
    } catch (error) {
      console.error('Failed to reorder card:', error)
      
      // Rollback optimistic update
      if (callbacks.onRollback) {
        callbacks.onRollback(card.id)
      }
      
      return false
    }
  }

  // Check if a card is currently being dragged
  const isCardDragging = (cardId: string): boolean => {
    return dragState.value.isDragging && dragState.value.draggedCard?.id === cardId
  }

  // Check if a list is valid drop target
  const isValidDropTarget = (listId: string): boolean => {
    return dragState.value.isDragging && dragState.value.draggedFromListId !== listId
  }

  // Check if currently dragging over a specific list
  const isDragOverList = (listId: string): boolean => {
    return dragState.value.dragOverListId === listId
  }

  return {
    // State
    isDragging,
    draggedCard,
    draggedFromListId,
    dragOverListId,
    
    // Actions
    startDrag,
    endDrag,
    setDragOver,
    handleDrop,
    
    // Utilities
    isCardDragging,
    isValidDropTarget,
    isDragOverList
  }
}

// Utility functions for drag calculations
export function calculateDropIndex(
  dragOverElement: Element | null,
  clientY: number,
  cardElements: NodeListOf<Element>
): number {
  if (!dragOverElement || cardElements.length === 0) {
    return 0
  }

  // Find the closest card element
  let closestIndex = 0
  let minDistance = Infinity

  Array.from(cardElements).forEach((card, index) => {
    const rect = card.getBoundingClientRect()
    const distance = Math.abs(clientY - (rect.top + rect.height / 2))
    
    if (distance < minDistance) {
      minDistance = distance
      closestIndex = clientY > rect.top + rect.height / 2 ? index + 1 : index
    }
  })

  return Math.max(0, Math.min(closestIndex, cardElements.length))
}

export function getDropZoneClasses(
  isDragOver: boolean,
  isValidTarget: boolean,
  isEmpty: boolean = false
): string[] {
  const classes: string[] = []

  if (isDragOver && isValidTarget) {
    classes.push('border-emerald-400', 'bg-emerald-50')
  } else if (isDragOver && !isValidTarget) {
    classes.push('border-red-400', 'bg-red-50')
  }

  if (isEmpty && isDragOver && isValidTarget) {
    classes.push('min-h-24', 'border-2', 'border-dashed', 'rounded-lg')
  }

  return classes
}

export function getDragCardClasses(isDragging: boolean): string[] {
  const classes: string[] = []

  if (isDragging) {
    classes.push('opacity-50', 'shadow-lg', 'rotate-2', 'scale-105')
  }

  return classes
}
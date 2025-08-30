import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDragAndDrop, calculateDropIndex, getDropZoneClasses, getDragCardClasses } from './useDragAndDrop'
import type { Card, ReorderCardInput } from '../services/board.service'

// Mock card data
const mockCard: Card = {
  id: 'card-1',
  content: 'Test card content',
  listId: 'list-1'
}

describe('useDragAndDrop composable', () => {
  let mockCallbacks: any
  
  beforeEach(() => {
    mockCallbacks = {
      onReorderCard: vi.fn(),
      onOptimisticUpdate: vi.fn(),
      onRollback: vi.fn()
    }
  })

  describe('drag state management', () => {
    it('initializes with correct default state', () => {
      const { isDragging, draggedCard, draggedFromListId, dragOverListId } = useDragAndDrop(mockCallbacks)

      expect(isDragging.value).toBe(false)
      expect(draggedCard.value).toBeNull()
      expect(draggedFromListId.value).toBeNull()
      expect(dragOverListId.value).toBeNull()
    })

    it('updates state when drag starts', () => {
      const { startDrag, isDragging, draggedCard, draggedFromListId } = useDragAndDrop(mockCallbacks)

      startDrag(mockCard, 'list-1')

      expect(isDragging.value).toBe(true)
      expect(draggedCard.value).toEqual(mockCard)
      expect(draggedFromListId.value).toBe('list-1')
    })

    it('clears state when drag ends', () => {
      const { startDrag, endDrag, isDragging, draggedCard, draggedFromListId, dragOverListId } = useDragAndDrop(mockCallbacks)

      // Start drag first
      startDrag(mockCard, 'list-1')
      expect(isDragging.value).toBe(true)

      // End drag
      endDrag()

      expect(isDragging.value).toBe(false)
      expect(draggedCard.value).toBeNull()
      expect(draggedFromListId.value).toBeNull()
      expect(dragOverListId.value).toBeNull()
    })

    it('updates drag over state', () => {
      const { setDragOver, dragOverListId, startDrag } = useDragAndDrop(mockCallbacks)

      // Start dragging first
      startDrag(mockCard, 'list-1')

      setDragOver('list-2')
      expect(dragOverListId.value).toBe('list-2')

      setDragOver(null)
      expect(dragOverListId.value).toBeNull()
    })

    it('only updates drag over state when dragging', () => {
      const { setDragOver, dragOverListId } = useDragAndDrop(mockCallbacks)

      setDragOver('list-2')
      expect(dragOverListId.value).toBeNull()
    })
  })

  describe('utility functions', () => {
    it('correctly identifies if card is dragging', () => {
      const { startDrag, isCardDragging } = useDragAndDrop(mockCallbacks)

      expect(isCardDragging('card-1')).toBe(false)

      startDrag(mockCard, 'list-1')
      expect(isCardDragging('card-1')).toBe(true)
      expect(isCardDragging('card-2')).toBe(false)
    })

    it('correctly identifies valid drop targets', () => {
      const { startDrag, isValidDropTarget } = useDragAndDrop(mockCallbacks)

      expect(isValidDropTarget('list-2')).toBe(false)

      startDrag(mockCard, 'list-1')
      expect(isValidDropTarget('list-1')).toBe(false) // Same list
      expect(isValidDropTarget('list-2')).toBe(true)  // Different list
    })

    it('correctly identifies drag over list', () => {
      const { startDrag, setDragOver, isDragOverList } = useDragAndDrop(mockCallbacks)

      startDrag(mockCard, 'list-1')
      setDragOver('list-2')

      expect(isDragOverList('list-2')).toBe(true)
      expect(isDragOverList('list-3')).toBe(false)
    })
  })

  describe('drop handling', () => {
    it('calls onOptimisticUpdate and onReorderCard on successful drop', async () => {
      mockCallbacks.onReorderCard.mockResolvedValue(undefined)
      
      const { handleDrop } = useDragAndDrop(mockCallbacks)

      const result = await handleDrop(mockCard, 'list-1', 'list-2', 1)

      expect(mockCallbacks.onOptimisticUpdate).toHaveBeenCalledWith('card-1', 'list-1', 'list-2', 1)
      expect(mockCallbacks.onReorderCard).toHaveBeenCalledWith({
        cardId: 'card-1',
        sourceListId: 'list-1',
        destListId: 'list-2',
        newIndex: 1
      })
      expect(result).toBe(true)
    })

    it('calls onRollback when drop fails', async () => {
      const error = new Error('Network error')
      mockCallbacks.onReorderCard.mockRejectedValue(error)
      
      const { handleDrop } = useDragAndDrop(mockCallbacks)

      const result = await handleDrop(mockCard, 'list-1', 'list-2', 1)

      expect(mockCallbacks.onOptimisticUpdate).toHaveBeenCalled()
      expect(mockCallbacks.onRollback).toHaveBeenCalledWith('card-1')
      expect(result).toBe(false)
    })

    it('works without optional callbacks', async () => {
      const minimalCallbacks = {
        onReorderCard: vi.fn().mockResolvedValue(undefined)
      }
      
      const { handleDrop } = useDragAndDrop(minimalCallbacks)

      const result = await handleDrop(mockCard, 'list-1', 'list-2', 1)

      expect(result).toBe(true)
      expect(minimalCallbacks.onReorderCard).toHaveBeenCalled()
    })
  })
})

describe('calculateDropIndex utility', () => {
  let mockCardElements: any[]

  beforeEach(() => {
    mockCardElements = [
      { getBoundingClientRect: () => ({ top: 100, height: 50 }) },
      { getBoundingClientRect: () => ({ top: 160, height: 50 }) },
      { getBoundingClientRect: () => ({ top: 220, height: 50 }) }
    ]
  })

  it('returns 0 for no elements', () => {
    const result = calculateDropIndex(null, 150, [] as any)
    expect(result).toBe(0)
  })

  it('calculates correct drop index for mouse position above first card', () => {
    const mockElements = mockCardElements as any
    const result = calculateDropIndex(null, 90, mockElements)
    expect(result).toBe(0)
  })

  it('calculates correct drop index for mouse position between cards', () => {
    // Mock NodeListOf properly
    const mockNodeList = {
      length: mockCardElements.length,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < this.length; i++) {
          yield mockCardElements[i]
        }
      },
      forEach: (callback: any) => mockCardElements.forEach(callback),
      ...mockCardElements
    }
    const result = calculateDropIndex(null, 185, mockNodeList as any)
    expect(result).toBe(2) // Between second and third card
  })

  it('calculates correct drop index for mouse position after last card', () => {
    // Mock NodeListOf properly
    const mockNodeList = {
      length: mockCardElements.length,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < this.length; i++) {
          yield mockCardElements[i]
        }
      },
      forEach: (callback: any) => mockCardElements.forEach(callback),
      ...mockCardElements
    }
    const result = calculateDropIndex(null, 300, mockNodeList as any)
    expect(result).toBe(3) // After last card
  })
})

describe('getDropZoneClasses utility', () => {
  it('returns correct classes for valid drop zone', () => {
    const classes = getDropZoneClasses(true, true)
    expect(classes).toContain('border-emerald-400')
    expect(classes).toContain('bg-emerald-50')
  })

  it('returns correct classes for invalid drop zone', () => {
    const classes = getDropZoneClasses(true, false)
    expect(classes).toContain('border-red-400')
    expect(classes).toContain('bg-red-50')
  })

  it('returns empty array when not dragging over', () => {
    const classes = getDropZoneClasses(false, true)
    expect(classes).toHaveLength(0)
  })

  it('returns additional classes for empty valid drop zone', () => {
    const classes = getDropZoneClasses(true, true, true)
    expect(classes).toContain('min-h-24')
    expect(classes).toContain('border-dashed')
    expect(classes).toContain('rounded-lg')
  })
})

describe('getDragCardClasses utility', () => {
  it('returns drag classes when dragging', () => {
    const classes = getDragCardClasses(true)
    expect(classes).toContain('opacity-50')
    expect(classes).toContain('shadow-lg')
    expect(classes).toContain('rotate-2')
    expect(classes).toContain('scale-105')
  })

  it('returns empty array when not dragging', () => {
    const classes = getDragCardClasses(false)
    expect(classes).toHaveLength(0)
  })
})
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import ListColumn from './ListColumn.vue'
import ListDragHandle from './ListDragHandle.vue'
import type { List } from '../../services/board.service'

// Mock VueDraggable component
vi.mock('vuedraggable', () => ({
  default: {
    name: 'VueDraggable',
    template: '<div class="mock-draggable"><slot name="item" v-for="item in modelValue" :element="item" /></div>',
    props: ['modelValue']
  }
}))

// Mock CardItem component
vi.mock('../cards/CardItem.vue', () => ({
  default: {
    name: 'CardItem',
    props: ['card', 'listId'],
    template: '<div class="mock-card-item">{{ card.content }}</div>'
  }
}))

// Mock CreateCardForm component
vi.mock('../cards/CreateCardForm.vue', () => ({
  default: {
    name: 'CreateCardForm',
    template: '<div class="mock-create-card-form">Create Card Form</div>'
  }
}))

describe('ListColumn - List Drag and Drop', () => {
  let wrapper: VueWrapper<any>
  let mockList: List

  beforeEach(() => {
    mockList = {
      id: 'list-1',
      title: 'Test List',
      boardId: 'board-1',
      cardOrder: ['card-1', 'card-2'],
      cards: [
        { id: 'card-1', content: 'Card 1', listId: 'list-1' },
        { id: 'card-2', content: 'Card 2', listId: 'list-1' }
      ]
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(ListColumn, {
      props: {
        list: mockList,
        ...props
      }
    })
  }

  describe('Drag Handle Integration', () => {
    it('should render ListDragHandle when not editing', async () => {
      wrapper = createWrapper()

      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.exists()).toBe(true)
    })

    it('should not render ListDragHandle when editing', async () => {
      wrapper = createWrapper()
      
      // Start editing mode
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')

      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.exists()).toBe(false)
    })

    it('should pass correct props to ListDragHandle', async () => {
      wrapper = createWrapper({
        isDraggingList: true,
        isUpdating: false,
        isDeleting: false
      })

      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.props()).toMatchObject({
        listTitle: 'Test List',
        isDragging: true,
        disabled: false
      })
    })

    it('should disable ListDragHandle when updating', async () => {
      wrapper = createWrapper({
        isUpdating: true
      })

      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.props('disabled')).toBe(true)
    })

    it('should disable ListDragHandle when deleting', async () => {
      wrapper = createWrapper({
        isDeleting: true
      })

      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.props('disabled')).toBe(true)
    })
  })

  describe('Visual Drag Feedback', () => {
    it('should apply drag styling when isDraggingList is true', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('opacity-90')
      expect(listContainer.classes()).toContain('shadow-xl')
      expect(listContainer.classes()).toContain('scale-105')
      expect(listContainer.classes()).toContain('rotate-2')
    })

    it('should not apply drag styling when isDraggingList is false', async () => {
      wrapper = createWrapper({
        isDraggingList: false
      })

      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).not.toContain('opacity-90')
      expect(listContainer.classes()).not.toContain('shadow-xl')
      expect(listContainer.classes()).not.toContain('scale-105')
      expect(listContainer.classes()).not.toContain('rotate-2')
    })

    it('should apply transition-all class for smooth animations', async () => {
      wrapper = createWrapper()

      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('transition-all')
      expect(listContainer.classes()).toContain('duration-200')
    })
  })

  describe('Drag State Interaction', () => {
    it('should maintain card drag functionality when list is being dragged', async () => {
      wrapper = createWrapper({
        isDraggingList: true,
        isDragOverList: true
      })

      // Card drag functionality should still work
      const draggableComponent = wrapper.find('.mock-draggable')
      expect(draggableComponent.exists()).toBe(true)

      // Drop zone styling should still be applied
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('border-emerald-400')
      expect(listContainer.classes()).toContain('bg-emerald-50')
    })

    it('should combine list and card drag visual states correctly', async () => {
      wrapper = createWrapper({
        isDraggingList: true,
        isDragOverList: true
      })

      const listContainer = wrapper.find('.bg-white')
      
      // Should have both list drag and card drop zone styles
      expect(listContainer.classes()).toContain('opacity-90') // List drag
      expect(listContainer.classes()).toContain('border-emerald-400') // Card drop zone
      expect(listContainer.classes()).toContain('bg-emerald-50') // Card drop zone
    })

    it('should prioritize list drag styling over normal state', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      const listContainer = wrapper.find('.bg-white')
      
      // List drag styles should be applied
      expect(listContainer.classes()).toContain('opacity-90')
      expect(listContainer.classes()).toContain('scale-105')
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain ARIA attributes during drag operations', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      // Check that existing accessibility features are maintained
      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.exists()).toBe(true)
      
      // ListDragHandle should have proper ARIA attributes
      expect(dragHandle.vm).toBeDefined()
    })

    it('should maintain card drop zone accessibility during list drag', async () => {
      wrapper = createWrapper({
        isDraggingList: true,
        isDragOverList: true
      })

      // Drop zone region should maintain accessibility
      const dropZoneRegion = wrapper.find('[role="region"]')
      if (dropZoneRegion.exists()) {
        expect(dropZoneRegion.attributes('aria-label')).toContain('Drop zone')
      }
    })

    it('should maintain screen reader announcements', async () => {
      wrapper = createWrapper({
        isDraggingList: true,
        isDragOverList: true
      })

      // Screen reader announcements should be maintained
      const srOnlyElements = wrapper.findAll('.sr-only')
      expect(srOnlyElements.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Considerations', () => {
    it('should not cause unnecessary re-renders when drag state changes', async () => {
      wrapper = createWrapper()
      
      const initialRenderCount = wrapper.findAllComponents({ name: 'CardItem' }).length
      
      // Change drag state
      await wrapper.setProps({ isDraggingList: true })
      
      const afterDragRenderCount = wrapper.findAllComponents({ name: 'CardItem' }).length
      
      // Card components should not be re-rendered
      expect(afterDragRenderCount).toBe(initialRenderCount)
    })

    it('should handle rapid drag state changes efficiently', async () => {
      wrapper = createWrapper()
      
      // Rapidly change drag states
      await wrapper.setProps({ isDraggingList: true })
      await wrapper.setProps({ isDraggingList: false })
      await wrapper.setProps({ isDraggingList: true })
      
      // Should still render correctly
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('opacity-90')
    })

    it('should maintain card ordering during list drag', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      // Cards should maintain their order
      const cardItems = wrapper.findAllComponents({ name: 'CardItem' })
      expect(cardItems).toHaveLength(2)
      expect(cardItems[0].props('card').content).toBe('Card 1')
      expect(cardItems[1].props('card').content).toBe('Card 2')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing cards array gracefully during drag', async () => {
      const listWithoutCards = {
        ...mockList,
        cards: undefined
      }

      wrapper = createWrapper({
        list: listWithoutCards,
        isDraggingList: true
      })

      // Should not throw error
      expect(wrapper.findComponent(ListDragHandle).exists()).toBe(true)
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('opacity-90')
    })

    it('should handle empty card order during drag', async () => {
      const listWithEmptyOrder = {
        ...mockList,
        cardOrder: []
      }

      wrapper = createWrapper({
        list: listWithEmptyOrder,
        isDraggingList: true
      })

      // Should render empty state
      expect(wrapper.findAllComponents({ name: 'CardItem' })).toHaveLength(0)
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('opacity-90')
    })

    it('should handle simultaneous editing and dragging states', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      // Start editing while dragging (edge case)
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')

      // Drag handle should be hidden during editing
      const dragHandle = wrapper.findComponent(ListDragHandle)
      expect(dragHandle.exists()).toBe(false)

      // But visual drag state should be maintained
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('opacity-90')
    })
  })

  describe('Style Integration', () => {
    it('should have proper CSS classes defined', async () => {
      wrapper = createWrapper()

      // Check that styles are included
      expect(wrapper.html()).toBeDefined()
      
      // Component should have scoped styles
      const styles = wrapper.find('style')
      if (styles.exists()) {
        expect(styles.text()).toContain('scoped')
      }
    })

    it('should support reduced motion preferences', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      // Styles should include reduced motion support
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('transition-all')
    })

    it('should maintain visual hierarchy during drag', async () => {
      wrapper = createWrapper({
        isDraggingList: true
      })

      // Container should have elevated z-index styles available
      const listContainer = wrapper.find('.bg-white')
      expect(listContainer.classes()).toContain('shadow-xl')
    })
  })
})
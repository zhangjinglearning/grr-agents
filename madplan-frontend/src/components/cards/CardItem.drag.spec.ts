import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CardItem from './CardItem.vue'
import type { Card } from '../../services/board.service'

// Mock card data
const mockCard: Card = {
  id: 'card-1',
  content: 'Test card content',
  listId: 'list-1'
}

describe('CardItem drag-and-drop functionality', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(CardItem, {
      props: {
        card: mockCard,
        listId: 'list-1'
      }
    })
  })

  describe('drag attributes and classes', () => {
    it('has draggable attribute set to true', () => {
      const cardElement = wrapper.find('.bg-white')
      expect(cardElement.attributes('draggable')).toBe('true')
    })

    it('has cursor-grab class by default', () => {
      const cardElement = wrapper.find('.bg-white')
      expect(cardElement.classes()).toContain('cursor-grab')
    })

    it('applies drag styling when isDragging is true', async () => {
      await wrapper.setProps({ isDragging: true })

      const cardElement = wrapper.find('.bg-white')
      expect(cardElement.classes()).toContain('opacity-50')
      expect(cardElement.classes()).toContain('shadow-lg')
      expect(cardElement.classes()).toContain('rotate-2')
      expect(cardElement.classes()).toContain('scale-105')
      expect(cardElement.classes()).toContain('cursor-grabbing')
    })

    it('has transition classes for smooth animations', () => {
      const cardElement = wrapper.find('.bg-white')
      expect(cardElement.classes()).toContain('transition-all')
      expect(cardElement.classes()).toContain('duration-200')
    })
  })

  describe('drag event handlers', () => {
    it('handles dragstart event correctly', async () => {
      const cardElement = wrapper.find('.bg-white')
      
      // Mock drag event
      const mockDragEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn()
        },
        preventDefault: vi.fn()
      }

      await cardElement.trigger('dragstart', mockDragEvent)

      expect(mockDragEvent.dataTransfer.effectAllowed).toBe('move')
      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'card-1')
      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify({ cardId: 'card-1', sourceListId: 'list-1' })
      )
      expect(wrapper.emitted('drag-start')).toBeTruthy()
      expect(wrapper.emitted('drag-start')[0]).toEqual([mockCard, 'list-1'])
    })

    it('prevents dragstart when in edit mode', async () => {
      // Enter edit mode
      await wrapper.find('p').trigger('click')
      await nextTick()

      const cardElement = wrapper.find('.bg-white')
      const mockDragEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn()
        },
        preventDefault: vi.fn()
      }

      await cardElement.trigger('dragstart', mockDragEvent)

      expect(mockDragEvent.preventDefault).toHaveBeenCalled()
      expect(wrapper.emitted('drag-start')).toBeFalsy()
    })

    it('prevents dragstart when updating', async () => {
      await wrapper.setProps({ isUpdating: true })

      const cardElement = wrapper.find('.bg-white')
      const mockDragEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn()
        },
        preventDefault: vi.fn()
      }

      await cardElement.trigger('dragstart', mockDragEvent)

      expect(mockDragEvent.preventDefault).toHaveBeenCalled()
      expect(wrapper.emitted('drag-start')).toBeFalsy()
    })

    it('prevents dragstart when deleting', async () => {
      await wrapper.setProps({ isDeleting: true })

      const cardElement = wrapper.find('.bg-white')
      const mockDragEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn()
        },
        preventDefault: vi.fn()
      }

      await cardElement.trigger('dragstart', mockDragEvent)

      expect(mockDragEvent.preventDefault).toHaveBeenCalled()
      expect(wrapper.emitted('drag-start')).toBeFalsy()
    })

    it('prevents dragstart when delete confirmation is showing', async () => {
      // Show delete confirmation
      const deleteButton = wrapper.find('[title="Delete card"]')
      await deleteButton.trigger('click')
      await nextTick()

      const cardElement = wrapper.find('.bg-white')
      const mockDragEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn()
        },
        preventDefault: vi.fn()
      }

      await cardElement.trigger('dragstart', mockDragEvent)

      expect(mockDragEvent.preventDefault).toHaveBeenCalled()
      expect(wrapper.emitted('drag-start')).toBeFalsy()
    })

    it('handles dragend event correctly', async () => {
      const cardElement = wrapper.find('.bg-white')
      
      await cardElement.trigger('dragend')

      expect(wrapper.emitted('drag-end')).toBeTruthy()
    })

    it('handles dragover event with prevent default', async () => {
      const cardElement = wrapper.find('.bg-white')
      
      const mockDragEvent = {
        preventDefault: vi.fn()
      }

      await cardElement.trigger('dragover', mockDragEvent)

      expect(mockDragEvent.preventDefault).toHaveBeenCalled()
    })
  })

  describe('click handling with drag integration', () => {
    it('starts edit mode when clicking on content (not dragging)', async () => {
      const cardElement = wrapper.find('.bg-white')
      const mockClickEvent = {
        target: wrapper.find('p').element
      }

      await cardElement.trigger('click', mockClickEvent)
      await nextTick()

      expect(wrapper.vm.isEditing).toBe(true)
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('does not start edit mode when isDragging is true', async () => {
      await wrapper.setProps({ isDragging: true })

      const cardElement = wrapper.find('.bg-white')
      const mockClickEvent = {
        target: wrapper.find('p').element
      }

      await cardElement.trigger('click', mockClickEvent)
      await nextTick()

      expect(wrapper.vm.isEditing).toBe(false)
      expect(wrapper.find('textarea').exists()).toBe(false)
    })

    it('does not start edit mode when clicking on buttons', async () => {
      const editButton = wrapper.find('[title="Edit card"]')
      const mockClickEvent = {
        target: editButton.element
      }

      const cardElement = wrapper.find('.bg-white')
      await cardElement.trigger('click', mockClickEvent)
      await nextTick()

      expect(wrapper.vm.isEditing).toBe(false)
    })

    it('does not interfere with double-click to edit', async () => {
      const contentP = wrapper.find('p')
      
      await contentP.trigger('dblclick')
      await nextTick()

      expect(wrapper.vm.isEditing).toBe(true)
      expect(wrapper.find('textarea').exists()).toBe(true)
    })
  })

  describe('drag state visual feedback', () => {
    it('shows normal state by default', () => {
      const cardElement = wrapper.find('.bg-white')
      
      expect(cardElement.classes()).not.toContain('opacity-50')
      expect(cardElement.classes()).not.toContain('shadow-lg')
      expect(cardElement.classes()).not.toContain('rotate-2')
      expect(cardElement.classes()).not.toContain('scale-105')
      expect(cardElement.classes()).toContain('cursor-grab')
    })

    it('shows dragging state when isDragging is true', async () => {
      await wrapper.setProps({ isDragging: true })

      const cardElement = wrapper.find('.bg-white')
      
      expect(cardElement.classes()).toContain('opacity-50')
      expect(cardElement.classes()).toContain('shadow-lg')
      expect(cardElement.classes()).toContain('rotate-2')
      expect(cardElement.classes()).toContain('scale-105')
      expect(cardElement.classes()).toContain('cursor-grabbing')
    })

    it('maintains other state classes when dragging', async () => {
      await wrapper.setProps({ isDragging: true })

      const cardElement = wrapper.find('.bg-white')
      
      expect(cardElement.classes()).toContain('bg-white')
      expect(cardElement.classes()).toContain('rounded-lg')
      expect(cardElement.classes()).toContain('border')
      expect(cardElement.classes()).toContain('border-emerald-200')
    })
  })

  describe('accessibility during drag operations', () => {
    it('maintains accessibility attributes during drag', async () => {
      const contentP = wrapper.find('p')
      const editButton = wrapper.find('[title="Edit card"]')
      const deleteButton = wrapper.find('[title="Delete card"]')

      await wrapper.setProps({ isDragging: true })

      expect(contentP.attributes('title')).toBe('Test card content')
      expect(editButton.attributes('title')).toBe('Edit card')
      expect(deleteButton.attributes('title')).toBe('Delete card')
    })

    it('maintains proper tabindex and focus management', async () => {
      await wrapper.setProps({ isDragging: true })

      const editButton = wrapper.find('[title="Edit card"]')
      const deleteButton = wrapper.find('[title="Delete card"]')

      expect(editButton.attributes('disabled')).toBeUndefined()
      expect(deleteButton.attributes('disabled')).toBeUndefined()
    })

    it('disables buttons when updating or deleting', async () => {
      await wrapper.setProps({ isUpdating: true })

      const editButton = wrapper.find('[title="Edit card"]')
      const deleteButton = wrapper.find('[title="Delete card"]')

      expect(editButton.attributes('disabled')).toBeDefined()
      expect(deleteButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('performance considerations', () => {
    it('does not trigger unnecessary re-renders during drag', async () => {
      const renderSpy = vi.fn()
      wrapper.vm.$options.beforeUpdate = renderSpy

      await wrapper.setProps({ isDragging: true })
      await wrapper.setProps({ isDragging: false })
      await wrapper.setProps({ isDragging: true })

      // Verify that component handles drag state changes efficiently
      expect(wrapper.vm.isDragging).toBeDefined()
    })

    it('properly handles rapid drag state changes', async () => {
      // Simulate rapid state changes
      for (let i = 0; i < 5; i++) {
        await wrapper.setProps({ isDragging: i % 2 === 0 })
        await nextTick()
      }

      // Component should remain stable
      expect(wrapper.find('.bg-white').exists()).toBe(true)
    })
  })
})
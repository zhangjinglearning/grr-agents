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

describe('CardItem', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(CardItem, {
      props: {
        card: mockCard,
        listId: 'list-1'
      }
    })
  })

  it('renders card content correctly', () => {
    expect(wrapper.find('p').text()).toBe('Test card content')
  })

  it('shows edit and delete buttons on hover', async () => {
    const cardDiv = wrapper.find('.group')
    const actionButtons = wrapper.find('.opacity-0')
    
    // Initially hidden
    expect(actionButtons.exists()).toBe(true)
    
    // Should show edit and delete buttons
    const editButton = wrapper.find('[title="Edit card"]')
    const deleteButton = wrapper.find('[title="Delete card"]')
    
    expect(editButton.exists()).toBe(true)
    expect(deleteButton.exists()).toBe(true)
  })

  it('enters edit mode when content is clicked', async () => {
    const contentParagraph = wrapper.find('p')
    
    await contentParagraph.trigger('click')
    await nextTick()
    
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.vm.isEditing).toBe(true)
  })

  it('enters edit mode when edit button is clicked', async () => {
    const editButton = wrapper.find('[title="Edit card"]')
    
    await editButton.trigger('click')
    await nextTick()
    
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.vm.isEditing).toBe(true)
  })

  it('shows textarea with correct content in edit mode', async () => {
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    const textarea = wrapper.find('textarea')
    expect(textarea.element.value).toBe('Test card content')
  })

  it('emits update-content event when saving valid changes', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Change content
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Updated card content')
    
    // Save changes
    const saveButton = wrapper.find('button:first-child')
    await saveButton.trigger('click')
    
    expect(wrapper.emitted('update-content')).toBeTruthy()
    expect(wrapper.emitted('update-content')[0]).toEqual(['card-1', 'Updated card content'])
  })

  it('does not emit update-content when content is unchanged', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Save without changes
    const saveButton = wrapper.find('button:first-child')
    await saveButton.trigger('click')
    
    expect(wrapper.emitted('update-content')).toBeFalsy()
    expect(wrapper.vm.isEditing).toBe(false)
  })

  it('cancels edit mode when escape is pressed', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Press escape
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown.escape')
    
    expect(wrapper.vm.isEditing).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('cancels edit mode when cancel button is clicked', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Click cancel
    const cancelButton = wrapper.find('button:last-child')
    await cancelButton.trigger('click')
    
    expect(wrapper.vm.isEditing).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('saves content when Ctrl+Enter is pressed', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Change content and press Ctrl+Enter
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Updated with keyboard')
    await textarea.trigger('keydown.enter.ctrl')
    
    expect(wrapper.emitted('update-content')).toBeTruthy()
    expect(wrapper.emitted('update-content')[0]).toEqual(['card-1', 'Updated with keyboard'])
  })

  it('saves content when Meta+Enter is pressed', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Change content and press Meta+Enter
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Updated with meta key')
    await textarea.trigger('keydown.enter.meta')
    
    expect(wrapper.emitted('update-content')).toBeTruthy()
    expect(wrapper.emitted('update-content')[0]).toEqual(['card-1', 'Updated with meta key'])
  })

  it('shows delete confirmation when delete button is clicked', async () => {
    const deleteButton = wrapper.find('[title="Delete card"]')
    
    await deleteButton.trigger('click')
    await nextTick()
    
    expect(wrapper.find('.bg-red-50').exists()).toBe(true)
    expect(wrapper.text()).toContain('Delete this card?')
    expect(wrapper.vm.showDeleteConfirm).toBe(true)
  })

  it('emits delete event when deletion is confirmed', async () => {
    // Show delete confirmation
    const deleteButton = wrapper.find('[title="Delete card"]')
    await deleteButton.trigger('click')
    await nextTick()
    
    // Confirm delete
    const confirmButton = wrapper.find('.bg-red-600')
    await confirmButton.trigger('click')
    
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')[0]).toEqual(['card-1'])
  })

  it('cancels delete when cancel button in confirmation is clicked', async () => {
    // Show delete confirmation
    const deleteButton = wrapper.find('[title="Delete card"]')
    await deleteButton.trigger('click')
    await nextTick()
    
    // Cancel delete
    const cancelButton = wrapper.find('.bg-gray-300')
    await cancelButton.trigger('click')
    
    expect(wrapper.emitted('delete')).toBeFalsy()
    expect(wrapper.vm.showDeleteConfirm).toBe(false)
  })

  it('disables buttons when isUpdating prop is true', async () => {
    await wrapper.setProps({ isUpdating: true })
    
    const editButton = wrapper.find('[title="Edit card"]')
    const deleteButton = wrapper.find('[title="Delete card"]')
    
    expect(editButton.attributes('disabled')).toBeDefined()
    expect(deleteButton.attributes('disabled')).toBeDefined()
  })

  it('disables buttons when isDeleting prop is true', async () => {
    await wrapper.setProps({ isDeleting: true })
    
    const editButton = wrapper.find('[title="Edit card"]')
    const deleteButton = wrapper.find('[title="Delete card"]')
    
    expect(editButton.attributes('disabled')).toBeDefined()
    expect(deleteButton.attributes('disabled')).toBeDefined()
  })

  it('shows updating overlay when isUpdating is true and not editing', async () => {
    await wrapper.setProps({ isUpdating: true })
    
    expect(wrapper.find('.bg-emerald-50').exists()).toBe(true)
    expect(wrapper.text()).toContain('Updating...')
  })

  it('shows deleting spinner in confirmation when isDeleting is true', async () => {
    await wrapper.setProps({ isDeleting: true })
    
    // Show delete confirmation
    const deleteButton = wrapper.find('[title="Delete card"]')
    await deleteButton.trigger('click')
    await nextTick()
    
    expect(wrapper.text()).toContain('Deleting...')
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('does not enter edit mode when disabled', async () => {
    await wrapper.setProps({ isUpdating: true })
    
    const contentParagraph = wrapper.find('p')
    await contentParagraph.trigger('click')
    
    expect(wrapper.vm.isEditing).toBe(false)
  })

  it('prevents empty content submission', async () => {
    // Enter edit mode
    await wrapper.find('p').trigger('click')
    await nextTick()
    
    // Clear content
    const textarea = wrapper.find('textarea')
    await textarea.setValue('   ')
    
    // Try to save
    const saveButton = wrapper.find('button:first-child')
    await saveButton.trigger('click')
    
    expect(wrapper.emitted('update-content')).toBeFalsy()
    expect(wrapper.vm.isEditing).toBe(false)
  })

  it('handles long content with proper truncation in title', () => {
    const longContent = 'A'.repeat(200)
    const longCard = { ...mockCard, content: longContent }
    
    const longWrapper = mount(CardItem, {
      props: { 
        card: longCard,
        listId: 'list-1'
      }
    })
    
    const contentP = longWrapper.find('p')
    expect(contentP.attributes('title')).toBe(longContent)
    expect(contentP.text()).toBe(longContent)
  })

  it('renders with proper accessibility attributes', () => {
    const contentP = wrapper.find('p')
    const editButton = wrapper.find('[title="Edit card"]')
    const deleteButton = wrapper.find('[title="Delete card"]')
    
    expect(contentP.attributes('title')).toBe('Test card content')
    expect(editButton.attributes('title')).toBe('Edit card')
    expect(deleteButton.attributes('title')).toBe('Delete card')
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CreateCardForm from './CreateCardForm.vue'

describe('CreateCardForm', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(CreateCardForm, {
      props: {
        listId: 'list-1'
      }
    })
  })

  it('renders collapsed state by default', () => {
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('button').text()).toBe('Add a card')
    expect(wrapper.vm.isExpanded).toBe(false)
  })

  it('expands form when Add a card button is clicked', async () => {
    const addButton = wrapper.find('button')
    
    await addButton.trigger('click')
    await nextTick()
    
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.vm.isExpanded).toBe(true)
  })

  it('focuses textarea when form is expanded', async () => {
    const addButton = wrapper.find('button')
    
    await addButton.trigger('click')
    await nextTick()
    
    const textarea = wrapper.find('textarea')
    expect(document.activeElement).toBe(textarea.element)
  })

  it('collapses form when cancel button is clicked', async () => {
    // Expand first
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Click cancel
    const cancelButton = wrapper.find('[title="Cancel"]')
    await cancelButton.trigger('click')
    
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.vm.isExpanded).toBe(false)
    expect(wrapper.vm.newCardContent).toBe('')
  })

  it('collapses form when escape is pressed', async () => {
    // Expand first
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Press escape
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown.escape')
    
    expect(wrapper.vm.isExpanded).toBe(false)
    expect(wrapper.vm.newCardContent).toBe('')
  })

  it('shows character count while typing', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type content
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Hello world')
    
    expect(wrapper.text()).toContain('11/1000 characters')
  })

  it('validates content length and shows error for empty content', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    expect(wrapper.text()).toContain('Card content is required')
    expect(wrapper.vm.canSubmit).toBe(false)
  })

  it('validates content length and shows error for too long content', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type long content
    const textarea = wrapper.find('textarea')
    const longContent = 'A'.repeat(1001)
    await textarea.setValue(longContent)
    
    expect(wrapper.text()).toContain('Card content must be less than 1000 characters')
    expect(wrapper.vm.canSubmit).toBe(false)
  })

  it('enables submit button when content is valid', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type valid content
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Valid card content')
    
    const submitButton = wrapper.find('.bg-emerald-600')
    expect(submitButton.attributes('disabled')).toBeUndefined()
    expect(wrapper.vm.canSubmit).toBe(true)
  })

  it('emits create event when form is submitted with valid content', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type content
    const textarea = wrapper.find('textarea')
    await textarea.setValue('New card content')
    
    // Submit
    const submitButton = wrapper.find('.bg-emerald-600')
    await submitButton.trigger('click')
    
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')[0]).toEqual(['list-1', 'New card content'])
    expect(wrapper.vm.newCardContent).toBe('')
  })

  it('emits create event when Ctrl+Enter is pressed', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type content and press Ctrl+Enter
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Keyboard submission')
    await textarea.trigger('keydown.enter.ctrl')
    
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')[0]).toEqual(['list-1', 'Keyboard submission'])
  })

  it('emits create event when Meta+Enter is pressed', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type content and press Meta+Enter
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Meta key submission')
    await textarea.trigger('keydown.enter.meta')
    
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')[0]).toEqual(['list-1', 'Meta key submission'])
  })

  it('does not submit when content is invalid', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Try to submit empty content
    const submitButton = wrapper.find('.bg-emerald-600')
    await submitButton.trigger('click')
    
    expect(wrapper.emitted('create')).toBeFalsy()
  })

  it('trims whitespace from content before submission', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type content with whitespace
    const textarea = wrapper.find('textarea')
    await textarea.setValue('  Trimmed content  ')
    
    // Submit
    const submitButton = wrapper.find('.bg-emerald-600')
    await submitButton.trigger('click')
    
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')[0]).toEqual(['list-1', 'Trimmed content'])
  })

  it('disables form when isCreating prop is true', async () => {
    await wrapper.setProps({ isCreating: true })
    
    // Should disable the add button in collapsed state
    const addButton = wrapper.find('button')
    expect(addButton.attributes('disabled')).toBeDefined()
  })

  it('disables form elements when isCreating prop is true in expanded state', async () => {
    // Expand first
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Then set creating state
    await wrapper.setProps({ isCreating: true })
    
    const textarea = wrapper.find('textarea')
    const submitButton = wrapper.find('.bg-emerald-600')
    const cancelButton = wrapper.find('[title="Cancel"]')
    
    expect(textarea.attributes('disabled')).toBeDefined()
    expect(submitButton.attributes('disabled')).toBeDefined()
    expect(cancelButton.attributes('disabled')).toBeDefined()
  })

  it('shows loading spinner and text when creating', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Set creating state
    await wrapper.setProps({ isCreating: true })
    
    expect(wrapper.text()).toContain('Adding...')
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('shows error message when error prop is provided', async () => {
    await wrapper.setProps({ error: 'Failed to create card' })
    
    // Should auto-expand when error is present
    await nextTick()
    
    expect(wrapper.vm.isExpanded).toBe(true)
    expect(wrapper.find('.bg-red-50').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to create card')
  })

  it('collapses form when creation succeeds (isCreating goes from true to false)', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Set creating state
    await wrapper.setProps({ isCreating: true })
    
    // Simulate successful creation
    await wrapper.setProps({ isCreating: false, error: null })
    
    expect(wrapper.vm.isExpanded).toBe(false)
  })

  it('does not collapse form when creation fails', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Set creating state
    await wrapper.setProps({ isCreating: true })
    
    // Simulate failed creation
    await wrapper.setProps({ isCreating: false, error: 'Creation failed' })
    
    expect(wrapper.vm.isExpanded).toBe(true)
  })

  it('emits cancel event when form is collapsed', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Cancel
    const cancelButton = wrapper.find('[title="Cancel"]')
    await cancelButton.trigger('click')
    
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('auto-resizes textarea on input', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    const textarea = wrapper.find('textarea')
    const initialHeight = textarea.element.style.height
    
    // Type multi-line content
    await textarea.setValue('Line 1\nLine 2\nLine 3\nLine 4')
    await textarea.trigger('input')
    
    // Height should have changed (implementation depends on component)
    expect(textarea.element.scrollHeight).toBeGreaterThan(parseInt(initialHeight) || 40)
  })

  it('has proper accessibility attributes', async () => {
    const addButton = wrapper.find('button')
    expect(addButton.text()).toContain('Add a card')
    
    // Expand form
    await addButton.trigger('click')
    await nextTick()
    
    const textarea = wrapper.find('textarea')
    const cancelButton = wrapper.find('[title="Cancel"]')
    
    expect(textarea.attributes('placeholder')).toBe('Enter a title for this card...')
    expect(cancelButton.attributes('title')).toBe('Cancel')
  })

  it('handles maximum character limit edge case', async () => {
    // Expand form
    await wrapper.find('button').trigger('click')
    await nextTick()
    
    // Type exactly 1000 characters
    const textarea = wrapper.find('textarea')
    const exactContent = 'A'.repeat(1000)
    await textarea.setValue(exactContent)
    
    expect(wrapper.text()).toContain('1000/1000 characters')
    expect(wrapper.vm.canSubmit).toBe(true)
    expect(wrapper.vm.validationError).toBe(null)
  })

  it('handles empty listId prop correctly', () => {
    const emptyWrapper = mount(CreateCardForm, {
      props: { listId: '' }
    })
    
    expect(emptyWrapper.vm.listId).toBe('')
    // Component should still render without errors
    expect(emptyWrapper.find('button').exists()).toBe(true)
  })
})
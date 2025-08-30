import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CreateListForm from './CreateListForm.vue'

describe('CreateListForm', () => {
  let wrapper: any
  const defaultProps = {
    boardId: 'board-123',
    isCreating: false,
    error: null
  }

  beforeEach(() => {
    wrapper = mount(CreateListForm, {
      props: defaultProps
    })
  })

  describe('Component Rendering', () => {
    it('should render collapsed state by default', () => {
      expect(wrapper.text()).toContain('Add a list')
      expect(wrapper.find('button svg').exists()).toBe(true) // Plus icon
      expect(wrapper.find('form').exists()).toBe(false)
    })

    it('should show expanded form when add button is clicked', async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()

      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.find('input#list-title').exists()).toBe(true)
      expect(wrapper.text()).toContain('List title')
    })

    it('should show form elements in expanded state', async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()

      expect(wrapper.find('label[for="list-title"]').text()).toBe('List title')
      expect(wrapper.find('input#list-title').attributes('placeholder')).toBe('Enter list title...')
      expect(wrapper.find('button[type="submit"]').text()).toBe('Add List')
      expect(wrapper.find('button[type="button"]').text()).toBe('Cancel')
    })
  })

  describe('Form Interaction', () => {
    beforeEach(async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()
    })

    it('should update character count as user types', async () => {
      const input = wrapper.find('input#list-title')
      await input.setValue('Test Title')

      expect(wrapper.text()).toContain('10/100')
    })

    it('should enable submit button when title is valid', async () => {
      const input = wrapper.find('input#list-title')
      const submitButton = wrapper.find('button[type="submit"]')

      // Initially disabled
      expect(submitButton.attributes('disabled')).toBeDefined()

      await input.setValue('Valid Title')

      expect(submitButton.attributes('disabled')).toBeUndefined()
    })

    it('should disable submit button for empty title', async () => {
      const input = wrapper.find('input#list-title')
      const submitButton = wrapper.find('button[type="submit"]')

      await input.setValue('')

      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should disable submit button for title over 100 characters', async () => {
      const input = wrapper.find('input#list-title')
      const submitButton = wrapper.find('button[type="submit"]')

      await input.setValue('A'.repeat(101))

      expect(submitButton.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('101/100')
    })

    it('should emit create event on form submission', async () => {
      const input = wrapper.find('input#list-title')
      const form = wrapper.find('form')

      await input.setValue('New List Title')
      await form.trigger('submit')

      expect(wrapper.emitted('create')).toBeTruthy()
      expect(wrapper.emitted('create')?.[0]).toEqual(['New List Title'])
    })

    it('should emit create event when submit button is clicked', async () => {
      const input = wrapper.find('input#list-title')
      const submitButton = wrapper.find('button[type="submit"]')

      await input.setValue('Button Click Title')
      await submitButton.trigger('click')

      expect(wrapper.emitted('create')).toBeTruthy()
      expect(wrapper.emitted('create')?.[0]).toEqual(['Button Click Title'])
    })

    it('should trim whitespace from title before submission', async () => {
      const input = wrapper.find('input#list-title')
      const form = wrapper.find('form')

      await input.setValue('  Trimmed Title  ')
      await form.trigger('submit')

      expect(wrapper.emitted('create')?.[0]).toEqual(['Trimmed Title'])
    })

    it('should not submit if title is empty after trimming', async () => {
      const input = wrapper.find('input#list-title')
      const form = wrapper.find('form')

      await input.setValue('   ')
      await form.trigger('submit')

      expect(wrapper.emitted('create')).toBeFalsy()
      expect(wrapper.text()).toContain('List title is required')
    })

    it('should emit cancel event when cancel button is clicked', async () => {
      const cancelButton = wrapper.find('button[type="button"]')
      await cancelButton.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.find('form').exists()).toBe(false) // Form should collapse
    })

    it('should reset form when cancelled', async () => {
      const input = wrapper.find('input#list-title')
      const cancelButton = wrapper.find('button[type="button"]')

      await input.setValue('Some text')
      await cancelButton.trigger('click')
      await nextTick()

      // Form should be collapsed
      expect(wrapper.find('form').exists()).toBe(false)
      expect(wrapper.text()).toContain('Add a list')
    })
  })

  describe('Loading State', () => {
    beforeEach(async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()
    })

    it('should show loading state when isCreating is true', async () => {
      await wrapper.setProps({ isCreating: true })

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.text()).toContain('Creating...')
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should disable form inputs when creating', async () => {
      await wrapper.setProps({ isCreating: true })

      const input = wrapper.find('input#list-title')
      const submitButton = wrapper.find('button[type="submit"]')
      const cancelButton = wrapper.find('button[type="button"]')

      expect(input.attributes('disabled')).toBeDefined()
      expect(submitButton.attributes('disabled')).toBeDefined()
      expect(cancelButton.attributes('disabled')).toBeDefined()
    })

    it('should reset form after successful creation', async () => {
      const input = wrapper.find('input#list-title')
      await input.setValue('Test List')

      // Simulate creation start
      await wrapper.setProps({ isCreating: true })
      
      // Simulate creation success (isCreating becomes false, no error)
      await wrapper.setProps({ isCreating: false, error: null })
      await nextTick()

      // Form should be reset and collapsed
      expect(wrapper.find('form').exists()).toBe(false)
      expect(wrapper.text()).toContain('Add a list')
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()
    })

    it('should display error message when error prop is set', async () => {
      await wrapper.setProps({ error: 'Failed to create list' })

      expect(wrapper.text()).toContain('Failed to create list')
      expect(wrapper.text()).toContain('Failed to create list')
      expect(wrapper.find('.bg-red-50').exists()).toBe(true)
    })

    it('should show validation error for empty title', async () => {
      const input = wrapper.find('input#list-title')
      const form = wrapper.find('form')

      await input.setValue('')
      await form.trigger('submit')

      expect(wrapper.text()).toContain('List title is required')
    })

    it('should show validation error for title over 100 characters', async () => {
      const input = wrapper.find('input#list-title')
      const form = wrapper.find('form')

      const longTitle = 'A'.repeat(101)
      await input.setValue(longTitle)
      await form.trigger('submit')

      expect(wrapper.text()).toContain('List title must be 100 characters or less')
    })

    it('should clear validation error when user starts typing', async () => {
      const input = wrapper.find('input#list-title')
      const form = wrapper.find('form')

      // Trigger validation error
      await input.setValue('')
      await form.trigger('submit')
      expect(wrapper.text()).toContain('List title is required')

      // Start typing - error should clear
      await input.setValue('A')
      expect(wrapper.text()).not.toContain('List title is required')
    })
  })

  describe('Keyboard Interactions', () => {
    it('should focus input when form is expanded', async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()

      const input = wrapper.find('input#list-title')
      expect(input.element).toBe(document.activeElement)
    })

    it('should handle Escape key to cancel form', async () => {
      const addButton = wrapper.find('button')
      await addButton.trigger('click')
      await nextTick()

      const input = wrapper.find('input#list-title')
      await input.setValue('Some text')

      // Simulate Escape key (this is handled by the global listener)
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      window.dispatchEvent(event)
      await nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('Props Validation', () => {
    it('should handle different boardId', async () => {
      await wrapper.setProps({ boardId: 'different-board-id' })
      
      expect(wrapper.props('boardId')).toBe('different-board-id')
    })

    it('should handle default props correctly', () => {
      const minimalWrapper = mount(CreateListForm, {
        props: {
          boardId: 'test-board'
        }
      })

      expect(minimalWrapper.props('isCreating')).toBe(false)
      expect(minimalWrapper.props('error')).toBeNull()
    })
  })

  describe('Component Lifecycle', () => {
    it('should not show form initially when created', () => {
      const freshWrapper = mount(CreateListForm, {
        props: defaultProps
      })

      expect(freshWrapper.find('form').exists()).toBe(false)
      expect(freshWrapper.text()).toContain('Add a list')
    })

    it('should handle props changes correctly', async () => {
      // Expand form
      await wrapper.find('button').trigger('click')
      await nextTick()

      // Change props
      await wrapper.setProps({ 
        isCreating: true, 
        error: 'Some error' 
      })

      expect(wrapper.text()).toContain('Creating...')
      expect(wrapper.text()).toContain('Some error')
    })
  })
})
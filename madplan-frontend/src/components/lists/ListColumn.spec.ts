import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListColumn from './ListColumn.vue'
import type { List } from '../../services/board.service'

describe('ListColumn', () => {
  let wrapper: any
  const mockList: List = {
    id: 'list-123',
    title: 'Test List',
    boardId: 'board-123',
    cardOrder: []
  }

  beforeEach(() => {
    wrapper = mount(ListColumn, {
      props: {
        list: mockList,
        isUpdating: false,
        isDeleting: false
      }
    })
  })

  describe('Component Rendering', () => {
    it('should render list title correctly', () => {
      expect(wrapper.text()).toContain('Test List')
      expect(wrapper.find('h3').text()).toBe('Test List')
    })

    it('should show empty state for cards', () => {
      expect(wrapper.text()).toContain('No cards yet')
      expect(wrapper.text()).toContain('Cards will be added in future stories')
    })

    it('should render edit and delete buttons', () => {
      const editButton = wrapper.find('button[title="Edit list title"]')
      const deleteButton = wrapper.find('button[title="Delete list"]')
      
      expect(editButton.exists()).toBe(true)
      expect(deleteButton.exists()).toBe(true)
    })
  })

  describe('Edit Mode', () => {
    it('should enter edit mode when title is clicked', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      expect(input.element.value).toBe('Test List')
    })

    it('should enter edit mode when edit button is clicked', async () => {
      const editButton = wrapper.find('button[title="Edit list title"]')
      await editButton.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      expect(input.element.value).toBe('Test List')
    })

    it('should save changes on Enter key', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.setValue('Updated List Title')
      await input.trigger('keyup.enter')

      expect(wrapper.emitted('update-title')).toBeTruthy()
      expect(wrapper.emitted('update-title')?.[0]).toEqual(['list-123', 'Updated List Title'])
    })

    it('should cancel edit on Escape key', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.setValue('Changed Title')
      await input.trigger('keyup.escape')
      await nextTick()

      // Should exit edit mode and revert to original title
      expect(wrapper.find('h3').text()).toBe('Test List')
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('should save changes when save button is clicked', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.setValue('New Title')

      const saveButton = wrapper.find('button[title="Save"]')
      await saveButton.trigger('click')

      expect(wrapper.emitted('update-title')).toBeTruthy()
      expect(wrapper.emitted('update-title')?.[0]).toEqual(['list-123', 'New Title'])
    })

    it('should cancel changes when cancel button is clicked', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.setValue('Changed Title')

      const cancelButton = wrapper.find('button[title="Cancel"]')
      await cancelButton.trigger('click')
      await nextTick()

      // Should exit edit mode and revert to original title
      expect(wrapper.find('h3').text()).toBe('Test List')
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('should not save if title is empty', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.setValue('')
      await input.trigger('keyup.enter')

      expect(wrapper.emitted('update-title')).toBeFalsy()
      expect(wrapper.find('h3').text()).toBe('Test List') // Should revert
    })

    it('should not save if title is unchanged', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.trigger('keyup.enter')

      expect(wrapper.emitted('update-title')).toBeFalsy()
      expect(wrapper.find('h3').text()).toBe('Test List')
    })
  })

  describe('Loading States', () => {
    it('should show updating state when isUpdating is true', async () => {
      await wrapper.setProps({ isUpdating: true })

      expect(wrapper.text()).toContain('Updating...')
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should show deleting overlay when isDeleting is true', async () => {
      await wrapper.setProps({ isDeleting: true })

      expect(wrapper.text()).toContain('Deleting list...')
      expect(wrapper.find('.bg-red-50').exists()).toBe(true)
    })

    it('should disable edit mode when updating', async () => {
      await wrapper.setProps({ isUpdating: true })

      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      // Should not enter edit mode
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('should disable edit mode when deleting', async () => {
      await wrapper.setProps({ isDeleting: true })

      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      // Should not enter edit mode
      expect(wrapper.find('input').exists()).toBe(false)
    })
  })

  describe('Event Emissions', () => {
    it('should emit delete event when delete button is clicked', async () => {
      const deleteButton = wrapper.find('button[title="Delete list"]')
      await deleteButton.trigger('click')

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')?.[0]).toEqual(['list-123'])
    })

    it('should not emit delete when deleting state is active', async () => {
      await wrapper.setProps({ isDeleting: true })

      const deleteButton = wrapper.find('button[title="Delete list"]')
      expect(deleteButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Props Validation', () => {
    it('should handle different list props correctly', async () => {
      const differentList: List = {
        id: 'different-id',
        title: 'Different Title',
        boardId: 'different-board',
        cardOrder: ['card1', 'card2']
      }

      await wrapper.setProps({ list: differentList })

      expect(wrapper.find('h3').text()).toBe('Different Title')
    })

    it('should handle props with default values', () => {
      const minimalWrapper = mount(ListColumn, {
        props: {
          list: mockList
        }
      })

      expect(minimalWrapper.props('isUpdating')).toBe(false)
      expect(minimalWrapper.props('isDeleting')).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle list with very long title', async () => {
      const longTitle = 'A'.repeat(150)
      const longTitleList = { ...mockList, title: longTitle }

      await wrapper.setProps({ list: longTitleList })

      expect(wrapper.find('h3').text()).toBe(longTitle)
    })

    it('should handle list with special characters', async () => {
      const specialTitle = 'Test & List <>"\'`'
      const specialList = { ...mockList, title: specialTitle }

      await wrapper.setProps({ list: specialList })

      expect(wrapper.find('h3').text()).toBe(specialTitle)
    })

    it('should trim whitespace from edited titles', async () => {
      const titleElement = wrapper.find('h3')
      await titleElement.trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      await input.setValue('  Trimmed Title  ')
      await input.trigger('keyup.enter')

      expect(wrapper.emitted('update-title')?.[0]).toEqual(['list-123', 'Trimmed Title'])
    })
  })
})
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import BoardCard from './BoardCard.vue'
import type { Board } from '../../services/board.service'

// Mock window.confirm for delete confirmation
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn()
})

describe('BoardCard', () => {
  let wrapper: VueWrapper
  
  const mockBoard: Board = {
    id: '507f1f77bcf86cd799439011',
    title: 'Test Board',
    listOrder: ['list1', 'list2', 'list3']
  }

  const defaultProps = {
    board: mockBoard,
    showDeleteButton: false,
    showCreatedDate: false,
    isDeleting: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Rendering', () => {
    it('should render board information correctly', () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      expect(wrapper.text()).toContain('Test Board')
      expect(wrapper.text()).toContain('3 lists')
      expect(wrapper.text()).toContain('Click to open')
    })

    it('should display singular list text for single list', () => {
      const singleListBoard = { ...mockBoard, listOrder: ['list1'] }
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, board: singleListBoard }
      })

      expect(wrapper.text()).toContain('1 list')
    })

    it('should display created date when showCreatedDate is true', () => {
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, showCreatedDate: true }
      })

      expect(wrapper.text()).toContain('Created recently')
    })

    it('should show delete button when showDeleteButton is true', () => {
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, showDeleteButton: true }
      })

      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')
      expect(deleteButton.exists()).toBe(true)
    })

    it('should hide delete button when showDeleteButton is false', () => {
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, showDeleteButton: false }
      })

      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')
      expect(deleteButton.exists()).toBe(false)
    })
  })

  describe('Interactive Behavior', () => {
    it('should emit click event when card is clicked', async () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')?.[0]).toEqual([mockBoard])
    })

    it('should emit click event when Enter key is pressed', async () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      await wrapper.trigger('keypress.enter')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')?.[0]).toEqual([mockBoard])
    })

    it('should have proper keyboard accessibility attributes', () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      expect(wrapper.attributes('tabindex')).toBe('0')
      expect(wrapper.attributes('role')).toBe('button')
      expect(wrapper.attributes('aria-label')).toBe('Open board: Test Board')
    })
  })

  describe('Delete Functionality', () => {
    beforeEach(() => {
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, showDeleteButton: true }
      })
    })

    it('should show confirmation dialog when delete button is clicked', async () => {
      const confirmSpy = vi.mocked(window.confirm).mockReturnValue(true)
      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')

      await deleteButton.trigger('click')

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to delete the board "Test Board"? This action cannot be undone.'
      )
    })

    it('should emit delete event when deletion is confirmed', async () => {
      vi.mocked(window.confirm).mockReturnValue(true)
      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')

      await deleteButton.trigger('click')

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')?.[0]).toEqual([mockBoard])
    })

    it('should not emit delete event when deletion is cancelled', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')

      await deleteButton.trigger('click')

      expect(wrapper.emitted('delete')).toBeFalsy()
    })

    it('should not trigger card click when delete button is clicked', async () => {
      vi.mocked(window.confirm).mockReturnValue(true)
      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')

      await deleteButton.trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('should show loading state when isDeleting is true', () => {
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, showDeleteButton: true, isDeleting: true }
      })

      const deleteButton = wrapper.find('button[aria-label*="Delete board"]')
      expect(deleteButton.find('.animate-spin').exists()).toBe(true)
    })
  })

  describe('Visual States', () => {
    it('should apply hover styles with proper classes', () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      expect(wrapper.classes()).toContain('hover:border-emerald-300')
      expect(wrapper.classes()).toContain('hover:shadow-lg')
      expect(wrapper.classes()).toContain('hover:-translate-y-1')
    })

    it('should have focus styles for accessibility', () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      expect(wrapper.classes()).toContain('focus:outline-none')
      expect(wrapper.classes()).toContain('focus:ring-2')
      expect(wrapper.classes()).toContain('focus:ring-emerald-500')
    })

    it('should show proper visual indicators', () => {
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, showDeleteButton: true }
      })

      // Should have arrow indicator
      const arrowIcon = wrapper.find('svg path[d*="M9 5l7 7-7 7"]')
      expect(arrowIcon.exists()).toBe(true)

      // Should have board icon
      const boardIcon = wrapper.find('svg path[d*="M19 11H5m14 0a2 2 0"]')
      expect(boardIcon.exists()).toBe(true)

      // Should have visual indicator dot
      const indicatorDot = wrapper.find('.w-2.h-2.bg-emerald-400.rounded-full')
      expect(indicatorDot.exists()).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    it('should calculate list count text correctly for multiple lists', () => {
      wrapper = mount(BoardCard, {
        props: defaultProps
      })

      expect(wrapper.text()).toContain('3 lists')
    })

    it('should calculate list count text correctly for single list', () => {
      const singleListBoard = { ...mockBoard, listOrder: ['list1'] }
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, board: singleListBoard }
      })

      expect(wrapper.text()).toContain('1 list')
    })

    it('should calculate list count text correctly for no lists', () => {
      const noListBoard = { ...mockBoard, listOrder: [] }
      wrapper = mount(BoardCard, {
        props: { ...defaultProps, board: noListBoard }
      })

      expect(wrapper.text()).toContain('0 lists')
    })
  })

  describe('Props Validation', () => {
    it('should handle all prop combinations correctly', () => {
      const allPropsEnabled = {
        board: mockBoard,
        showDeleteButton: true,
        showCreatedDate: true,
        isDeleting: true
      }

      wrapper = mount(BoardCard, {
        props: allPropsEnabled
      })

      expect(wrapper.text()).toContain('Test Board')
      expect(wrapper.text()).toContain('Created recently')
      expect(wrapper.find('button[aria-label*="Delete board"]').exists()).toBe(true)
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should handle minimal props correctly', () => {
      const minimalProps = {
        board: mockBoard
      }

      wrapper = mount(BoardCard, {
        props: minimalProps
      })

      expect(wrapper.text()).toContain('Test Board')
      expect(wrapper.text()).not.toContain('Created recently')
      expect(wrapper.find('button[aria-label*="Delete board"]').exists()).toBe(false)
      expect(wrapper.find('.animate-spin').exists()).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle board with very long title', () => {
      const longTitleBoard = {
        ...mockBoard,
        title: 'This is a very long board title that should be truncated when displayed in the card to maintain proper layout and design'
      }

      wrapper = mount(BoardCard, {
        props: { ...defaultProps, board: longTitleBoard }
      })

      const titleElement = wrapper.find('h4')
      expect(titleElement.classes()).toContain('truncate')
      expect(wrapper.text()).toContain('This is a very long board title')
    })

    it('should handle board with special characters in title', () => {
      const specialCharBoard = {
        ...mockBoard,
        title: 'Board with "quotes" & <special> chars!'
      }

      wrapper = mount(BoardCard, {
        props: { ...defaultProps, board: specialCharBoard }
      })

      expect(wrapper.text()).toContain('Board with "quotes" & <special> chars!')
    })
  })
})
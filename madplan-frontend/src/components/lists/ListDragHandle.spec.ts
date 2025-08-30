import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import ListDragHandle from './ListDragHandle.vue'

describe('ListDragHandle', () => {
  let wrapper: VueWrapper<any>

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(ListDragHandle, {
      props: {
        listTitle: 'Test List',
        isDragging: false,
        disabled: false,
        listIndex: 0,
        totalLists: 3,
        ...props
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render drag handle with correct structure', () => {
      wrapper = createWrapper()

      expect(wrapper.find('.list-drag-handle').exists()).toBe(true)
      expect(wrapper.find('svg').exists()).toBe(true)
      expect(wrapper.find('.sr-only').exists()).toBe(true)
    })

    it('should have proper role and tabindex', () => {
      wrapper = createWrapper()

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.attributes('role')).toBe('button')
      expect(handle.attributes('tabindex')).toBe('0')
    })

    it('should display correct drag icon', () => {
      wrapper = createWrapper()

      const svg = wrapper.find('svg')
      expect(svg.attributes('viewBox')).toBe('0 0 24 24')
      expect(svg.find('path').attributes('d')).toBe('M8 9h8M8 15h8')
    })
  })

  describe('Visual States', () => {
    it('should apply default styles when not dragging', () => {
      wrapper = createWrapper()

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.classes()).toContain('opacity-0')
      expect(handle.classes()).toContain('group-hover:opacity-100')
      expect(handle.classes()).toContain('cursor-grab')
    })

    it('should apply dragging styles when isDragging is true', () => {
      wrapper = createWrapper({
        isDragging: true
      })

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.classes()).toContain('opacity-100')
      expect(handle.classes()).toContain('text-emerald-600')
      expect(handle.classes()).toContain('cursor-grabbing')
    })

    it('should show visual feedback on hover', () => {
      wrapper = createWrapper()

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.classes()).toContain('hover:text-emerald-600')
    })

    it('should have smooth transitions', () => {
      wrapper = createWrapper()

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.classes()).toContain('transition-all')
      expect(handle.classes()).toContain('duration-200')
    })
  })

  describe('Accessibility Features', () => {
    it('should generate correct aria-label', () => {
      wrapper = createWrapper({
        listTitle: 'My List',
        listIndex: 1,
        totalLists: 5
      })

      const handle = wrapper.find('.list-drag-handle')
      const ariaLabel = handle.attributes('aria-label')
      expect(ariaLabel).toContain('Drag handle for list: My List')
      expect(ariaLabel).toContain('Position: 2 of 5')
      expect(ariaLabel).toContain('Press Enter or Space to start keyboard dragging')
    })

    it('should update aria-label when disabled', () => {
      wrapper = createWrapper({
        disabled: true
      })

      const handle = wrapper.find('.list-drag-handle')
      const ariaLabel = handle.attributes('aria-label')
      expect(ariaLabel).toContain('Dragging disabled')
    })

    it('should update aria-label during keyboard dragging', async () => {
      wrapper = createWrapper()

      // Start keyboard dragging
      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      const handle = wrapper.find('.list-drag-handle')
      const ariaLabel = handle.attributes('aria-label')
      expect(ariaLabel).toContain('Keyboard dragging active')
    })

    it('should have correct title attribute', () => {
      wrapper = createWrapper()

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.attributes('title')).toBe('Drag to reorder list')
    })

    it('should update title when dragging', () => {
      wrapper = createWrapper({
        isDragging: true
      })

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.attributes('title')).toBe('Currently dragging list')
    })

    it('should update title when disabled', () => {
      wrapper = createWrapper({
        disabled: true
      })

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.attributes('title')).toBe('Drag disabled')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should start keyboard dragging on Enter key', async () => {
      wrapper = createWrapper()
      const emitted = wrapper.emitted()

      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      expect(emitted['drag-start']).toBeTruthy()
      expect(emitted['drag-start']).toHaveLength(1)
    })

    it('should start keyboard dragging on Space key', async () => {
      wrapper = createWrapper()

      await wrapper.find('.list-drag-handle').trigger('keydown', { key: ' ' })

      expect(wrapper.emitted('drag-start')).toBeTruthy()
    })

    it('should prevent default on Enter and Space', async () => {
      wrapper = createWrapper()
      const handle = wrapper.find('.list-drag-handle')

      const enterEvent = { key: 'Enter', preventDefault: vi.fn() }
      const spaceEvent = { key: ' ', preventDefault: vi.fn() }

      await handle.trigger('keydown', enterEvent)
      await handle.trigger('keydown', spaceEvent)

      expect(enterEvent.preventDefault).toHaveBeenCalled()
      expect(spaceEvent.preventDefault).toHaveBeenCalled()
    })

    it('should handle arrow keys during keyboard dragging', async () => {
      wrapper = createWrapper()

      // Start keyboard dragging
      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      // Test left arrow
      const leftEvent = { key: 'ArrowLeft', preventDefault: vi.fn() }
      await wrapper.find('.list-drag-handle').trigger('keydown', leftEvent)
      expect(wrapper.emitted('keyboard-move')).toBeTruthy()
      expect(wrapper.emitted('keyboard-move')?.[0]).toEqual(['left'])
      expect(leftEvent.preventDefault).toHaveBeenCalled()

      // Test right arrow
      const rightEvent = { key: 'ArrowRight', preventDefault: vi.fn() }
      await wrapper.find('.list-drag-handle').trigger('keydown', rightEvent)
      expect(wrapper.emitted('keyboard-move')?.[1]).toEqual(['right'])
      expect(rightEvent.preventDefault).toHaveBeenCalled()
    })

    it('should end keyboard dragging on Enter when already dragging', async () => {
      wrapper = createWrapper()

      // Start keyboard dragging
      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })
      
      // End keyboard dragging
      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      const dragStartEvents = wrapper.emitted('drag-start')
      const dragEndEvents = wrapper.emitted('drag-end')
      
      expect(dragStartEvents).toHaveLength(1)
      expect(dragEndEvents).toHaveLength(1)
    })

    it('should cancel keyboard dragging on Escape', async () => {
      wrapper = createWrapper()

      // Start keyboard dragging
      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      const escapeEvent = { key: 'Escape', preventDefault: vi.fn() }
      await wrapper.find('.list-drag-handle').trigger('keydown', escapeEvent)

      expect(escapeEvent.preventDefault).toHaveBeenCalled()
      // Should not emit drag-end for cancellation
      expect(wrapper.emitted('drag-end')).toBeFalsy()
    })

    it('should not respond to keys when disabled', async () => {
      wrapper = createWrapper({
        disabled: true
      })

      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('drag-start')).toBeFalsy()
    })

    it('should ignore arrow keys when not keyboard dragging', async () => {
      wrapper = createWrapper()

      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'ArrowLeft' })

      expect(wrapper.emitted('keyboard-move')).toBeFalsy()
    })
  })

  describe('Focus Management', () => {
    it('should update focus state on focus event', async () => {
      wrapper = createWrapper()

      await wrapper.find('.list-drag-handle').trigger('focus')

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toContain('Drag handle focused')
    })

    it('should clear focus state on blur event', async () => {
      wrapper = createWrapper()

      // Focus then blur
      await wrapper.find('.list-drag-handle').trigger('focus')
      await wrapper.find('.list-drag-handle').trigger('blur')

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toBe('')
    })

    it('should cancel keyboard dragging on blur', async () => {
      wrapper = createWrapper()

      // Start keyboard dragging
      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })
      
      // Blur should cancel dragging
      await wrapper.find('.list-drag-handle').trigger('blur')

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toBe('')
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should announce when dragging starts', async () => {
      wrapper = createWrapper()

      await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Enter' })

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toContain('Keyboard dragging active')
      expect(screenReader.text()).toContain('Left and Right arrow keys to move')
    })

    it('should announce when focused', async () => {
      wrapper = createWrapper()

      await wrapper.find('.list-drag-handle').trigger('focus')

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toContain('Press Enter or Space to start keyboard dragging')
    })

    it('should announce when prop dragging is active', async () => {
      wrapper = createWrapper({
        isDragging: true
      })

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toContain('List is being dragged')
    })

    it('should be quiet when not focused or dragging', () => {
      wrapper = createWrapper()

      const screenReader = wrapper.find('.sr-only')
      expect(screenReader.text()).toBe('')
    })
  })

  describe('Mobile and Touch Support', () => {
    it('should have enhanced touch targets in mobile styles', () => {
      wrapper = createWrapper()

      // Should have mobile-specific CSS
      const styles = wrapper.find('style').text()
      expect(styles).toContain('@media (hover: none) and (pointer: coarse)')
      expect(styles).toContain('min-w-[44px]')
      expect(styles).toContain('min-h-[44px]')
    })

    it('should maintain proper cursor states', () => {
      wrapper = createWrapper()

      const handle = wrapper.find('.list-drag-handle')
      expect(handle.classes()).toContain('cursor-grab')

      wrapper = createWrapper({ isDragging: true })
      const draggingHandle = wrapper.find('.list-drag-handle')
      expect(draggingHandle.classes()).toContain('cursor-grabbing')
    })
  })

  describe('Accessibility Standards Compliance', () => {
    it('should have proper focus styles', () => {
      wrapper = createWrapper()

      const styles = wrapper.find('style').text()
      expect(styles).toContain(':focus')
      expect(styles).toContain('ring-2')
      expect(styles).toContain('ring-emerald-500')
    })

    it('should support high contrast mode', () => {
      wrapper = createWrapper()

      const styles = wrapper.find('style').text()
      expect(styles).toContain('@media (prefers-contrast: high)')
    })

    it('should support reduced motion', () => {
      wrapper = createWrapper()

      const styles = wrapper.find('style').text()
      expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
      expect(styles).toContain('transition-none')
    })

    it('should have screen reader only content properly hidden', () => {
      wrapper = createWrapper()

      const srOnly = wrapper.find('.sr-only')
      const styles = wrapper.find('style').text()
      
      expect(srOnly.exists()).toBe(true)
      expect(styles).toContain('position: absolute')
      expect(styles).toContain('width: 1px')
      expect(styles).toContain('height: 1px')
    })
  })

  describe('Event Handling Edge Cases', () => {
    it('should handle rapid keyboard events gracefully', async () => {
      wrapper = createWrapper()

      // Rapidly fire events
      const handle = wrapper.find('.list-drag-handle')
      await handle.trigger('keydown', { key: 'Enter' })
      await handle.trigger('keydown', { key: 'ArrowLeft' })
      await handle.trigger('keydown', { key: 'ArrowRight' })
      await handle.trigger('keydown', { key: 'Enter' })

      // Should handle all events without errors
      expect(wrapper.emitted('drag-start')).toHaveLength(1)
      expect(wrapper.emitted('drag-end')).toHaveLength(1)
      expect(wrapper.emitted('keyboard-move')).toHaveLength(2)
    })

    it('should handle unknown key events gracefully', async () => {
      wrapper = createWrapper()

      // Should not throw on unknown keys
      expect(async () => {
        await wrapper.find('.list-drag-handle').trigger('keydown', { key: 'Unknown' })
      }).not.toThrow()
    })

    it('should maintain consistent state during rapid prop changes', async () => {
      wrapper = createWrapper()

      // Rapidly change props
      await wrapper.setProps({ isDragging: true })
      await wrapper.setProps({ disabled: true })
      await wrapper.setProps({ isDragging: false })
      await wrapper.setProps({ disabled: false })

      // Should render correctly
      const handle = wrapper.find('.list-drag-handle')
      expect(handle.exists()).toBe(true)
      expect(handle.classes()).toContain('cursor-grab')
    })
  })
})
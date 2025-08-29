import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import FormButton from './FormButton.vue'

describe('FormButton', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render correctly with default props', () => {
      wrapper = mount(FormButton)

      expect(wrapper.find('button').exists()).toBe(true)
      expect(wrapper.find('button').attributes('type')).toBe('button')
      expect(wrapper.find('button').classes()).toContain('form-button')
    })

    it('should render text from text prop', () => {
      wrapper = mount(FormButton, {
        props: {
          text: 'Click Me',
        },
      })

      expect(wrapper.text()).toContain('Click Me')
    })

    it('should render slot content over text prop', () => {
      wrapper = mount(FormButton, {
        props: {
          text: 'Text Prop',
        },
        slots: {
          default: 'Slot Content',
        },
      })

      expect(wrapper.text()).toContain('Slot Content')
      expect(wrapper.text()).not.toContain('Text Prop')
    })
  })

  describe('Button Types', () => {
    it('should render button type by default', () => {
      wrapper = mount(FormButton)

      expect(wrapper.find('button').attributes('type')).toBe('button')
    })

    it('should render submit type when specified', () => {
      wrapper = mount(FormButton, {
        props: {
          type: 'submit',
        },
      })

      expect(wrapper.find('button').attributes('type')).toBe('submit')
    })

    it('should render reset type when specified', () => {
      wrapper = mount(FormButton, {
        props: {
          type: 'reset',
        },
      })

      expect(wrapper.find('button').attributes('type')).toBe('reset')
    })
  })

  describe('Button Variants', () => {
    it('should apply primary variant classes by default', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.classes()).toContain('bg-emerald-600')
      expect(button.classes()).toContain('text-white')
    })

    it('should apply secondary variant classes', () => {
      wrapper = mount(FormButton, {
        props: {
          variant: 'secondary',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('bg-emerald-100')
      expect(button.classes()).toContain('text-emerald-800')
    })

    it('should apply outline variant classes', () => {
      wrapper = mount(FormButton, {
        props: {
          variant: 'outline',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('border-2')
      expect(button.classes()).toContain('border-emerald-600')
      expect(button.classes()).toContain('text-emerald-600')
      expect(button.classes()).toContain('bg-transparent')
    })

    it('should apply ghost variant classes', () => {
      wrapper = mount(FormButton, {
        props: {
          variant: 'ghost',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('text-emerald-600')
      expect(button.classes()).toContain('bg-transparent')
    })
  })

  describe('Button Sizes', () => {
    it('should apply medium size classes by default', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.classes()).toContain('px-6')
      expect(button.classes()).toContain('py-3')
      expect(button.classes()).toContain('text-base')
    })

    it('should apply small size classes', () => {
      wrapper = mount(FormButton, {
        props: {
          size: 'sm',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('px-3')
      expect(button.classes()).toContain('py-2')
      expect(button.classes()).toContain('text-sm')
    })

    it('should apply large size classes', () => {
      wrapper = mount(FormButton, {
        props: {
          size: 'lg',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('px-8')
      expect(button.classes()).toContain('py-4')
      expect(button.classes()).toContain('text-lg')
    })
  })

  describe('Full Width', () => {
    it('should not apply full width by default', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.classes()).not.toContain('w-full')
    })

    it('should apply full width classes when specified', () => {
      wrapper = mount(FormButton, {
        props: {
          fullWidth: true,
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('w-full')
    })
  })

  describe('Disabled State', () => {
    it('should not be disabled by default', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeUndefined()
    })

    it('should be disabled when disabled prop is true', () => {
      wrapper = mount(FormButton, {
        props: {
          disabled: true,
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('should apply disabled styling', () => {
      wrapper = mount(FormButton, {
        props: {
          disabled: true,
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('disabled:opacity-50')
      expect(button.classes()).toContain('disabled:cursor-not-allowed')
    })

    it('should not emit click event when disabled', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          disabled: true,
          onClick,
        },
      })

      await wrapper.find('button').trigger('click')
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should not be in loading state by default', () => {
      wrapper = mount(FormButton)

      expect(wrapper.find('svg').exists()).toBe(false)
      expect(wrapper.find('span').text()).not.toContain('Loading...')
    })

    it('should show loading spinner when loading', () => {
      wrapper = mount(FormButton, {
        props: {
          loading: true,
        },
      })

      const spinner = wrapper.find('svg')
      expect(spinner.exists()).toBe(true)
      expect(spinner.classes()).toContain('animate-spin')
    })

    it('should show loading text when loading', () => {
      wrapper = mount(FormButton, {
        props: {
          loading: true,
          text: 'Submit',
        },
      })

      expect(wrapper.text()).toContain('Loading...')
      expect(wrapper.text()).not.toContain('Submit')
    })

    it('should show custom loading text', () => {
      wrapper = mount(FormButton, {
        props: {
          loading: true,
          loadingText: 'Processing...',
        },
      })

      expect(wrapper.text()).toContain('Processing...')
    })

    it('should be disabled when loading', () => {
      wrapper = mount(FormButton, {
        props: {
          loading: true,
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('should not emit click event when loading', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          loading: true,
          onClick,
        },
      })

      await wrapper.find('button').trigger('click')
      expect(onClick).not.toHaveBeenCalled()
    })

    it('should hide slot content when loading', () => {
      wrapper = mount(FormButton, {
        props: {
          loading: true,
        },
        slots: {
          default: 'Button Text',
        },
      })

      // The slot content should not be visible, only loading text
      const spans = wrapper.findAll('span')
      const visibleSpan = spans.find(span => !span.attributes().hasOwnProperty('v-if'))
      expect(visibleSpan?.text()).toBe('Loading...')
    })
  })

  describe('Click Events', () => {
    it('should emit click event when clicked', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          onClick,
        },
      })

      await wrapper.find('button').trigger('click')
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledWith(expect.any(MouseEvent))
    })

    it('should not emit click event when disabled', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          disabled: true,
          onClick,
        },
      })

      await wrapper.find('button').trigger('click')
      expect(onClick).not.toHaveBeenCalled()
    })

    it('should not emit click event when loading', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          loading: true,
          onClick,
        },
      })

      await wrapper.find('button').trigger('click')
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button semantics', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.element.tagName).toBe('BUTTON')
    })

    it('should have focus ring classes', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.classes()).toContain('focus:outline-none')
      expect(button.classes()).toContain('focus:ring-4')
      expect(button.classes()).toContain('focus:ring-emerald-300')
    })

    it('should be focusable when not disabled', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeUndefined()
    })

    it('should not be focusable when disabled', () => {
      wrapper = mount(FormButton, {
        props: {
          disabled: true,
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  describe('Styling and Visual Effects', () => {
    it('should apply transition classes', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.classes()).toContain('transition-all')
      expect(button.classes()).toContain('duration-200')
      expect(button.classes()).toContain('ease-in-out')
    })

    it('should apply base styling classes', () => {
      wrapper = mount(FormButton)

      const button = wrapper.find('button')
      expect(button.classes()).toContain('inline-flex')
      expect(button.classes()).toContain('items-center')
      expect(button.classes()).toContain('justify-center')
      expect(button.classes()).toContain('font-semibold')
      expect(button.classes()).toContain('rounded-lg')
    })

    it('should apply shadow and transform effects for primary variant', () => {
      wrapper = mount(FormButton, {
        props: {
          variant: 'primary',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('shadow-lg')
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle primary large full-width button', () => {
      wrapper = mount(FormButton, {
        props: {
          variant: 'primary',
          size: 'lg',
          fullWidth: true,
          text: 'Submit Form',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('bg-emerald-600')
      expect(button.classes()).toContain('px-8')
      expect(button.classes()).toContain('py-4')
      expect(button.classes()).toContain('text-lg')
      expect(button.classes()).toContain('w-full')
      expect(wrapper.text()).toContain('Submit Form')
    })

    it('should handle disabled loading state', () => {
      wrapper = mount(FormButton, {
        props: {
          disabled: true,
          loading: true,
          text: 'Submit',
          loadingText: 'Submitting...',
        },
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.find('svg').exists()).toBe(true)
      expect(wrapper.text()).toContain('Submitting...')
      expect(wrapper.text()).not.toContain('Submit')
    })

    it('should handle outline variant with custom slot', () => {
      wrapper = mount(FormButton, {
        props: {
          variant: 'outline',
          size: 'sm',
        },
        slots: {
          default: '<span>Custom <strong>Content</strong></span>',
        },
      })

      const button = wrapper.find('button')
      expect(button.classes()).toContain('border-2')
      expect(button.classes()).toContain('border-emerald-600')
      expect(button.classes()).toContain('px-3')
      expect(button.classes()).toContain('py-2')
      expect(wrapper.html()).toContain('<strong>Content</strong>')
    })
  })

  describe('Event Handling Edge Cases', () => {
    it('should handle rapid clicking correctly', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          onClick,
        },
      })

      const button = wrapper.find('button')
      
      // Rapid clicks
      await button.trigger('click')
      await button.trigger('click')
      await button.trigger('click')

      expect(onClick).toHaveBeenCalledTimes(3)
    })

    it('should prevent clicks during loading state changes', async () => {
      const onClick = vi.fn()
      wrapper = mount(FormButton, {
        props: {
          loading: false,
          onClick,
        },
      })

      // Click before loading
      await wrapper.find('button').trigger('click')
      expect(onClick).toHaveBeenCalledTimes(1)

      // Set loading state
      await wrapper.setProps({ loading: true })

      // Try to click during loading
      await wrapper.find('button').trigger('click')
      expect(onClick).toHaveBeenCalledTimes(1) // Should not increase
    })
  })
})
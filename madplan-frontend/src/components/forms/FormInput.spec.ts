import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import FormInput from './FormInput.vue'

describe('FormInput', () => {
  let wrapper: VueWrapper<any>

  const defaultProps = {
    modelValue: '',
    'onUpdate:modelValue': vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render correctly with default props', () => {
      wrapper = mount(FormInput, {
        props: defaultProps,
      })

      expect(wrapper.find('input').exists()).toBe(true)
      expect(wrapper.find('input').attributes('type')).toBe('text')
      expect(wrapper.find('label').exists()).toBe(false)
    })

    it('should render label when provided', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          label: 'Test Label',
        },
      })

      const label = wrapper.find('label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe('Test Label')
    })

    it('should render required asterisk when required', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          label: 'Test Label',
          required: true,
        },
      })

      const requiredSpan = wrapper.find('span.text-red-500')
      expect(requiredSpan.exists()).toBe(true)
      expect(requiredSpan.text()).toBe('*')
    })

    it('should not render required asterisk when not required', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          label: 'Test Label',
          required: false,
        },
      })

      const requiredSpan = wrapper.find('span.text-red-500')
      expect(requiredSpan.exists()).toBe(false)
    })
  })

  describe('Input Types and Attributes', () => {
    it('should render text input by default', () => {
      wrapper = mount(FormInput, {
        props: defaultProps,
      })

      const input = wrapper.find('input')
      expect(input.attributes('type')).toBe('text')
    })

    it('should render email input when type is email', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          type: 'email',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('type')).toBe('email')
    })

    it('should render password input when type is password', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          type: 'password',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('type')).toBe('password')
    })

    it('should apply placeholder when provided', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          placeholder: 'Enter your email',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('placeholder')).toBe('Enter your email')
    })

    it('should set required attribute when required', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          required: true,
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('required')).toBeDefined()
    })

    it('should set disabled attribute when disabled', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('disabled')).toBeDefined()
    })
  })

  describe('Value Binding', () => {
    it('should display the model value', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          modelValue: 'test value',
        },
      })

      const input = wrapper.find('input')
      expect(input.element.value).toBe('test value')
    })

    it('should emit update:modelValue on input', async () => {
      const updateModelValue = vi.fn()
      wrapper = mount(FormInput, {
        props: {
          modelValue: '',
          'onUpdate:modelValue': updateModelValue,
        },
      })

      const input = wrapper.find('input')
      await input.setValue('new value')

      expect(updateModelValue).toHaveBeenCalledWith('new value')
    })

    it('should emit blur event on input blur', async () => {
      const onBlur = vi.fn()
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          onBlur,
        },
      })

      const input = wrapper.find('input')
      await input.trigger('blur')

      expect(onBlur).toHaveBeenCalled()
    })

    it('should emit enter event on Enter key press', async () => {
      const onEnter = vi.fn()
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          onEnter,
        },
      })

      const input = wrapper.find('input')
      await input.trigger('keydown.enter')

      expect(onEnter).toHaveBeenCalled()
    })
  })

  describe('Password Visibility Toggle', () => {
    it('should render password toggle button for password inputs', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          type: 'password',
        },
      })

      const toggleButton = wrapper.find('button[aria-label*="password"]')
      expect(toggleButton.exists()).toBe(true)
    })

    it('should not render password toggle for non-password inputs', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          type: 'text',
        },
      })

      const toggleButton = wrapper.find('button[aria-label*="password"]')
      expect(toggleButton.exists()).toBe(false)
    })

    it('should toggle password visibility on button click', async () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          type: 'password',
        },
      })

      const input = wrapper.find('input')
      const toggleButton = wrapper.find('button[aria-label*="password"]')

      // Initial state: password hidden
      expect(input.attributes('type')).toBe('password')
      expect(toggleButton.attributes('aria-label')).toBe('Show password')

      // Click to show password
      await toggleButton.trigger('click')
      await wrapper.vm.$nextTick()

      expect(input.attributes('type')).toBe('text')
      expect(toggleButton.attributes('aria-label')).toBe('Hide password')

      // Click to hide password again
      await toggleButton.trigger('click')
      await wrapper.vm.$nextTick()

      expect(input.attributes('type')).toBe('password')
      expect(toggleButton.attributes('aria-label')).toBe('Show password')
    })
  })

  describe('Error States', () => {
    it('should render error message when error prop is provided', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          error: 'This field is required',
        },
      })

      const errorElement = wrapper.find('p[role="alert"]')
      expect(errorElement.exists()).toBe(true)
      expect(errorElement.text()).toBe('This field is required')
    })

    it('should apply error styling when error is present', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          error: 'Error message',
        },
      })

      const input = wrapper.find('input')
      expect(input.classes()).toContain('border-red-300')
      expect(input.classes()).toContain('bg-red-50')
    })

    it('should set aria-invalid when error is present', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          error: 'Error message',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('aria-invalid')).toBe('true')
    })

    it('should link error message to input with aria-describedby', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          error: 'Error message',
        },
      })

      const input = wrapper.find('input')
      const errorElement = wrapper.find('p[role="alert"]')
      
      expect(input.attributes('aria-describedby')).toBeDefined()
      expect(errorElement.attributes('id')).toBe(input.attributes('aria-describedby'))
    })
  })

  describe('Helper Text', () => {
    it('should render helper text when provided and no error', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          helperText: 'Enter a valid email address',
        },
      })

      const helperElement = wrapper.find('p.text-emerald-600')
      expect(helperElement.exists()).toBe(true)
      expect(helperElement.text()).toBe('Enter a valid email address')
    })

    it('should not render helper text when error is present', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          helperText: 'Helper text',
          error: 'Error message',
        },
      })

      const helperElement = wrapper.find('p.text-emerald-600')
      expect(helperElement.exists()).toBe(false)
    })
  })

  describe('Accessibility', () => {
    it('should have proper label association', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          label: 'Email Address',
        },
      })

      const label = wrapper.find('label')
      const input = wrapper.find('input')
      
      expect(label.attributes('for')).toBe(input.attributes('id'))
    })

    it('should generate unique id when not provided', () => {
      const wrapper1 = mount(FormInput, { props: defaultProps })
      const wrapper2 = mount(FormInput, { props: defaultProps })

      const input1 = wrapper1.find('input')
      const input2 = wrapper2.find('input')

      expect(input1.attributes('id')).not.toBe(input2.attributes('id'))
    })

    it('should use provided id when given', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          id: 'custom-input-id',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('id')).toBe('custom-input-id')
    })

    it('should have proper ARIA attributes', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          error: 'Error message',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.attributes('aria-describedby')).toBeDefined()
    })
  })

  describe('Styling Classes', () => {
    it('should apply default styling classes', () => {
      wrapper = mount(FormInput, {
        props: defaultProps,
      })

      const input = wrapper.find('input')
      expect(input.classes()).toContain('form-input')
      expect(input.classes()).toContain('border-emerald-200')
      expect(input.classes()).toContain('bg-white')
    })

    it('should apply disabled styling when disabled', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      })

      const input = wrapper.find('input')
      expect(input.classes()).toContain('disabled:bg-emerald-50')
      expect(input.classes()).toContain('disabled:cursor-not-allowed')
    })
  })

  describe('Event Handling', () => {
    it('should handle input events correctly', async () => {
      const updateModelValue = vi.fn()
      wrapper = mount(FormInput, {
        props: {
          modelValue: '',
          'onUpdate:modelValue': updateModelValue,
        },
      })

      const input = wrapper.find('input')
      const inputElement = input.element as HTMLInputElement

      // Simulate typing
      inputElement.value = 'test'
      await input.trigger('input')

      expect(updateModelValue).toHaveBeenCalledWith('test')
    })

    it('should handle blur events correctly', async () => {
      const onBlur = vi.fn()
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          onBlur,
        },
      })

      const input = wrapper.find('input')
      await input.trigger('blur')

      expect(onBlur).toHaveBeenCalled()
      expect(onBlur).toHaveBeenCalledWith(expect.any(Event))
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string model value', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          modelValue: '',
        },
      })

      const input = wrapper.find('input')
      expect(input.element.value).toBe('')
    })

    it('should handle whitespace model value', () => {
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          modelValue: '   ',
        },
      })

      const input = wrapper.find('input')
      expect(input.element.value).toBe('   ')
    })

    it('should handle special characters in model value', () => {
      const specialValue = 'test@example.com!@#$%^&*()'
      wrapper = mount(FormInput, {
        props: {
          ...defaultProps,
          modelValue: specialValue,
        },
      })

      const input = wrapper.find('input')
      expect(input.element.value).toBe(specialValue)
    })
  })
})
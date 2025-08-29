import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import LoginView from './LoginView.vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

// Mock Vue Router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('LoginView Integration Tests', () => {
  let wrapper: VueWrapper<any>
  let authStore: any
  let pinia: any

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
    mockPush.mockClear()

    // Create fresh Pinia store
    pinia = createPinia()
    setActivePinia(pinia)
    authStore = useAuthStore()

    // Mock auth store methods and properties
    authStore.login = vi.fn()
    authStore.clearError = vi.fn()
    authStore.register = vi.fn()
    authStore.logout = vi.fn()
    authStore.initializeAuth = vi.fn()
    authStore.isLoading = false
    authStore.error = null
    authStore.isAuthenticated = false
    authStore.user = null
    authStore.token = null
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Mounting and Initial State', () => {
    it('should render correctly with all form elements', () => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })

      // Check main structure
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.findAll('input')).toHaveLength(2)
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true)

      // Check form fields
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')
      expect(emailInput.exists()).toBe(true)
      expect(passwordInput.exists()).toBe(true)

      // Check labels
      expect(wrapper.text()).toContain('Email Address')
      expect(wrapper.text()).toContain('Password')

      // Check submit button
      expect(wrapper.text()).toContain('Sign In')

      // Check registration link
      expect(wrapper.text()).toContain("Don't have an account?")
      expect(wrapper.text()).toContain('Sign up here')
    })

    it('should clear auth error on mount', () => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })

      expect(authStore.clearError).toHaveBeenCalledOnce()
    })

    it('should redirect to dashboard if already authenticated', async () => {
      authStore.isAuthenticated = true

      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })

      await nextTick()
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('should have submit button disabled initially', () => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    describe('Email Validation', () => {
      it('should show error for empty email on blur', async () => {
        const emailInput = wrapper.find('input[type="email"]')
        
        await emailInput.setValue('')
        await emailInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Email is required')
      })

      it('should show error for invalid email format', async () => {
        const emailInput = wrapper.find('input[type="email"]')
        
        await emailInput.setValue('invalid-email')
        await emailInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Please enter a valid email address')
      })

      it('should not show error for valid email', async () => {
        const emailInput = wrapper.find('input[type="email"]')
        
        await emailInput.setValue('user@example.com')
        await emailInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).not.toContain('Email is required')
        expect(wrapper.text()).not.toContain('Please enter a valid email address')
      })
    })

    describe('Password Validation', () => {
      it('should show error for empty password on blur', async () => {
        const passwordInput = wrapper.find('input[type="password"]')
        
        await passwordInput.setValue('')
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Password is required')
      })

      it('should show error for password too short', async () => {
        const passwordInput = wrapper.find('input[type="password"]')
        
        await passwordInput.setValue('12345') // 5 characters
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Password must be at least 6 characters')
      })

      it('should show error for password too long', async () => {
        const passwordInput = wrapper.find('input[type="password"]')
        const longPassword = 'a'.repeat(129) // 129 characters
        
        await passwordInput.setValue(longPassword)
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Password must not exceed 128 characters')
      })

      it('should not show error for valid password', async () => {
        const passwordInput = wrapper.find('input[type="password"]')
        
        await passwordInput.setValue('validpassword123')
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).not.toContain('Password is required')
        expect(wrapper.text()).not.toContain('Password must be at least 6 characters')
        expect(wrapper.text()).not.toContain('Password must not exceed 128 characters')
      })
    })

    describe('Form State Management', () => {
      it('should enable submit button when form is valid', async () => {
        const emailInput = wrapper.find('input[type="email"]')
        const passwordInput = wrapper.find('input[type="password"]')
        const submitButton = wrapper.find('button[type="submit"]')

        // Initially disabled
        expect(submitButton.attributes('disabled')).toBeDefined()

        // Fill in valid data
        await emailInput.setValue('user@example.com')
        await passwordInput.setValue('validpassword123')
        await nextTick()

        // Should be enabled now
        expect(submitButton.attributes('disabled')).toBeUndefined()
      })

      it('should disable submit button when form has errors', async () => {
        const emailInput = wrapper.find('input[type="email"]')
        const passwordInput = wrapper.find('input[type="password"]')
        const submitButton = wrapper.find('button[type="submit"]')

        // Fill in invalid data
        await emailInput.setValue('invalid-email')
        await passwordInput.setValue('123')
        await emailInput.trigger('blur')
        await passwordInput.trigger('blur')
        await nextTick()

        expect(submitButton.attributes('disabled')).toBeDefined()
      })

      it('should update form values correctly', async () => {
        const emailInput = wrapper.find('input[type="email"]')
        const passwordInput = wrapper.find('input[type="password"]')

        await emailInput.setValue('test@example.com')
        await passwordInput.setValue('testpassword')
        await nextTick()

        expect((emailInput.element as HTMLInputElement).value).toBe('test@example.com')
        expect((passwordInput.element as HTMLInputElement).value).toBe('testpassword')
      })
    })
  })

  describe('Form Submission', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should call auth store login on valid form submission', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')
      const form = wrapper.find('form')

      // Fill valid data
      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await nextTick()

      // Mock successful login
      authStore.login.mockResolvedValue(undefined)

      // Submit form
      await form.trigger('submit')
      await nextTick()

      expect(authStore.clearError).toHaveBeenCalled()
      expect(authStore.login).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'validpassword123'
      })
    })

    it('should redirect to dashboard on successful login', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')
      const form = wrapper.find('form')

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await nextTick()

      authStore.login.mockResolvedValue(undefined)

      await form.trigger('submit')
      await nextTick()

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('should not submit form if validation fails', async () => {
      const form = wrapper.find('form')

      // Try to submit empty form
      await form.trigger('submit')
      await nextTick()

      expect(authStore.login).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should handle login failure gracefully', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')
      const form = wrapper.find('form')

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('wrongpassword')
      await nextTick()

      // Mock login failure
      authStore.login.mockRejectedValue(new Error('Invalid credentials'))

      // Submit form
      await form.trigger('submit')
      await nextTick()

      expect(authStore.login).toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should trigger form submission on Enter key in password field', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await nextTick()

      authStore.login.mockResolvedValue(undefined)

      await passwordInput.trigger('keydown.enter')
      await nextTick()

      expect(authStore.login).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should show loading state on submit button when loading', async () => {
      authStore.isLoading = true
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(wrapper.text()).toContain('Signing In...')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should disable submit button during loading', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await nextTick()

      authStore.isLoading = true
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Error Display', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should display auth error when present', async () => {
      authStore.error = 'Invalid email or password'
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Invalid email or password')
      expect(wrapper.find('.bg-red-50').exists()).toBe(true)
    })

    it('should not display error container when no auth error', async () => {
      authStore.error = null
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.bg-red-50').exists()).toBe(false)
    })

    it('should display validation errors for individual fields', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')

      await emailInput.setValue('invalid')
      await passwordInput.setValue('123')
      await emailInput.trigger('blur')
      await passwordInput.trigger('blur')
      await nextTick()

      expect(wrapper.text()).toContain('Please enter a valid email address')
      expect(wrapper.text()).toContain('Password must be at least 6 characters')
    })
  })

  describe('Integration with Authentication Store', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should react to changes in auth store loading state', async () => {
      // Initial state
      expect(wrapper.text()).not.toContain('Signing In...')

      // Set loading state
      authStore.isLoading = true
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Signing In...')

      // Clear loading state
      authStore.isLoading = false
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).not.toContain('Signing In...')
    })

    it('should react to changes in auth store error state', async () => {
      // Initial state - no error
      expect(wrapper.find('.bg-red-50').exists()).toBe(false)

      // Set error
      authStore.error = 'Network error occurred'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.bg-red-50').exists()).toBe(true)
      expect(wrapper.text()).toContain('Network error occurred')

      // Clear error
      authStore.error = null
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.bg-red-50').exists()).toBe(false)
    })
  })

  describe('User Experience and Interactions', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should have proper tab order for form fields', () => {
      const inputs = wrapper.findAll('input')
      const button = wrapper.find('button[type="submit"]')

      expect(inputs[0].attributes('type')).toBe('email')
      expect(inputs[1].attributes('type')).toBe('password')
      expect(button.exists()).toBe(true)
    })

    it('should have proper ARIA attributes', () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')

      expect(emailInput.attributes('required')).toBeDefined()
      expect(passwordInput.attributes('required')).toBeDefined()
    })

    it('should maintain form state during user interactions', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')

      // Fill form partially
      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('pass')
      
      // Trigger validation on password
      await passwordInput.trigger('blur')
      await nextTick()

      // Email should still be filled
      expect((emailInput.element as HTMLInputElement).value).toBe('user@example.com')
      expect((passwordInput.element as HTMLInputElement).value).toBe('pass')
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    beforeEach(() => {
      wrapper = mount(LoginView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should handle extremely long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com'
      const emailInput = wrapper.find('input[type="email"]')

      await emailInput.setValue(longEmail)
      await emailInput.trigger('blur')
      await nextTick()

      // Should still validate as proper email format
      expect(wrapper.text()).not.toContain('Please enter a valid email address')
    })

    it('should handle special characters in form inputs', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInput = wrapper.find('input[type="password"]')

      await emailInput.setValue('user+test@example.com')
      await passwordInput.setValue('pass@#$%^&*()')
      await nextTick()

      expect((emailInput.element as HTMLInputElement).value).toBe('user+test@example.com')
      expect((passwordInput.element as HTMLInputElement).value).toBe('pass@#$%^&*()')
    })

    it('should handle rapid form state changes', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      
      // Rapid changes
      await emailInput.setValue('a')
      await emailInput.setValue('ab')
      await emailInput.setValue('abc@')
      await emailInput.setValue('abc@example')
      await emailInput.setValue('abc@example.com')
      await emailInput.trigger('blur')
      await nextTick()

      expect((emailInput.element as HTMLInputElement).value).toBe('abc@example.com')
      expect(wrapper.text()).not.toContain('Please enter a valid email address')
    })
  })
})
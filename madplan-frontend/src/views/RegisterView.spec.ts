import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import RegisterView from './RegisterView.vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

// Mock Vue Router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('RegisterView Integration Tests', () => {
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
      wrapper = mount(RegisterView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })

      // Check main structure
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.findAll('input')).toHaveLength(3) // email, password, confirm password
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true)

      // Check form fields
      expect(wrapper.find('input[type="email"]').exists()).toBe(true)
      expect(wrapper.findAll('input[type="password"]')).toHaveLength(2)

      // Check labels
      expect(wrapper.text()).toContain('Email Address')
      expect(wrapper.text()).toContain('Password')
      expect(wrapper.text()).toContain('Confirm Password')

      // Check submit button
      expect(wrapper.text()).toContain('Create Account')

      // Check login link
      expect(wrapper.text()).toContain('Already have an account?')
      expect(wrapper.text()).toContain('Sign in here')
    })

    it('should clear auth error on mount', () => {
      wrapper = mount(RegisterView, {
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

      wrapper = mount(RegisterView, {
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
      wrapper = mount(RegisterView, {
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
      wrapper = mount(RegisterView, {
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
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0] // First password field
        
        await passwordInput.setValue('')
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Password is required')
      })

      it('should show error for password too short', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0]
        
        await passwordInput.setValue('12345') // 5 characters
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Password must be at least 6 characters')
      })

      it('should show error for password too long', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0]
        const longPassword = 'a'.repeat(129) // 129 characters
        
        await passwordInput.setValue(longPassword)
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Password must not exceed 128 characters')
      })

      it('should not show error for valid password', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0]
        
        await passwordInput.setValue('validpassword123')
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).not.toContain('Password is required')
        expect(wrapper.text()).not.toContain('Password must be at least 6 characters')
      })

      it('should show helper text for password requirements', () => {
        expect(wrapper.text()).toContain('Must be at least 6 characters with uppercase, lowercase, and number')
      })
    })

    describe('Confirm Password Validation', () => {
      it('should show error for empty confirm password on blur', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const confirmPasswordInput = passwordInputs[1] // Second password field
        
        await confirmPasswordInput.setValue('')
        await confirmPasswordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Please confirm your password')
      })

      it('should show error when passwords do not match', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0]
        const confirmPasswordInput = passwordInputs[1]
        
        await passwordInput.setValue('password123')
        await confirmPasswordInput.setValue('password456')
        await confirmPasswordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Passwords do not match')
      })

      it('should not show error when passwords match', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0]
        const confirmPasswordInput = passwordInputs[1]
        
        await passwordInput.setValue('password123')
        await confirmPasswordInput.setValue('password123')
        await confirmPasswordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).not.toContain('Please confirm your password')
        expect(wrapper.text()).not.toContain('Passwords do not match')
      })

      it('should revalidate confirm password when main password changes', async () => {
        const passwordInputs = wrapper.findAll('input[type="password"]')
        const passwordInput = passwordInputs[0]
        const confirmPasswordInput = passwordInputs[1]
        
        // Set matching passwords
        await passwordInput.setValue('password123')
        await confirmPasswordInput.setValue('password123')
        await confirmPasswordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).not.toContain('Passwords do not match')

        // Change main password
        await passwordInput.setValue('newpassword456')
        await passwordInput.trigger('blur')
        await nextTick()

        expect(wrapper.text()).toContain('Passwords do not match')
      })
    })
  })

  describe('Password Strength Indicator', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should not show password strength indicator when password is empty', () => {
      expect(wrapper.find('.password-strength').exists()).toBe(false)
    })

    it('should show password strength indicator when password has value', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('password')
      await nextTick()

      expect(wrapper.find('.password-strength').exists()).toBe(true)
      expect(wrapper.text()).toContain('Password strength:')
    })

    it('should show "Very Weak" for simple password', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('abc')
      await nextTick()

      expect(wrapper.text()).toContain('Very Weak')
    })

    it('should show "Weak" for slightly better password', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('abcdefgh') // 8+ chars
      await nextTick()

      expect(wrapper.text()).toContain('Weak')
    })

    it('should show "Fair" for password with mixed case', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('AbcDefGh') // 8+ chars + mixed case
      await nextTick()

      expect(wrapper.text()).toContain('Fair')
    })

    it('should show "Good" for password with numbers', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('AbcDef123') // 8+ chars + mixed case + numbers
      await nextTick()

      expect(wrapper.text()).toContain('Good')
    })

    it('should show "Strong" for password with special characters', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('AbcDef123!@#') // 12+ chars + mixed case + numbers + special
      await nextTick()

      expect(wrapper.text()).toContain('Strong')
    })

    it('should have correct number of strength indicators', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      
      await passwordInput.setValue('password')
      await nextTick()

      const indicators = wrapper.findAll('.password-strength .flex > div')
      expect(indicators).toHaveLength(4)
    })
  })

  describe('Form State Management', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should enable submit button when form is valid', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const submitButton = wrapper.find('button[type="submit"]')

      // Initially disabled
      expect(submitButton.attributes('disabled')).toBeDefined()

      // Fill in valid data
      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('ValidPass123!')
      await confirmPasswordInput.setValue('ValidPass123!')
      await nextTick()

      // Should be enabled now
      expect(submitButton.attributes('disabled')).toBeUndefined()
    })

    it('should disable submit button when form has errors', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const submitButton = wrapper.find('button[type="submit"]')

      // Fill in invalid data
      await emailInput.setValue('invalid-email')
      await passwordInput.setValue('123')
      await confirmPasswordInput.setValue('456')
      await emailInput.trigger('blur')
      await passwordInput.trigger('blur')
      await confirmPasswordInput.trigger('blur')
      await nextTick()

      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should update form values correctly', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      await emailInput.setValue('test@example.com')
      await passwordInput.setValue('testpassword')
      await confirmPasswordInput.setValue('testpassword')
      await nextTick()

      expect((emailInput.element as HTMLInputElement).value).toBe('test@example.com')
      expect((passwordInput.element as HTMLInputElement).value).toBe('testpassword')
      expect((confirmPasswordInput.element as HTMLInputElement).value).toBe('testpassword')
    })
  })

  describe('Form Submission', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should call auth store register on valid form submission', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const form = wrapper.find('form')

      // Fill valid data
      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await confirmPasswordInput.setValue('validpassword123')
      await nextTick()

      // Mock successful registration
      authStore.register.mockResolvedValue(undefined)

      // Submit form
      await form.trigger('submit')
      await nextTick()

      expect(authStore.clearError).toHaveBeenCalled()
      expect(authStore.register).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'validpassword123'
      })
    })

    it('should redirect to dashboard on successful registration', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const form = wrapper.find('form')

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await confirmPasswordInput.setValue('validpassword123')
      await nextTick()

      authStore.register.mockResolvedValue(undefined)

      await form.trigger('submit')
      await nextTick()

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('should not submit form if validation fails', async () => {
      const form = wrapper.find('form')

      // Try to submit empty form
      await form.trigger('submit')
      await nextTick()

      expect(authStore.register).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should handle registration failure gracefully', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const form = wrapper.find('form')

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await confirmPasswordInput.setValue('validpassword123')
      await nextTick()

      // Mock registration failure
      authStore.register.mockRejectedValue(new Error('Email already exists'))

      // Submit form
      await form.trigger('submit')
      await nextTick()

      expect(authStore.register).toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should trigger form submission on Enter key in confirm password field', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await confirmPasswordInput.setValue('validpassword123')
      await nextTick()

      authStore.register.mockResolvedValue(undefined)

      await confirmPasswordInput.trigger('keydown.enter')
      await nextTick()

      expect(authStore.register).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
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
      expect(wrapper.text()).toContain('Creating Account...')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should disable submit button during loading', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('validpassword123')
      await confirmPasswordInput.setValue('validpassword123')
      await nextTick()

      authStore.isLoading = true
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Error Display', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should display auth error when present', async () => {
      authStore.error = 'Email already exists'
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Email already exists')
      expect(wrapper.find('.bg-red-50').exists()).toBe(true)
    })

    it('should not display error container when no auth error', async () => {
      authStore.error = null
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.bg-red-50').exists()).toBe(false)
    })

    it('should display validation errors for individual fields', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      await emailInput.setValue('invalid')
      await passwordInput.setValue('123')
      await confirmPasswordInput.setValue('456')
      await emailInput.trigger('blur')
      await passwordInput.trigger('blur')
      await confirmPasswordInput.trigger('blur')
      await nextTick()

      expect(wrapper.text()).toContain('Please enter a valid email address')
      expect(wrapper.text()).toContain('Password must be at least 6 characters')
      expect(wrapper.text()).toContain('Passwords do not match')
    })
  })

  describe('User Experience and Accessibility', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
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
      expect(inputs[2].attributes('type')).toBe('password')
      expect(button.exists()).toBe(true)
    })

    it('should have proper ARIA attributes', () => {
      const inputs = wrapper.findAll('input')

      inputs.forEach(input => {
        expect(input.attributes('required')).toBeDefined()
      })
    })

    it('should maintain form state during complex interactions', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      // Fill form progressively
      await emailInput.setValue('user@example.com')
      await passwordInput.setValue('TempPassword123!')
      await confirmPasswordInput.setValue('TempPassword123!')
      
      // Change password (should trigger confirm password validation)
      await passwordInput.setValue('NewPassword456!')
      await passwordInput.trigger('blur')
      await nextTick()

      // Email should still be filled, confirm password should show error
      expect((emailInput.element as HTMLInputElement).value).toBe('user@example.com')
      expect((passwordInput.element as HTMLInputElement).value).toBe('NewPassword456!')
      expect((confirmPasswordInput.element as HTMLInputElement).value).toBe('TempPassword123!')
      expect(wrapper.text()).toContain('Passwords do not match')
    })
  })

  describe('Edge Cases and Complex Scenarios', () => {
    beforeEach(() => {
      wrapper = mount(RegisterView, {
        global: {
          plugins: [pinia],
          stubs: {
            'router-link': true,
          },
        },
      })
    })

    it('should handle special characters in passwords', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      const specialPassword = 'Test@#$%^&*()_+123!'

      await emailInput.setValue('user@example.com')
      await passwordInput.setValue(specialPassword)
      await confirmPasswordInput.setValue(specialPassword)
      await nextTick()

      expect((passwordInput.element as HTMLInputElement).value).toBe(specialPassword)
      expect((confirmPasswordInput.element as HTMLInputElement).value).toBe(specialPassword)
      
      // Should show strong password
      expect(wrapper.text()).toContain('Strong')
    })

    it('should handle rapid password strength changes', async () => {
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]

      // Progressive password building
      await passwordInput.setValue('a')
      await nextTick()
      expect(wrapper.text()).toContain('Very Weak')

      await passwordInput.setValue('abcdefgh')
      await nextTick()
      expect(wrapper.text()).toContain('Weak')

      await passwordInput.setValue('AbcDefGh')
      await nextTick()
      expect(wrapper.text()).toContain('Fair')

      await passwordInput.setValue('AbcDef123')
      await nextTick()
      expect(wrapper.text()).toContain('Good')

      await passwordInput.setValue('AbcDef123!@#$')
      await nextTick()
      expect(wrapper.text()).toContain('Strong')
    })

    it('should handle form submission with complex password scenarios', async () => {
      const emailInput = wrapper.find('input[type="email"]')
      const passwordInputs = wrapper.findAll('input[type="password"]')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const form = wrapper.find('form')

      // Test with various password complexities
      const testCases = [
        'SimplePass123!',
        'VeryLongPasswordWith123AndSpecialChars!@#',
        'MixedCase123',
        'simple123'
      ]

      for (const password of testCases) {
        await emailInput.setValue('user@example.com')
        await passwordInput.setValue(password)
        await confirmPasswordInput.setValue(password)
        await nextTick()

        authStore.register.mockResolvedValue(undefined)

        await form.trigger('submit')
        await nextTick()

        expect(authStore.register).toHaveBeenLastCalledWith({
          email: 'user@example.com',
          password: password
        })

        // Reset mocks for next iteration
        authStore.register.mockClear()
      }
    })
  })
})
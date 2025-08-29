import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import { useStorage } from '@vueuse/core'
import { jwtDecode } from 'jwt-decode'
import { 
  REGISTER_MUTATION, 
  LOGIN_MUTATION,
  type User, 
  type AuthPayload, 
  type RegisterUserInput, 
  type LoginUserInput 
} from '../services/auth.service'

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = useStorage<string | null>('auth-token', null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isAuthenticated = computed(() => {
    if (!token.value) return false
    
    try {
      const decoded: any = jwtDecode(token.value)
      return decoded.exp * 1000 > Date.now()
    } catch {
      return false
    }
  })

  // Apollo client for clearing cache on logout
  const apolloClient = useApolloClient()

  // Mutations
  const { mutate: registerMutation } = useMutation(REGISTER_MUTATION)
  const { mutate: loginMutation } = useMutation(LOGIN_MUTATION)

  // Actions
  const register = async (input: RegisterUserInput): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await registerMutation({ input })
      
      if (result?.data?.register) {
        const authPayload: AuthPayload = result.data.register
        setAuthData(authPayload)
      } else {
        throw new Error('Registration failed')
      }
    } catch (err: any) {
      error.value = err.message || 'Registration failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const login = async (input: LoginUserInput): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await loginMutation({ input })
      
      if (result?.data?.login) {
        const authPayload: AuthPayload = result.data.login
        setAuthData(authPayload)
      } else {
        throw new Error('Login failed')
      }
    } catch (err: any) {
      error.value = err.message || 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    user.value = null
    token.value = null
    error.value = null
    
    // Clear Apollo cache
    await apolloClient.client.clearStore()
  }

  const setAuthData = (authPayload: AuthPayload): void => {
    user.value = authPayload.user
    token.value = authPayload.token
    error.value = null
  }

  const clearError = (): void => {
    error.value = null
  }

  // Initialize user from token on store creation
  const initializeAuth = (): void => {
    if (token.value && isAuthenticated.value) {
      try {
        const decoded: any = jwtDecode(token.value)
        if (decoded.sub && decoded.email) {
          user.value = {
            id: decoded.sub,
            email: decoded.email
          }
        }
      } catch (err) {
        // Token is invalid, clear it
        logout()
      }
    }
  }

  // Initialize auth state
  initializeAuth()

  return {
    // State
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    
    // Actions
    register,
    login,
    logout,
    clearError,
    initializeAuth
  }
})
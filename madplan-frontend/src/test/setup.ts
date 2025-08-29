/**
 * Test setup file for Vitest
 * Configures global testing utilities and mocks
 */

import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Clear localStorage and sessionStorage
  localStorage.clear()
  sessionStorage.clear()
  
  // Reset any global state
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

// Mock environment variables for testing
vi.mock('../../env.d.ts', () => ({
  VITE_API_URL: 'http://localhost:3001/graphql',
  VITE_APP_VERSION: '1.0.0',
  MODE: 'test',
  DEV: false,
  PROD: false,
}))

// Mock Vue Router
vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    })),
    useRoute: vi.fn(() => ({
      path: '/',
      name: 'home',
      params: {},
      query: {},
      meta: {},
      fullPath: '/',
    })),
  }
})

// Mock Pinia stores
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    clearError: vi.fn(),
    initializeAuth: vi.fn(),
  })),
}))

// Mock Apollo Client
vi.mock('@apollo/client/core', () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useLazyQuery: vi.fn(),
}))

// Mock JWT Decode
vi.mock('jwt-decode', () => ({
  default: vi.fn(() => ({
    sub: 'test-user-id',
    email: 'test@example.com',
    exp: Date.now() / 1000 + 3600, // 1 hour from now
  })),
}))

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver (for components that use it)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver (for components that use it)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock fetch for API testing
global.fetch = vi.fn()

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    mark: vi.fn(),
    measure: vi.fn(),
    now: vi.fn(() => Date.now()),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  },
})

// Console warning suppression for expected warnings in tests
const originalWarn = console.warn
console.warn = (...args: any[]) => {
  // Suppress specific Vue warnings that are expected in tests
  const message = args[0]
  if (
    typeof message === 'string' &&
    (message.includes('Failed to resolve component') ||
     message.includes('Invalid prop') ||
     message.includes('Missing required prop'))
  ) {
    return
  }
  originalWarn(...args)
}

// Add custom matchers for better testing experience
expect.extend({
  toBeVisible(received) {
    const pass = received && received.style.display !== 'none' && received.style.visibility !== 'hidden'
    if (pass) {
      return {
        message: () => `expected element to not be visible`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected element to be visible`,
        pass: false,
      }
    }
  },
})

// Global test utilities
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

export const mockAuthPayload = {
  token: 'mock-jwt-token',
  user: mockUser,
}

export const createMockRouter = (overrides = {}) => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  ...overrides,
})

export const createMockRoute = (overrides = {}) => ({
  path: '/',
  name: 'home',
  params: {},
  query: {},
  meta: {},
  fullPath: '/',
  ...overrides,
})

// Utility function to wait for DOM updates
export const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

// Utility function to flush all pending promises
export const flushPromises = () => new Promise(resolve => setImmediate(resolve))
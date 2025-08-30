import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import BoardView from './BoardView.vue'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'
import type { Board } from '../services/board.service'

// Mock the stores
vi.mock('../stores/auth')
vi.mock('../stores/board')

describe('BoardView', () => {
  let wrapper: VueWrapper
  let router: any
  let mockAuthStore: any
  let mockBoardStore: any

  const mockBoard: Board = {
    id: '507f1f77bcf86cd799439011',
    title: 'Test Board',
    listOrder: ['list1', 'list2']
  }

  beforeEach(async () => {
    // Create fresh pinia and router instances
    setActivePinia(createPinia())
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: '/board/:id', component: BoardView },
        { path: '/login', component: { template: '<div>Login</div>' } }
      ]
    })

    // Mock auth store
    mockAuthStore = {
      user: { id: 'user1', email: 'test@example.com' },
      isAuthenticated: true
    }

    // Mock board store
    mockBoardStore = {
      getBoardById: vi.fn().mockReturnValue(mockBoard),
      fetchBoards: vi.fn().mockResolvedValue(undefined)
    }

    // Apply mocks
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore)
    vi.mocked(useBoardStore).mockReturnValue(mockBoardStore)

    // Navigate to board route
    await router.push('/board/507f1f77bcf86cd799439011')
    await router.isReady()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render board view with navigation header', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Test Board')
      expect(wrapper.text()).toContain('Back to Dashboard')
      expect(wrapper.text()).toContain('test@example.com')
    })

    it('should display board information correctly', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Test Board')
      expect(wrapper.text()).toContain('2 lists')
      expect(wrapper.text()).toContain('Board ID: 507f1f77bcf86cd799439011')
    })

    it('should show coming soon placeholder content', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Kanban Board Coming Soon!')
      expect(wrapper.text()).toContain('Create and manage lists')
      expect(wrapper.text()).toContain('Add cards to lists')
      expect(wrapper.text()).toContain('Drag and drop functionality')
    })
  })

  describe('Loading States', () => {
    it('should show loading state initially', async () => {
      // Mock board not found in cache initially
      mockBoardStore.getBoardById.mockReturnValue(null)
      mockBoardStore.fetchBoards.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.text()).toContain('Loading board...')
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should hide loading state after board loads', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).not.toContain('Loading board...')
      expect(wrapper.text()).toContain('Test Board')
    })
  })

  describe('Error Handling', () => {
    it('should show error state when board is not found', async () => {
      mockBoardStore.getBoardById.mockReturnValue(null)

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0)) // Wait for async operations

      expect(wrapper.text()).toContain('Board not found')
      expect(wrapper.text()).toContain('Back to Dashboard')
    })

    it('should show error state when board fetch fails', async () => {
      mockBoardStore.getBoardById.mockReturnValue(null)
      mockBoardStore.fetchBoards.mockRejectedValue(new Error('Network error'))

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0)) // Wait for async operations

      expect(wrapper.text()).toContain('Board not found')
    })

    it('should handle invalid board ID', async () => {
      // Navigate to route with invalid ID
      await router.push('/board/')

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Board not found')
    })
  })

  describe('Navigation', () => {
    it('should navigate back to dashboard when back button is clicked', async () => {
      const routerSpy = vi.spyOn(router, 'push')
      
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const backButton = wrapper.find('button:contains("Back to Dashboard")')
      await backButton.trigger('click')

      expect(routerSpy).toHaveBeenCalledWith('/dashboard')
    })

    it('should navigate back to dashboard from error state', async () => {
      const routerSpy = vi.spyOn(router, 'push')
      mockBoardStore.getBoardById.mockReturnValue(null)

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      const backButton = wrapper.find('button:contains("Back to Dashboard")')
      await backButton.trigger('click')

      expect(routerSpy).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('Authentication Handling', () => {
    it('should redirect to login when user is not authenticated', async () => {
      mockAuthStore.isAuthenticated = false
      const routerSpy = vi.spyOn(router, 'push')

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      expect(routerSpy).toHaveBeenCalledWith('/login')
    })
  })

  describe('Board Loading Logic', () => {
    it('should try to get board from cache first', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(mockBoardStore.getBoardById).toHaveBeenCalledWith('507f1f77bcf86cd799439011')
    })

    it('should fetch boards if not in cache', async () => {
      // First call returns null (not in cache), second call returns board (after fetch)
      mockBoardStore.getBoardById
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockBoard)

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockBoardStore.fetchBoards).toHaveBeenCalled()
      expect(mockBoardStore.getBoardById).toHaveBeenCalledTimes(2)
    })

    it('should display board after successful fetch', async () => {
      mockBoardStore.getBoardById
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockBoard)

      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Test Board')
    })
  })

  describe('Computed Properties', () => {
    it('should extract board ID from route params', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.vm.boardId).toBe('507f1f77bcf86cd799439011')
    })

    it('should display user email from auth store', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('test@example.com')
    })
  })

  describe('Component Lifecycle', () => {
    it('should load board data on mount', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      expect(mockBoardStore.getBoardById).toHaveBeenCalledWith('507f1f77bcf86cd799439011')
    })

    it('should handle component unmount gracefully', () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      expect(() => wrapper.unmount()).not.toThrow()
    })
  })

  describe('Visual Elements', () => {
    it('should display proper icons and visual elements', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      // Should have back arrow icon
      const backArrow = wrapper.find('svg path[d*="M10 19l-7-7m0 0l7-7m-7 7h18"]')
      expect(backArrow.exists()).toBe(true)

      // Should have board icon
      const boardIcon = wrapper.find('svg path[d*="M19 11H5m14 0a2 2 0"]')
      expect(boardIcon.exists()).toBe(true)

      // Should have user icon
      const userIcon = wrapper.find('svg path[d*="M16 7a4 4 0 11-8 0"]')
      expect(userIcon.exists()).toBe(true)
    })

    it('should apply proper styling classes', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.classes()).toContain('min-h-screen')
      expect(wrapper.find('.bg-gradient-to-br').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('h1').text()).toContain('Test Board')
      expect(wrapper.find('h2').text()).toContain('Test Board')
      expect(wrapper.find('h3').text()).toContain('Kanban Board Coming Soon!')
    })

    it('should have focusable interactive elements', async () => {
      wrapper = mount(BoardView, {
        global: {
          plugins: [router]
        }
      })

      const backButton = wrapper.find('button')
      expect(backButton.exists()).toBe(true)
      expect(backButton.classes()).toContain('focus:outline-none')
      expect(backButton.classes()).toContain('focus:ring-2')
    })
  })
})
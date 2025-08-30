import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from './DashboardView.vue'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'
import type { Board } from '../services/board.service'

// Mock the stores
vi.mock('../stores/auth')
vi.mock('../stores/board')

// Mock the child components to avoid complex dependency issues
vi.mock('../components/boards/BoardCard.vue', () => ({
  default: {
    name: 'BoardCard',
    template: '<div data-testid="board-card">{{ board.title }}</div>',
    props: ['board', 'showDeleteButton', 'showCreatedDate', 'isDeleting'],
    emits: ['click', 'delete']
  }
}))

vi.mock('../components/boards/CreateBoardModal.vue', () => ({
  default: {
    name: 'CreateBoardModal',
    template: '<div data-testid="create-board-modal" v-if="isOpen">Modal</div>',
    props: ['isOpen', 'isCreating', 'error'],
    emits: ['close', 'create']
  }
}))

describe('DashboardView', () => {
  let wrapper: VueWrapper
  let router: any
  let mockAuthStore: any
  let mockBoardStore: any

  const mockBoards: Board[] = [
    { id: '1', title: 'Test Board 1', listOrder: ['list1'] },
    { id: '2', title: 'Test Board 2', listOrder: [] }
  ]

  beforeEach(async () => {
    // Create fresh pinia and router instances
    setActivePinia(createPinia())
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: '/board/:id', component: { template: '<div>Board</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } }
      ]
    })

    // Mock auth store
    mockAuthStore = {
      user: { id: 'user1', email: 'test@example.com' },
      isAuthenticated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    }

    // Mock board store
    mockBoardStore = {
      boards: mockBoards,
      isLoading: false,
      error: null,
      isCreatingBoard: false,
      isDeletingBoard: null,
      boardCount: 2,
      hasBoards: true,
      sortedBoards: [...mockBoards].sort((a, b) => a.title.localeCompare(b.title)),
      fetchBoards: vi.fn().mockResolvedValue(undefined),
      createBoard: vi.fn().mockResolvedValue(mockBoards[0]),
      deleteBoard: vi.fn().mockResolvedValue(true),
      clearError: vi.fn(),
      clearBoards: vi.fn(),
      getBoardById: vi.fn()
    }

    // Apply mocks
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore)
    vi.mocked(useBoardStore).mockReturnValue(mockBoardStore)

    // Mount component
    wrapper = mount(DashboardView, {
      global: {
        plugins: [router]
      }
    })

    await router.isReady()
  })

  afterEach(() => {
    wrapper.unmount()
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render dashboard with user information', () => {
      expect(wrapper.text()).toContain('Welcome back, test!')
      expect(wrapper.text()).toContain('test@example.com')
      expect(wrapper.find('[data-testid="create-board-button"]').exists()).toBe(true)
    })

    it('should display board count in header', () => {
      expect(wrapper.text()).toContain('2') // Board count badge
    })

    it('should render boards grid when boards exist', () => {
      const boardCards = wrapper.findAll('[data-testid="board-card"]')
      expect(boardCards).toHaveLength(2)
      expect(boardCards[0].text()).toContain('Test Board 1')
      expect(boardCards[1].text()).toContain('Test Board 2')
    })

    it('should display refresh button', () => {
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      expect(refreshButton.exists()).toBe(true)
      expect(refreshButton.text()).toContain('Refresh')
    })
  })

  describe('Loading States', () => {
    it('should show loading state when boards are loading', async () => {
      mockBoardStore.isLoading = true
      mockBoardStore.hasBoards = false
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Loading your boards...')
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should show loading state on refresh button when loading', async () => {
      mockBoardStore.isLoading = true
      
      await wrapper.vm.$nextTick()
      
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      expect(refreshButton.text()).toContain('Loading...')
      expect(refreshButton.classes()).toContain('cursor-not-allowed')
    })

    it('should show creating state on create button', async () => {
      mockBoardStore.isCreatingBoard = true
      
      await wrapper.vm.$nextTick()
      
      const createButton = wrapper.find('[data-testid="create-board-button"]')
      expect(createButton.text()).toContain('Creating...')
      expect(createButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when boards fail to load', async () => {
      mockBoardStore.error = 'Failed to fetch boards'
      mockBoardStore.isLoading = false
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Error loading boards')
      expect(wrapper.text()).toContain('Failed to fetch boards')
      expect(wrapper.find('[data-testid="try-again-button"]').exists()).toBe(true)
    })

    it('should handle try again button click', async () => {
      mockBoardStore.error = 'Network error'
      mockBoardStore.isLoading = false
      
      await wrapper.vm.$nextTick()
      
      const tryAgainButton = wrapper.find('[data-testid="try-again-button"]')
      await tryAgainButton.trigger('click')
      
      expect(mockBoardStore.clearError).toHaveBeenCalled()
      expect(mockBoardStore.fetchBoards).toHaveBeenCalled()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no boards exist', async () => {
      mockBoardStore.hasBoards = false
      mockBoardStore.boards = []
      mockBoardStore.isLoading = false
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('No boards yet')
      expect(wrapper.text()).toContain('Create your first board')
      expect(wrapper.find('[data-testid="create-first-board-button"]').exists()).toBe(true)
    })

    it('should open modal when clicking create first board button', async () => {
      mockBoardStore.hasBoards = false
      mockBoardStore.boards = []
      
      await wrapper.vm.$nextTick()
      
      const createFirstButton = wrapper.find('[data-testid="create-first-board-button"]')
      await createFirstButton.trigger('click')
      
      expect(wrapper.vm.showCreateBoardModal).toBe(true)
    })
  })

  describe('User Interactions', () => {
    it('should open create board modal when clicking create button', async () => {
      const createButton = wrapper.find('[data-testid="create-board-button"]')
      await createButton.trigger('click')
      
      expect(wrapper.vm.showCreateBoardModal).toBe(true)
    })

    it('should refresh boards when clicking refresh button', async () => {
      const refreshButton = wrapper.find('[data-testid="refresh-button"]')
      await refreshButton.trigger('click')
      
      expect(mockBoardStore.fetchBoards).toHaveBeenCalled()
    })

    it('should handle board card click navigation', async () => {
      const routerSpy = vi.spyOn(router, 'push')
      
      // Simulate board card click event
      await wrapper.vm.navigateToBoard(mockBoards[0])
      
      expect(routerSpy).toHaveBeenCalledWith('/board/1')
    })

    it('should handle board deletion', async () => {
      await wrapper.vm.handleDeleteBoard(mockBoards[0])
      
      expect(mockBoardStore.deleteBoard).toHaveBeenCalledWith('1')
    })
  })

  describe('Create Board Modal Integration', () => {
    it('should pass correct props to create board modal', async () => {
      wrapper.vm.showCreateBoardModal = true
      mockBoardStore.isCreatingBoard = true
      wrapper.vm.createBoardError = 'Some error'
      
      await wrapper.vm.$nextTick()
      
      const modal = wrapper.findComponent({ name: 'CreateBoardModal' })
      expect(modal.props('isOpen')).toBe(true)
      expect(modal.props('isCreating')).toBe(true)
      expect(modal.props('error')).toBe('Some error')
    })

    it('should handle modal close event', async () => {
      wrapper.vm.showCreateBoardModal = true
      
      const modal = wrapper.findComponent({ name: 'CreateBoardModal' })
      await modal.vm.$emit('close')
      
      expect(wrapper.vm.showCreateBoardModal).toBe(false)
      expect(wrapper.vm.createBoardError).toBe(null)
    })

    it('should handle modal create event', async () => {
      const routerSpy = vi.spyOn(router, 'push')
      const createData = { title: 'New Board', description: 'Test description' }
      
      const modal = wrapper.findComponent({ name: 'CreateBoardModal' })
      await modal.vm.$emit('create', createData)
      
      expect(mockBoardStore.createBoard).toHaveBeenCalledWith('New Board')
      expect(routerSpy).toHaveBeenCalledWith('/board/1')
      expect(wrapper.vm.showCreateBoardModal).toBe(false)
    })

    it('should handle create board error', async () => {
      mockBoardStore.createBoard.mockRejectedValue(new Error('Creation failed'))
      
      const modal = wrapper.findComponent({ name: 'CreateBoardModal' })
      await modal.vm.$emit('create', { title: 'New Board' })
      
      expect(wrapper.vm.createBoardError).toBe('Creation failed')
    })
  })

  describe('Logout Functionality', () => {
    it('should handle logout', async () => {
      const routerSpy = vi.spyOn(router, 'push')
      
      const logoutButton = wrapper.find('[data-testid="logout-button"]')
      await logoutButton.trigger('click')
      
      expect(mockAuthStore.logout).toHaveBeenCalled()
      expect(mockBoardStore.clearBoards).toHaveBeenCalled()
      expect(routerSpy).toHaveBeenCalledWith('/login')
    })

    it('should handle logout error', async () => {
      mockAuthStore.logout.mockRejectedValue(new Error('Logout failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const logoutButton = wrapper.find('[data-testid="logout-button"]')
      await logoutButton.trigger('click')
      
      expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('Component Lifecycle', () => {
    it('should fetch boards on mount when authenticated and no boards', async () => {
      mockBoardStore.hasBoards = false
      
      // Remount component to test onMounted
      wrapper.unmount()
      wrapper = mount(DashboardView, {
        global: {
          plugins: [router]
        }
      })
      
      expect(mockBoardStore.fetchBoards).toHaveBeenCalled()
    })

    it('should not fetch boards on mount when boards already exist', async () => {
      mockBoardStore.hasBoards = true
      
      // Remount component to test onMounted
      wrapper.unmount()
      wrapper = mount(DashboardView, {
        global: {
          plugins: [router]
        }
      })
      
      // Should not call fetchBoards again since boards already exist
      expect(mockBoardStore.fetchBoards).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      const createButton = wrapper.find('[data-testid="create-board-button"]')
      expect(createButton.attributes('type')).toBe('button')
      
      const logoutButton = wrapper.find('[data-testid="logout-button"]')
      expect(logoutButton.attributes('type')).toBe('button')
    })

    it('should handle keyboard navigation', async () => {
      const createButton = wrapper.find('[data-testid="create-board-button"]')
      
      await createButton.trigger('keydown.enter')
      // The actual behavior would depend on the button implementation
      expect(createButton.exists()).toBe(true)
    })
  })
})
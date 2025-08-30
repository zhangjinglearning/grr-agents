import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBoardStore } from './board'
import { useAuthStore } from './auth'
import type { Board } from '../services/board.service'

// Mock Vue Apollo Composable
const mockMutate = vi.fn()
const mockClient = {
  query: vi.fn(),
  cache: {
    modify: vi.fn(),
    writeFragment: vi.fn()
  }
}

vi.mock('@vue/apollo-composable', () => ({
  useMutation: vi.fn(() => ({ mutate: mockMutate })),
  useApolloClient: vi.fn(() => ({ client: mockClient }))
}))

// Mock auth store
vi.mock('./auth', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
    user: { id: 'user1', email: 'test@example.com' }
  }))
}))

describe('Board Store', () => {
  let boardStore: ReturnType<typeof useBoardStore>
  
  const mockBoard: Board = {
    id: '507f1f77bcf86cd799439011',
    title: 'Test Board',
    listOrder: ['list1', 'list2']
  }

  const mockBoards: Board[] = [
    mockBoard,
    {
      id: '507f1f77bcf86cd799439022',
      title: 'Another Board',
      listOrder: []
    }
  ]

  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())
    boardStore = useBoardStore()
    
    // Reset all mocks
    vi.clearAllMocks()
    mockClient.query.mockClear()
    mockMutate.mockClear()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(boardStore.boards).toEqual([])
      expect(boardStore.isLoading).toBe(false)
      expect(boardStore.error).toBe(null)
      expect(boardStore.isCreatingBoard).toBe(false)
      expect(boardStore.isDeletingBoard).toBe(null)
    })

    it('should have correct computed properties', () => {
      expect(boardStore.boardCount).toBe(0)
      expect(boardStore.hasBoards).toBe(false)
      expect(boardStore.sortedBoards).toEqual([])
    })
  })

  describe('fetchBoards', () => {
    it('should fetch boards successfully', async () => {
      mockClient.query.mockResolvedValue({
        data: { myBoards: mockBoards }
      })

      await boardStore.fetchBoards()

      expect(mockClient.query).toHaveBeenCalledWith({
        query: expect.any(Object),
        fetchPolicy: 'cache-first'
      })
      expect(boardStore.boards).toEqual(mockBoards)
      expect(boardStore.isLoading).toBe(false)
      expect(boardStore.error).toBe(null)
    })

    it('should handle empty boards response', async () => {
      mockClient.query.mockResolvedValue({
        data: { myBoards: [] }
      })

      await boardStore.fetchBoards()

      expect(boardStore.boards).toEqual([])
      expect(boardStore.hasBoards).toBe(false)
    })

    it('should handle null boards response', async () => {
      mockClient.query.mockResolvedValue({
        data: { myBoards: null }
      })

      await boardStore.fetchBoards()

      expect(boardStore.boards).toEqual([])
    })

    it('should handle fetch error', async () => {
      const errorMessage = 'Network error'
      mockClient.query.mockRejectedValue(new Error(errorMessage))

      await boardStore.fetchBoards()

      expect(boardStore.error).toBe(errorMessage)
      expect(boardStore.boards).toEqual([])
      expect(boardStore.isLoading).toBe(false)
    })

    it('should not fetch if user is not authenticated', async () => {
      // Mock unauthenticated user
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null
      } as any)

      const unauthStore = useBoardStore()
      await unauthStore.fetchBoards()

      expect(mockClient.query).not.toHaveBeenCalled()
      expect(unauthStore.error).toBe('User not authenticated')
    })
  })

  describe('createBoard', () => {
    beforeEach(() => {
      // Set up boards in store for cache modification tests
      boardStore.boards = mockBoards
    })

    it('should create board successfully', async () => {
      const newBoard = { id: 'new-board', title: 'New Board', listOrder: [] }
      mockMutate.mockResolvedValue({
        data: { createBoard: newBoard }
      })

      const result = await boardStore.createBoard('New Board')

      expect(mockMutate).toHaveBeenCalledWith({ title: 'New Board' })
      expect(result).toEqual(newBoard)
      expect(boardStore.boards).toContain(newBoard)
      expect(boardStore.isCreatingBoard).toBe(false)
    })

    it('should trim board title', async () => {
      const newBoard = { id: 'new-board', title: 'Trimmed Board', listOrder: [] }
      mockMutate.mockResolvedValue({
        data: { createBoard: newBoard }
      })

      await boardStore.createBoard('  Trimmed Board  ')

      expect(mockMutate).toHaveBeenCalledWith({ title: 'Trimmed Board' })
    })

    it('should handle create error', async () => {
      const errorMessage = 'Creation failed'
      mockMutate.mockRejectedValue(new Error(errorMessage))

      await expect(boardStore.createBoard('Test Board')).rejects.toThrow(errorMessage)
      expect(boardStore.error).toBe(errorMessage)
      expect(boardStore.isCreatingBoard).toBe(false)
    })

    it('should handle missing response data', async () => {
      mockMutate.mockResolvedValue({ data: null })

      await expect(boardStore.createBoard('Test Board')).rejects.toThrow('Failed to create board')
    })

    it('should not create if user is not authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null
      } as any)

      const unauthStore = useBoardStore()
      const result = await unauthStore.createBoard('Test Board')

      expect(result).toBe(null)
      expect(unauthStore.error).toBe('User not authenticated')
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })

  describe('deleteBoard', () => {
    beforeEach(() => {
      boardStore.boards = [...mockBoards]
    })

    it('should delete board successfully', async () => {
      mockMutate.mockResolvedValue({
        data: { deleteBoard: true }
      })

      const result = await boardStore.deleteBoard(mockBoard.id)

      expect(mockMutate).toHaveBeenCalledWith({ id: mockBoard.id })
      expect(result).toBe(true)
      expect(boardStore.boards).not.toContain(mockBoard)
      expect(boardStore.isDeletingBoard).toBe(null)
    })

    it('should handle delete error', async () => {
      const errorMessage = 'Delete failed'
      mockMutate.mockRejectedValue(new Error(errorMessage))

      await expect(boardStore.deleteBoard(mockBoard.id)).rejects.toThrow(errorMessage)
      expect(boardStore.error).toBe(errorMessage)
      expect(boardStore.isDeletingBoard).toBe(null)
    })

    it('should handle failed delete response', async () => {
      mockMutate.mockResolvedValue({
        data: { deleteBoard: false }
      })

      await expect(boardStore.deleteBoard(mockBoard.id)).rejects.toThrow('Failed to delete board')
    })

    it('should not delete if user is not authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        user: null
      } as any)

      const unauthStore = useBoardStore()
      const result = await unauthStore.deleteBoard(mockBoard.id)

      expect(result).toBe(false)
      expect(unauthStore.error).toBe('User not authenticated')
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      boardStore.boards = mockBoards
    })

    it('should calculate boardCount correctly', () => {
      expect(boardStore.boardCount).toBe(2)
    })

    it('should calculate hasBoards correctly', () => {
      expect(boardStore.hasBoards).toBe(true)
    })

    it('should sort boards alphabetically', () => {
      const sortedBoards = boardStore.sortedBoards
      expect(sortedBoards[0].title).toBe('Another Board')
      expect(sortedBoards[1].title).toBe('Test Board')
    })
  })

  describe('Utility Methods', () => {
    beforeEach(() => {
      boardStore.boards = mockBoards
    })

    it('should find board by ID', () => {
      const foundBoard = boardStore.getBoardById(mockBoard.id)
      expect(foundBoard).toEqual(mockBoard)
    })

    it('should return undefined for non-existent board', () => {
      const foundBoard = boardStore.getBoardById('non-existent')
      expect(foundBoard).toBeUndefined()
    })

    it('should clear error', () => {
      boardStore.error = 'Some error'
      boardStore.clearError()
      expect(boardStore.error).toBe(null)
    })

    it('should clear all boards and state', () => {
      boardStore.error = 'Some error'
      boardStore.isLoading = true
      
      boardStore.clearBoards()
      
      expect(boardStore.boards).toEqual([])
      expect(boardStore.error).toBe(null)
      expect(boardStore.isLoading).toBe(false)
      expect(boardStore.isCreatingBoard).toBe(false)
      expect(boardStore.isDeletingBoard).toBe(null)
    })
  })

  describe('Apollo Cache Integration', () => {
    it('should update cache when creating board', async () => {
      const newBoard = { id: 'new-board', title: 'New Board', listOrder: [] }
      mockMutate.mockResolvedValue({
        data: { createBoard: newBoard }
      })

      await boardStore.createBoard('New Board')

      expect(mockClient.cache.modify).toHaveBeenCalled()
      expect(mockClient.cache.writeFragment).toHaveBeenCalled()
    })

    it('should update cache when deleting board', async () => {
      mockMutate.mockResolvedValue({
        data: { deleteBoard: true }
      })

      await boardStore.deleteBoard(mockBoard.id)

      expect(mockClient.cache.modify).toHaveBeenCalled()
    })
  })
})
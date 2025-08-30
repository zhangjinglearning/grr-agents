import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useQuery, useMutation, useApolloClient } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { 
  MY_BOARDS_QUERY,
  CREATE_BOARD_MUTATION,
  DELETE_BOARD_MUTATION,
  GET_BOARD_WITH_LISTS_QUERY,
  GET_BOARD_WITH_LISTS_AND_CARDS_QUERY,
  CREATE_LIST_MUTATION,
  UPDATE_LIST_MUTATION,
  DELETE_LIST_MUTATION,
  CREATE_CARD_MUTATION,
  UPDATE_CARD_MUTATION,
  DELETE_CARD_MUTATION,
  type Board,
  type List,
  type Card,
  type CreateBoardInput,
  type CreateListInput,
  type UpdateListInput,
  type CreateCardInput,
  type UpdateCardInput
} from '../services/board.service'
import { useAuthStore } from './auth'

export interface BoardState {
  boards: Board[]
  isLoading: boolean
  error: string | null
}

export const useBoardStore = defineStore('board', () => {
  // State
  const boards = ref<Board[]>([])
  const selectedBoard = ref<Board | null>(null)
  const isLoading = ref(false)
  const isLoadingBoard = ref(false)
  const error = ref<string | null>(null)
  const isCreatingBoard = ref(false)
  const isDeletingBoard = ref<string | null>(null)
  const isCreatingList = ref(false)
  const isUpdatingList = ref<string | null>(null)
  const isDeletingList = ref<string | null>(null)
  const isCreatingCard = ref<string | null>(null)
  const isUpdatingCard = ref<string | null>(null)
  const isDeletingCard = ref<string | null>(null)

  // Computed
  const boardCount = computed(() => boards.value.length)
  const hasBoards = computed(() => boards.value.length > 0)
  const sortedBoards = computed(() => 
    [...boards.value].sort((a, b) => a.title.localeCompare(b.title))
  )
  const listCount = computed(() => selectedBoard.value?.lists?.length || 0)
  const hasLists = computed(() => (selectedBoard.value?.lists?.length || 0) > 0)
  const orderedLists = computed(() => {
    if (!selectedBoard.value?.lists || !selectedBoard.value?.listOrder) {
      return []
    }
    
    // Sort lists according to board's listOrder
    const listMap = new Map(selectedBoard.value.lists.map(list => [list.id, list]))
    return selectedBoard.value.listOrder
      .map(listId => listMap.get(listId))
      .filter((list): list is List => list !== undefined)
  })

  const cardCount = computed(() => {
    if (!selectedBoard.value?.lists) return 0
    return selectedBoard.value.lists.reduce((count, list) => count + (list.cards?.length || 0), 0)
  })

  const hasCards = computed(() => cardCount.value > 0)

  const getOrderedCardsForList = (listId: string): Card[] => {
    const list = selectedBoard.value?.lists?.find(l => l.id === listId)
    if (!list?.cards || !list?.cardOrder) return []
    
    const cardMap = new Map(list.cards.map(card => [card.id, card]))
    return list.cardOrder
      .map(cardId => cardMap.get(cardId))
      .filter((card): card is Card => card !== undefined)
  }

  // Apollo client for cache management
  const apolloClient = useApolloClient()
  const authStore = useAuthStore()

  // Mutations
  const { mutate: createBoardMutation } = useMutation(CREATE_BOARD_MUTATION)
  const { mutate: deleteBoardMutation } = useMutation(DELETE_BOARD_MUTATION)
  const { mutate: createListMutation } = useMutation(CREATE_LIST_MUTATION)
  const { mutate: updateListMutation } = useMutation(UPDATE_LIST_MUTATION)
  const { mutate: deleteListMutation } = useMutation(DELETE_LIST_MUTATION)
  const { mutate: createCardMutation } = useMutation(CREATE_CARD_MUTATION)
  const { mutate: updateCardMutation } = useMutation(UPDATE_CARD_MUTATION)
  const { mutate: deleteCardMutation } = useMutation(DELETE_CARD_MUTATION)

  // Actions
  const fetchBoards = async (): Promise<void> => {
    // Only fetch if user is authenticated
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Use Apollo Client directly for imperative queries
      const result = await apolloClient.client.query({
        query: MY_BOARDS_QUERY,
        fetchPolicy: 'cache-first'
      })

      if (result.data?.myBoards) {
        boards.value = result.data.myBoards
      } else {
        boards.value = []
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch boards'
      boards.value = []
      console.error('Error fetching boards:', err)
    } finally {
      isLoading.value = false
    }
  }

  const createBoard = async (title: string): Promise<Board | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isCreatingBoard.value = true
    error.value = null

    try {
      const result = await createBoardMutation({ 
        title: title.trim() 
      })
      
      if (result?.data?.createBoard) {
        const newBoard: Board = result.data.createBoard
        
        // Add to local state
        boards.value.unshift(newBoard)
        
        // Update Apollo cache
        apolloClient.client.cache.modify({
          fields: {
            myBoards(existingBoards = []) {
              const newBoardRef = apolloClient.client.cache.writeFragment({
                data: newBoard,
                fragment: gql`
                  fragment NewBoard on Board {
                    id
                    title
                    listOrder
                  }
                `
              })
              return [newBoardRef, ...existingBoards]
            }
          }
        })

        return newBoard
      } else {
        throw new Error('Failed to create board')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to create board'
      console.error('Error creating board:', err)
      throw err
    } finally {
      isCreatingBoard.value = false
    }
  }

  const deleteBoard = async (boardId: string): Promise<boolean> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return false
    }

    isDeletingBoard.value = boardId
    error.value = null

    try {
      const result = await deleteBoardMutation({ id: boardId })
      
      if (result?.data?.deleteBoard) {
        // Remove from local state
        boards.value = boards.value.filter(board => board.id !== boardId)
        
        // Update Apollo cache
        apolloClient.client.cache.modify({
          fields: {
            myBoards(existingBoards = [], { readField }) {
              return existingBoards.filter(
                (boardRef: any) => readField('id', boardRef) !== boardId
              )
            }
          }
        })

        return true
      } else {
        throw new Error('Failed to delete board')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete board'
      console.error('Error deleting board:', err)
      throw err
    } finally {
      isDeletingBoard.value = null
    }
  }

  // Board with cards management actions
  const fetchBoardWithListsAndCards = async (boardId: string): Promise<Board | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isLoadingBoard.value = true
    error.value = null

    try {
      const result = await apolloClient.client.query({
        query: GET_BOARD_WITH_LISTS_AND_CARDS_QUERY,
        variables: { id: boardId },
        fetchPolicy: 'cache-first'
      })

      if (result.data?.board) {
        const board = result.data.board
        selectedBoard.value = board
        
        // Also update the board in the boards array if it exists
        const boardIndex = boards.value.findIndex(b => b.id === boardId)
        if (boardIndex !== -1) {
          boards.value[boardIndex] = board
        }
        
        return board
      } else {
        error.value = 'Board not found'
        selectedBoard.value = null
        return null
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch board'
      selectedBoard.value = null
      console.error('Error fetching board with lists and cards:', err)
      return null
    } finally {
      isLoadingBoard.value = false
    }
  }

  // List management actions
  const fetchBoardWithLists = async (boardId: string): Promise<Board | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isLoadingBoard.value = true
    error.value = null

    try {
      const result = await apolloClient.client.query({
        query: GET_BOARD_WITH_LISTS_QUERY,
        variables: { id: boardId },
        fetchPolicy: 'cache-first'
      })

      if (result.data?.board) {
        const board = result.data.board
        selectedBoard.value = board
        
        // Also update the board in the boards array if it exists
        const boardIndex = boards.value.findIndex(b => b.id === boardId)
        if (boardIndex !== -1) {
          boards.value[boardIndex] = board
        }
        
        return board
      } else {
        error.value = 'Board not found'
        selectedBoard.value = null
        return null
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch board'
      selectedBoard.value = null
      console.error('Error fetching board with lists:', err)
      return null
    } finally {
      isLoadingBoard.value = false
    }
  }

  const createList = async (boardId: string, title: string): Promise<List | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isCreatingList.value = true
    error.value = null

    try {
      const result = await createListMutation({
        input: { boardId, title: title.trim() }
      })

      if (result?.data?.createList) {
        const newList: List = result.data.createList

        // Update selectedBoard if it matches
        if (selectedBoard.value?.id === boardId) {
          if (!selectedBoard.value.lists) {
            selectedBoard.value.lists = []
          }
          selectedBoard.value.lists.push(newList)
          selectedBoard.value.listOrder.push(newList.id)
        }

        // Update boards array
        const boardIndex = boards.value.findIndex(b => b.id === boardId)
        if (boardIndex !== -1) {
          boards.value[boardIndex].listOrder.push(newList.id)
        }

        return newList
      } else {
        throw new Error('Failed to create list')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to create list'
      console.error('Error creating list:', err)
      throw err
    } finally {
      isCreatingList.value = false
    }
  }

  const updateList = async (listId: string, title: string): Promise<List | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isUpdatingList.value = listId
    error.value = null

    try {
      const result = await updateListMutation({
        input: { id: listId, title: title.trim() }
      })

      if (result?.data?.updateList) {
        const updatedList: List = result.data.updateList

        // Update selectedBoard lists if present
        if (selectedBoard.value?.lists) {
          const listIndex = selectedBoard.value.lists.findIndex(l => l.id === listId)
          if (listIndex !== -1) {
            selectedBoard.value.lists[listIndex] = {
              ...selectedBoard.value.lists[listIndex],
              ...updatedList
            }
          }
        }

        return updatedList
      } else {
        throw new Error('Failed to update list')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to update list'
      console.error('Error updating list:', err)
      throw err
    } finally {
      isUpdatingList.value = null
    }
  }

  const deleteList = async (listId: string): Promise<boolean> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return false
    }

    isDeletingList.value = listId
    error.value = null

    try {
      const result = await deleteListMutation({ id: listId })

      if (result?.data?.deleteList) {
        // Update selectedBoard if present
        if (selectedBoard.value?.lists) {
          selectedBoard.value.lists = selectedBoard.value.lists.filter(l => l.id !== listId)
          selectedBoard.value.listOrder = selectedBoard.value.listOrder.filter(id => id !== listId)
        }

        // Find and update the relevant board in boards array
        const listBoardIndex = boards.value.findIndex(board => 
          board.listOrder.includes(listId)
        )
        if (listBoardIndex !== -1) {
          boards.value[listBoardIndex].listOrder = 
            boards.value[listBoardIndex].listOrder.filter(id => id !== listId)
        }

        return true
      } else {
        throw new Error('Failed to delete list')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete list'
      console.error('Error deleting list:', err)
      throw err
    } finally {
      isDeletingList.value = null
    }
  }

  // Card management actions
  const createCard = async (listId: string, content: string): Promise<Card | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isCreatingCard.value = listId
    error.value = null

    try {
      const result = await createCardMutation({
        input: { listId, content: content.trim() }
      })

      if (result?.data?.createCard) {
        const newCard: Card = result.data.createCard

        // Update selectedBoard if it contains the target list
        if (selectedBoard.value?.lists) {
          const listIndex = selectedBoard.value.lists.findIndex(l => l.id === listId)
          if (listIndex !== -1) {
            const list = selectedBoard.value.lists[listIndex]
            if (!list.cards) {
              list.cards = []
            }
            list.cards.push(newCard)
            list.cardOrder.push(newCard.id)
          }
        }

        return newCard
      } else {
        throw new Error('Failed to create card')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to create card'
      console.error('Error creating card:', err)
      throw err
    } finally {
      isCreatingCard.value = null
    }
  }

  const updateCard = async (cardId: string, content: string): Promise<Card | null> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return null
    }

    isUpdatingCard.value = cardId
    error.value = null

    try {
      const result = await updateCardMutation({
        input: { id: cardId, content: content.trim() }
      })

      if (result?.data?.updateCard) {
        const updatedCard: Card = result.data.updateCard

        // Update selectedBoard if it contains the card
        if (selectedBoard.value?.lists) {
          for (const list of selectedBoard.value.lists) {
            if (list.cards) {
              const cardIndex = list.cards.findIndex(c => c.id === cardId)
              if (cardIndex !== -1) {
                list.cards[cardIndex] = { ...list.cards[cardIndex], ...updatedCard }
                break
              }
            }
          }
        }

        return updatedCard
      } else {
        throw new Error('Failed to update card')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to update card'
      console.error('Error updating card:', err)
      throw err
    } finally {
      isUpdatingCard.value = null
    }
  }

  const deleteCard = async (cardId: string): Promise<boolean> => {
    if (!authStore.isAuthenticated) {
      error.value = 'User not authenticated'
      return false
    }

    isDeletingCard.value = cardId
    error.value = null

    try {
      const result = await deleteCardMutation({ id: cardId })

      if (result?.data?.deleteCard) {
        // Update selectedBoard if it contains the card
        if (selectedBoard.value?.lists) {
          for (const list of selectedBoard.value.lists) {
            if (list.cards) {
              const cardIndex = list.cards.findIndex(c => c.id === cardId)
              if (cardIndex !== -1) {
                list.cards.splice(cardIndex, 1)
                list.cardOrder = list.cardOrder.filter(id => id !== cardId)
                break
              }
            }
          }
        }

        return true
      } else {
        throw new Error('Failed to delete card')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete card'
      console.error('Error deleting card:', err)
      throw err
    } finally {
      isDeletingCard.value = null
    }
  }

  const getBoardById = (boardId: string): Board | undefined => {
    return boards.value.find(board => board.id === boardId)
  }

  const clearError = (): void => {
    error.value = null
  }

  const clearBoards = (): void => {
    boards.value = []
    selectedBoard.value = null
    error.value = null
    isLoading.value = false
    isLoadingBoard.value = false
    isCreatingBoard.value = false
    isDeletingBoard.value = null
    isCreatingList.value = false
    isUpdatingList.value = null
    isDeletingList.value = null
    isCreatingCard.value = null
    isUpdatingCard.value = null
    isDeletingCard.value = null
  }

  // Initialize boards when store is created (if user is authenticated)
  if (authStore.isAuthenticated) {
    fetchBoards()
  }

  return {
    // State
    boards: computed(() => boards.value),
    selectedBoard: computed(() => selectedBoard.value),
    isLoading: computed(() => isLoading.value),
    isLoadingBoard: computed(() => isLoadingBoard.value),
    error: computed(() => error.value),
    isCreatingBoard: computed(() => isCreatingBoard.value),
    isDeletingBoard: computed(() => isDeletingBoard.value),
    isCreatingList: computed(() => isCreatingList.value),
    isUpdatingList: computed(() => isUpdatingList.value),
    isDeletingList: computed(() => isDeletingList.value),
    isCreatingCard: computed(() => isCreatingCard.value),
    isUpdatingCard: computed(() => isUpdatingCard.value),
    isDeletingCard: computed(() => isDeletingCard.value),
    
    // Computed
    boardCount,
    hasBoards,
    sortedBoards,
    listCount,
    hasLists,
    orderedLists,
    cardCount,
    hasCards,
    getOrderedCardsForList,
    
    // Actions
    fetchBoards,
    createBoard,
    deleteBoard,
    getBoardById,
    fetchBoardWithLists,
    fetchBoardWithListsAndCards,
    createList,
    updateList,
    deleteList,
    createCard,
    updateCard,
    deleteCard,
    clearError,
    clearBoards
  }
})
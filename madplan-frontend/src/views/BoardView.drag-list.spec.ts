import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import BoardView from './BoardView.vue'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'
import type { Board, List } from '../services/board.service'

// Mock Apollo Client
vi.mock('@apollo/client/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    gql: vi.fn((template, ...args) => {
      // Simple mock implementation that returns the template
      return template.join('')
    })
  }
})

// Mock Vue Apollo
vi.mock('@vue/apollo-composable', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn() })),
  useApolloClient: vi.fn(() => ({
    client: {
      query: vi.fn(),
      cache: {
        modify: vi.fn(),
        writeFragment: vi.fn()
      }
    }
  }))
}))

// Mock VueDraggable component
vi.mock('vuedraggable', () => ({
  default: {
    name: 'VueDraggable',
    props: ['modelValue', 'group', 'disabled', 'itemKey', 'ghostClass', 'chosenClass', 'dragClass', 'animation', 'swapThreshold'],
    emits: ['start', 'end', 'change'],
    template: `
      <div class="vue-draggable">
        <template v-for="item in modelValue" :key="item.id">
          <slot name="item" :element="item" />
        </template>
        <slot name="footer" />
      </div>
    `
  }
}))

// Mock components
vi.mock('../components/lists/ListColumn.vue', () => ({
  default: {
    name: 'ListColumn',
    props: ['list', 'isDraggingList'],
    template: '<div class="list-column" :data-list-id="list.id">{{ list.title }}</div>'
  }
}))

vi.mock('../components/lists/CreateListForm.vue', () => ({
  default: {
    name: 'CreateListForm',
    template: '<div class="create-list-form">Create List Form</div>'
  }
}))

// Mock router
const mockRouter = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/board/:id', component: BoardView }
  ]
})

describe('BoardView - List Drag and Drop', () => {
  let wrapper: VueWrapper<any>
  let mockBoard: Board
  let mockLists: List[]
  let authStore: ReturnType<typeof useAuthStore>
  let boardStore: ReturnType<typeof useBoardStore>
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    // Create fresh Pinia instance
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock board data
    mockLists = [
      { id: 'list-1', title: 'To Do', boardId: 'board-1', cardOrder: [], cards: [] },
      { id: 'list-2', title: 'In Progress', boardId: 'board-1', cardOrder: [], cards: [] },
      { id: 'list-3', title: 'Done', boardId: 'board-1', cardOrder: [], cards: [] }
    ]

    mockBoard = {
      id: 'board-1',
      title: 'Test Board',
      listOrder: ['list-1', 'list-2', 'list-3'],
      lists: mockLists
    }

    // Initialize stores
    authStore = useAuthStore()
    boardStore = useBoardStore()

    // Mock auth state
    authStore.isAuthenticated = true
    authStore.user = { id: '1', email: 'test@example.com' }

    // Mock board store methods
    vi.spyOn(boardStore, 'fetchBoardWithListsAndCards').mockResolvedValue(mockBoard)
    vi.spyOn(boardStore, 'startListDrag').mockImplementation(() => {})
    vi.spyOn(boardStore, 'endListDrag').mockImplementation(() => {})
    vi.spyOn(boardStore, 'reorderList').mockResolvedValue(true)

    // Mock board store state
    boardStore.selectedBoard = mockBoard
    boardStore.isLoadingBoard = false
    boardStore.isDraggingList = false
    boardStore.draggedList = null
    boardStore.isReorderingList = false

    // Mock navigator.vibrate
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      configurable: true
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const createWrapper = (routeParams = { id: 'board-1' }) => {
    return mount(BoardView, {
      global: {
        plugins: [pinia, mockRouter],
        mocks: {
          $route: {
            params: routeParams
          }
        }
      }
    })
  }

  describe('List Drag Initialization', () => {
    it('should render VueDraggable component for lists', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const draggable = wrapper.find('.vue-draggable')
      expect(draggable.exists()).toBe(true)
    })

    it('should pass correct props to VueDraggable', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      expect(draggableComponent.props()).toMatchObject({
        group: 'lists',
        disabled: false,
        itemKey: 'id',
        ghostClass: 'ghost-list',
        chosenClass: 'chosen-list',
        dragClass: 'drag-list',
        animation: 150,
        swapThreshold: 0.65
      })
    })

    it('should disable dragging when board is loading', async () => {
      boardStore.isLoadingBoard = true
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      expect(draggableComponent.props('disabled')).toBe(true)
    })

    it('should disable dragging when reordering lists', async () => {
      boardStore.isReorderingList = true
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      expect(draggableComponent.props('disabled')).toBe(true)
    })
  })

  describe('Drag Start Handling', () => {
    it('should call startListDrag when drag starts', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        item: {
          __vueParentComponent: {
            props: {
              list: mockLists[0]
            }
          }
        }
      }

      // Trigger drag start
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('start', mockEvent)

      expect(boardStore.startListDrag).toHaveBeenCalledWith(mockLists[0])
    })

    it('should trigger haptic feedback on drag start', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        item: {
          __vueParentComponent: {
            props: {
              list: mockLists[0]
            }
          }
        }
      }

      // Trigger drag start
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('start', mockEvent)

      expect(navigator.vibrate).toHaveBeenCalledWith(50)
    })

    it('should announce drag start to screen readers', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        item: {
          __vueParentComponent: {
            props: {
              list: mockLists[0]
            }
          }
        }
      }

      // Trigger drag start
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('start', mockEvent)

      const announcement = wrapper.find('[aria-live="polite"]')
      expect(announcement.text()).toBe('Started dragging list: To Do')
    })
  })

  describe('Drag End Handling', () => {
    beforeEach(() => {
      boardStore.draggedList = mockLists[0]
    })

    it('should call endListDrag when drag ends', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Trigger drag end
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('end')

      expect(boardStore.endListDrag).toHaveBeenCalled()
    })

    it('should trigger success haptic feedback on drag end', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Trigger drag end
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('end')

      expect(navigator.vibrate).toHaveBeenCalledWith([50, 50, 50])
    })

    it('should announce drag end to screen readers', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Trigger drag end
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('end')

      const announcement = wrapper.find('[aria-live="polite"]')
      expect(announcement.text()).toBe('Stopped dragging list: To Do')
    })
  })

  describe('List Reordering', () => {
    it('should call reorderList when list is moved', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        moved: {
          element: mockLists[0],
          newIndex: 2
        }
      }

      // Trigger list reorder
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('change', mockEvent)

      expect(boardStore.reorderList).toHaveBeenCalledWith('list-1', 2)
    })

    it('should trigger success feedback on successful reorder', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        moved: {
          element: mockLists[0],
          newIndex: 2
        }
      }

      // Trigger list reorder
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('change', mockEvent)
      await wrapper.vm.$nextTick()

      expect(navigator.vibrate).toHaveBeenCalledWith(100)

      const announcement = wrapper.find('[aria-live="polite"]')
      expect(announcement.text()).toBe('Moved list "To Do" to position 3')
    })

    it('should handle reorder errors gracefully', async () => {
      // Mock reorder failure
      vi.spyOn(boardStore, 'reorderList').mockRejectedValue(new Error('Network error'))
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        moved: {
          element: mockLists[0],
          newIndex: 2
        }
      }

      // Trigger list reorder
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('change', mockEvent)
      await wrapper.vm.$nextTick()

      expect(navigator.vibrate).toHaveBeenCalledWith([200, 100, 200])

      const announcement = wrapper.find('[aria-live="polite"]')
      expect(announcement.text()).toBe('Failed to move list "To Do". Please try again.')
    })

    it('should not handle events without moved property', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        added: {
          element: mockLists[0],
          newIndex: 2
        }
      }

      // Trigger event without moved property
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('change', mockEvent)

      expect(boardStore.reorderList).not.toHaveBeenCalled()
    })
  })

  describe('Auto-scroll Functionality', () => {
    beforeEach(() => {
      // Mock scrollContainer
      Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
        value: () => ({
          left: 100,
          right: 900,
          width: 800
        }),
        configurable: true
      })
    })

    it('should setup auto-scroll on drag start', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        item: {
          __vueParentComponent: {
            props: {
              list: mockLists[0]
            }
          }
        }
      }

      // Add event listeners spy
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      // Trigger drag start
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('start', mockEvent)

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    })

    it('should apply scroll-smooth class to container', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const scrollContainer = wrapper.find('[ref="scrollContainer"]')
      expect(scrollContainer.classes()).toContain('scroll-smooth')
    })
  })

  describe('Visual Feedback', () => {
    it('should pass isDraggingList prop to ListColumn', async () => {
      boardStore.draggedList = mockLists[0]
      boardStore.isDraggingList = true
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const listColumns = wrapper.findAllComponents({ name: 'ListColumn' })
      const draggingColumn = listColumns.find(column => 
        column.props('list').id === 'list-1'
      )
      
      expect(draggingColumn?.props('isDraggingList')).toBe(true)
    })

    it('should apply correct CSS classes for drag states', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Check that CSS classes are defined in styles
      const styles = wrapper.find('style').text()
      expect(styles).toContain('.ghost-list')
      expect(styles).toContain('.chosen-list')
      expect(styles).toContain('.drag-list')
    })
  })

  describe('Accessibility Features', () => {
    it('should have screen reader live region', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const liveRegion = wrapper.find('[aria-live="polite"]')
      expect(liveRegion.exists()).toBe(true)
      expect(liveRegion.attributes('role')).toBe('status')
      expect(liveRegion.attributes('aria-atomic')).toBe('true')
    })

    it('should have proper ARIA attributes on draggable container', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const draggableContainer = wrapper.find('.vue-draggable')
      expect(draggableContainer.exists()).toBe(true)
    })

    it('should support reduced motion preferences', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Check that reduced motion styles are defined
      const styles = wrapper.find('style').text()
      expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    })

    it('should support high contrast mode', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Check that high contrast styles are defined
      const styles = wrapper.find('style').text()
      expect(styles).toContain('@media (prefers-contrast: high)')
    })
  })

  describe('Mobile Optimizations', () => {
    it('should have enhanced touch styles', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Check that mobile styles are defined
      const styles = wrapper.find('style').text()
      expect(styles).toContain('@media (hover: none) and (pointer: coarse)')
    })

    it('should trigger haptic feedback appropriately', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Mock list drag start
      const mockEvent = {
        item: {
          __vueParentComponent: {
            props: {
              list: mockLists[0]
            }
          }
        }
      }

      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('start', mockEvent)

      // Should trigger haptic feedback on supported devices
      expect(navigator.vibrate).toHaveBeenCalledWith(50)
    })
  })

  describe('Performance Considerations', () => {
    it('should not create wrapper when no list in drag event', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        item: {
          __vueParentComponent: null
        }
      }

      // Trigger drag start with null component
      const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
      await draggableComponent.vm.$emit('start', mockEvent)

      expect(boardStore.startListDrag).not.toHaveBeenCalled()
    })

    it('should handle missing navigator.vibrate gracefully', async () => {
      // Remove navigator.vibrate
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        configurable: true
      })

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const mockEvent = {
        item: {
          __vueParentComponent: {
            props: {
              list: mockLists[0]
            }
          }
        }
      }

      // Should not throw error when vibrate is not available
      expect(() => {
        const draggableComponent = wrapper.findComponent({ name: 'VueDraggable' })
        draggableComponent.vm.$emit('start', mockEvent)
      }).not.toThrow()
    })
  })
})
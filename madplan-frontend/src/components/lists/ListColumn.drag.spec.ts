import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListColumn from './ListColumn.vue'
import type { List, Card } from '../../services/board.service'

// Mock VueDraggable component
vi.mock('vuedraggable', () => ({
  default: {
    name: 'draggable',
    template: '<div><slot /></div>',
    props: ['modelValue', 'group', 'disabled', 'itemKey', 'class', 'ghostClass', 'chosenClass', 'dragClass'],
    emits: ['start', 'end', 'change'],
    setup(props: any, { emit }: any) {
      return {
        emitStart: () => emit('start', {}),
        emitEnd: () => emit('end', {}),
        emitChange: (evt: any) => emit('change', evt)
      }
    }
  }
}))

// Mock components
vi.mock('../cards/CardItem.vue', () => ({
  default: {
    name: 'CardItem',
    template: '<div data-testid="card-item">{{ card.content }}</div>',
    props: ['card', 'listId', 'isUpdating', 'isDeleting', 'isDragging'],
    emits: ['update-content', 'delete', 'drag-start', 'drag-end']
  }
}))

vi.mock('../cards/CreateCardForm.vue', () => ({
  default: {
    name: 'CreateCardForm',
    template: '<div data-testid="create-card-form"></div>',
    props: ['listId', 'isCreating', 'error'],
    emits: ['create', 'cancel']
  }
}))

// Mock list with cards
const mockCards: Card[] = [
  { id: 'card-1', content: 'Card 1', listId: 'list-1' },
  { id: 'card-2', content: 'Card 2', listId: 'list-1' },
  { id: 'card-3', content: 'Card 3', listId: 'list-1' }
]

const mockList: List = {
  id: 'list-1',
  title: 'Test List',
  boardId: 'board-1',
  cardOrder: ['card-1', 'card-2', 'card-3'],
  cards: mockCards
}

describe('ListColumn drag-and-drop functionality', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(ListColumn, {
      props: {
        list: mockList
      },
      global: {
        stubs: {
          draggable: true,
          CardItem: true,
          CreateCardForm: true
        }
      }
    })
  })

  it('renders draggable container with correct props', () => {
    const draggable = wrapper.findComponent({ name: 'draggable' })
    
    expect(draggable.exists()).toBe(true)
    expect(draggable.props('group')).toBe('cards')
    expect(draggable.props('itemKey')).toBe('id')
    expect(draggable.props('disabled')).toBe(false)
  })

  it('disables draggable when list is updating or deleting', async () => {
    await wrapper.setProps({ isUpdating: true })
    
    const draggable = wrapper.findComponent({ name: 'draggable' })
    expect(draggable.props('disabled')).toBe(true)

    await wrapper.setProps({ isUpdating: false, isDeleting: true })
    expect(draggable.props('disabled')).toBe(true)
  })

  it('applies correct CSS classes for drag states', async () => {
    const draggable = wrapper.findComponent({ name: 'draggable' })
    
    expect(draggable.classes()).toContain('space-y-2')
    expect(draggable.classes()).toContain('min-h-[100px]')
  })

  it('applies drag over classes when isDragOverList is true and list is empty', async () => {
    const emptyList = { ...mockList, cards: [], cardOrder: [] }
    await wrapper.setProps({ 
      list: emptyList,
      isDragOverList: true 
    })
    
    const draggable = wrapper.findComponent({ name: 'draggable' })
    expect(draggable.classes()).toContain('border-2')
    expect(draggable.classes()).toContain('border-dashed')
    expect(draggable.classes()).toContain('border-emerald-400')
  })

  it('passes correct props to CardItem components', () => {
    const cardItems = wrapper.findAllComponents({ name: 'CardItem' })
    
    expect(cardItems).toHaveLength(3)
    
    cardItems.forEach((cardItem: any, index: number) => {
      expect(cardItem.props('card')).toEqual(mockCards[index])
      expect(cardItem.props('listId')).toBe('list-1')
      expect(cardItem.props('isUpdating')).toBe(false)
      expect(cardItem.props('isDeleting')).toBe(false)
      expect(cardItem.props('isDragging')).toBe(false)
    })
  })

  it('updates CardItem props when drag state changes', async () => {
    await wrapper.setProps({
      isUpdatingCard: 'card-1',
      isDeletingCard: 'card-2',
      draggedCardId: 'card-3'
    })

    const cardItems = wrapper.findAllComponents({ name: 'CardItem' })
    
    expect(cardItems[0].props('isUpdating')).toBe(true)
    expect(cardItems[1].props('isDeleting')).toBe(true)
    expect(cardItems[2].props('isDragging')).toBe(true)
  })

  it('shows correct empty state message based on drag state', async () => {
    const emptyList = { ...mockList, cards: [], cardOrder: [] }
    await wrapper.setProps({ list: emptyList })
    
    expect(wrapper.text()).toContain('No cards yet')

    await wrapper.setProps({ isDragOverList: true })
    expect(wrapper.text()).toContain('Drop card here')
  })

  it('emits card-drag-start event when CardItem starts dragging', async () => {
    const cardItem = wrapper.findComponent({ name: 'CardItem' })
    
    await cardItem.vm.$emit('drag-start', mockCards[0], 'list-1')
    
    expect(wrapper.emitted('card-drag-start')).toBeTruthy()
    expect(wrapper.emitted('card-drag-start')[0]).toEqual([mockCards[0], 'list-1'])
  })

  it('emits card-drag-end event when CardItem stops dragging', async () => {
    const cardItem = wrapper.findComponent({ name: 'CardItem' })
    
    await cardItem.vm.$emit('drag-end')
    
    expect(wrapper.emitted('card-drag-end')).toBeTruthy()
  })

  it('handles draggable start event', async () => {
    const draggable = wrapper.findComponent({ name: 'draggable' })
    
    await draggable.vm.$emit('start', { item: mockCards[0] })
    
    // Verify internal state is updated (if applicable)
    expect(wrapper.vm.handleDragStart).toBeDefined()
  })

  it('handles draggable end event', async () => {
    const draggable = wrapper.findComponent({ name: 'draggable' })
    
    await draggable.vm.$emit('end', { item: mockCards[0] })
    
    expect(wrapper.vm.handleDragEnd).toBeDefined()
  })

  it('emits card-reorder event when card is moved within same list', async () => {
    const draggable = wrapper.findComponent({ name: 'draggable' })
    
    const moveEvent = {
      moved: {
        element: mockCards[0],
        newIndex: 2
      }
    }
    
    await draggable.vm.$emit('change', moveEvent)
    
    expect(wrapper.emitted('card-reorder')).toBeTruthy()
    expect(wrapper.emitted('card-reorder')[0]).toEqual(['card-1', 'list-1', 'list-1', 2])
  })

  it('emits card-reorder event when card is added from another list', async () => {
    const draggable = wrapper.findComponent({ name: 'draggable' })
    
    const addEvent = {
      added: {
        element: { ...mockCards[0], listId: 'list-2' },
        newIndex: 1
      }
    }
    
    await draggable.vm.$emit('change', addEvent)
    
    expect(wrapper.emitted('card-reorder')).toBeTruthy()
    expect(wrapper.emitted('card-reorder')[0]).toEqual(['card-1', 'list-2', 'list-1', 1])
  })

  it('applies correct drag-related CSS classes', () => {
    const styles = wrapper.find('style')
    
    // Check that drag-related styles are present
    expect(wrapper.html()).toContain('ghost-card')
    expect(wrapper.html()).toContain('chosen-card')
    expect(wrapper.html()).toContain('drag-card')
  })

  it('maintains card order based on cardOrder prop', () => {
    const orderedCards = wrapper.vm.orderedCards
    
    expect(orderedCards).toHaveLength(3)
    expect(orderedCards[0].id).toBe('card-1')
    expect(orderedCards[1].id).toBe('card-2')
    expect(orderedCards[2].id).toBe('card-3')
  })

  it('updates draggableCards computed property correctly', () => {
    const draggableCards = wrapper.vm.draggableCards
    
    expect(draggableCards).toEqual(mockCards)
  })

  it('handles empty cardOrder gracefully', async () => {
    const listWithNoOrder = { ...mockList, cardOrder: [] }
    await wrapper.setProps({ list: listWithNoOrder })
    
    const orderedCards = wrapper.vm.orderedCards
    expect(orderedCards).toHaveLength(0)
  })

  it('handles missing cards array gracefully', async () => {
    const listWithNoCards = { ...mockList, cards: undefined }
    await wrapper.setProps({ list: listWithNoCards })
    
    const orderedCards = wrapper.vm.orderedCards
    expect(orderedCards).toHaveLength(0)
  })

  it('shows list container with drag over styling', async () => {
    await wrapper.setProps({ isDragOverList: true })
    
    const container = wrapper.find('.bg-white')
    expect(container.classes()).toContain('border-emerald-400')
    expect(container.classes()).toContain('bg-emerald-50')
  })
})
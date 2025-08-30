import { gql } from '@apollo/client/core'

// TypeScript interfaces matching backend Board schema from Story 2.1
export interface Board {
  id: string
  title: string
  listOrder: string[]
  lists?: List[]
}

export interface List {
  id: string
  title: string
  boardId: string
  cardOrder: string[]
  cards?: Card[]
}

export interface Card {
  id: string
  content: string
  listId: string
}

export interface CreateBoardInput {
  title: string
}

export interface CreateListInput {
  boardId: string
  title: string
}

export interface UpdateListInput {
  id: string
  title?: string
}

export interface CreateCardInput {
  listId: string
  content: string
}

export interface UpdateCardInput {
  id: string
  content?: string
}

// GraphQL queries
export const MY_BOARDS_QUERY = gql`
  query MyBoards {
    myBoards {
      id
      title
      listOrder
    }
  }
`

export const BOARD_QUERY = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      id
      title
      listOrder
    }
  }
`

export const GET_BOARD_WITH_LISTS_QUERY = gql`
  query GetBoardWithLists($id: ID!) {
    board(id: $id) {
      id
      title
      listOrder
      lists {
        id
        title
        cardOrder
      }
    }
  }
`

export const GET_BOARD_WITH_LISTS_AND_CARDS_QUERY = gql`
  query GetBoardWithListsAndCards($id: ID!) {
    board(id: $id) {
      id
      title
      listOrder
      lists {
        id
        title
        cardOrder
        cards {
          id
          content
        }
      }
    }
  }
`

// GraphQL mutations
export const CREATE_BOARD_MUTATION = gql`
  mutation CreateBoard($title: String!) {
    createBoard(title: $title) {
      id
      title
      listOrder
    }
  }
`

export const DELETE_BOARD_MUTATION = gql`
  mutation DeleteBoard($id: ID!) {
    deleteBoard(id: $id)
  }
`

// List mutations
export const CREATE_LIST_MUTATION = gql`
  mutation CreateList($input: CreateListInput!) {
    createList(input: $input) {
      id
      title
      cardOrder
    }
  }
`

export const UPDATE_LIST_MUTATION = gql`
  mutation UpdateList($input: UpdateListInput!) {
    updateList(input: $input) {
      id
      title
    }
  }
`

export const DELETE_LIST_MUTATION = gql`
  mutation DeleteList($id: ID!) {
    deleteList(id: $id)
  }
`

// Card mutations
export const CREATE_CARD_MUTATION = gql`
  mutation CreateCard($input: CreateCardInput!) {
    createCard(input: $input) {
      id
      content
    }
  }
`

export const UPDATE_CARD_MUTATION = gql`
  mutation UpdateCard($input: UpdateCardInput!) {
    updateCard(input: $input) {
      id
      content
    }
  }
`

export const DELETE_CARD_MUTATION = gql`
  mutation DeleteCard($id: ID!) {
    deleteCard(id: $id)
  }
`
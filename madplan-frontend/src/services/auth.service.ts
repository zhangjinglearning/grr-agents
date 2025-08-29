import { gql } from '@apollo/client/core'

// TypeScript interfaces matching backend types
export interface User {
  id: string
  email: string
}

export interface AuthPayload {
  token: string
  user: User
}

export interface RegisterUserInput {
  email: string
  password: string
}

export interface LoginUserInput {
  email: string
  password: string
}

// GraphQL mutations
export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterUserInput!) {
    register(input: $input) {
      token
      user {
        id
        email
      }
    }
  }
`

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginUserInput!) {
    login(input: $input) {
      token
      user {
        id
        email
      }
    }
  }
`

// GraphQL queries for future use
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
    }
  }
`
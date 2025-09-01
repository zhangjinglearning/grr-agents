import { gql } from '@apollo/client/core'

// TypeScript interfaces matching backend CardTemplate schema
export interface TemplateContent {
  title: string
  description: string
  labels: string[]
  priority: Priority
  customFields: string
  checklistItems: string[]
  attachmentTypes: string[]
}

export interface CardTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  isPublic: boolean
  createdBy: string
  content: TemplateContent
  usageCount: number
  createdAt: string
  updatedAt: string
}

export enum TemplateCategory {
  TASK = 'task',
  BUG = 'bug',
  MEETING = 'meeting',
  FEATURE = 'feature',
  RESEARCH = 'research',
  CUSTOM = 'custom'
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface CreateTemplateContentInput {
  title: string
  description: string
  labels: string[]
  priority: Priority
  customFields: string
  checklistItems: string[]
  attachmentTypes: string[]
}

export interface CreateTemplateInput {
  name: string
  description: string
  category: TemplateCategory
  isPublic: boolean
  content: CreateTemplateContentInput
}

export interface UpdateTemplateInput {
  id: string
  name?: string
  description?: string
  category?: TemplateCategory
  isPublic?: boolean
  content?: Partial<CreateTemplateContentInput>
}

export interface ApplyTemplateInput {
  templateId: string
  listId: string
  titleOverride?: string
  customData?: string
}

// GraphQL queries and mutations
export const GET_USER_TEMPLATES_QUERY = gql`
  query GetUserTemplates($category: TemplateCategory) {
    getUserTemplates(category: $category) {
      id
      name
      description
      category
      isPublic
      createdBy
      content {
        title
        description
        labels
        priority
        customFields
        checklistItems
        attachmentTypes
      }
      usageCount
      createdAt
      updatedAt
    }
  }
`

export const GET_POPULAR_TEMPLATES_QUERY = gql`
  query GetPopularTemplates($limit: Int) {
    getPopularTemplates(limit: $limit) {
      id
      name
      description
      category
      isPublic
      createdBy
      content {
        title
        description
        labels
        priority
        customFields
        checklistItems
        attachmentTypes
      }
      usageCount
      createdAt
      updatedAt
    }
  }
`

export const GET_TEMPLATE_QUERY = gql`
  query GetTemplate($id: String!) {
    getTemplate(id: $id) {
      id
      name
      description
      category
      isPublic
      createdBy
      content {
        title
        description
        labels
        priority
        customFields
        checklistItems
        attachmentTypes
      }
      usageCount
      createdAt
      updatedAt
    }
  }
`

export const SEARCH_TEMPLATES_QUERY = gql`
  query SearchTemplates($query: String!, $limit: Int) {
    searchTemplates(query: $query, limit: $limit) {
      id
      name
      description
      category
      isPublic
      createdBy
      content {
        title
        description
        labels
        priority
        customFields
        checklistItems
        attachmentTypes
      }
      usageCount
      createdAt
      updatedAt
    }
  }
`

export const CREATE_TEMPLATE_MUTATION = gql`
  mutation CreateTemplate($input: CreateTemplateInput!) {
    createTemplate(input: $input) {
      id
      name
      description
      category
      isPublic
      createdBy
      content {
        title
        description
        labels
        priority
        customFields
        checklistItems
        attachmentTypes
      }
      usageCount
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_TEMPLATE_MUTATION = gql`
  mutation UpdateTemplate($input: UpdateTemplateInput!) {
    updateTemplate(input: $input) {
      id
      name
      description
      category
      isPublic
      createdBy
      content {
        title
        description
        labels
        priority
        customFields
        checklistItems
        attachmentTypes
      }
      usageCount
      createdAt
      updatedAt
    }
  }
`

export const DELETE_TEMPLATE_MUTATION = gql`
  mutation DeleteTemplate($id: String!) {
    deleteTemplate(id: $id)
  }
`

export const APPLY_TEMPLATE_MUTATION = gql`
  mutation ApplyTemplate($input: ApplyTemplateInput!) {
    applyTemplate(input: $input) {
      id
      content
      listId
      createdAt
      updatedAt
    }
  }
`
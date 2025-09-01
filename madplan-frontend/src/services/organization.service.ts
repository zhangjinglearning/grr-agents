import { apolloClient } from './apollo.service';
import { gql } from '@apollo/client/core';
import type { 
  Label,
  CustomField,
  CardOrganization,
  BoardOrganizationSettings,
  CreateLabelInput,
  UpdateLabelInput,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  UpdateCardOrganizationInput,
  OrganizationQueryInput,
} from '@/types/organization';

// Label Mutations
const CREATE_LABEL = gql`
  mutation CreateLabel($input: CreateLabelInput!) {
    createLabel(input: $input) {
      id
      name
      color
      boardId
      createdBy
      description
      createdAt
      usageCount
      isActive
    }
  }
`;

const UPDATE_LABEL = gql`
  mutation UpdateLabel($labelId: ID!, $input: UpdateLabelInput!) {
    updateLabel(labelId: $labelId, input: $input) {
      id
      name
      color
      description
      isActive
    }
  }
`;

const DELETE_LABEL = gql`
  mutation DeleteLabel($labelId: ID!) {
    deleteLabel(labelId: $labelId)
  }
`;

// Custom Field Mutations
const CREATE_CUSTOM_FIELD = gql`
  mutation CreateCustomField($input: CreateCustomFieldInput!) {
    createCustomField(input: $input) {
      id
      name
      type
      boardId
      createdBy
      description
      isRequired
      isActive
      position
      options {
        label
        value
        color
        position
      }
      defaultValue
      placeholder
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_CUSTOM_FIELD = gql`
  mutation UpdateCustomField($fieldId: ID!, $input: UpdateCustomFieldInput!) {
    updateCustomField(fieldId: $fieldId, input: $input) {
      id
      name
      description
      isRequired
      isActive
      options {
        label
        value
        color
        position
      }
      defaultValue
      placeholder
      updatedAt
    }
  }
`;

const DELETE_CUSTOM_FIELD = gql`
  mutation DeleteCustomField($fieldId: ID!) {
    deleteCustomField(fieldId: $fieldId)
  }
`;

const REORDER_CUSTOM_FIELDS = gql`
  mutation ReorderCustomFields($boardId: ID!, $fieldIds: [ID!]!) {
    reorderCustomFields(boardId: $boardId, fieldIds: $fieldIds)
  }
`;

// Card Organization Mutations
const UPDATE_CARD_ORGANIZATION = gql`
  mutation UpdateCardOrganization($cardId: ID!, $input: UpdateCardOrganizationInput!) {
    updateCardOrganization(cardId: $cardId, input: $input) {
      id
      cardId
      boardId
      labelIds
      priority
      customFieldValues {
        fieldId
        fieldName
        fieldType
        value
        multiValue
        updatedAt
      }
      tags
      estimatedHours
      actualHours
      storyPoints
      createdAt
      updatedAt
    }
  }
`;

// Board Settings Mutations
const UPDATE_BOARD_ORGANIZATION_SETTINGS = gql`
  mutation UpdateBoardOrganizationSettings($boardId: ID!, $input: UpdateBoardOrganizationSettingsInput!) {
    updateBoardOrganizationSettings(boardId: $boardId, input: $input) {
      id
      boardId
      enableLabels
      enablePriorities
      enableCustomFields
      enableTags
      enableEstimation
      availablePriorities
      defaultPriority
      maxLabelsPerCard
      maxCustomFieldsPerBoard
      createdAt
      updatedAt
    }
  }
`;

// Queries
const GET_BOARD_LABELS = gql`
  query GetBoardLabels($boardId: ID!) {
    getBoardLabels(boardId: $boardId) {
      id
      name
      color
      boardId
      createdBy
      description
      createdAt
      usageCount
      isActive
    }
  }
`;

const GET_BOARD_CUSTOM_FIELDS = gql`
  query GetBoardCustomFields($boardId: ID!) {
    getBoardCustomFields(boardId: $boardId) {
      id
      name
      type
      boardId
      createdBy
      description
      isRequired
      isActive
      position
      options {
        label
        value
        color
        position
      }
      defaultValue
      placeholder
      createdAt
      updatedAt
    }
  }
`;

const GET_CARD_ORGANIZATION = gql`
  query GetCardOrganization($cardId: ID!) {
    getCardOrganization(cardId: $cardId) {
      id
      cardId
      boardId
      labelIds
      priority
      customFieldValues {
        fieldId
        fieldName
        fieldType
        value
        multiValue
        updatedAt
      }
      tags
      estimatedHours
      actualHours
      storyPoints
      createdAt
      updatedAt
    }
  }
`;

const GET_ORGANIZED_CARDS = gql`
  query GetOrganizedCards($query: OrganizationQueryInput!) {
    getOrganizedCards(query: $query) {
      id
      cardId
      boardId
      labelIds
      priority
      customFieldValues {
        fieldId
        fieldName
        fieldType
        value
        multiValue
        updatedAt
      }
      tags
      estimatedHours
      actualHours
      storyPoints
      createdAt
      updatedAt
    }
  }
`;

const GET_BOARD_ORGANIZATION_SETTINGS = gql`
  query GetBoardOrganizationSettings($boardId: ID!) {
    getBoardOrganizationSettings(boardId: $boardId) {
      id
      boardId
      enableLabels
      enablePriorities
      enableCustomFields
      enableTags
      enableEstimation
      availablePriorities
      defaultPriority
      maxLabelsPerCard
      maxCustomFieldsPerBoard
      createdAt
      updatedAt
    }
  }
`;

const GET_BOARD_ORGANIZATION_SUMMARY = gql`
  query GetBoardOrganizationSummary($boardId: ID!) {
    getBoardOrganizationSummary(boardId: $boardId) {
      totalCards
      labelStats {
        name
        color
        count
      }
      priorityStats {
        _id
        count
      }
      customFieldCount
    }
  }
`;

class OrganizationService {
  // Label Methods
  async createLabel(input: CreateLabelInput): Promise<Label> {
    const { data } = await apolloClient.mutate({
      mutation: CREATE_LABEL,
      variables: { input },
    });
    return data.createLabel;
  }

  async updateLabel(labelId: string, input: UpdateLabelInput): Promise<Label> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_LABEL,
      variables: { labelId, input },
    });
    return data.updateLabel;
  }

  async deleteLabel(labelId: string): Promise<boolean> {
    const { data } = await apolloClient.mutate({
      mutation: DELETE_LABEL,
      variables: { labelId },
    });
    return data.deleteLabel;
  }

  async getBoardLabels(boardId: string): Promise<Label[]> {
    const { data } = await apolloClient.query({
      query: GET_BOARD_LABELS,
      variables: { boardId },
      fetchPolicy: 'network-only',
    });
    return data.getBoardLabels;
  }

  // Custom Field Methods
  async createCustomField(input: CreateCustomFieldInput): Promise<CustomField> {
    const { data } = await apolloClient.mutate({
      mutation: CREATE_CUSTOM_FIELD,
      variables: { input },
    });
    return data.createCustomField;
  }

  async updateCustomField(fieldId: string, input: UpdateCustomFieldInput): Promise<CustomField> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_CUSTOM_FIELD,
      variables: { fieldId, input },
    });
    return data.updateCustomField;
  }

  async deleteCustomField(fieldId: string): Promise<boolean> {
    const { data } = await apolloClient.mutate({
      mutation: DELETE_CUSTOM_FIELD,
      variables: { fieldId },
    });
    return data.deleteCustomField;
  }

  async getBoardCustomFields(boardId: string): Promise<CustomField[]> {
    const { data } = await apolloClient.query({
      query: GET_BOARD_CUSTOM_FIELDS,
      variables: { boardId },
      fetchPolicy: 'network-only',
    });
    return data.getBoardCustomFields;
  }

  async reorderCustomFields(boardId: string, fieldIds: string[]): Promise<boolean> {
    const { data } = await apolloClient.mutate({
      mutation: REORDER_CUSTOM_FIELDS,
      variables: { boardId, fieldIds },
    });
    return data.reorderCustomFields;
  }

  // Card Organization Methods
  async updateCardOrganization(cardId: string, input: UpdateCardOrganizationInput): Promise<CardOrganization> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_CARD_ORGANIZATION,
      variables: { cardId, input },
    });
    return data.updateCardOrganization;
  }

  async getCardOrganization(cardId: string): Promise<CardOrganization | null> {
    try {
      const { data } = await apolloClient.query({
        query: GET_CARD_ORGANIZATION,
        variables: { cardId },
        fetchPolicy: 'network-only',
      });
      return data.getCardOrganization;
    } catch (error) {
      // Return null if card organization doesn't exist
      return null;
    }
  }

  async getOrganizedCards(query: OrganizationQueryInput): Promise<CardOrganization[]> {
    const { data } = await apolloClient.query({
      query: GET_ORGANIZED_CARDS,
      variables: { query },
      fetchPolicy: 'network-only',
    });
    return data.getOrganizedCards;
  }

  // Board Settings Methods
  async getBoardOrganizationSettings(boardId: string): Promise<BoardOrganizationSettings> {
    const { data } = await apolloClient.query({
      query: GET_BOARD_ORGANIZATION_SETTINGS,
      variables: { boardId },
      fetchPolicy: 'network-only',
    });
    return data.getBoardOrganizationSettings;
  }

  async updateBoardOrganizationSettings(
    boardId: string, 
    settings: Partial<BoardOrganizationSettings>
  ): Promise<BoardOrganizationSettings> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_BOARD_ORGANIZATION_SETTINGS,
      variables: { boardId, input: settings },
    });
    return data.updateBoardOrganizationSettings;
  }

  async getBoardOrganizationSummary(boardId: string): Promise<any> {
    const { data } = await apolloClient.query({
      query: GET_BOARD_ORGANIZATION_SUMMARY,
      variables: { boardId },
      fetchPolicy: 'network-only',
    });
    return data.getBoardOrganizationSummary;
  }
}

export const organizationService = new OrganizationService();
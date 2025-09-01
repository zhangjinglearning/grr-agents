import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { organizationService } from '@/services/organization.service';
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

export const useOrganizationStore = defineStore('organization', () => {
  // State
  const labels = ref<Label[]>([]);
  const customFields = ref<CustomField[]>([]);
  const cardOrganizations = ref<Map<string, CardOrganization>>(new Map());
  const boardSettings = ref<BoardOrganizationSettings | null>(null);
  const organizationSummary = ref<any>(null);
  const loading = ref(false);

  // Computed
  const activeLabels = computed(() => 
    labels.value.filter(label => label.isActive)
  );

  const activeCustomFields = computed(() => 
    customFields.value.filter(field => field.isActive)
  );

  const labelsByColor = computed(() => {
    const grouped: Record<string, Label[]> = {};
    activeLabels.value.forEach(label => {
      if (!grouped[label.color]) {
        grouped[label.color] = [];
      }
      grouped[label.color].push(label);
    });
    return grouped;
  });

  const customFieldsByType = computed(() => {
    const grouped: Record<string, CustomField[]> = {};
    activeCustomFields.value.forEach(field => {
      if (!grouped[field.type]) {
        grouped[field.type] = [];
      }
      grouped[field.type].push(field);
    });
    return grouped;
  });

  // Label Actions
  async function createLabel(input: CreateLabelInput): Promise<Label> {
    try {
      loading.value = true;
      const label = await organizationService.createLabel(input);
      labels.value.push(label);
      return label;
    } catch (error) {
      console.error('Failed to create label:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function updateLabel(labelId: string, input: UpdateLabelInput): Promise<Label> {
    try {
      const updatedLabel = await organizationService.updateLabel(labelId, input);
      const index = labels.value.findIndex(label => label.id === labelId);
      if (index >= 0) {
        labels.value[index] = updatedLabel;
      }
      return updatedLabel;
    } catch (error) {
      console.error('Failed to update label:', error);
      throw error;
    }
  }

  async function deleteLabel(labelId: string): Promise<void> {
    try {
      await organizationService.deleteLabel(labelId);
      const index = labels.value.findIndex(label => label.id === labelId);
      if (index >= 0) {
        labels.value[index].isActive = false;
      }
    } catch (error) {
      console.error('Failed to delete label:', error);
      throw error;
    }
  }

  async function fetchBoardLabels(boardId: string): Promise<void> {
    try {
      loading.value = true;
      const boardLabels = await organizationService.getBoardLabels(boardId);
      labels.value = boardLabels;
    } catch (error) {
      console.error('Failed to fetch board labels:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // Custom Field Actions
  async function createCustomField(input: CreateCustomFieldInput): Promise<CustomField> {
    try {
      loading.value = true;
      const field = await organizationService.createCustomField(input);
      customFields.value.push(field);
      return field;
    } catch (error) {
      console.error('Failed to create custom field:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function updateCustomField(fieldId: string, input: UpdateCustomFieldInput): Promise<CustomField> {
    try {
      const updatedField = await organizationService.updateCustomField(fieldId, input);
      const index = customFields.value.findIndex(field => field.id === fieldId);
      if (index >= 0) {
        customFields.value[index] = updatedField;
      }
      return updatedField;
    } catch (error) {
      console.error('Failed to update custom field:', error);
      throw error;
    }
  }

  async function deleteCustomField(fieldId: string): Promise<void> {
    try {
      await organizationService.deleteCustomField(fieldId);
      const index = customFields.value.findIndex(field => field.id === fieldId);
      if (index >= 0) {
        customFields.value[index].isActive = false;
      }
    } catch (error) {
      console.error('Failed to delete custom field:', error);
      throw error;
    }
  }

  async function fetchBoardCustomFields(boardId: string): Promise<void> {
    try {
      loading.value = true;
      const fields = await organizationService.getBoardCustomFields(boardId);
      customFields.value = fields;
    } catch (error) {
      console.error('Failed to fetch board custom fields:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function reorderCustomFields(boardId: string, fieldIds: string[]): Promise<void> {
    try {
      await organizationService.reorderCustomFields(boardId, fieldIds);
      // Update local order
      customFields.value.sort((a, b) => {
        const aIndex = fieldIds.indexOf(a.id);
        const bIndex = fieldIds.indexOf(b.id);
        return aIndex - bIndex;
      });
    } catch (error) {
      console.error('Failed to reorder custom fields:', error);
      throw error;
    }
  }

  // Card Organization Actions
  async function updateCardOrganization(cardId: string, input: UpdateCardOrganizationInput): Promise<CardOrganization> {
    try {
      const cardOrg = await organizationService.updateCardOrganization(cardId, input);
      cardOrganizations.value.set(cardId, cardOrg);
      return cardOrg;
    } catch (error) {
      console.error('Failed to update card organization:', error);
      throw error;
    }
  }

  async function fetchCardOrganization(cardId: string): Promise<void> {
    try {
      const cardOrg = await organizationService.getCardOrganization(cardId);
      if (cardOrg) {
        cardOrganizations.value.set(cardId, cardOrg);
      }
    } catch (error) {
      console.error('Failed to fetch card organization:', error);
      throw error;
    }
  }

  async function getOrganizedCards(query: OrganizationQueryInput): Promise<CardOrganization[]> {
    try {
      return await organizationService.getOrganizedCards(query);
    } catch (error) {
      console.error('Failed to get organized cards:', error);
      throw error;
    }
  }

  // Board Settings Actions
  async function fetchBoardSettings(boardId: string): Promise<void> {
    try {
      const settings = await organizationService.getBoardOrganizationSettings(boardId);
      boardSettings.value = settings;
    } catch (error) {
      console.error('Failed to fetch board settings:', error);
      throw error;
    }
  }

  async function updateBoardSettings(boardId: string, settings: Partial<BoardOrganizationSettings>): Promise<void> {
    try {
      const updatedSettings = await organizationService.updateBoardOrganizationSettings(boardId, settings);
      boardSettings.value = updatedSettings;
    } catch (error) {
      console.error('Failed to update board settings:', error);
      throw error;
    }
  }

  async function fetchOrganizationSummary(boardId: string): Promise<void> {
    try {
      const summary = await organizationService.getBoardOrganizationSummary(boardId);
      organizationSummary.value = summary;
    } catch (error) {
      console.error('Failed to fetch organization summary:', error);
      throw error;
    }
  }

  // Utility Functions
  function getCardOrganization(cardId: string): CardOrganization | null {
    return cardOrganizations.value.get(cardId) || null;
  }

  function getLabelById(labelId: string): Label | null {
    return labels.value.find(label => label.id === labelId) || null;
  }

  function getCustomFieldById(fieldId: string): CustomField | null {
    return customFields.value.find(field => field.id === fieldId) || null;
  }

  function setCustomFields(fields: CustomField[]): void {
    customFields.value = fields;
  }

  function clearBoardData(): void {
    labels.value = [];
    customFields.value = [];
    cardOrganizations.value.clear();
    boardSettings.value = null;
    organizationSummary.value = null;
  }

  // Filtering and Search
  function getLabelsForCard(cardId: string): Label[] {
    const cardOrg = getCardOrganization(cardId);
    if (!cardOrg?.labelIds) return [];
    
    return cardOrg.labelIds
      .map(id => getLabelById(id))
      .filter(label => label !== null) as Label[];
  }

  function getCardsWithLabel(labelId: string): string[] {
    const cardIds: string[] = [];
    cardOrganizations.value.forEach((cardOrg, cardId) => {
      if (cardOrg.labelIds?.includes(labelId)) {
        cardIds.push(cardId);
      }
    });
    return cardIds;
  }

  function getCardsWithPriority(priority: string): string[] {
    const cardIds: string[] = [];
    cardOrganizations.value.forEach((cardOrg, cardId) => {
      if (cardOrg.priority === priority) {
        cardIds.push(cardId);
      }
    });
    return cardIds;
  }

  function searchCardsByTag(tag: string): string[] {
    const cardIds: string[] = [];
    cardOrganizations.value.forEach((cardOrg, cardId) => {
      if (cardOrg.tags?.some(t => t.toLowerCase().includes(tag.toLowerCase()))) {
        cardIds.push(cardId);
      }
    });
    return cardIds;
  }

  return {
    // State
    labels,
    customFields,
    cardOrganizations,
    boardSettings,
    organizationSummary,
    loading,

    // Computed
    activeLabels,
    activeCustomFields,
    labelsByColor,
    customFieldsByType,

    // Label Actions
    createLabel,
    updateLabel,
    deleteLabel,
    fetchBoardLabels,

    // Custom Field Actions
    createCustomField,
    updateCustomField,
    deleteCustomField,
    fetchBoardCustomFields,
    reorderCustomFields,

    // Card Organization Actions
    updateCardOrganization,
    fetchCardOrganization,
    getOrganizedCards,

    // Board Settings Actions
    fetchBoardSettings,
    updateBoardSettings,
    fetchOrganizationSummary,

    // Utility Functions
    getCardOrganization,
    getLabelById,
    getCustomFieldById,
    setCustomFields,
    clearBoardData,

    // Filtering and Search
    getLabelsForCard,
    getCardsWithLabel,
    getCardsWithPriority,
    searchCardsByTag,
  };
});
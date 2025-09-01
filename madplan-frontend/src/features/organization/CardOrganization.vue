<template>
  <div class="card-organization">
    <!-- Labels Section -->
    <div v-if="settings?.enableLabels" class="org-section">
      <div class="section-header">
        <label class="section-title">Labels</label>
        <button 
          @click="showLabelSelector = true" 
          class="btn btn-ghost btn-xs"
        >
          <i class="fas fa-plus"></i>
        </button>
      </div>
      
      <div class="labels-container">
        <div 
          v-for="label in selectedLabels" 
          :key="label.id"
          class="label-chip"
          :class="`label-${label.color}`"
        >
          <span>{{ label.name }}</span>
          <button 
            @click="removeLabel(label.id)" 
            class="label-remove"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div v-if="selectedLabels.length === 0" class="empty-state-inline">
          No labels selected
        </div>
      </div>
    </div>

    <!-- Priority Section -->
    <div v-if="settings?.enablePriorities" class="org-section">
      <div class="section-header">
        <label class="section-title">Priority</label>
      </div>
      
      <select 
        v-model="cardOrg.priority" 
        @change="updateOrganization"
        class="form-select priority-select"
      >
        <option value="">No priority</option>
        <option 
          v-for="priority in availablePriorities" 
          :key="priority"
          :value="priority"
        >
          {{ formatPriority(priority) }}
        </option>
      </select>
    </div>

    <!-- Custom Fields Section -->
    <div v-if="settings?.enableCustomFields && customFields.length > 0" class="org-section">
      <div class="section-header">
        <label class="section-title">Custom Fields</label>
      </div>
      
      <div class="custom-fields-container">
        <div 
          v-for="field in customFields" 
          :key="field.id"
          class="custom-field-item"
        >
          <label class="field-label">
            {{ field.name }}
            <span v-if="field.isRequired" class="required">*</span>
          </label>
          
          <div class="field-input">
            <!-- Text Field -->
            <input 
              v-if="field.type === 'text'"
              v-model="getFieldValue(field.id)"
              @input="updateFieldValue(field, $event.target.value)"
              type="text"
              :placeholder="field.placeholder"
              :required="field.isRequired"
              class="form-input"
            >
            
            <!-- Number Field -->
            <input 
              v-else-if="field.type === 'number'"
              v-model="getFieldValue(field.id)"
              @input="updateFieldValue(field, $event.target.value)"
              type="number"
              :required="field.isRequired"
              class="form-input"
            >
            
            <!-- Date Field -->
            <input 
              v-else-if="field.type === 'date'"
              v-model="getFieldValue(field.id)"
              @input="updateFieldValue(field, $event.target.value)"
              type="date"
              :required="field.isRequired"
              class="form-input"
            >
            
            <!-- Boolean Field -->
            <label v-else-if="field.type === 'boolean'" class="checkbox-field">
              <input 
                :checked="getFieldValue(field.id) === 'true'"
                @change="updateFieldValue(field, $event.target.checked ? 'true' : 'false')"
                type="checkbox"
              >
              <span class="checkmark"></span>
            </label>
            
            <!-- Select Field -->
            <select 
              v-else-if="field.type === 'select'"
              v-model="getFieldValue(field.id)"
              @change="updateFieldValue(field, $event.target.value)"
              :required="field.isRequired"
              class="form-select"
            >
              <option value="">Select option</option>
              <option 
                v-for="option in field.options" 
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            
            <!-- Multi Select Field -->
            <div v-else-if="field.type === 'multi_select'" class="multi-select">
              <div 
                v-for="option in field.options" 
                :key="option.value"
                class="multi-select-option"
              >
                <label class="checkbox-field">
                  <input 
                    :checked="isMultiValueSelected(field.id, option.value)"
                    @change="toggleMultiValue(field, option.value, $event.target.checked)"
                    type="checkbox"
                  >
                  <span class="checkmark"></span>
                  <span class="option-label" :class="`color-${option.color}`">
                    {{ option.label }}
                  </span>
                </label>
              </div>
            </div>
            
            <!-- URL Field -->
            <input 
              v-else-if="field.type === 'url'"
              v-model="getFieldValue(field.id)"
              @input="updateFieldValue(field, $event.target.value)"
              type="url"
              :required="field.isRequired"
              class="form-input"
            >
            
            <!-- Email Field -->
            <input 
              v-else-if="field.type === 'email'"
              v-model="getFieldValue(field.id)"
              @input="updateFieldValue(field, $event.target.value)"
              type="email"
              :required="field.isRequired"
              class="form-input"
            >
            
            <!-- Phone Field -->
            <input 
              v-else-if="field.type === 'phone'"
              v-model="getFieldValue(field.id)"
              @input="updateFieldValue(field, $event.target.value)"
              type="tel"
              :required="field.isRequired"
              class="form-input"
            >
          </div>
          
          <div v-if="field.description" class="field-description">
            {{ field.description }}
          </div>
        </div>
      </div>
    </div>

    <!-- Tags Section -->
    <div v-if="settings?.enableTags" class="org-section">
      <div class="section-header">
        <label class="section-title">Tags</label>
      </div>
      
      <div class="tags-input">
        <div class="tags-container">
          <span 
            v-for="(tag, index) in cardOrg.tags" 
            :key="index"
            class="tag-chip"
          >
            {{ tag }}
            <button 
              @click="removeTag(index)" 
              class="tag-remove"
            >
              <i class="fas fa-times"></i>
            </button>
          </span>
        </div>
        
        <input 
          v-model="newTag"
          @keydown.enter="addTag"
          @keydown.comma.prevent="addTag"
          type="text"
          placeholder="Add tag and press Enter"
          class="form-input tag-input"
        >
      </div>
    </div>

    <!-- Estimation Section -->
    <div v-if="settings?.enableEstimation" class="org-section">
      <div class="section-header">
        <label class="section-title">Estimation</label>
      </div>
      
      <div class="estimation-fields">
        <div class="form-group">
          <label>Story Points</label>
          <input 
            v-model.number="cardOrg.storyPoints"
            @input="updateOrganization"
            type="number"
            min="0"
            step="0.5"
            class="form-input"
          >
        </div>
        
        <div class="form-group">
          <label>Estimated Hours</label>
          <input 
            v-model.number="cardOrg.estimatedHours"
            @input="updateOrganization"
            type="number"
            min="0"
            step="0.25"
            class="form-input"
          >
        </div>
        
        <div class="form-group">
          <label>Actual Hours</label>
          <input 
            v-model.number="cardOrg.actualHours"
            @input="updateOrganization"
            type="number"
            min="0"
            step="0.25"
            class="form-input"
          >
        </div>
      </div>
    </div>

    <!-- Label Selector Modal -->
    <div v-if="showLabelSelector" class="modal-overlay" @click="showLabelSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>Select Labels</h4>
          <button @click="showLabelSelector = false" class="btn btn-ghost">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="labels-grid">
            <div 
              v-for="label in availableLabels" 
              :key="label.id"
              class="label-option"
              :class="[`label-${label.color}`, { selected: isLabelSelected(label.id) }]"
              @click="toggleLabel(label.id)"
            >
              <span>{{ label.name }}</span>
              <i v-if="isLabelSelected(label.id)" class="fas fa-check"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useOrganizationStore } from '@/stores/organization';
import { useToast } from '@/composables/useToast';
import { debounce } from 'lodash-es';
import type { 
  CardOrganization, 
  Label, 
  CustomField, 
  BoardOrganizationSettings, 
  Priority,
  CustomFieldValue 
} from '@/types/organization';

interface Props {
  cardId: string;
  boardId: string;
}

const props = defineProps<Props>();
const organizationStore = useOrganizationStore();
const toast = useToast();

const showLabelSelector = ref(false);
const newTag = ref('');

const settings = computed(() => organizationStore.boardSettings);
const availableLabels = computed(() => organizationStore.labels);
const customFields = computed(() => organizationStore.customFields);
const cardOrg = computed(() => organizationStore.getCardOrganization(props.cardId) || {
  cardId: props.cardId,
  boardId: props.boardId,
  labelIds: [],
  priority: null,
  customFieldValues: [],
  tags: [],
  estimatedHours: null,
  actualHours: null,
  storyPoints: null,
});

const selectedLabels = computed(() => {
  return availableLabels.value.filter(label => 
    cardOrg.value.labelIds?.includes(label.id)
  );
});

const availablePriorities = computed(() => {
  return settings.value?.availablePriorities || ['lowest', 'low', 'medium', 'high', 'highest', 'critical'];
});

onMounted(async () => {
  await Promise.all([
    organizationStore.fetchBoardSettings(props.boardId),
    organizationStore.fetchBoardLabels(props.boardId),
    organizationStore.fetchBoardCustomFields(props.boardId),
    organizationStore.fetchCardOrganization(props.cardId),
  ]);
});

// Debounced update function
const updateOrganization = debounce(async () => {
  try {
    await organizationStore.updateCardOrganization(props.cardId, {
      labelIds: cardOrg.value.labelIds,
      priority: cardOrg.value.priority || undefined,
      customFieldValues: cardOrg.value.customFieldValues,
      tags: cardOrg.value.tags,
      estimatedHours: cardOrg.value.estimatedHours || undefined,
      actualHours: cardOrg.value.actualHours || undefined,
      storyPoints: cardOrg.value.storyPoints || undefined,
    });
  } catch (error) {
    toast.error('Failed to update card organization');
  }
}, 500);

function formatPriority(priority: Priority): string {
  const priorities = {
    lowest: 'Lowest',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    highest: 'Highest',
    critical: 'Critical',
  };
  return priorities[priority] || priority;
}

function isLabelSelected(labelId: string): boolean {
  return cardOrg.value.labelIds?.includes(labelId) || false;
}

function toggleLabel(labelId: string) {
  const currentLabels = cardOrg.value.labelIds || [];
  const maxLabels = settings.value?.maxLabelsPerCard || 10;
  
  if (isLabelSelected(labelId)) {
    cardOrg.value.labelIds = currentLabels.filter(id => id !== labelId);
  } else {
    if (currentLabels.length >= maxLabels) {
      toast.warning(`Maximum ${maxLabels} labels allowed per card`);
      return;
    }
    cardOrg.value.labelIds = [...currentLabels, labelId];
  }
  
  updateOrganization();
}

function removeLabel(labelId: string) {
  cardOrg.value.labelIds = cardOrg.value.labelIds?.filter(id => id !== labelId) || [];
  updateOrganization();
}

function getFieldValue(fieldId: string): string {
  const fieldValue = cardOrg.value.customFieldValues?.find(v => v.fieldId === fieldId);
  return fieldValue?.value || '';
}

function updateFieldValue(field: CustomField, value: string) {
  const currentValues = cardOrg.value.customFieldValues || [];
  const existingIndex = currentValues.findIndex(v => v.fieldId === field.id);
  
  const fieldValue: CustomFieldValue = {
    fieldId: field.id,
    fieldName: field.name,
    fieldType: field.type,
    value,
    updatedAt: new Date(),
  };
  
  if (existingIndex >= 0) {
    currentValues[existingIndex] = fieldValue;
  } else {
    currentValues.push(fieldValue);
  }
  
  cardOrg.value.customFieldValues = currentValues;
  updateOrganization();
}

function isMultiValueSelected(fieldId: string, value: string): boolean {
  const fieldValue = cardOrg.value.customFieldValues?.find(v => v.fieldId === fieldId);
  return fieldValue?.multiValue?.includes(value) || false;
}

function toggleMultiValue(field: CustomField, value: string, checked: boolean) {
  const currentValues = cardOrg.value.customFieldValues || [];
  const existingIndex = currentValues.findIndex(v => v.fieldId === field.id);
  
  let multiValue: string[] = [];
  
  if (existingIndex >= 0) {
    multiValue = currentValues[existingIndex].multiValue || [];
  }
  
  if (checked) {
    if (!multiValue.includes(value)) {
      multiValue.push(value);
    }
  } else {
    multiValue = multiValue.filter(v => v !== value);
  }
  
  const fieldValue: CustomFieldValue = {
    fieldId: field.id,
    fieldName: field.name,
    fieldType: field.type,
    multiValue,
    updatedAt: new Date(),
  };
  
  if (existingIndex >= 0) {
    currentValues[existingIndex] = fieldValue;
  } else {
    currentValues.push(fieldValue);
  }
  
  cardOrg.value.customFieldValues = currentValues;
  updateOrganization();
}

function addTag() {
  const tag = newTag.value.trim().replace(/,$/, '');
  if (tag && !cardOrg.value.tags?.includes(tag)) {
    cardOrg.value.tags = [...(cardOrg.value.tags || []), tag];
    newTag.value = '';
    updateOrganization();
  }
}

function removeTag(index: number) {
  cardOrg.value.tags = cardOrg.value.tags?.filter((_, i) => i !== index) || [];
  updateOrganization();
}
</script>

<style scoped>
.card-organization {
  padding: 1rem;
  max-height: 60vh;
  overflow-y: auto;
}

.org-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-light);
}

.org-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.labels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 32px;
  align-items: flex-start;
}

.label-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
}

.label-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.label-remove:hover {
  opacity: 1;
}

.priority-select {
  width: 100%;
}

.custom-fields-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.custom-field-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.required {
  color: var(--red-500);
}

.field-input {
  width: 100%;
}

.field-description {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-field input[type="checkbox"] {
  margin: 0;
}

.multi-select {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.multi-select-option {
  display: flex;
  align-items: center;
}

.option-label {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.tags-input {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem;
  min-height: 40px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--primary-100);
  color: var(--primary-700);
  border-radius: 12px;
  font-size: 0.75rem;
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.tag-input {
  border: none;
  outline: none;
  width: 100%;
  padding: 0;
  font-size: 0.875rem;
}

.estimation-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.labels-grid {
  display: grid;
  gap: 0.5rem;
}

.label-option {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  color: white;
}

.label-option:hover {
  opacity: 0.8;
}

.label-option.selected {
  border-color: rgba(255, 255, 255, 0.5);
}

.empty-state-inline {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-style: italic;
  padding: 0.5rem 0;
}

/* Label Colors - same as LabelManager */
.label-red, .color-red { background-color: #ef4444; }
.label-orange, .color-orange { background-color: #f97316; }
.label-yellow, .color-yellow { background-color: #eab308; color: black; }
.label-green, .color-green { background-color: #22c55e; }
.label-blue, .color-blue { background-color: #3b82f6; }
.label-purple, .color-purple { background-color: #8b5cf6; }
.label-pink, .color-pink { background-color: #ec4899; }
.label-gray, .color-gray { background-color: #6b7280; }
.label-brown, .color-brown { background-color: #a16207; }
.label-teal, .color-teal { background-color: #14b8a6; }

/* Form elements */
.form-input, .form-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.875rem;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 2px var(--primary-100);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.modal-body {
  padding: 1rem;
}

.btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-muted);
  transition: color 0.2s;
}

.btn:hover {
  color: var(--text-primary);
}

.btn-ghost {
  color: var(--text-muted);
}

.btn-xs {
  font-size: 0.75rem;
}
</style>
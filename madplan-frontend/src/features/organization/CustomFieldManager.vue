<template>
  <div class="custom-field-manager">
    <div class="manager-header">
      <h3>Custom Fields</h3>
      <button @click="showCreateForm = true" class="btn btn-primary btn-sm">
        <i class="fas fa-plus"></i>
        Add Field
      </button>
    </div>

    <!-- Fields List -->
    <div class="fields-list">
      <div v-if="customFields.length === 0" class="empty-state">
        <i class="fas fa-list-alt text-muted"></i>
        <p>No custom fields created yet</p>
      </div>

      <draggable
        v-else
        v-model="customFields"
        item-key="id"
        handle=".drag-handle"
        @end="handleReorder"
      >
        <template #item="{ element: field }">
          <div class="field-item">
            <div class="field-content">
              <div class="drag-handle">
                <i class="fas fa-grip-vertical"></i>
              </div>
              
              <div class="field-info">
                <div class="field-header">
                  <span class="field-name">{{ field.name }}</span>
                  <span class="field-type" :class="`type-${field.type}`">
                    {{ formatFieldType(field.type) }}
                  </span>
                  <span v-if="field.isRequired" class="required-badge">Required</span>
                </div>
                
                <p v-if="field.description" class="field-description">{{ field.description }}</p>
                
                <div class="field-meta">
                  <span>Position: {{ field.position + 1 }}</span>
                  <span v-if="field.options">{{ field.options.length }} options</span>
                </div>
              </div>

              <div class="field-actions">
                <button @click="editField(field)" class="btn btn-ghost btn-xs">
                  <i class="fas fa-edit"></i>
                </button>
                <button @click="deleteField(field.id)" class="btn btn-ghost btn-xs text-danger">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </template>
      </draggable>
    </div>

    <!-- Create/Edit Form Modal -->
    <div v-if="showCreateForm || editingField" class="modal-overlay" @click="closeForm">
      <div class="modal-content large" @click.stop>
        <div class="modal-header">
          <h4>{{ editingField ? 'Edit Custom Field' : 'Create Custom Field' }}</h4>
          <button @click="closeForm" class="btn btn-ghost">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="submitForm">
            <div class="form-row">
              <div class="form-group">
                <label>Name *</label>
                <input 
                  v-model="form.name" 
                  type="text" 
                  placeholder="Enter field name"
                  class="form-input"
                  required
                >
              </div>

              <div class="form-group">
                <label>Type *</label>
                <select v-model="form.type" class="form-select" required>
                  <option value="">Select field type</option>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                  <option value="select">Single Select</option>
                  <option value="multi_select">Multi Select</option>
                  <option value="user">User</option>
                  <option value="url">URL</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea 
                v-model="form.description" 
                placeholder="Optional description"
                class="form-textarea"
                rows="2"
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="form.isRequired">
                  Required field
                </label>
              </div>
            </div>

            <div v-if="form.type === 'text'" class="form-group">
              <label>Placeholder</label>
              <input 
                v-model="form.placeholder" 
                type="text" 
                placeholder="Enter placeholder text"
                class="form-input"
              >
            </div>

            <div v-if="needsDefaultValue" class="form-group">
              <label>Default Value</label>
              <input 
                v-if="form.type !== 'boolean'"
                v-model="form.defaultValue" 
                :type="getInputType(form.type)"
                placeholder="Enter default value"
                class="form-input"
              >
              <select v-else v-model="form.defaultValue" class="form-select">
                <option value="">No default</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>

            <!-- Options for Select Fields -->
            <div v-if="form.type === 'select' || form.type === 'multi_select'" class="form-group">
              <label>Options *</label>
              <div class="options-container">
                <div 
                  v-for="(option, index) in form.options" 
                  :key="index"
                  class="option-item"
                >
                  <input 
                    v-model="option.label" 
                    type="text" 
                    placeholder="Option label"
                    class="form-input"
                    required
                  >
                  <input 
                    v-model="option.value" 
                    type="text" 
                    placeholder="Option value"
                    class="form-input"
                    required
                  >
                  <div class="color-picker-mini">
                    <div 
                      v-for="color in availableColors" 
                      :key="color"
                      class="color-option-mini"
                      :class="[`color-${color}`, { active: option.color === color }]"
                      @click="option.color = color"
                    ></div>
                  </div>
                  <button 
                    @click="removeOption(index)" 
                    type="button"
                    class="btn btn-ghost btn-xs text-danger"
                  >
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
                
                <button 
                  @click="addOption" 
                  type="button"
                  class="btn btn-secondary btn-sm"
                >
                  <i class="fas fa-plus"></i>
                  Add Option
                </button>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button @click="closeForm" class="btn btn-secondary">Cancel</button>
          <button 
            @click="submitForm" 
            class="btn btn-primary"
            :disabled="!isFormValid || loading"
          >
            {{ loading ? 'Saving...' : (editingField ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useOrganizationStore } from '@/stores/organization';
import { useToast } from '@/composables/useToast';
import draggable from 'vuedraggable';
import type { CustomField, CustomFieldType, LabelColor } from '@/types/organization';

const route = useRoute();
const organizationStore = useOrganizationStore();
const toast = useToast();

const boardId = computed(() => route.params.id as string);
const loading = ref(false);
const showCreateForm = ref(false);
const editingField = ref<CustomField | null>(null);

const customFields = computed({
  get: () => organizationStore.customFields,
  set: (value) => organizationStore.setCustomFields(value),
});

const form = ref({
  name: '',
  type: '' as CustomFieldType,
  description: '',
  isRequired: false,
  placeholder: '',
  defaultValue: '',
  options: [] as Array<{
    label: string;
    value: string;
    color: LabelColor;
    position: number;
  }>,
});

const availableColors: LabelColor[] = [
  'blue', 'green', 'yellow', 'orange', 'red', 
  'purple', 'pink', 'gray', 'brown', 'teal'
];

const needsDefaultValue = computed(() => {
  return ['text', 'number', 'boolean', 'select'].includes(form.value.type);
});

const isFormValid = computed(() => {
  if (!form.value.name || !form.value.type) return false;
  
  if ((form.value.type === 'select' || form.value.type === 'multi_select')) {
    return form.value.options.length > 0 && 
           form.value.options.every(opt => opt.label && opt.value);
  }
  
  return true;
});

onMounted(async () => {
  await organizationStore.fetchBoardCustomFields(boardId.value);
});

function formatFieldType(type: CustomFieldType): string {
  const types = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    boolean: 'Boolean',
    select: 'Select',
    multi_select: 'Multi Select',
    user: 'User',
    url: 'URL',
    email: 'Email',
    phone: 'Phone',
  };
  return types[type] || type;
}

function getInputType(fieldType: CustomFieldType): string {
  const inputTypes = {
    text: 'text',
    number: 'number',
    date: 'date',
    url: 'url',
    email: 'email',
    phone: 'tel',
  };
  return inputTypes[fieldType] || 'text';
}

function editField(field: CustomField) {
  editingField.value = field;
  form.value = {
    name: field.name,
    type: field.type,
    description: field.description || '',
    isRequired: field.isRequired,
    placeholder: field.placeholder || '',
    defaultValue: field.defaultValue || '',
    options: field.options ? [...field.options] : [],
  };
}

function closeForm() {
  showCreateForm.value = false;
  editingField.value = null;
  resetForm();
}

function resetForm() {
  form.value = {
    name: '',
    type: '' as CustomFieldType,
    description: '',
    isRequired: false,
    placeholder: '',
    defaultValue: '',
    options: [],
  };
}

function addOption() {
  form.value.options.push({
    label: '',
    value: '',
    color: 'blue',
    position: form.value.options.length,
  });
}

function removeOption(index: number) {
  form.value.options.splice(index, 1);
  // Update positions
  form.value.options.forEach((option, i) => {
    option.position = i;
  });
}

async function submitForm() {
  if (!isFormValid.value) return;

  try {
    loading.value = true;

    const fieldData = {
      name: form.value.name,
      type: form.value.type,
      boardId: boardId.value,
      description: form.value.description || undefined,
      isRequired: form.value.isRequired,
      placeholder: form.value.placeholder || undefined,
      defaultValue: form.value.defaultValue || undefined,
      options: form.value.options.length > 0 ? form.value.options : undefined,
    };

    if (editingField.value) {
      await organizationStore.updateCustomField(editingField.value.id, fieldData);
      toast.success('Custom field updated successfully');
    } else {
      await organizationStore.createCustomField(fieldData);
      toast.success('Custom field created successfully');
    }

    closeForm();
  } catch (error) {
    toast.error('Failed to save custom field');
  } finally {
    loading.value = false;
  }
}

async function deleteField(fieldId: string) {
  if (confirm('Are you sure you want to delete this custom field? All data will be lost.')) {
    try {
      await organizationStore.deleteCustomField(fieldId);
      toast.success('Custom field deleted successfully');
    } catch (error) {
      toast.error('Failed to delete custom field');
    }
  }
}

async function handleReorder() {
  try {
    const fieldIds = customFields.value.map(field => field.id);
    await organizationStore.reorderCustomFields(boardId.value, fieldIds);
  } catch (error) {
    toast.error('Failed to reorder fields');
    await organizationStore.fetchBoardCustomFields(boardId.value);
  }
}
</script>

<style scoped>
.custom-field-manager {
  padding: 1rem;
}

.manager-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.manager-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.fields-list {
  min-height: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}

.field-item {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  transition: all 0.2s;
}

.field-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.field-content {
  display: flex;
  align-items: flex-start;
  padding: 1rem;
  gap: 0.75rem;
}

.drag-handle {
  color: var(--text-muted);
  cursor: grab;
  padding: 0.25rem;
}

.drag-handle:active {
  cursor: grabbing;
}

.field-info {
  flex: 1;
}

.field-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.field-name {
  font-weight: 600;
  font-size: 1rem;
}

.field-type {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.type-text { background: var(--blue-100); color: var(--blue-700); }
.type-number { background: var(--green-100); color: var(--green-700); }
.type-date { background: var(--purple-100); color: var(--purple-700); }
.type-boolean { background: var(--orange-100); color: var(--orange-700); }
.type-select { background: var(--pink-100); color: var(--pink-700); }
.type-multi_select { background: var(--pink-100); color: var(--pink-700); }
.type-user { background: var(--teal-100); color: var(--teal-700); }
.type-url { background: var(--indigo-100); color: var(--indigo-700); }
.type-email { background: var(--cyan-100); color: var(--cyan-700); }
.type-phone { background: var(--gray-100); color: var(--gray-700); }

.required-badge {
  padding: 0.25rem 0.5rem;
  background: var(--red-100);
  color: var(--red-700);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.field-description {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin: 0.5rem 0;
}

.field-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.field-actions {
  display: flex;
  gap: 0.25rem;
}

.modal-content.large {
  max-width: 700px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.options-container {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 1rem;
}

.option-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.color-picker-mini {
  display: flex;
  gap: 0.25rem;
}

.color-option-mini {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.color-option-mini.active {
  border-color: var(--text-primary);
  transform: scale(1.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
}

/* All previous styles from LabelManager.vue apply here too */
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
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-700);
}

.btn-secondary {
  background: var(--gray-200);
  color: var(--gray-700);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover {
  background: var(--gray-100);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-xs {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-danger {
  color: var(--red-600);
}

.text-muted {
  color: var(--text-muted);
}

/* Label Colors for options */
.color-red { background-color: #ef4444; }
.color-orange { background-color: #f97316; }
.color-yellow { background-color: #eab308; }
.color-green { background-color: #22c55e; }
.color-blue { background-color: #3b82f6; }
.color-purple { background-color: #8b5cf6; }
.color-pink { background-color: #ec4899; }
.color-gray { background-color: #6b7280; }
.color-brown { background-color: #a16207; }
.color-teal { background-color: #14b8a6; }
</style>
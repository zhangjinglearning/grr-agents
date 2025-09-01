<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    @click.self="$emit('close')"
  >
    <div class="modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <h2 class="modal-title">
          <span class="icon">{{ isEditing ? '✏️' : '➕' }}</span>
          {{ isEditing ? 'Edit Template' : 'Create New Template' }}
        </h2>
        <button @click="$emit('close')" class="close-button">
          <span class="icon">✕</span>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="modal-content">
        <form @submit.prevent="handleSubmit" class="template-form">
          <!-- Basic Information -->
          <div class="form-section">
            <h3 class="section-title">Basic Information</h3>
            
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="template-name" class="form-label">Template Name *</label>
                <input
                  id="template-name"
                  v-model="formData.name"
                  type="text"
                  required
                  placeholder="Enter template name..."
                  class="form-input"
                  :class="{ 'error': errors.name }"
                >
                <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
              </div>
              
              <div class="form-group">
                <label for="template-category" class="form-label">Category</label>
                <select
                  id="template-category"
                  v-model="formData.category"
                  class="form-select"
                >
                  <option v-for="category in categoryOptions" :key="category.value" :value="category.value">
                    {{ category.icon }} {{ category.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="template-description" class="form-label">Description *</label>
              <textarea
                id="template-description"
                v-model="formData.description"
                required
                placeholder="Describe when and how to use this template..."
                rows="3"
                class="form-textarea"
                :class="{ 'error': errors.description }"
              ></textarea>
              <span v-if="errors.description" class="error-message">{{ errors.description }}</span>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="formData.isPublic"
                  type="checkbox"
                  class="form-checkbox"
                >
                <span class="checkbox-text">
                  <span class="icon">🌐</span>
                  Make this template public (other users can see and use it)
                </span>
              </label>
            </div>
          </div>

          <!-- Card Content -->
          <div class="form-section">
            <h3 class="section-title">Card Content</h3>
            
            <div class="form-group">
              <label for="content-title" class="form-label">Default Title *</label>
              <input
                id="content-title"
                v-model="formData.content.title"
                type="text"
                required
                placeholder="Default card title template..."
                class="form-input"
                :class="{ 'error': errors.contentTitle }"
              >
              <span v-if="errors.contentTitle" class="error-message">{{ errors.contentTitle }}</span>
            </div>

            <div class="form-group">
              <label for="content-description" class="form-label">
                Default Description *
                <span class="label-hint">(supports Markdown)</span>
              </label>
              <textarea
                id="content-description"
                v-model="formData.content.description"
                required
                placeholder="Default card description template..."
                rows="6"
                class="form-textarea font-mono"
                :class="{ 'error': errors.contentDescription }"
              ></textarea>
              <span v-if="errors.contentDescription" class="error-message">{{ errors.contentDescription }}</span>
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="content-priority" class="form-label">Default Priority</label>
                <select
                  id="content-priority"
                  v-model="formData.content.priority"
                  class="form-select"
                >
                  <option v-for="priority in priorityOptions" :key="priority.value" :value="priority.value">
                    {{ priority.icon }} {{ priority.label }}
                  </option>
                </select>
              </div>
              
              <div class="form-group flex-1">
                <label for="content-labels" class="form-label">
                  Default Labels
                  <span class="label-hint">(comma-separated)</span>
                </label>
                <input
                  id="content-labels"
                  v-model="labelsInput"
                  type="text"
                  placeholder="bug, high-priority, frontend"
                  class="form-input"
                >
              </div>
            </div>
          </div>

          <!-- Advanced Options -->
          <div class="form-section">
            <h3 class="section-title">Advanced Options</h3>
            
            <div class="form-group">
              <label for="checklist-items" class="form-label">
                Default Checklist Items
                <span class="label-hint">(one per line)</span>
              </label>
              <textarea
                id="checklist-items"
                v-model="checklistItemsInput"
                placeholder="Define requirements&#10;Implement solution&#10;Test thoroughly&#10;Update documentation"
                rows="4"
                class="form-textarea"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="attachment-types" class="form-label">
                Expected Attachment Types
                <span class="label-hint">(comma-separated)</span>
              </label>
              <input
                id="attachment-types"
                v-model="attachmentTypesInput"
                type="text"
                placeholder="screenshots, documents, mockups"
                class="form-input"
              >
            </div>

            <div class="form-group">
              <label for="custom-fields" class="form-label">
                Custom Fields (JSON)
                <span class="label-hint">(optional structured data)</span>
              </label>
              <textarea
                id="custom-fields"
                v-model="customFieldsInput"
                placeholder='{"Assignee": "", "Story Points": "", "Epic": ""}'
                rows="3"
                class="form-textarea font-mono"
                :class="{ 'error': errors.customFields }"
              ></textarea>
              <span v-if="errors.customFields" class="error-message">{{ errors.customFields }}</span>
            </div>
          </div>

          <!-- Preview Section -->
          <div class="form-section preview-section">
            <h3 class="section-title">Preview</h3>
            <div class="template-preview">
              <div class="preview-header">
                <span class="preview-category">{{ categoryOptions.find(c => c.value === formData.category)?.icon }} {{ categoryOptions.find(c => c.value === formData.category)?.label }}</span>
                <span class="preview-priority">{{ priorityOptions.find(p => p.value === formData.content.priority)?.icon }} {{ priorityOptions.find(p => p.value === formData.content.priority)?.label }}</span>
              </div>
              <div class="preview-title">{{ formData.content.title || 'Template Title' }}</div>
              <div class="preview-description">{{ formData.content.description || 'Template description will appear here...' }}</div>
              <div v-if="parsedLabels.length > 0" class="preview-labels">
                <span v-for="label in parsedLabels" :key="label" class="preview-label">{{ label }}</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button
          @click="$emit('close')"
          type="button"
          class="btn btn-secondary"
          :disabled="isSubmitting"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          type="submit"
          class="btn btn-primary"
          :disabled="!isFormValid || isSubmitting"
        >
          <LoadingSpinner v-if="isSubmitting" size="small" />
          <span v-else class="icon">{{ isEditing ? '💾' : '➕' }}</span>
          {{ isSubmitting ? 'Saving...' : (isEditing ? 'Update Template' : 'Create Template') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTemplateStore } from '../../stores/template'
import { TemplateCategory, Priority, type CardTemplate, type CreateTemplateInput } from '../../services/template.service'
import LoadingSpinner from '../../components/feedback/LoadingSpinner.vue'

interface Props {
  template?: CardTemplate | null
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [templateData: CreateTemplateInput]
}>()

const templateStore = useTemplateStore()

// Reactive state
const isSubmitting = ref(false)
const errors = ref<Record<string, string>>({})

const formData = ref<CreateTemplateInput>({
  name: '',
  description: '',
  category: TemplateCategory.TASK,
  isPublic: false,
  content: {
    title: '',
    description: '',
    labels: [],
    priority: Priority.MEDIUM,
    customFields: '{}',
    checklistItems: [],
    attachmentTypes: []
  }
})

// Helper inputs for arrays and objects
const labelsInput = ref('')
const checklistItemsInput = ref('')
const attachmentTypesInput = ref('')
const customFieldsInput = ref('{}')

// Computed properties
const isEditing = computed(() => !!props.template)

const categoryOptions = computed(() => [
  { value: TemplateCategory.TASK, label: 'Task', icon: '✅' },
  { value: TemplateCategory.BUG, label: 'Bug Report', icon: '🐛' },
  { value: TemplateCategory.MEETING, label: 'Meeting', icon: '👥' },
  { value: TemplateCategory.FEATURE, label: 'Feature', icon: '⭐' },
  { value: TemplateCategory.RESEARCH, label: 'Research', icon: '🔬' },
  { value: TemplateCategory.CUSTOM, label: 'Custom', icon: '🔧' }
])

const priorityOptions = computed(() => [
  { value: Priority.LOW, label: 'Low', icon: '🟢' },
  { value: Priority.MEDIUM, label: 'Medium', icon: '🟡' },
  { value: Priority.HIGH, label: 'High', icon: '🟠' },
  { value: Priority.CRITICAL, label: 'Critical', icon: '🔴' }
])

const parsedLabels = computed(() => {
  return labelsInput.value
    .split(',')
    .map(label => label.trim())
    .filter(label => label.length > 0)
})

const isFormValid = computed(() => {
  return formData.value.name.trim().length > 0 &&
         formData.value.description.trim().length > 0 &&
         formData.value.content.title.trim().length > 0 &&
         formData.value.content.description.trim().length > 0 &&
         Object.keys(errors.value).length === 0
})

// Methods
const validateForm = () => {
  errors.value = {}

  // Validate basic fields
  if (!formData.value.name.trim()) {
    errors.value.name = 'Template name is required'
  }
  
  if (!formData.value.description.trim()) {
    errors.value.description = 'Description is required'
  }
  
  if (!formData.value.content.title.trim()) {
    errors.value.contentTitle = 'Default title is required'
  }
  
  if (!formData.value.content.description.trim()) {
    errors.value.contentDescription = 'Default description is required'
  }

  // Validate JSON fields
  if (customFieldsInput.value.trim()) {
    try {
      JSON.parse(customFieldsInput.value)
    } catch (e) {
      errors.value.customFields = 'Invalid JSON format'
    }
  }
  
  return Object.keys(errors.value).length === 0
}

const syncArrayFields = () => {
  // Parse labels
  formData.value.content.labels = parsedLabels.value

  // Parse checklist items
  formData.value.content.checklistItems = checklistItemsInput.value
    .split('\n')
    .map(item => item.trim())
    .filter(item => item.length > 0)

  // Parse attachment types
  formData.value.content.attachmentTypes = attachmentTypesInput.value
    .split(',')
    .map(type => type.trim())
    .filter(type => type.length > 0)

  // Set custom fields
  formData.value.content.customFields = customFieldsInput.value.trim() || '{}'
}

const handleSubmit = async () => {
  if (!validateForm()) return

  try {
    isSubmitting.value = true
    syncArrayFields()
    
    emit('save', { ...formData.value })
  } catch (error) {
    console.error('Error submitting form:', error)
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    category: TemplateCategory.TASK,
    isPublic: false,
    content: {
      title: '',
      description: '',
      labels: [],
      priority: Priority.MEDIUM,
      customFields: '{}',
      checklistItems: [],
      attachmentTypes: []
    }
  }
  
  labelsInput.value = ''
  checklistItemsInput.value = ''
  attachmentTypesInput.value = ''
  customFieldsInput.value = '{}'
  errors.value = {}
}

const populateForm = () => {
  if (props.template) {
    formData.value = {
      name: props.template.name,
      description: props.template.description,
      category: props.template.category,
      isPublic: props.template.isPublic,
      content: { ...props.template.content }
    }
    
    // Populate helper inputs
    labelsInput.value = props.template.content.labels.join(', ')
    checklistItemsInput.value = props.template.content.checklistItems.join('\n')
    attachmentTypesInput.value = props.template.content.attachmentTypes.join(', ')
    customFieldsInput.value = props.template.content.customFields || '{}'
  } else {
    resetForm()
  }
}

// Watchers
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    populateForm()
  }
})

watch(() => props.template, () => {
  if (props.isOpen) {
    populateForm()
  }
})

// Lifecycle
onMounted(() => {
  if (props.isOpen) {
    populateForm()
  }
})
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
}

.modal-container {
  @apply bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] 
         flex flex-col overflow-hidden;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.modal-title {
  @apply text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2;
}

.close-button {
  @apply p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg 
         text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors;
}

.modal-content {
  @apply flex-1 overflow-auto p-6;
}

.template-form {
  @apply space-y-8;
}

.form-section {
  @apply space-y-4;
}

.section-title {
  @apply text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2;
}

.form-row {
  @apply flex gap-4;
}

.form-group {
  @apply space-y-2;
}

.form-group.flex-1 {
  @apply flex-1;
}

.form-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.label-hint {
  @apply text-xs text-gray-500 dark:text-gray-400 font-normal;
}

.form-input,
.form-textarea,
.form-select {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
         focus:ring-2 focus:ring-blue-500 focus:border-transparent
         placeholder-gray-500 dark:placeholder-gray-400;
}

.form-input.error,
.form-textarea.error {
  @apply border-red-500 focus:ring-red-500;
}

.form-textarea {
  @apply resize-vertical min-h-[80px];
}

.form-checkbox {
  @apply w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded
         focus:ring-blue-500 dark:focus:ring-blue-600;
}

.checkbox-label {
  @apply flex items-center gap-3 cursor-pointer;
}

.checkbox-text {
  @apply text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2;
}

.error-message {
  @apply text-sm text-red-600 dark:text-red-400;
}

.preview-section {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4;
}

.template-preview {
  @apply bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700;
}

.preview-header {
  @apply flex items-center justify-between mb-3 text-sm;
}

.preview-category {
  @apply bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full;
}

.preview-priority {
  @apply bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full;
}

.preview-title {
  @apply font-semibold text-gray-900 dark:text-white mb-2;
}

.preview-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mb-3 whitespace-pre-wrap;
}

.preview-labels {
  @apply flex flex-wrap gap-1;
}

.preview-label {
  @apply text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 
         px-2 py-1 rounded-full;
}

.modal-footer {
  @apply flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700;
}

.btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 
         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white shadow-sm;
}

.btn-secondary {
  @apply bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 
         text-gray-900 dark:text-white;
}

.icon {
  @apply inline-block;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .modal-container {
    @apply max-w-full mx-2;
  }
  
  .form-row {
    @apply flex-col;
  }
  
  .modal-footer {
    @apply flex-col-reverse gap-2;
  }
  
  .modal-footer .btn {
    @apply w-full justify-center;
  }
}
</style>
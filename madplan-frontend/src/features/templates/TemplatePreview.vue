<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    @click.self="$emit('close')"
  >
    <div class="modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-content">
          <h2 class="modal-title">
            <span class="template-category-icon">{{ categoryIcon }}</span>
            {{ template.name }}
          </h2>
          <div class="template-meta">
            <span class="category-badge">{{ categoryLabel }}</span>
            <span v-if="template.isPublic" class="public-badge">
              <span class="icon">🌐</span>
              Public
            </span>
            <span class="usage-count">
              <span class="icon">📊</span>
              {{ template.usageCount }} uses
            </span>
          </div>
        </div>
        
        <button @click="$emit('close')" class="close-button">
          <span class="icon">✕</span>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="modal-content">
        <!-- Template Description -->
        <div class="template-info">
          <h3 class="section-title">About This Template</h3>
          <p class="template-description">{{ template.description }}</p>
          
          <div class="template-details">
            <div class="detail-item">
              <span class="detail-label">Created:</span>
              <span class="detail-value">{{ formatDate(template.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Author:</span>
              <span class="detail-value">{{ authorName }}</span>
            </div>
            <div v-if="template.updatedAt !== template.createdAt" class="detail-item">
              <span class="detail-label">Updated:</span>
              <span class="detail-value">{{ formatDate(template.updatedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Card Preview -->
        <div class="card-preview">
          <h3 class="section-title">Card Preview</h3>
          <div class="preview-card">
            <div class="card-header">
              <div class="card-title">{{ template.content.title }}</div>
              <div class="card-priority" :class="priorityClass">
                <span class="priority-icon">{{ priorityIcon }}</span>
                {{ template.content.priority }}
              </div>
            </div>
            
            <div class="card-content">
              <div class="card-description" v-html="formattedDescription"></div>
            </div>
            
            <div v-if="template.content.labels.length > 0" class="card-labels">
              <span
                v-for="label in template.content.labels"
                :key="label"
                class="label-tag"
              >
                {{ label }}
              </span>
            </div>
            
            <div v-if="template.content.checklistItems.length > 0" class="card-checklist">
              <h4 class="checklist-title">
                <span class="icon">☑️</span>
                Checklist ({{ template.content.checklistItems.length }} items)
              </h4>
              <ul class="checklist-items">
                <li v-for="item in template.content.checklistItems" :key="item" class="checklist-item">
                  <input type="checkbox" disabled class="checkbox">
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Additional Information -->
        <div v-if="hasAdditionalInfo" class="additional-info">
          <h3 class="section-title">Additional Details</h3>
          
          <div v-if="customFields && Object.keys(customFields).length > 0" class="custom-fields">
            <h4 class="subsection-title">Custom Fields</h4>
            <div class="fields-grid">
              <div
                v-for="[key, value] in Object.entries(customFields)"
                :key="key"
                class="field-item"
              >
                <span class="field-label">{{ key }}:</span>
                <span class="field-value">{{ value || '(empty)' }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="template.content.attachmentTypes.length > 0" class="attachment-types">
            <h4 class="subsection-title">Expected Attachments</h4>
            <div class="attachment-list">
              <span
                v-for="type in template.content.attachmentTypes"
                :key="type"
                class="attachment-type"
              >
                <span class="icon">📎</span>
                {{ type }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <div class="footer-info">
          <span class="last-updated">
            Last updated {{ formatRelativeDate(template.updatedAt) }}
          </span>
        </div>
        
        <div class="footer-actions">
          <button
            v-if="canEdit"
            @click="$emit('edit', template)"
            class="btn btn-secondary"
          >
            <span class="icon">✏️</span>
            Edit Template
          </button>
          
          <button
            @click="handleApply"
            class="btn btn-primary"
            :disabled="isApplying"
          >
            <LoadingSpinner v-if="isApplying" size="small" />
            <span v-else class="icon">➕</span>
            {{ isApplying ? 'Creating Card...' : 'Use This Template' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTemplateStore } from '../../stores/template'
import { useAuthStore } from '../../stores/auth'
import { TemplateCategory, Priority, type CardTemplate } from '../../services/template.service'
import LoadingSpinner from '../../components/feedback/LoadingSpinner.vue'

interface Props {
  template: CardTemplate
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  apply: [template: CardTemplate]
  edit: [template: CardTemplate]
}>()

const templateStore = useTemplateStore()
const authStore = useAuthStore()

// Computed properties
const categoryIcon = computed(() => {
  const icons = {
    [TemplateCategory.TASK]: '✅',
    [TemplateCategory.BUG]: '🐛',
    [TemplateCategory.MEETING]: '👥',
    [TemplateCategory.FEATURE]: '⭐',
    [TemplateCategory.RESEARCH]: '🔬',
    [TemplateCategory.CUSTOM]: '🔧'
  }
  return icons[props.template.category] || '📋'
})

const categoryLabel = computed(() => {
  const labels = {
    [TemplateCategory.TASK]: 'Task Template',
    [TemplateCategory.BUG]: 'Bug Report',
    [TemplateCategory.MEETING]: 'Meeting Template',
    [TemplateCategory.FEATURE]: 'Feature Template',
    [TemplateCategory.RESEARCH]: 'Research Template',
    [TemplateCategory.CUSTOM]: 'Custom Template'
  }
  return labels[props.template.category] || 'Template'
})

const priorityIcon = computed(() => {
  const icons = {
    [Priority.CRITICAL]: '🔴',
    [Priority.HIGH]: '🟠',
    [Priority.MEDIUM]: '🟡',
    [Priority.LOW]: '🟢'
  }
  return icons[props.template.content.priority] || '🟡'
})

const priorityClass = computed(() => {
  return `priority-${props.template.content.priority.toLowerCase()}`
})

const authorName = computed(() => {
  if (props.template.createdBy === 'system') {
    return 'System Template'
  }
  // In a real app, this would be resolved from user data
  return props.template.createdBy
})

const canEdit = computed(() => {
  return props.template.createdBy === authStore.userId
})

const isApplying = computed(() => {
  return templateStore.isApplying === props.template.id
})

const customFields = computed(() => {
  try {
    if (props.template.content.customFields && props.template.content.customFields !== '{}') {
      return JSON.parse(props.template.content.customFields)
    }
    return {}
  } catch (error) {
    console.warn('Failed to parse custom fields:', error)
    return {}
  }
})

const hasAdditionalInfo = computed(() => {
  return (customFields.value && Object.keys(customFields.value).length > 0) ||
         props.template.content.attachmentTypes.length > 0
})

const formattedDescription = computed(() => {
  // Simple markdown-like formatting
  let formatted = props.template.content.description
  
  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>')
  
  // Convert ## headers to <h4>
  formatted = formatted.replace(/^## (.*?)$/gm, '<h4 class="content-header">$1</h4>')
  
  return formatted
})

// Methods
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric',
    month: 'long', 
    day: 'numeric' 
  })
}

const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) {
    return 'today'
  } else if (diffInDays === 1) {
    return 'yesterday'
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffInDays / 365)
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
}

const handleApply = () => {
  emit('apply', props.template)
}
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
  @apply flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.header-content {
  @apply flex-1 pr-4;
}

.modal-title {
  @apply text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3 mb-2;
}

.template-category-icon {
  @apply text-2xl;
}

.template-meta {
  @apply flex items-center gap-3 flex-wrap;
}

.category-badge {
  @apply text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 
         px-3 py-1 rounded-full;
}

.public-badge {
  @apply text-sm bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 
         px-3 py-1 rounded-full flex items-center gap-1;
}

.usage-count {
  @apply text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1;
}

.close-button {
  @apply p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg 
         text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors;
}

.modal-content {
  @apply flex-1 overflow-auto p-6 space-y-6;
}

.section-title {
  @apply text-lg font-semibold text-gray-900 dark:text-white mb-4;
}

.subsection-title {
  @apply text-base font-medium text-gray-700 dark:text-gray-300 mb-3;
}

.template-info {
  @apply space-y-4;
}

.template-description {
  @apply text-gray-600 dark:text-gray-400 leading-relaxed;
}

.template-details {
  @apply space-y-2;
}

.detail-item {
  @apply flex items-center text-sm;
}

.detail-label {
  @apply font-medium text-gray-700 dark:text-gray-300 w-20;
}

.detail-value {
  @apply text-gray-600 dark:text-gray-400;
}

.card-preview {
  @apply space-y-4;
}

.preview-card {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4;
}

.card-header {
  @apply flex items-start justify-between gap-4;
}

.card-title {
  @apply font-semibold text-gray-900 dark:text-white flex-1;
}

.card-priority {
  @apply text-sm px-2 py-1 rounded-full flex items-center gap-1 font-medium whitespace-nowrap;
}

.priority-critical {
  @apply bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300;
}

.priority-high {
  @apply bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300;
}

.priority-medium {
  @apply bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300;
}

.priority-low {
  @apply bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300;
}

.card-content {
  @apply space-y-3;
}

.card-description {
  @apply text-sm text-gray-600 dark:text-gray-400 leading-relaxed;
}

.card-description :deep(.content-header) {
  @apply font-semibold text-gray-900 dark:text-white mt-4 mb-2;
}

.card-labels {
  @apply flex flex-wrap gap-2;
}

.label-tag {
  @apply text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 
         px-2 py-1 rounded-full;
}

.card-checklist {
  @apply space-y-3;
}

.checklist-title {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2;
}

.checklist-items {
  @apply space-y-2;
}

.checklist-item {
  @apply flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400;
}

.checkbox {
  @apply w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded;
}

.additional-info {
  @apply space-y-6;
}

.custom-fields {
  @apply space-y-3;
}

.fields-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-3;
}

.field-item {
  @apply bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3;
}

.field-label {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300 block;
}

.field-value {
  @apply text-sm text-gray-600 dark:text-gray-400 font-mono;
}

.attachment-types {
  @apply space-y-3;
}

.attachment-list {
  @apply flex flex-wrap gap-2;
}

.attachment-type {
  @apply text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
         px-3 py-1 rounded-full flex items-center gap-1;
}

.modal-footer {
  @apply flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700;
}

.footer-info {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.footer-actions {
  @apply flex items-center gap-3;
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

.priority-icon {
  @apply text-sm;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .modal-container {
    @apply max-w-full mx-2 max-h-[95vh];
  }
  
  .modal-header {
    @apply flex-col items-start gap-4;
  }
  
  .template-meta {
    @apply text-xs;
  }
  
  .card-header {
    @apply flex-col items-start gap-2;
  }
  
  .fields-grid {
    @apply grid-cols-1;
  }
  
  .modal-footer {
    @apply flex-col-reverse gap-4;
  }
  
  .footer-actions {
    @apply w-full flex-col;
  }
  
  .footer-actions .btn {
    @apply w-full justify-center;
  }
}
</style>
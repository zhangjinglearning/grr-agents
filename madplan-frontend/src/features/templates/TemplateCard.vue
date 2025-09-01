<template>
  <div 
    class="template-card"
    :class="{ 'selected': isSelected }"
    @click="$emit('select', template)"
  >
    <!-- Card Header -->
    <div class="card-header">
      <div class="template-info">
        <div class="template-category">
          <span class="category-icon">{{ categoryIcon }}</span>
          <span class="category-text">{{ categoryLabel }}</span>
        </div>
        <div class="template-meta">
          <span v-if="showUsageCount" class="usage-count">
            <span class="icon">📊</span>
            {{ template.usageCount }} uses
          </span>
          <span v-if="template.isPublic" class="public-badge">
            <span class="icon">🌐</span>
            Public
          </span>
        </div>
      </div>
      
      <!-- Actions Menu -->
      <div v-if="showActions" class="card-actions">
        <button
          @click.stop="showActionsMenu = !showActionsMenu"
          class="actions-button"
          :class="{ active: showActionsMenu }"
        >
          <span class="icon">⋮</span>
        </button>
        
        <!-- Actions Dropdown -->
        <div v-if="showActionsMenu" class="actions-menu" @click.stop>
          <button @click="editTemplate" class="action-item">
            <span class="icon">✏️</span>
            Edit
          </button>
          <button @click="duplicateTemplate" class="action-item">
            <span class="icon">📋</span>
            Duplicate
          </button>
          <button @click="deleteTemplate" class="action-item danger">
            <span class="icon">🗑️</span>
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Template Name and Description -->
    <div class="card-content">
      <h3 class="template-name">{{ template.name }}</h3>
      <p class="template-description">{{ template.description }}</p>
      
      <!-- Template Preview -->
      <div class="template-preview">
        <div class="preview-title">{{ template.content.title }}</div>
        <div class="preview-description">{{ truncatedContent }}</div>
      </div>
    </div>

    <!-- Template Details -->
    <div class="card-details">
      <!-- Priority Badge -->
      <div class="priority-badge" :class="priorityClass">
        <span class="priority-icon">{{ priorityIcon }}</span>
        {{ template.content.priority }}
      </div>
      
      <!-- Labels -->
      <div v-if="template.content.labels.length > 0" class="template-labels">
        <span
          v-for="label in displayLabels"
          :key="label"
          class="label-tag"
        >
          {{ label }}
        </span>
        <span v-if="template.content.labels.length > 3" class="more-labels">
          +{{ template.content.labels.length - 3 }}
        </span>
      </div>
      
      <!-- Checklist Items Count -->
      <div v-if="template.content.checklistItems.length > 0" class="checklist-info">
        <span class="icon">☑️</span>
        {{ template.content.checklistItems.length }} items
      </div>
    </div>

    <!-- Card Footer -->
    <div class="card-footer">
      <div class="template-author">
        <span v-if="showOwner" class="author-info">
          <span class="icon">👤</span>
          By {{ authorName }}
        </span>
        <span class="created-date">{{ formatDate(template.createdAt) }}</span>
      </div>
      
      <!-- Action Buttons -->
      <div class="footer-actions">
        <button
          @click.stop="$emit('apply', template)"
          class="btn btn-primary btn-sm"
          :disabled="isApplying"
        >
          <LoadingSpinner v-if="isApplying" size="small" />
          <span v-else class="icon">➕</span>
          {{ isApplying ? 'Creating...' : 'Use Template' }}
        </button>
        
        <button
          @click.stop="$emit('select', template)"
          class="btn btn-secondary btn-sm"
        >
          <span class="icon">👀</span>
          Preview
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isDeleting" class="loading-overlay">
      <LoadingSpinner size="large" />
      <p>Deleting template...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTemplateStore } from '../../stores/template'
import { TemplateCategory, Priority, type CardTemplate } from '../../services/template.service'
import LoadingSpinner from '../../components/feedback/LoadingSpinner.vue'

interface Props {
  template: CardTemplate
  showUsageCount?: boolean
  showOwner?: boolean
  showActions?: boolean
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showUsageCount: false,
  showOwner: true,
  showActions: false,
  isSelected: false
})

const emit = defineEmits<{
  select: [template: CardTemplate]
  edit: [template: CardTemplate]
  delete: [template: CardTemplate]
  apply: [template: CardTemplate]
}>()

const templateStore = useTemplateStore()

// Reactive state
const showActionsMenu = ref(false)

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
    [TemplateCategory.TASK]: 'Task',
    [TemplateCategory.BUG]: 'Bug',
    [TemplateCategory.MEETING]: 'Meeting',
    [TemplateCategory.FEATURE]: 'Feature',
    [TemplateCategory.RESEARCH]: 'Research',
    [TemplateCategory.CUSTOM]: 'Custom'
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

const truncatedContent = computed(() => {
  const content = props.template.content.description
  return content.length > 120 ? content.substring(0, 120) + '...' : content
})

const displayLabels = computed(() => {
  return props.template.content.labels.slice(0, 3)
})

const authorName = computed(() => {
  if (props.template.createdBy === 'system') {
    return 'System'
  }
  // In a real app, this would be populated from user data
  return props.template.createdBy
})

const isApplying = computed(() => {
  return templateStore.isApplying === props.template.id
})

const isDeleting = computed(() => {
  return templateStore.isDeleting === props.template.id
})

// Methods
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

const editTemplate = () => {
  showActionsMenu.value = false
  emit('edit', props.template)
}

const duplicateTemplate = () => {
  showActionsMenu.value = false
  // Create a new template based on this one
  const duplicateData = {
    ...props.template,
    name: `${props.template.name} (Copy)`,
    isPublic: false
  }
  delete (duplicateData as any).id
  delete (duplicateData as any).createdBy
  delete (duplicateData as any).usageCount
  delete (duplicateData as any).createdAt
  delete (duplicateData as any).updatedAt
  
  templateStore.createTemplate(duplicateData)
}

const deleteTemplate = () => {
  showActionsMenu.value = false
  emit('delete', props.template)
}

// Close actions menu when clicking outside
const handleClickOutside = (event: Event) => {
  if (!((event.target as Element)?.closest('.card-actions'))) {
    showActionsMenu.value = false
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.template-card {
  @apply relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
         shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer
         hover:border-blue-300 dark:hover:border-blue-600;
}

.template-card.selected {
  @apply ring-2 ring-blue-500 border-blue-500;
}

.loading-overlay {
  @apply absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-90 
         flex flex-col items-center justify-center rounded-lg z-10;
}

.loading-overlay p {
  @apply text-gray-600 dark:text-gray-400 mt-2 text-sm;
}

.card-header {
  @apply flex items-start justify-between p-4 pb-2;
}

.template-info {
  @apply flex-1;
}

.template-category {
  @apply flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400;
}

.category-icon {
  @apply text-base;
}

.template-meta {
  @apply flex items-center gap-3 mt-1;
}

.usage-count {
  @apply text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1;
}

.public-badge {
  @apply text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 
         px-2 py-1 rounded-full flex items-center gap-1;
}

.card-actions {
  @apply relative;
}

.actions-button {
  @apply p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
         transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300;
}

.actions-button.active {
  @apply bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300;
}

.actions-menu {
  @apply absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg 
         border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[120px];
}

.action-item {
  @apply w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700
         text-gray-700 dark:text-gray-300 flex items-center gap-2;
}

.action-item.danger {
  @apply text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20;
}

.card-content {
  @apply px-4 pb-3;
}

.template-name {
  @apply text-lg font-semibold text-gray-900 dark:text-white mb-1;
}

.template-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mb-3;
}

.template-preview {
  @apply bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3;
}

.preview-title {
  @apply font-medium text-gray-900 dark:text-white text-sm mb-2;
}

.preview-description {
  @apply text-xs text-gray-600 dark:text-gray-400 line-clamp-3;
}

.card-details {
  @apply px-4 pb-3 flex flex-wrap gap-2 items-center;
}

.priority-badge {
  @apply text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium;
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

.template-labels {
  @apply flex flex-wrap gap-1;
}

.label-tag {
  @apply text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 
         px-2 py-1 rounded-full;
}

.more-labels {
  @apply text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 
         px-2 py-1 rounded-full;
}

.checklist-info {
  @apply text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1;
}

.card-footer {
  @apply flex items-center justify-between p-4 pt-0 border-t border-gray-100 dark:border-gray-700 mt-2;
}

.template-author {
  @apply flex flex-col text-xs text-gray-500 dark:text-gray-400;
}

.author-info {
  @apply flex items-center gap-1 mb-1;
}

.created-date {
  @apply text-xs;
}

.footer-actions {
  @apply flex gap-2;
}

.btn {
  @apply px-3 py-1.5 rounded-lg font-medium transition-all duration-200 
         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1;
}

.btn-sm {
  @apply text-xs px-2 py-1;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white shadow-sm;
}

.btn-secondary {
  @apply bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 
         text-gray-900 dark:text-white;
}

.icon {
  @apply inline-block text-sm;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .card-footer {
    @apply flex-col items-stretch gap-3;
  }
  
  .footer-actions {
    @apply justify-stretch;
  }
  
  .footer-actions .btn {
    @apply flex-1 justify-center;
  }
}

/* Text clamping utility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
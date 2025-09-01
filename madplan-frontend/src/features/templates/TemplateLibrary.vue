<template>
  <div class="template-library">
    <!-- Header -->
    <div class="library-header">
      <div class="header-content">
        <h2 class="library-title">
          <span class="icon">📋</span>
          Card Templates
        </h2>
        <p class="library-description">
          Create cards quickly using predefined templates or create your own
        </p>
      </div>
      
      <div class="header-actions">
        <button 
          @click="showCreateDialog = true"
          class="btn btn-primary"
          :disabled="templateStore.isLoadingAny"
        >
          <span class="icon">➕</span>
          Create Template
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="library-controls">
      <div class="search-container">
        <input
          v-model="searchQuery"
          @input="handleSearch"
          type="text"
          placeholder="Search templates..."
          class="search-input"
        >
        <span class="search-icon">🔍</span>
      </div>
      
      <div class="filter-tabs">
        <button
          v-for="category in categoryTabs"
          :key="category.value"
          @click="selectedCategory = category.value"
          :class="['tab', { active: selectedCategory === category.value }]"
        >
          <span class="tab-icon">{{ category.icon }}</span>
          {{ category.label }}
          <span v-if="category.count > 0" class="tab-count">{{ category.count }}</span>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="library-content">
      <!-- Loading State -->
      <div v-if="templateStore.isLoading" class="loading-container">
        <LoadingSpinner variant="ghibli" size="large" />
        <p>Loading templates...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="templateStore.error" class="error-container">
        <div class="error-message">
          <span class="icon">⚠️</span>
          <p>{{ templateStore.error }}</p>
          <button @click="retryLoad" class="btn btn-secondary">Retry</button>
        </div>
      </div>

      <!-- Templates Grid -->
      <div v-else class="templates-grid">
        <!-- Search Results -->
        <div v-if="showSearchResults" class="search-results">
          <h3 class="section-title">Search Results ({{ searchResults.length }})</h3>
          <div class="templates-list">
            <TemplateCard
              v-for="template in searchResults"
              :key="template.id"
              :template="template"
              @select="selectTemplate"
              @edit="editTemplate"
              @delete="deleteTemplate"
              @apply="applyTemplate"
            />
          </div>
        </div>

        <!-- Popular Templates Section -->
        <div v-if="!showSearchResults && showPopularTemplates" class="popular-section">
          <h3 class="section-title">
            <span class="icon">🌟</span>
            Popular Templates
          </h3>
          <div class="templates-list">
            <TemplateCard
              v-for="template in filteredPopularTemplates"
              :key="template.id"
              :template="template"
              :show-usage-count="true"
              @select="selectTemplate"
              @apply="applyTemplate"
            />
          </div>
        </div>

        <!-- User Templates Section -->
        <div v-if="!showSearchResults" class="user-section">
          <h3 class="section-title">
            <span class="icon">👤</span>
            Your Templates
            <span class="template-count">({{ filteredUserTemplates.length }})</span>
          </h3>
          
          <!-- Empty State for User Templates -->
          <div v-if="filteredUserTemplates.length === 0" class="empty-state">
            <div class="empty-content">
              <span class="empty-icon">📝</span>
              <h4>No templates yet</h4>
              <p>Create your first template to get started</p>
              <button @click="showCreateDialog = true" class="btn btn-primary">
                Create Template
              </button>
            </div>
          </div>

          <!-- User Templates Grid -->
          <div v-else class="templates-list">
            <TemplateCard
              v-for="template in filteredUserTemplates"
              :key="template.id"
              :template="template"
              :show-owner="false"
              :show-actions="true"
              @select="selectTemplate"
              @edit="editTemplate"
              @delete="deleteTemplate"
              @apply="applyTemplate"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Template Dialog -->
    <TemplateEditor
      v-if="showCreateDialog || editingTemplate"
      :template="editingTemplate"
      :is-open="showCreateDialog || !!editingTemplate"
      @close="closeEditor"
      @save="handleTemplateSave"
    />

    <!-- Template Preview Dialog -->
    <TemplatePreview
      v-if="selectedTemplate"
      :template="selectedTemplate"
      :is-open="!!selectedTemplate"
      @close="selectedTemplate = null"
      @apply="applyTemplate"
      @edit="editTemplate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTemplateStore } from '../../stores/template'
import { TemplateCategory, type CardTemplate, type CreateTemplateInput } from '../../services/template.service'
import LoadingSpinner from '../../components/feedback/LoadingSpinner.vue'
import TemplateCard from './TemplateCard.vue'
import TemplateEditor from './TemplateEditor.vue'
import TemplatePreview from './TemplatePreview.vue'

const templateStore = useTemplateStore()

// Reactive state
const searchQuery = ref('')
const selectedCategory = ref<TemplateCategory | 'all'>('all')
const showCreateDialog = ref(false)
const editingTemplate = ref<CardTemplate | null>(null)
const selectedTemplate = ref<CardTemplate | null>(null)
const searchResults = ref<CardTemplate[]>([])
const searchTimeout = ref<number | null>(null)

// Computed properties
const showSearchResults = computed(() => searchQuery.value.length > 0 && searchResults.value.length >= 0)
const showPopularTemplates = computed(() => !showSearchResults.value && selectedCategory.value === 'all')

const categoryTabs = computed(() => [
  { 
    value: 'all' as const, 
    label: 'All', 
    icon: '📋', 
    count: templateStore.userTemplates.length 
  },
  { 
    value: TemplateCategory.TASK, 
    label: 'Tasks', 
    icon: '✅', 
    count: templateStore.getTemplatesByCategory(TemplateCategory.TASK).length 
  },
  { 
    value: TemplateCategory.BUG, 
    label: 'Bugs', 
    icon: '🐛', 
    count: templateStore.getTemplatesByCategory(TemplateCategory.BUG).length 
  },
  { 
    value: TemplateCategory.MEETING, 
    label: 'Meetings', 
    icon: '👥', 
    count: templateStore.getTemplatesByCategory(TemplateCategory.MEETING).length 
  },
  { 
    value: TemplateCategory.FEATURE, 
    label: 'Features', 
    icon: '⭐', 
    count: templateStore.getTemplatesByCategory(TemplateCategory.FEATURE).length 
  },
  { 
    value: TemplateCategory.RESEARCH, 
    label: 'Research', 
    icon: '🔬', 
    count: templateStore.getTemplatesByCategory(TemplateCategory.RESEARCH).length 
  },
  { 
    value: TemplateCategory.CUSTOM, 
    label: 'Custom', 
    icon: '🔧', 
    count: templateStore.getTemplatesByCategory(TemplateCategory.CUSTOM).length 
  }
])

const filteredUserTemplates = computed(() => {
  if (selectedCategory.value === 'all') {
    return templateStore.userTemplates
  }
  return templateStore.getTemplatesByCategory(selectedCategory.value as TemplateCategory)
})

const filteredPopularTemplates = computed(() => {
  return templateStore.popularTemplates.slice(0, 6) // Show top 6 popular templates
})

// Methods
const handleSearch = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }
  
  searchTimeout.value = window.setTimeout(async () => {
    if (searchQuery.value.length > 0) {
      const results = await templateStore.searchTemplates(searchQuery.value)
      searchResults.value = results || []
    } else {
      searchResults.value = []
    }
  }, 300) // Debounce search by 300ms
}

const selectTemplate = (template: CardTemplate) => {
  selectedTemplate.value = template
}

const editTemplate = (template: CardTemplate) => {
  editingTemplate.value = template
  showCreateDialog.value = false
}

const deleteTemplate = async (template: CardTemplate) => {
  if (confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
    await templateStore.deleteTemplate(template.id)
  }
}

const applyTemplate = (template: CardTemplate) => {
  // This will be handled by parent component or through events
  // For now, we'll emit an event
  emit('apply-template', template)
}

const closeEditor = () => {
  showCreateDialog.value = false
  editingTemplate.value = null
}

const handleTemplateSave = async (templateData: CreateTemplateInput) => {
  try {
    if (editingTemplate.value) {
      await templateStore.updateTemplate({
        id: editingTemplate.value.id,
        ...templateData
      })
    } else {
      await templateStore.createTemplate(templateData)
    }
    closeEditor()
  } catch (error) {
    console.error('Failed to save template:', error)
  }
}

const retryLoad = () => {
  loadTemplates()
}

const loadTemplates = async () => {
  await Promise.all([
    templateStore.fetchUserTemplates(),
    templateStore.fetchPopularTemplates(10)
  ])
}

// Watchers
watch(selectedCategory, (newCategory) => {
  if (newCategory !== 'all') {
    templateStore.fetchUserTemplates(newCategory as TemplateCategory)
  }
})

// Events
const emit = defineEmits<{
  'apply-template': [template: CardTemplate]
}>()

// Lifecycle
onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.template-library {
  @apply flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm;
}

.library-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.header-content {
  @apply flex-1;
}

.library-title {
  @apply text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2;
}

.library-description {
  @apply text-gray-600 dark:text-gray-400 mt-1;
}

.header-actions {
  @apply flex gap-2;
}

.library-controls {
  @apply flex items-center justify-between p-6 pb-4 gap-4;
}

.search-container {
  @apply relative flex-1 max-w-md;
}

.search-input {
  @apply w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
         focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.search-icon {
  @apply absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400;
}

.filter-tabs {
  @apply flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg;
}

.tab {
  @apply flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
         text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
         hover:bg-white dark:hover:bg-gray-700 transition-colors;
}

.tab.active {
  @apply bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm;
}

.tab-icon {
  @apply text-base;
}

.tab-count {
  @apply bg-gray-200 dark:bg-gray-600 text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center;
}

.library-content {
  @apply flex-1 overflow-auto p-6;
}

.loading-container {
  @apply flex flex-col items-center justify-center py-12 text-gray-500;
}

.error-container {
  @apply flex items-center justify-center py-12;
}

.error-message {
  @apply text-center;
}

.error-message .icon {
  @apply text-4xl mb-4 block;
}

.error-message p {
  @apply text-gray-600 dark:text-gray-400 mb-4;
}

.section-title {
  @apply text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2;
}

.template-count {
  @apply text-sm font-normal text-gray-500 dark:text-gray-400;
}

.templates-list {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8;
}

.search-results {
  @apply mb-8;
}

.popular-section {
  @apply mb-8;
}

.empty-state {
  @apply flex items-center justify-center py-16;
}

.empty-content {
  @apply text-center;
}

.empty-icon {
  @apply text-6xl mb-4 block opacity-50;
}

.empty-content h4 {
  @apply text-lg font-semibold text-gray-900 dark:text-white mb-2;
}

.empty-content p {
  @apply text-gray-600 dark:text-gray-400 mb-6;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .library-header {
    @apply flex-col items-start gap-4;
  }
  
  .library-controls {
    @apply flex-col gap-4;
  }
  
  .filter-tabs {
    @apply flex-wrap;
  }
  
  .templates-list {
    @apply grid-cols-1 sm:grid-cols-2;
  }
}

/* Button styles */
.btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md;
}

.btn-secondary {
  @apply bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 
         text-gray-900 dark:text-white;
}

.icon {
  @apply inline-block;
}
</style>
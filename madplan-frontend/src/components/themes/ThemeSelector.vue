<template>
  <div class="theme-selector">
    <div class="theme-selector-header">
      <h3 class="theme-selector-title">Choose Your Theme</h3>
      <p class="theme-selector-description">
        Select a Ghibli-inspired theme to personalize your board
      </p>
    </div>

    <div v-if="isLoading" class="theme-loading">
      <div class="loading-spinner"></div>
      <p>Loading themes...</p>
    </div>

    <div v-else-if="error" class="theme-error">
      <p class="error-message">{{ error }}</p>
      <button @click="retryLoad" class="retry-button">
        Try Again
      </button>
    </div>

    <div v-else class="theme-grid">
      <ThemePreview
        v-for="theme in availableThemes"
        :key="theme.id"
        :theme="theme"
        :is-selected="selectedThemeId === theme.name"
        :is-current="currentTheme?.name === theme.name"
        @select="handleThemeSelect"
        @preview="handleThemePreview"
        @preview-end="handlePreviewEnd"
        class="theme-grid-item"
      />
    </div>

    <div v-if="selectedTheme && selectedThemeId !== currentTheme?.name" class="theme-actions">
      <div class="theme-customization">
        <ThemeCustomizer
          v-if="showCustomizer"
          :theme="selectedTheme"
          :customizations="pendingCustomizations"
          @update="handleCustomizationUpdate"
        />
        
        <button 
          @click="toggleCustomizer"
          class="customize-button"
          :class="{ active: showCustomizer }"
        >
          <svg class="customize-icon" viewBox="0 0 24 24">
            <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z" />
          </svg>
          Customize
        </button>
      </div>

      <div class="theme-action-buttons">
        <button @click="handleCancel" class="cancel-button">
          Cancel
        </button>
        <button 
          @click="handleApply" 
          :disabled="isApplying"
          class="apply-button"
        >
          <span v-if="isApplying">Applying...</span>
          <span v-else>Apply Theme</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '../../stores/theme';
import { GhibliTheme, ThemeCustomizations } from '../../types/theme';
import ThemePreview from './ThemePreview.vue';
import ThemeCustomizer from './ThemeCustomizer.vue';
import { logger } from '../../utils/logger';

interface Props {
  boardId?: string;
  initialThemeId?: string;
}

interface Emits {
  (e: 'theme-applied', theme: GhibliTheme, customizations?: ThemeCustomizations): void;
  (e: 'theme-cancelled'): void;
  (e: 'error', error: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  boardId: '',
  initialThemeId: 'spirited-away',
});

const emit = defineEmits<Emits>();

// Store
const themeStore = useThemeStore();

// Local state
const selectedThemeId = ref<string>(props.initialThemeId);
const showCustomizer = ref<boolean>(false);
const pendingCustomizations = ref<ThemeCustomizations>({});
const isApplying = ref<boolean>(false);
const previewTimeout = ref<NodeJS.Timeout | null>(null);

// Computed
const availableThemes = computed(() => themeStore.availableThemes);
const currentTheme = computed(() => themeStore.currentTheme);
const isLoading = computed(() => themeStore.isLoading);
const error = computed(() => themeStore.error);

const selectedTheme = computed(() => {
  return availableThemes.value.find(theme => theme.name === selectedThemeId.value) || null;
});

// Methods
const handleThemeSelect = (theme: GhibliTheme): void => {
  selectedThemeId.value = theme.name;
  showCustomizer.value = false;
  pendingCustomizations.value = {};
  logger.info(`Theme selected: ${theme.displayName}`);
};

const handleThemePreview = async (theme: GhibliTheme): Promise<void> => {
  try {
    // Clear any existing preview timeout
    if (previewTimeout.value) {
      clearTimeout(previewTimeout.value);
    }

    // Apply theme for preview
    await themeStore.applyTheme(theme.name);
    
    // Set timeout to revert after 3 seconds
    previewTimeout.value = setTimeout(() => {
      handlePreviewEnd();
    }, 3000);
    
    logger.info(`Previewing theme: ${theme.displayName}`);
  } catch (err) {
    logger.error('Failed to preview theme:', err);
    emit('error', 'Failed to preview theme');
  }
};

const handlePreviewEnd = async (): Promise<void> => {
  try {
    // Clear timeout
    if (previewTimeout.value) {
      clearTimeout(previewTimeout.value);
      previewTimeout.value = null;
    }

    // Revert to current theme
    if (currentTheme.value) {
      await themeStore.applyTheme(currentTheme.value.name);
    }
  } catch (err) {
    logger.error('Failed to end preview:', err);
  }
};

const toggleCustomizer = (): void => {
  showCustomizer.value = !showCustomizer.value;
};

const handleCustomizationUpdate = (customizations: ThemeCustomizations): void => {
  pendingCustomizations.value = { ...customizations };
  logger.info('Theme customizations updated:', customizations);
};

const handleApply = async (): Promise<void> => {
  if (!selectedTheme.value) return;

  isApplying.value = true;

  try {
    // If boardId is provided, update board theme
    if (props.boardId) {
      await themeStore.updateBoardTheme({
        boardId: props.boardId,
        themeId: selectedTheme.value.name,
        customizations: Object.keys(pendingCustomizations.value).length > 0 
          ? pendingCustomizations.value 
          : undefined,
      });
    }

    // Apply theme locally
    await themeStore.applyTheme(selectedTheme.value.name, pendingCustomizations.value);

    emit('theme-applied', selectedTheme.value, pendingCustomizations.value);
    logger.info(`Theme applied: ${selectedTheme.value.displayName}`);
  } catch (err) {
    logger.error('Failed to apply theme:', err);
    emit('error', 'Failed to apply theme');
  } finally {
    isApplying.value = false;
  }
};

const handleCancel = (): void => {
  selectedThemeId.value = currentTheme.value?.name || 'spirited-away';
  showCustomizer.value = false;
  pendingCustomizations.value = {};
  handlePreviewEnd();
  emit('theme-cancelled');
};

const retryLoad = async (): Promise<void> => {
  try {
    themeStore.clearError();
    await themeStore.loadThemes();
  } catch (err) {
    logger.error('Failed to retry theme loading:', err);
  }
};

// Lifecycle
onMounted(async () => {
  try {
    // Initialize theme store if not already loaded
    if (availableThemes.value.length === 0) {
      await themeStore.loadThemes();
    }
  } catch (err) {
    logger.error('Failed to load themes on mount:', err);
  }
});

onUnmounted(() => {
  // Clean up preview timeout
  if (previewTimeout.value) {
    clearTimeout(previewTimeout.value);
    handlePreviewEnd();
  }
});
</script>

<style scoped>
.theme-selector {
  @apply space-y-6;
}

.theme-selector-header {
  @apply text-center space-y-2;
}

.theme-selector-title {
  @apply text-xl font-semibold text-gray-900;
}

.theme-selector-description {
  @apply text-sm text-gray-600;
}

.theme-loading {
  @apply flex flex-col items-center justify-center py-12 space-y-4;
}

.loading-spinner {
  @apply w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin;
}

.theme-error {
  @apply text-center py-8 space-y-4;
}

.error-message {
  @apply text-red-600;
}

.retry-button {
  @apply px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors;
}

.theme-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4;
}

.theme-grid-item {
  @apply transition-transform hover:scale-105;
}

.theme-actions {
  @apply border-t pt-6 space-y-4;
}

.theme-customization {
  @apply space-y-4;
}

.customize-button {
  @apply flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors;
}

.customize-button.active {
  @apply bg-primary text-white border-primary;
}

.customize-icon {
  @apply w-4 h-4 fill-current;
}

.theme-action-buttons {
  @apply flex justify-end space-x-3;
}

.cancel-button {
  @apply px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors;
}

.apply-button {
  @apply px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors;
}

/* Animation classes */
:global(.animation-subtle) .theme-grid-item {
  transition-duration: 0.4s;
}

:global(.animation-normal) .theme-grid-item {
  transition-duration: 0.3s;
}

:global(.animation-playful) .theme-grid-item {
  transition-duration: 0.25s;
}

/* Typography scale classes */
:global(.typography-compact) .theme-selector-title {
  @apply text-lg;
}

:global(.typography-comfortable) .theme-selector-title {
  @apply text-xl;
}

:global(.typography-spacious) .theme-selector-title {
  @apply text-2xl;
}
</style>
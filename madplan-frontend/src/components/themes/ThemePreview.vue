<template>
  <div 
    class="theme-preview"
    :class="[
      { 
        'selected': isSelected,
        'current': isCurrent,
        'preview-active': isPreviewActive
      }
    ]"
    @click="handleSelect"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :style="cssVariables"
  >
    <!-- Theme Background Preview -->
    <div class="theme-preview-background">
      <div class="theme-preview-content">
        <!-- Miniature board preview -->
        <div class="preview-board">
          <div class="preview-list" v-for="i in 3" :key="`list-${i}`">
            <div class="preview-list-header"></div>
            <div class="preview-card" v-for="j in 2" :key="`card-${i}-${j}`"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Theme Info -->
    <div class="theme-info">
      <div class="theme-name">
        {{ theme.displayName }}
      </div>
      <div class="theme-description">
        {{ theme.description }}
      </div>
      <div class="theme-inspiration">
        {{ theme.inspiration }}
      </div>
    </div>

    <!-- Selection Indicator -->
    <div v-if="isSelected" class="selection-indicator">
      <svg class="selection-check" viewBox="0 0 24 24">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
      </svg>
    </div>

    <!-- Current Theme Badge -->
    <div v-if="isCurrent" class="current-badge">
      Current
    </div>

    <!-- Preview Overlay -->
    <div v-if="isPreviewActive" class="preview-overlay">
      <div class="preview-text">Previewing...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { GhibliTheme } from '../../types/theme';
import { ThemeService } from '../../services/theme.service';

interface Props {
  theme: GhibliTheme;
  isSelected?: boolean;
  isCurrent?: boolean;
}

interface Emits {
  (e: 'select', theme: GhibliTheme): void;
  (e: 'preview', theme: GhibliTheme): void;
  (e: 'preview-end'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isCurrent: false,
});

const emit = defineEmits<Emits>();

// Local state
const isPreviewActive = ref<boolean>(false);
const previewTimeout = ref<NodeJS.Timeout | null>(null);

// Computed
const cssVariables = computed(() => {
  const variables = ThemeService.getThemeCSSVariables(props.theme);
  
  // Convert to CSS custom properties with preview prefix
  const previewVars: Record<string, string> = {};
  Object.entries(variables).forEach(([key, value]) => {
    previewVars[`--preview${key}`] = value;
  });
  
  return previewVars;
});

// Methods
const handleSelect = (): void => {
  emit('select', props.theme);
};

const handleMouseEnter = (): void => {
  if (props.isSelected || props.isCurrent) return;
  
  // Start preview after delay
  previewTimeout.value = setTimeout(() => {
    isPreviewActive.value = true;
    emit('preview', props.theme);
  }, 1000); // 1 second delay
};

const handleMouseLeave = (): void => {
  // Clear preview timeout
  if (previewTimeout.value) {
    clearTimeout(previewTimeout.value);
    previewTimeout.value = null;
  }
  
  // End preview if active
  if (isPreviewActive.value) {
    isPreviewActive.value = false;
    emit('preview-end');
  }
};

// Lifecycle
onUnmounted(() => {
  if (previewTimeout.value) {
    clearTimeout(previewTimeout.value);
  }
});
</script>

<style scoped>
.theme-preview {
  @apply relative bg-white rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg;
  min-height: 200px;
}

.theme-preview.selected {
  @apply border-primary-500 ring-2 ring-primary-200;
}

.theme-preview.current {
  @apply border-green-500 ring-2 ring-green-200;
}

.theme-preview.preview-active {
  @apply transform scale-105 shadow-xl z-10;
}

.theme-preview-background {
  @apply absolute inset-0;
  background: var(--preview--bg-main, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
}

.theme-preview-content {
  @apply absolute inset-0 p-4;
}

.preview-board {
  @apply flex space-x-2 h-full;
}

.preview-list {
  @apply flex-1 space-y-2;
  max-width: 80px;
}

.preview-list-header {
  @apply h-3 rounded opacity-90;
  background: var(--preview--bg-list, rgba(255, 255, 255, 0.9));
}

.preview-card {
  @apply h-4 rounded opacity-80;
  background: var(--preview--bg-card, rgba(255, 255, 255, 0.95));
}

.theme-info {
  @apply absolute bottom-0 left-0 right-0 bg-white bg-opacity-95 backdrop-blur-sm p-3 space-y-1;
}

.theme-name {
  @apply font-semibold text-gray-900 text-sm;
}

.theme-description {
  @apply text-xs text-gray-600 line-clamp-1;
}

.theme-inspiration {
  @apply text-xs text-gray-500 italic line-clamp-1;
}

.selection-indicator {
  @apply absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center;
}

.selection-check {
  @apply w-4 h-4 text-white fill-current;
}

.current-badge {
  @apply absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium;
}

.preview-overlay {
  @apply absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center;
}

.preview-text {
  @apply text-white font-semibold text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full;
}

/* Color palette indicators */
.theme-preview::before {
  @apply absolute top-2 left-2 w-4 h-4 rounded-full border-2 border-white shadow-sm;
  content: '';
  background: var(--preview--color-primary, #6B46C1);
}

.theme-preview.current::before {
  display: none;
}

/* Hover effects */
.theme-preview:hover .theme-info {
  @apply bg-opacity-100;
}

.theme-preview:hover .preview-card,
.theme-preview:hover .preview-list-header {
  @apply opacity-100;
}

/* Animation intensity effects */
:global(.animation-subtle) .theme-preview {
  transition-duration: 0.4s;
}

:global(.animation-normal) .theme-preview {
  transition-duration: 0.3s;
}

:global(.animation-playful) .theme-preview {
  transition-duration: 0.25s;
}

:global(.animation-playful) .theme-preview:hover {
  @apply transform rotate-1;
}
</style>
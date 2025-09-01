<template>
  <div class="theme-customizer">
    <div class="customizer-header">
      <h4 class="customizer-title">Customize Theme</h4>
      <p class="customizer-description">Fine-tune the theme to your preferences</p>
    </div>

    <div class="customizer-content">
      <!-- Card Style -->
      <div class="customizer-section">
        <label class="section-label">Card Style</label>
        <div class="option-grid">
          <div 
            v-for="style in cardStyles" 
            :key="style.value"
            class="option-item"
            :class="{ selected: localCustomizations.cardStyle === style.value }"
            @click="updateCardStyle(style.value)"
          >
            <div class="option-preview" :class="`preview-${style.value}`">
              <div class="preview-element"></div>
            </div>
            <span class="option-label">{{ style.label }}</span>
          </div>
        </div>
      </div>

      <!-- Animation Intensity -->
      <div class="customizer-section">
        <label class="section-label">Animation Style</label>
        <div class="option-grid">
          <div 
            v-for="intensity in animationIntensities" 
            :key="intensity.value"
            class="option-item"
            :class="{ selected: localCustomizations.animationIntensity === intensity.value }"
            @click="updateAnimationIntensity(intensity.value)"
          >
            <div class="option-preview" :class="`animation-${intensity.value}`">
              <div class="preview-element animated"></div>
            </div>
            <span class="option-label">{{ intensity.label }}</span>
          </div>
        </div>
      </div>

      <!-- Typography Scale -->
      <div class="customizer-section">
        <label class="section-label">Text Size</label>
        <div class="option-grid">
          <div 
            v-for="scale in typographyScales" 
            :key="scale.value"
            class="option-item"
            :class="{ selected: localCustomizations.typographyScale === scale.value }"
            @click="updateTypographyScale(scale.value)"
          >
            <div class="option-preview">
              <div class="preview-text" :class="`text-${scale.value}`">Aa</div>
            </div>
            <span class="option-label">{{ scale.label }}</span>
          </div>
        </div>
      </div>

      <!-- Background Variant -->
      <div class="customizer-section">
        <label class="section-label">Background Variant</label>
        <div class="background-options">
          <div 
            v-for="variant in backgroundVariants" 
            :key="variant.value"
            class="background-option"
            :class="{ selected: localCustomizations.backgroundVariant === variant.value }"
            @click="updateBackgroundVariant(variant.value)"
            :style="{ background: variant.preview }"
          >
            <span class="background-label">{{ variant.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="customizer-actions">
      <button @click="resetCustomizations" class="reset-button">
        Reset to Default
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { GhibliTheme, ThemeCustomizations, CardStyle, AnimationIntensity, TypographyScale } from '../../types/theme';

interface Props {
  theme: GhibliTheme;
  customizations?: ThemeCustomizations;
}

interface Emits {
  (e: 'update', customizations: ThemeCustomizations): void;
}

const props = withDefaults(defineProps<Props>(), {
  customizations: () => ({}),
});

const emit = defineEmits<Emits>();

// Local state
const localCustomizations = ref<ThemeCustomizations>({ ...props.customizations });

// Options
const cardStyles = [
  { value: CardStyle.ROUNDED, label: 'Rounded', description: 'Soft, friendly corners' },
  { value: CardStyle.SQUARED, label: 'Squared', description: 'Clean, modern edges' },
  { value: CardStyle.TEXTURED, label: 'Textured', description: 'Subtle paper-like feel' },
];

const animationIntensities = [
  { value: AnimationIntensity.SUBTLE, label: 'Gentle', description: 'Minimal, calming movements' },
  { value: AnimationIntensity.NORMAL, label: 'Balanced', description: 'Smooth, noticeable animations' },
  { value: AnimationIntensity.PLAYFUL, label: 'Lively', description: 'Dynamic, engaging effects' },
];

const typographyScales = [
  { value: TypographyScale.COMPACT, label: 'Compact', description: 'Space-efficient text' },
  { value: TypographyScale.COMFORTABLE, label: 'Comfortable', description: 'Balanced reading experience' },
  { value: TypographyScale.SPACIOUS, label: 'Spacious', description: 'Generous, easy reading' },
];

const backgroundVariants = computed(() => [
  { 
    value: '', 
    label: 'Default', 
    preview: props.theme.backgrounds.main,
  },
  { 
    value: 'dark', 
    label: 'Dark', 
    preview: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  },
  { 
    value: 'light', 
    label: 'Light', 
    preview: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
  },
  { 
    value: 'vibrant', 
    label: 'Vibrant', 
    preview: `linear-gradient(135deg, ${props.theme.colorPalette.primary[0]} 0%, ${props.theme.colorPalette.accent[0]} 100%)`,
  },
]);

// Methods
const updateCardStyle = (style: CardStyle): void => {
  localCustomizations.value.cardStyle = style;
  emit('update', { ...localCustomizations.value });
};

const updateAnimationIntensity = (intensity: AnimationIntensity): void => {
  localCustomizations.value.animationIntensity = intensity;
  emit('update', { ...localCustomizations.value });
};

const updateTypographyScale = (scale: TypographyScale): void => {
  localCustomizations.value.typographyScale = scale;
  emit('update', { ...localCustomizations.value });
};

const updateBackgroundVariant = (variant: string): void => {
  localCustomizations.value.backgroundVariant = variant || undefined;
  emit('update', { ...localCustomizations.value });
};

const resetCustomizations = (): void => {
  localCustomizations.value = {
    cardStyle: props.theme.typography.scale as any, // Default from theme
    animationIntensity: props.theme.animations.intensity,
    typographyScale: props.theme.typography.scale,
    backgroundVariant: undefined,
  };
  emit('update', { ...localCustomizations.value });
};

// Watch for prop changes
watch(() => props.customizations, (newCustomizations) => {
  localCustomizations.value = { ...newCustomizations };
}, { deep: true });
</script>

<style scoped>
.theme-customizer {
  @apply bg-gray-50 rounded-lg p-4 space-y-6;
}

.customizer-header {
  @apply space-y-1;
}

.customizer-title {
  @apply font-semibold text-gray-900;
}

.customizer-description {
  @apply text-sm text-gray-600;
}

.customizer-content {
  @apply space-y-6;
}

.customizer-section {
  @apply space-y-3;
}

.section-label {
  @apply block text-sm font-medium text-gray-700;
}

.option-grid {
  @apply grid grid-cols-3 gap-3;
}

.option-item {
  @apply flex flex-col items-center space-y-2 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors;
}

.option-item.selected {
  @apply border-primary-500 bg-primary-50;
}

.option-preview {
  @apply flex items-center justify-center w-12 h-12 bg-gray-100 rounded;
}

.preview-element {
  @apply w-8 h-8 bg-current opacity-60;
}

.preview-rounded .preview-element {
  @apply rounded-lg;
}

.preview-squared .preview-element {
  @apply rounded-none;
}

.preview-textured .preview-element {
  @apply rounded-sm;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='0.1' d='M1,3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E");
}

.preview-element.animated {
  animation: pulse 2s infinite;
}

.animation-subtle .preview-element.animated {
  animation-duration: 3s;
}

.animation-normal .preview-element.animated {
  animation-duration: 2s;
}

.animation-playful .preview-element.animated {
  animation-duration: 1s;
}

.preview-text {
  @apply font-semibold text-gray-700;
}

.text-compact {
  @apply text-sm;
}

.text-comfortable {
  @apply text-base;
}

.text-spacious {
  @apply text-lg;
}

.option-label {
  @apply text-xs text-center text-gray-600;
}

.background-options {
  @apply grid grid-cols-2 gap-3;
}

.background-option {
  @apply relative h-16 rounded-lg border-2 border-gray-200 cursor-pointer overflow-hidden hover:border-gray-300 transition-colors;
}

.background-option.selected {
  @apply border-primary-500 ring-2 ring-primary-200;
}

.background-label {
  @apply absolute inset-x-0 bottom-0 bg-black bg-opacity-50 text-white text-xs text-center py-1;
}

.customizer-actions {
  @apply pt-4 border-t border-gray-200;
}

.reset-button {
  @apply w-full px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

/* Typography scale effects */
:global(.typography-compact) .customizer-title {
  @apply text-sm;
}

:global(.typography-comfortable) .customizer-title {
  @apply text-base;
}

:global(.typography-spacious) .customizer-title {
  @apply text-lg;
}
</style>
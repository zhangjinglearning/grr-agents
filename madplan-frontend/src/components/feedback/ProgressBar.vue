<template>
  <div :class="containerClasses" role="progressbar" :aria-valuenow="value" :aria-valuemin="min" :aria-valuemax="max">
    <!-- Progress bar track -->
    <div class="progress-track">
      <!-- Progress fill -->
      <div 
        class="progress-fill"
        :style="fillStyles"
      >
        <!-- Gradient overlay for Ghibli themes -->
        <div v-if="showGradient" class="progress-gradient"></div>
        
        <!-- Progress indicator dot -->
        <div v-if="showIndicator" class="progress-indicator"></div>
      </div>
      
      <!-- Buffer/secondary progress for loading states -->
      <div 
        v-if="buffer !== undefined"
        class="progress-buffer"
        :style="bufferStyles"
      ></div>
    </div>

    <!-- Progress label -->
    <div v-if="showLabel" class="progress-label">
      <span class="progress-text">{{ labelText }}</span>
      <span v-if="showPercentage" class="progress-percentage">{{ Math.round(percentage) }}%</span>
    </div>

    <!-- Step indicators for multi-step processes -->
    <div v-if="steps && steps.length > 0" class="progress-steps">
      <div
        v-for="(step, index) in steps"
        :key="index"
        :class="stepClasses(index)"
        @click="$emit('step-click', index)"
      >
        <div class="step-indicator">
          <CheckIcon v-if="isStepComplete(index)" class="w-4 h-4" />
          <span v-else class="step-number">{{ index + 1 }}</span>
        </div>
        <div class="step-label">{{ step.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { useThemeStore } from '@/stores/theme';

interface ProgressStep {
  label: string;
  completed?: boolean;
}

interface Props {
  value: number;
  min?: number;
  max?: number;
  buffer?: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showPercentage?: boolean;
  label?: string;
  steps?: ProgressStep[];
  showIndicator?: boolean;
  animated?: boolean;
  striped?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  variant: 'default',
  size: 'md',
  showLabel: false,
  showPercentage: false,
  showIndicator: false,
  animated: true,
  striped: false,
});

const emit = defineEmits<{
  'step-click': [stepIndex: number];
}>();

const themeStore = useThemeStore();

// Calculate percentage
const percentage = computed(() => {
  const range = props.max - props.min;
  const progress = props.value - props.min;
  return Math.max(0, Math.min(100, (progress / range) * 100));
});

const bufferPercentage = computed(() => {
  if (props.buffer === undefined) return 0;
  const range = props.max - props.min;
  const progress = props.buffer - props.min;
  return Math.max(0, Math.min(100, (progress / range) * 100));
});

// Container classes
const containerClasses = computed(() => [
  'progress-container',
  `size-${props.size}`,
  `variant-${props.variant}`,
  {
    'with-label': props.showLabel,
    'with-steps': props.steps && props.steps.length > 0,
    'animated': props.animated,
    'striped': props.striped,
  }
]);

// Progress fill styles
const fillStyles = computed(() => ({
  width: `${percentage.value}%`,
  transition: props.animated ? 'width 0.3s ease-out' : 'none',
}));

const bufferStyles = computed(() => ({
  width: `${bufferPercentage.value}%`,
}));

// Show gradient overlay for Ghibli themes
const showGradient = computed(() => {
  const currentTheme = themeStore.currentTheme?.name;
  return ['spirited-away', 'totoro', 'howls-castle', 'kikis-delivery'].includes(currentTheme || '');
});

// Label text
const labelText = computed(() => {
  if (props.label) return props.label;
  if (props.steps && props.steps.length > 0) {
    const currentStep = getCurrentStepIndex();
    return currentStep >= 0 ? props.steps[currentStep].label : 'Complete';
  }
  return 'Progress';
});

// Step-related methods
const getCurrentStepIndex = (): number => {
  if (!props.steps) return -1;
  
  const stepSize = 100 / props.steps.length;
  return Math.floor(percentage.value / stepSize);
};

const isStepComplete = (index: number): boolean => {
  if (props.steps?.[index]?.completed !== undefined) {
    return props.steps[index].completed!;
  }
  
  const stepSize = 100 / (props.steps?.length || 1);
  return percentage.value > (index + 1) * stepSize;
};

const stepClasses = (index: number) => [
  'progress-step',
  {
    'step-completed': isStepComplete(index),
    'step-current': getCurrentStepIndex() === index,
    'step-clickable': true,
  }
];
</script>

<style scoped>
.progress-container {
  --progress-height: 8px;
  --progress-radius: 4px;
  --step-size: 32px;
  
  width: 100%;
  
  &.size-sm {
    --progress-height: 4px;
    --progress-radius: 2px;
    --step-size: 24px;
  }
  
  &.size-lg {
    --progress-height: 12px;
    --progress-radius: 6px;
    --step-size: 40px;
  }
}

/* Progress track */
.progress-track {
  position: relative;
  width: 100%;
  height: var(--progress-height);
  background-color: var(--color-gray-200, #e5e7eb);
  border-radius: var(--progress-radius);
  overflow: hidden;
}

/* Progress fill */
.progress-fill {
  position: relative;
  height: 100%;
  border-radius: var(--progress-radius);
  overflow: hidden;
  
  .variant-default & {
    background-color: var(--color-primary, #6366f1);
  }
  
  .variant-success & {
    background-color: var(--color-accent, #10b981);
  }
  
  .variant-warning & {
    background-color: #f59e0b;
  }
  
  .variant-error & {
    background-color: #ef4444;
  }
  
  .variant-info & {
    background-color: #3b82f6;
  }
}

/* Ghibli theme gradients */
.progress-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.8;
  
  [data-theme="spirited-away"] & {
    background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  }
  
  [data-theme="totoro"] & {
    background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-primary) 100%);
  }
  
  [data-theme="howls-castle"] & {
    background: linear-gradient(90deg, var(--color-primary) 0%, rgba(255, 255, 255, 0.3) 50%, var(--color-primary) 100%);
  }
  
  [data-theme="kikis-delivery"] & {
    background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  }
}

/* Striped pattern */
.striped .progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 1rem 1rem;
}

.animated.striped .progress-fill::after {
  animation: progressStripes 1s linear infinite;
}

/* Progress indicator dot */
.progress-indicator {
  position: absolute;
  right: 4px;
  top: 50%;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid currentColor;
  border-radius: 50%;
  transform: translateY(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Buffer progress */
.progress-buffer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--color-gray-300, #d1d5db);
  border-radius: var(--progress-radius);
}

/* Progress label */
.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-gray-600, #6b7280);
}

.progress-text {
  font-weight: 500;
}

.progress-percentage {
  font-weight: 600;
  color: var(--color-gray-900, #111827);
}

/* Step indicators */
.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  gap: 0.5rem;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.step-clickable:hover .step-indicator {
    transform: scale(1.1);
  }
  
  &.step-current .step-indicator {
    background-color: var(--color-primary, #6366f1);
    color: white;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
  }
  
  &.step-completed .step-indicator {
    background-color: var(--color-accent, #10b981);
    color: white;
  }
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--step-size);
  height: var(--step-size);
  border-radius: 50%;
  background-color: var(--color-gray-200, #e5e7eb);
  color: var(--color-gray-600, #6b7280);
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.step-number {
  font-size: 0.75rem;
}

.step-label {
  font-size: 0.75rem;
  color: var(--color-gray-600, #6b7280);
  text-align: center;
  max-width: 80px;
  line-height: 1.2;
  
  .step-current & {
    color: var(--color-gray-900, #111827);
    font-weight: 500;
  }
  
  .step-completed & {
    color: var(--color-accent, #10b981);
  }
}

/* Animations */
@keyframes progressStripes {
  from {
    background-position: 1rem 0;
  }
  to {
    background-position: 0 0;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .progress-steps {
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .progress-step {
    min-width: calc(50% - 0.5rem);
  }
  
  .step-label {
    max-width: none;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none !important;
  }
  
  .animated.striped .progress-fill::after {
    animation: none !important;
  }
  
  .progress-step:hover .step-indicator {
    transform: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .progress-track {
    border: 1px solid #000000;
  }
  
  .progress-fill {
    border: 1px solid #ffffff;
  }
  
  .step-indicator {
    border: 2px solid #000000;
  }
}
</style>
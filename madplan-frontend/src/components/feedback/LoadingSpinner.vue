<template>
  <div 
    :class="containerClasses" 
    role="status" 
    :aria-label="accessibleLabel"
  >
    <!-- Ghibli-inspired loading animations -->
    <div v-if="variant === 'spirited'" class="spirited-loading">
      <div class="spirit-orb"></div>
      <div class="spirit-orb"></div>
      <div class="spirit-orb"></div>
    </div>
    
    <div v-else-if="variant === 'totoro'" class="totoro-loading">
      <div class="leaf leaf-1"></div>
      <div class="leaf leaf-2"></div>
      <div class="leaf leaf-3"></div>
    </div>
    
    <div v-else-if="variant === 'howls'" class="howls-loading">
      <div class="gear gear-outer"></div>
      <div class="gear gear-inner"></div>
    </div>
    
    <div v-else-if="variant === 'kikis'" class="kikis-loading">
      <div class="broom"></div>
    </div>
    
    <!-- Default spinner -->
    <div v-else class="default-spinner">
      <div class="spinner-ring"></div>
    </div>

    <!-- Loading message -->
    <div v-if="message" class="loading-message">
      {{ message }}
    </div>

    <!-- Progress indicator -->
    <div v-if="showProgress && progress !== undefined" class="progress-container">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${progress}%` }"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          role="progressbar"
        ></div>
      </div>
      <div class="progress-text">{{ progress }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';

interface Props {
  variant?: 'default' | 'spirited' | 'totoro' | 'howls' | 'kikis' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  progress?: number;
  showProgress?: boolean;
  overlay?: boolean;
  center?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'auto',
  size: 'md',
  showProgress: false,
  overlay: false,
  center: false,
});

const themeStore = useThemeStore();

// Auto-select variant based on current theme
const resolvedVariant = computed(() => {
  if (props.variant !== 'auto') return props.variant;
  
  const currentTheme = themeStore.currentTheme?.name || 'default';
  const themeMap: Record<string, string> = {
    'spirited-away': 'spirited',
    'totoro': 'totoro', 
    'howls-castle': 'howls',
    'kikis-delivery': 'kikis',
  };
  
  return themeMap[currentTheme] || 'default';
});

const containerClasses = computed(() => [
  'loading-spinner',
  `size-${props.size}`,
  `variant-${resolvedVariant.value}`,
  {
    'with-overlay': props.overlay,
    'center-absolute': props.center,
    'with-progress': props.showProgress,
  }
]);

const accessibleLabel = computed(() => {
  if (props.message) return `Loading: ${props.message}`;
  if (props.progress !== undefined) return `Loading: ${props.progress}% complete`;
  return 'Loading...';
});
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  
  &.with-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
    z-index: 9999;
  }
  
  &.center-absolute {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}

/* Size variants */
.size-sm {
  --spinner-size: 1.5rem;
  --message-size: 0.875rem;
}

.size-md {
  --spinner-size: 2rem;
  --message-size: 1rem;
}

.size-lg {
  --spinner-size: 3rem;
  --message-size: 1.125rem;
}

.size-xl {
  --spinner-size: 4rem;
  --message-size: 1.25rem;
}

/* Default spinner */
.default-spinner {
  width: var(--spinner-size);
  height: var(--spinner-size);
}

.spinner-ring {
  width: 100%;
  height: 100%;
  border: 2px solid var(--color-gray-200, #e5e7eb);
  border-top: 2px solid var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Spirited Away variant - floating orbs */
.spirited-loading {
  width: var(--spinner-size);
  height: var(--spinner-size);
  position: relative;
}

.spirit-orb {
  position: absolute;
  width: 25%;
  height: 25%;
  background: linear-gradient(135deg, var(--color-primary, #6B46C1), var(--color-secondary, #F59E0B));
  border-radius: 50%;
  animation: spiritFloat 2s ease-in-out infinite;
  
  &:nth-child(1) {
    top: 0;
    left: 37.5%;
    animation-delay: 0s;
  }
  
  &:nth-child(2) {
    top: 37.5%;
    right: 0;
    animation-delay: -0.7s;
  }
  
  &:nth-child(3) {
    bottom: 0;
    left: 0;
    animation-delay: -1.3s;
  }
}

/* Totoro variant - swaying leaves */
.totoro-loading {
  width: var(--spinner-size);
  height: var(--spinner-size);
  position: relative;
}

.leaf {
  position: absolute;
  width: 30%;
  height: 50%;
  background: var(--color-accent, #10B981);
  border-radius: 0 100% 0 100%;
  transform-origin: bottom center;
  animation: leafSway 1.5s ease-in-out infinite;
  
  &.leaf-1 {
    top: 10%;
    left: 35%;
    animation-delay: 0s;
  }
  
  &.leaf-2 {
    top: 30%;
    left: 50%;
    animation-delay: -0.5s;
  }
  
  &.leaf-3 {
    top: 50%;
    left: 20%;
    animation-delay: -1s;
  }
}

/* Howl's Castle variant - rotating gears */
.howls-loading {
  width: var(--spinner-size);
  height: var(--spinner-size);
  position: relative;
}

.gear {
  position: absolute;
  border: 2px solid var(--color-primary, #2563EB);
  border-radius: 50%;
  
  &::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0deg, var(--color-primary, #2563EB) 45deg, transparent 90deg);
  }
  
  &.gear-outer {
    width: 100%;
    height: 100%;
    animation: gearRotate 3s linear infinite;
  }
  
  &.gear-inner {
    width: 60%;
    height: 60%;
    top: 20%;
    left: 20%;
    animation: gearRotate 2s linear infinite reverse;
  }
}

/* Kiki's variant - flying broom */
.kikis-loading {
  width: var(--spinner-size);
  height: var(--spinner-size);
  position: relative;
}

.broom {
  width: 80%;
  height: 4px;
  background: linear-gradient(90deg, #8B4513 0%, #D2691E 50%, #8B4513 100%);
  border-radius: 2px;
  animation: broomFly 1.5s ease-in-out infinite;
  
  &::after {
    content: '';
    position: absolute;
    right: -10px;
    top: -6px;
    width: 0;
    height: 0;
    border-left: 20px solid var(--color-secondary, #EA580C);
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    filter: blur(1px);
  }
}

/* Loading message */
.loading-message {
  font-size: var(--message-size);
  color: var(--color-gray-600, #6b7280);
  text-align: center;
  font-weight: 500;
}

/* Progress indicator */
.progress-container {
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-gray-200, #e5e7eb);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary, #6366f1), var(--color-secondary, #f59e0b));
  border-radius: 2px;
  transition: width 0.3s ease-out;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--color-gray-600, #6b7280);
  text-align: center;
}

/* Animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes spiritFloat {
  0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
  50% { transform: translateY(-10px) scale(1.1); opacity: 0.8; }
}

@keyframes leafSway {
  0%, 100% { transform: rotate(-5deg) translateY(0); }
  50% { transform: rotate(5deg) translateY(-5px); }
}

@keyframes gearRotate {
  to { transform: rotate(360deg); }
}

@keyframes broomFly {
  0%, 100% { transform: translateX(-10px) rotate(-2deg); }
  50% { transform: translateX(10px) rotate(2deg); }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner * {
    animation-duration: 3s !important;
    animation-iteration-count: 1 !important;
  }
  
  .spirit-orb, .leaf, .broom {
    animation: none !important;
    opacity: 0.8;
  }
  
  .spinner-ring {
    animation: spin 3s linear infinite;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .loading-spinner {
    --color-primary: #000000;
    --color-secondary: #ffffff;
    --color-gray-600: #000000;
  }
  
  .loading-message {
    font-weight: 700;
  }
}
</style>
<template>
  <div 
    :class="containerClasses"
    role="status"
    aria-label="Loading content..."
  >
    <!-- Board skeleton -->
    <template v-if="variant === 'board'">
      <div class="board-skeleton">
        <div class="board-header-skeleton">
          <div class="skeleton-rect w-48 h-8"></div>
          <div class="skeleton-rect w-24 h-6"></div>
        </div>
        <div class="board-lists-skeleton">
          <div v-for="i in listCount" :key="`list-${i}`" class="list-skeleton">
            <div class="list-header-skeleton">
              <div class="skeleton-rect w-32 h-6"></div>
              <div class="skeleton-circle w-6 h-6"></div>
            </div>
            <div class="list-cards-skeleton">
              <div v-for="j in getCardCount(i)" :key="`card-${i}-${j}`" class="card-skeleton">
                <div class="skeleton-rect w-full h-4 mb-2"></div>
                <div class="skeleton-rect w-3/4 h-3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- List skeleton -->
    <template v-else-if="variant === 'list'">
      <div class="list-skeleton">
        <div class="list-header-skeleton">
          <div class="skeleton-rect w-32 h-6"></div>
          <div class="skeleton-circle w-6 h-6"></div>
        </div>
        <div class="list-cards-skeleton">
          <div v-for="i in cardCount" :key="`card-${i}`" class="card-skeleton">
            <div class="skeleton-rect w-full h-4 mb-2"></div>
            <div class="skeleton-rect w-2/3 h-3"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Card skeleton -->
    <template v-else-if="variant === 'card'">
      <div class="card-skeleton">
        <div class="skeleton-rect w-full h-4 mb-2"></div>
        <div class="skeleton-rect w-3/4 h-3 mb-2"></div>
        <div class="skeleton-rect w-1/2 h-3"></div>
      </div>
    </template>

    <!-- Dashboard skeleton -->
    <template v-else-if="variant === 'dashboard'">
      <div class="dashboard-skeleton">
        <div class="dashboard-header-skeleton">
          <div class="skeleton-rect w-64 h-10"></div>
          <div class="skeleton-rect w-32 h-8"></div>
        </div>
        <div class="dashboard-stats-skeleton">
          <div v-for="i in 4" :key="`stat-${i}`" class="stat-card-skeleton">
            <div class="skeleton-rect w-16 h-8 mb-2"></div>
            <div class="skeleton-rect w-24 h-4"></div>
          </div>
        </div>
        <div class="dashboard-boards-skeleton">
          <div v-for="i in 6" :key="`board-${i}`" class="board-card-skeleton">
            <div class="skeleton-rect w-full h-32 mb-3"></div>
            <div class="skeleton-rect w-full h-5 mb-2"></div>
            <div class="skeleton-rect w-2/3 h-4"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Text skeleton -->
    <template v-else-if="variant === 'text'">
      <div class="text-skeleton">
        <div v-for="i in lines" :key="`line-${i}`" class="text-line-skeleton">
          <div 
            class="skeleton-rect h-4" 
            :class="getTextLineWidth(i)"
          ></div>
        </div>
      </div>
    </template>

    <!-- Avatar skeleton -->
    <template v-else-if="variant === 'avatar'">
      <div class="avatar-skeleton">
        <div class="skeleton-circle w-10 h-10"></div>
        <div class="avatar-text-skeleton">
          <div class="skeleton-rect w-20 h-4 mb-1"></div>
          <div class="skeleton-rect w-16 h-3"></div>
        </div>
      </div>
    </template>

    <!-- Generic skeleton -->
    <template v-else>
      <div class="generic-skeleton">
        <div class="skeleton-rect w-full h-6 mb-4"></div>
        <div class="skeleton-rect w-3/4 h-4 mb-2"></div>
        <div class="skeleton-rect w-1/2 h-4"></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'board' | 'list' | 'card' | 'dashboard' | 'text' | 'avatar' | 'generic';
  listCount?: number;
  cardCount?: number;
  lines?: number;
  animated?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'generic',
  listCount: 3,
  cardCount: 3,
  lines: 3,
  animated: true,
  theme: 'auto',
});

const containerClasses = computed(() => [
  'skeleton-loader',
  `variant-${props.variant}`,
  `theme-${props.theme}`,
  {
    'animated': props.animated,
  }
]);

// Generate random card counts for more realistic board skeleton
const getCardCount = (listIndex: number): number => {
  const counts = [2, 4, 1, 3, 2, 5];
  return counts[listIndex - 1] || props.cardCount;
};

// Generate varying text line widths
const getTextLineWidth = (lineIndex: number): string => {
  const widths = ['w-full', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3', 'w-1/2'];
  return widths[lineIndex - 1] || 'w-3/4';
};
</script>

<style scoped>
.skeleton-loader {
  --skeleton-base: #f0f0f0;
  --skeleton-highlight: #ffffff;
  --skeleton-border-radius: 4px;
  
  &.theme-dark {
    --skeleton-base: #374151;
    --skeleton-highlight: #4b5563;
  }
  
  &.theme-auto {
    @media (prefers-color-scheme: dark) {
      --skeleton-base: #374151;
      --skeleton-highlight: #4b5563;
    }
  }
}

/* Base skeleton elements */
.skeleton-rect, .skeleton-circle {
  background: var(--skeleton-base);
  border-radius: var(--skeleton-border-radius);
  
  .animated & {
    background: linear-gradient(
      90deg,
      var(--skeleton-base) 0%,
      var(--skeleton-highlight) 50%,
      var(--skeleton-base) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
}

.skeleton-circle {
  border-radius: 50%;
}

/* Board skeleton */
.board-skeleton {
  width: 100%;
  padding: 1.5rem;
}

.board-header-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.board-lists-skeleton {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
}

.list-skeleton {
  min-width: 280px;
  max-width: 320px;
  background: var(--skeleton-highlight);
  border-radius: 8px;
  padding: 1rem;
}

.list-header-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.list-cards-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-skeleton {
  background: var(--skeleton-base);
  border-radius: 6px;
  padding: 0.75rem;
  min-height: 80px;
}

/* Dashboard skeleton */
.dashboard-skeleton {
  width: 100%;
  padding: 2rem;
}

.dashboard-header-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-stats-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 3rem;
}

.stat-card-skeleton {
  background: var(--skeleton-highlight);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.dashboard-boards-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.board-card-skeleton {
  background: var(--skeleton-highlight);
  border-radius: 8px;
  padding: 1rem;
}

/* Text skeleton */
.text-skeleton {
  width: 100%;
}

.text-line-skeleton {
  margin-bottom: 0.75rem;
  
  &:last-child {
    margin-bottom: 0;
  }
}

/* Avatar skeleton */
.avatar-skeleton {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar-text-skeleton {
  flex: 1;
}

/* Generic skeleton */
.generic-skeleton {
  width: 100%;
  padding: 1rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .board-lists-skeleton {
    flex-direction: column;
  }
  
  .list-skeleton {
    min-width: unset;
    max-width: unset;
  }
  
  .dashboard-stats-skeleton {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .dashboard-boards-skeleton {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .dashboard-stats-skeleton {
    grid-template-columns: 1fr;
  }
  
  .board-skeleton,
  .dashboard-skeleton {
    padding: 1rem;
  }
}

/* Shimmer animation */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .skeleton-rect, .skeleton-circle {
    animation: none !important;
    background: var(--skeleton-base) !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .skeleton-loader {
    --skeleton-base: #000000;
    --skeleton-highlight: #ffffff;
  }
  
  .skeleton-rect, .skeleton-circle {
    border: 1px solid #666666;
  }
}

/* Utilities for width classes */
.w-1\/2 { width: 50%; }
.w-2\/3 { width: 66.666667%; }
.w-3\/4 { width: 75%; }
.w-4\/5 { width: 80%; }
.w-5\/6 { width: 83.333333%; }
.w-full { width: 100%; }
.w-16 { width: 4rem; }
.w-20 { width: 5rem; }
.w-24 { width: 6rem; }
.w-32 { width: 8rem; }
.w-48 { width: 12rem; }
.w-64 { width: 16rem; }

.h-3 { height: 0.75rem; }
.h-4 { height: 1rem; }
.h-5 { height: 1.25rem; }
.h-6 { height: 1.5rem; }
.h-8 { height: 2rem; }
.h-10 { height: 2.5rem; }
.h-32 { height: 8rem; }

.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
</style>
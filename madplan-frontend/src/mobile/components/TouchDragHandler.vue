<template>
  <div 
    ref="dragContainer"
    class="touch-drag-container"
    :class="{ 
      'drag-active': isDragging,
      'drag-over': isDragOver,
      'drag-disabled': disabled 
    }"
  >
    <!-- Drag Preview -->
    <div 
      v-if="isDragging && dragPreview"
      ref="dragPreview"
      class="drag-preview"
      :style="dragPreviewStyle"
    >
      <slot name="preview" :item="draggedItem">
        <div class="default-preview">
          {{ draggedItem?.title || 'Dragging item...' }}
        </div>
      </slot>
    </div>

    <!-- Auto-scroll indicators -->
    <div 
      v-if="isDragging && autoScroll.active"
      class="auto-scroll-indicator"
      :class="autoScroll.direction"
    >
      <Icon :name="autoScrollIcon" size="24" />
    </div>

    <!-- Drop zones -->
    <div 
      v-for="zone in dropZones"
      :key="zone.id"
      ref="dropZones"
      class="drop-zone"
      :class="{ 
        'drop-zone-active': zone.isActive,
        'drop-zone-valid': zone.isValid,
        'drop-zone-invalid': !zone.isValid && zone.isActive
      }"
      :style="zone.style"
      :data-zone-id="zone.id"
    >
      <div class="drop-zone-content">
        <Icon name="target" size="32" />
        <span>{{ zone.label }}</span>
      </div>
    </div>

    <!-- Slot content -->
    <slot 
      :is-dragging="isDragging"
      :drag-item="draggedItem"
      :register-draggable="registerDraggable"
      :register-drop-zone="registerDropZone"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useTouchGestures } from '../services/touchGestures';
import { useHapticFeedback } from '../services/hapticFeedback';
import Icon from '@/components/common/Icon.vue';

interface DragItem {
  id: string | number;
  title: string;
  type: string;
  data: any;
  element: HTMLElement;
}

interface DropZone {
  id: string | number;
  label: string;
  accepts: string[];
  isActive: boolean;
  isValid: boolean;
  element: HTMLElement;
  style?: Record<string, string>;
}

interface DragState {
  item: DragItem | null;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  offset: { x: number; y: number };
  isActive: boolean;
}

interface AutoScrollState {
  active: boolean;
  direction: 'up' | 'down' | 'left' | 'right' | null;
  speed: number;
  zone: 'top' | 'bottom' | 'left' | 'right' | null;
}

const props = defineProps<{
  disabled?: boolean;
  dragPreview?: boolean;
  autoScroll?: boolean;
  scrollThreshold?: number;
  scrollSpeed?: number;
  hapticFeedback?: boolean;
}>();

const emit = defineEmits<{
  'drag-start': [item: DragItem, event: Event];
  'drag-move': [item: DragItem, position: { x: number; y: number }];
  'drag-end': [item: DragItem, dropZone?: DropZone];
  'drop': [item: DragItem, dropZone: DropZone];
  'drag-cancel': [item: DragItem];
}>();

// Refs
const dragContainer = ref<HTMLElement>();
const dragPreview = ref<HTMLElement>();
const dropZones = ref<HTMLElement[]>([]);

// Services
const { registerGesture, unregisterGesture } = useTouchGestures();
const { trigger: triggerHaptic } = useHapticFeedback();

// State
const dragState = reactive<DragState>({
  item: null,
  startPosition: { x: 0, y: 0 },
  currentPosition: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  isActive: false
});

const autoScroll = reactive<AutoScrollState>({
  active: false,
  direction: null,
  speed: props.scrollSpeed || 2,
  zone: null
});

const registeredDraggables = new Map<HTMLElement, DragItem>();
const registeredDropZones = new Map<HTMLElement, DropZone>();

// Computed properties
const isDragging = computed(() => dragState.isActive);
const isDragOver = computed(() => dropZones.value.some(zone => 
  registeredDropZones.get(zone)?.isActive
));
const draggedItem = computed(() => dragState.item);

const dragPreviewStyle = computed(() => ({
  transform: `translate(${dragState.currentPosition.x - dragState.offset.x}px, ${dragState.currentPosition.y - dragState.offset.y}px)`,
  pointerEvents: 'none',
  position: 'fixed',
  zIndex: '1000',
  opacity: isDragging.value ? '0.8' : '0'
}));

const autoScrollIcon = computed(() => {
  switch (autoScroll.direction) {
    case 'up': return 'arrow-up';
    case 'down': return 'arrow-down';
    case 'left': return 'arrow-left';
    case 'right': return 'arrow-right';
    default: return 'move';
  }
});

// Methods
const registerDraggable = (
  element: HTMLElement,
  item: Omit<DragItem, 'element'>
): void => {
  if (props.disabled) return;

  const dragItem: DragItem = { ...item, element };
  registeredDraggables.set(element, dragItem);

  // Register touch gestures
  registerGesture(element, 'longpress', (event) => {
    handleDragStart(dragItem, event.point, element);
  }, { threshold: 300 });

  registerGesture(element, 'drag', (event) => {
    if (dragState.isActive && dragState.item?.id === dragItem.id) {
      handleDragMove(event.currentPoint);
    }
  });

  // Add visual feedback classes
  element.classList.add('draggable');
};

const registerDropZone = (
  element: HTMLElement,
  zone: Omit<DropZone, 'element' | 'isActive' | 'isValid'>
): void => {
  if (props.disabled) return;

  const dropZone: DropZone = {
    ...zone,
    element,
    isActive: false,
    isValid: false
  };
  
  registeredDropZones.set(element, dropZone);
  element.classList.add('drop-zone');
};

const handleDragStart = (
  item: DragItem, 
  startPoint: { x: number; y: number },
  element: HTMLElement
): void => {
  if (props.disabled || dragState.isActive) return;

  // Calculate offset from touch point to element center
  const rect = element.getBoundingClientRect();
  const offset = {
    x: startPoint.x - rect.left,
    y: startPoint.y - rect.top
  };

  // Update drag state
  dragState.item = item;
  dragState.startPosition = startPoint;
  dragState.currentPosition = startPoint;
  dragState.offset = offset;
  dragState.isActive = true;

  // Add dragging class to element
  element.classList.add('dragging');

  // Trigger haptic feedback
  if (props.hapticFeedback) {
    triggerHaptic('drag');
  }

  // Emit drag start event
  emit('drag-start', item, new Event('dragstart'));

  // Start auto-scroll if enabled
  if (props.autoScroll) {
    startAutoScroll();
  }

  // Update drop zones
  updateDropZones(startPoint);
};

const handleDragMove = (currentPoint: { x: number; y: number }): void => {
  if (!dragState.isActive || !dragState.item) return;

  // Update current position
  dragState.currentPosition = currentPoint;

  // Update drop zones
  updateDropZones(currentPoint);

  // Handle auto-scroll
  if (props.autoScroll) {
    handleAutoScroll(currentPoint);
  }

  // Emit drag move event
  emit('drag-move', dragState.item, currentPoint);
};

const handleDragEnd = (endPoint?: { x: number; y: number }): void => {
  if (!dragState.isActive || !dragState.item) return;

  const draggedItem = dragState.item;
  const finalPosition = endPoint || dragState.currentPosition;

  // Find active drop zone
  const activeDropZone = Array.from(registeredDropZones.values())
    .find(zone => zone.isActive && zone.isValid);

  // Clean up drag state
  cleanupDragState();

  // Stop auto-scroll
  stopAutoScroll();

  // Trigger haptic feedback
  if (props.hapticFeedback) {
    if (activeDropZone) {
      triggerHaptic('success');
    } else {
      triggerHaptic('impact');
    }
  }

  // Emit events
  if (activeDropZone) {
    emit('drop', draggedItem, activeDropZone);
  }
  
  emit('drag-end', draggedItem, activeDropZone);
};

const handleDragCancel = (): void => {
  if (!dragState.isActive || !dragState.item) return;

  const draggedItem = dragState.item;

  // Clean up drag state
  cleanupDragState();

  // Stop auto-scroll
  stopAutoScroll();

  // Trigger haptic feedback
  if (props.hapticFeedback) {
    triggerHaptic('error');
  }

  // Emit cancel event
  emit('drag-cancel', draggedItem);
};

const cleanupDragState = (): void => {
  if (dragState.item) {
    dragState.item.element.classList.remove('dragging');
  }

  // Reset drop zones
  registeredDropZones.forEach(zone => {
    zone.isActive = false;
    zone.isValid = false;
    zone.element.classList.remove('drop-zone-active', 'drop-zone-valid', 'drop-zone-invalid');
  });

  // Reset drag state
  dragState.item = null;
  dragState.isActive = false;
  dragState.startPosition = { x: 0, y: 0 };
  dragState.currentPosition = { x: 0, y: 0 };
  dragState.offset = { x: 0, y: 0 };
};

const updateDropZones = (point: { x: number; y: number }): void => {
  if (!dragState.item) return;

  registeredDropZones.forEach(zone => {
    const rect = zone.element.getBoundingClientRect();
    const isOver = point.x >= rect.left && 
                   point.x <= rect.right && 
                   point.y >= rect.top && 
                   point.y <= rect.bottom;

    const wasActive = zone.isActive;
    zone.isActive = isOver;
    zone.isValid = isOver && zone.accepts.includes(dragState.item!.type);

    // Update CSS classes
    zone.element.classList.toggle('drop-zone-active', zone.isActive);
    zone.element.classList.toggle('drop-zone-valid', zone.isValid);
    zone.element.classList.toggle('drop-zone-invalid', zone.isActive && !zone.isValid);

    // Trigger haptic feedback on zone enter
    if (props.hapticFeedback && zone.isActive && !wasActive) {
      triggerHaptic('selection');
    }
  });
};

const startAutoScroll = (): void => {
  if (!props.autoScroll) return;
  
  autoScroll.active = true;
  requestAnimationFrame(autoScrollTick);
};

const stopAutoScroll = (): void => {
  autoScroll.active = false;
  autoScroll.direction = null;
  autoScroll.zone = null;
};

const handleAutoScroll = (point: { x: number; y: number }): void => {
  if (!props.autoScroll || !dragContainer.value) return;

  const threshold = props.scrollThreshold || 50;
  const rect = dragContainer.value.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Reset scroll state
  autoScroll.direction = null;
  autoScroll.zone = null;

  // Check vertical scroll zones
  if (point.y < rect.top + threshold) {
    autoScroll.direction = 'up';
    autoScroll.zone = 'top';
  } else if (point.y > viewportHeight - threshold) {
    autoScroll.direction = 'down';
    autoScroll.zone = 'bottom';
  }

  // Check horizontal scroll zones  
  if (point.x < rect.left + threshold) {
    autoScroll.direction = 'left';
    autoScroll.zone = 'left';
  } else if (point.x > viewportWidth - threshold) {
    autoScroll.direction = 'right';
    autoScroll.zone = 'right';
  }
};

const autoScrollTick = (): void => {
  if (!autoScroll.active || !autoScroll.direction) {
    requestAnimationFrame(autoScrollTick);
    return;
  }

  const scrollContainer = dragContainer.value?.closest('.scrollable') as HTMLElement || window;
  const speed = autoScroll.speed;

  switch (autoScroll.direction) {
    case 'up':
      if (scrollContainer === window) {
        window.scrollBy(0, -speed);
      } else {
        scrollContainer.scrollTop -= speed;
      }
      break;
    case 'down':
      if (scrollContainer === window) {
        window.scrollBy(0, speed);
      } else {
        scrollContainer.scrollTop += speed;
      }
      break;
    case 'left':
      if (scrollContainer === window) {
        window.scrollBy(-speed, 0);
      } else {
        scrollContainer.scrollLeft -= speed;
      }
      break;
    case 'right':
      if (scrollContainer === window) {
        window.scrollBy(speed, 0);
      } else {
        scrollContainer.scrollLeft += speed;
      }
      break;
  }

  requestAnimationFrame(autoScrollTick);
};

// Lifecycle
onMounted(() => {
  if (!dragContainer.value) return;

  // Register global touch end listener
  document.addEventListener('touchend', (event) => {
    if (dragState.isActive) {
      const touch = event.changedTouches[0];
      if (touch) {
        handleDragEnd({ x: touch.clientX, y: touch.clientY });
      }
    }
  }, { passive: true });

  // Register global touch cancel listener
  document.addEventListener('touchcancel', () => {
    if (dragState.isActive) {
      handleDragCancel();
    }
  }, { passive: true });

  // Register escape key listener
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dragState.isActive) {
      handleDragCancel();
    }
  });
});

onUnmounted(() => {
  // Clean up all registered elements
  registeredDraggables.forEach((item, element) => {
    unregisterGesture(element);
  });

  registeredDraggables.clear();
  registeredDropZones.clear();

  // Stop auto-scroll
  stopAutoScroll();
});

// Expose methods for parent components
defineExpose({
  registerDraggable,
  registerDropZone,
  cancelDrag: handleDragCancel
});
</script>

<style scoped lang="scss">
@import '@/styles/mobile/breakpoints.scss';
@import '@/styles/mobile/touch-targets.scss';

.touch-drag-container {
  position: relative;
  width: 100%;
  height: 100%;
  
  &.drag-active {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    
    // Prevent scrolling during drag
    overflow: hidden;
    touch-action: none;
  }
  
  &.drag-disabled {
    pointer-events: none;
    opacity: 0.6;
  }
}

// Draggable elements
:deep(.draggable) {
  touch-action: manipulation;
  cursor: grab;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:active {
    cursor: grabbing;
  }
  
  &.dragging {
    opacity: 0.8;
    transform: scale(1.05);
    box-shadow: var(--mobile-shadow-xl);
    z-index: 999;
    
    // Disable pointer events while dragging
    pointer-events: none;
  }
}

// Drag preview
.drag-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  opacity: 0.9;
  transform-origin: top left;
  transition: opacity 0.2s ease;
  
  .default-preview {
    background: var(--primary-color);
    color: white;
    padding: var(--mobile-spacing-sm) var(--mobile-spacing-md);
    border-radius: var(--mobile-radius-md);
    font-size: var(--mobile-font-size-sm);
    font-weight: 600;
    box-shadow: var(--mobile-shadow-lg);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// Drop zones
:deep(.drop-zone) {
  position: relative;
  transition: all 0.3s ease;
  border: 2px dashed transparent;
  border-radius: var(--mobile-radius-lg);
  min-height: var(--touch-target-large);
  
  &.drop-zone-active {
    border-color: var(--primary-color);
    background-color: rgba(107, 70, 193, 0.05);
    
    &::after {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border: 2px solid var(--primary-color);
      border-radius: var(--mobile-radius-lg);
      animation: pulse 1.5s infinite;
      pointer-events: none;
    }
  }
  
  &.drop-zone-valid {
    border-color: var(--success-color);
    background-color: rgba(34, 197, 94, 0.05);
    
    &::after {
      border-color: var(--success-color);
    }
  }
  
  &.drop-zone-invalid {
    border-color: var(--danger-color);
    background-color: rgba(239, 68, 68, 0.05);
    
    &::after {
      border-color: var(--danger-color);
    }
  }
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--mobile-spacing-sm);
  padding: var(--mobile-spacing-lg);
  color: var(--text-secondary);
  font-size: var(--mobile-font-size-sm);
  font-weight: 500;
  text-align: center;
  opacity: 0;
  transform: scale(0.9);
  transition: all 0.3s ease;
  
  .drop-zone-active & {
    opacity: 1;
    transform: scale(1);
  }
}

// Auto-scroll indicator
.auto-scroll-indicator {
  position: fixed;
  z-index: 1001;
  background: var(--primary-color);
  color: white;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--mobile-shadow-lg);
  animation: pulse 1s infinite;
  
  &.up {
    top: var(--mobile-spacing-lg);
    left: 50%;
    transform: translateX(-50%);
  }
  
  &.down {
    bottom: var(--mobile-spacing-lg);
    left: 50%;
    transform: translateX(-50%);
  }
  
  &.left {
    left: var(--mobile-spacing-lg);
    top: 50%;
    transform: translateY(-50%);
  }
  
  &.right {
    right: var(--mobile-spacing-lg);
    top: 50%;
    transform: translateY(-50%);
  }
}

// Animations
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .drag-preview,
  :deep(.draggable),
  :deep(.drop-zone),
  .drop-zone-content,
  .auto-scroll-indicator {
    transition: none !important;
    animation: none !important;
  }
  
  .auto-scroll-indicator {
    animation: none !important;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
  }
}

// High contrast mode
@media (prefers-contrast: high) {
  :deep(.drop-zone) {
    &.drop-zone-active {
      border-width: 3px;
    }
  }
  
  .drag-preview .default-preview {
    border: 2px solid var(--text-primary);
  }
  
  .auto-scroll-indicator {
    border: 2px solid white;
  }
}
</style>
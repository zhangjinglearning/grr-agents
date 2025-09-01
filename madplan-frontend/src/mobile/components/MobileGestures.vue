<template>
  <div 
    ref="gestureContainer"
    class="mobile-gestures-container"
    :class="{ 'gestures-active': hasActiveGestures }"
  >
    <!-- Voice Search Integration -->
    <div v-if="showVoiceSearch" class="voice-search-overlay">
      <div class="voice-search-modal">
        <div class="voice-animation" :class="{ active: isListening }">
          <div class="voice-wave"></div>
          <div class="voice-wave"></div>
          <div class="voice-wave"></div>
        </div>
        
        <div class="voice-status">
          <h3>{{ voiceStatus.title }}</h3>
          <p>{{ voiceStatus.message }}</p>
        </div>
        
        <div class="voice-actions">
          <button
            v-if="!isListening && !isProcessing"
            class="btn btn-primary voice-btn"
            @click="startVoiceSearch"
            aria-label="Start voice search"
          >
            <Icon name="mic" size="24" />
            <span>Start Speaking</span>
          </button>
          
          <button
            v-if="isListening"
            class="btn btn-secondary voice-btn"
            @click="stopVoiceSearch"
            aria-label="Stop voice search"
          >
            <Icon name="mic-off" size="24" />
            <span>Stop</span>
          </button>
          
          <button
            class="btn btn-outline voice-btn"
            @click="closeVoiceSearch"
            aria-label="Close voice search"
          >
            <Icon name="x" size="24" />
            <span>Cancel</span>
          </button>
        </div>
        
        <div v-if="voiceResults.length > 0" class="voice-results">
          <h4>Voice Search Results</h4>
          <div class="results-list">
            <div
              v-for="(result, index) in voiceResults"
              :key="index"
              class="result-item"
              @click="selectVoiceResult(result)"
            >
              <Icon :name="result.icon" size="20" />
              <div class="result-content">
                <div class="result-title">{{ result.title }}</div>
                <div class="result-description">{{ result.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Camera Integration Modal -->
    <div v-if="showCamera" class="camera-overlay">
      <div class="camera-modal">
        <div class="camera-header">
          <h3>{{ cameraMode === 'photo' ? 'Take Photo' : 'Scan Document' }}</h3>
          <button
            class="btn-close"
            @click="closeCamera"
            aria-label="Close camera"
          >
            <Icon name="x" size="24" />
          </button>
        </div>
        
        <div class="camera-viewport">
          <video
            ref="videoElement"
            class="camera-feed"
            autoplay
            playsinline
            :class="{ 'scanning': isScanning }"
          ></video>
          
          <canvas
            ref="canvasElement"
            class="camera-canvas"
            style="display: none;"
          ></canvas>
          
          <!-- Camera overlay guides -->
          <div class="camera-guides" v-if="cameraMode === 'document'">
            <div class="guide-frame"></div>
            <div class="guide-corners">
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>
            </div>
          </div>
        </div>
        
        <div class="camera-controls">
          <button
            class="btn btn-outline mode-btn"
            @click="toggleCameraMode"
            aria-label="Switch camera mode"
          >
            <Icon :name="cameraMode === 'photo' ? 'scan' : 'camera'" size="20" />
            <span>{{ cameraMode === 'photo' ? 'Scan' : 'Photo' }}</span>
          </button>
          
          <button
            class="btn btn-primary capture-btn"
            @click="captureImage"
            :disabled="isCapturing"
            aria-label="Capture image"
          >
            <div class="capture-ring">
              <div class="capture-inner"></div>
            </div>
          </button>
          
          <button
            class="btn btn-outline flip-btn"
            @click="flipCamera"
            aria-label="Flip camera"
          >
            <Icon name="rotate-ccw" size="20" />
          </button>
        </div>
      </div>
    </div>

    <!-- Gesture Feedback -->
    <div
      v-if="gesturefeedback.visible"
      class="gesture-feedback"
      :class="gesturefeedback.type"
    >
      <Icon :name="gesturefeedback.icon" size="32" />
      <span>{{ gestureFeedback.message }}</span>
    </div>

    <!-- Swipe Action Indicators -->
    <div
      v-for="action in activeSwipeActions"
      :key="action.id"
      class="swipe-action-indicator"
      :class="action.direction"
      :style="action.style"
    >
      <Icon :name="action.icon" size="20" />
      <span>{{ action.label }}</span>
    </div>

    <!-- Slot content -->
    <slot
      :voice-search="openVoiceSearch"
      :camera="openCamera"
      :gesture-enabled="hasActiveGestures"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useTouchGestures } from '../services/touchGestures';
import { useHapticFeedback } from '../services/hapticFeedback';
import Icon from '@/components/common/Icon.vue';

interface VoiceResult {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: string;
  data: any;
}

interface GestureFeedback {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  icon: string;
  message: string;
}

interface SwipeAction {
  id: string;
  direction: 'left' | 'right' | 'up' | 'down';
  icon: string;
  label: string;
  style: Record<string, string>;
}

const props = defineProps<{
  voiceSearchEnabled?: boolean;
  cameraEnabled?: boolean;
  gesturesEnabled?: boolean;
}>();

const emit = defineEmits<{
  'voice-result': [query: string, results: VoiceResult[]];
  'camera-capture': [imageData: string, mode: string];
  'gesture-action': [action: string, data: any];
  'swipe-action': [direction: string, target: HTMLElement];
}>();

// Refs
const gestureContainer = ref<HTMLElement>();
const videoElement = ref<HTMLVideoElement>();
const canvasElement = ref<HTMLCanvasElement>();

// Services
const { registerGesture, unregisterGesture } = useTouchGestures();
const { trigger: triggerHaptic } = useHapticFeedback();

// State
const showVoiceSearch = ref(false);
const showCamera = ref(false);
const isListening = ref(false);
const isProcessing = ref(false);
const isScanning = ref(false);
const isCapturing = ref(false);
const currentStream = ref<MediaStream | null>(null);
const facingMode = ref<'user' | 'environment'>('environment');
const cameraMode = ref<'photo' | 'document'>('photo');

const voiceResults = ref<VoiceResult[]>([]);
const activeSwipeActions = ref<SwipeAction[]>([]);

const gestureState = reactive({
  hasActiveSwipe: false,
  hasActivePinch: false,
  hasActiveDrag: false
});

const gestureCallback = reactive<GestureFeedback>({
  visible: false,
  type: 'info',
  icon: 'info',
  message: ''
});

// Speech recognition
let recognition: SpeechRecognition | null = null;

// Computed properties
const hasActiveGestures = computed(() => 
  gestureState.hasActiveSwipe || 
  gestureState.hasActivePinch || 
  gestureState.hasActiveDrag
);

const voiceStatus = computed(() => {
  if (isProcessing.value) {
    return {
      title: 'Processing...',
      message: 'Analyzing your voice input'
    };
  } else if (isListening.value) {
    return {
      title: 'Listening...',
      message: 'Speak now to search boards and cards'
    };
  } else {
    return {
      title: 'Voice Search',
      message: 'Tap the microphone to start voice search'
    };
  }
});

// Voice Search Methods
const openVoiceSearch = (): void => {
  if (!props.voiceSearchEnabled) return;
  
  showVoiceSearch.value = true;
  triggerHaptic('selection');
};

const closeVoiceSearch = (): void => {
  if (isListening.value) {
    stopVoiceSearch();
  }
  showVoiceSearch.value = false;
  voiceResults.value = [];
};

const startVoiceSearch = async (): Promise<void> => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    showGestureFeedback('error', 'mic-off', 'Voice search not supported');
    return;
  }

  try {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                            (window as any).webkitSpeechRecognition;
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening.value = true;
      triggerHaptic('selection');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const query = lastResult[0].transcript;
        processVoiceQuery(query);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      isListening.value = false;
      showGestureFeedback('error', 'alert-circle', 'Voice recognition failed');
    };

    recognition.onend = () => {
      isListening.value = false;
    };

    recognition.start();
  } catch (error) {
    console.error('Failed to start voice recognition:', error);
    showGestureFeedback('error', 'mic-off', 'Could not start voice search');
  }
};

const stopVoiceSearch = (): void => {
  if (recognition) {
    recognition.stop();
  }
  isListening.value = false;
};

const processVoiceQuery = async (query: string): Promise<void> => {
  isProcessing.value = true;
  
  try {
    // Simulate API call to process voice query
    const response = await fetch('/api/search/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const results = await response.json();
    voiceResults.value = results;
    
    emit('voice-result', query, results);
    triggerHaptic('success');
    
  } catch (error) {
    console.error('Voice query processing failed:', error);
    showGestureFeedback('error', 'search', 'Search failed');
  } finally {
    isProcessing.value = false;
  }
};

const selectVoiceResult = (result: VoiceResult): void => {
  triggerHaptic('selection');
  emit('gesture-action', 'voice-select', result);
  closeVoiceSearch();
};

// Camera Methods
const openCamera = (mode: 'photo' | 'document' = 'photo'): void => {
  if (!props.cameraEnabled) return;
  
  cameraMode.value = mode;
  showCamera.value = true;
  initializeCamera();
  triggerHaptic('selection');
};

const closeCamera = (): void => {
  stopCamera();
  showCamera.value = false;
};

const initializeCamera = async (): Promise<void> => {
  try {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facingMode.value,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    currentStream.value = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (videoElement.value) {
      videoElement.value.srcObject = currentStream.value;
    }
    
  } catch (error) {
    console.error('Failed to initialize camera:', error);
    showGestureFeedback('error', 'camera-off', 'Camera not available');
  }
};

const stopCamera = (): void => {
  if (currentStream.value) {
    currentStream.value.getTracks().forEach(track => track.stop());
    currentStream.value = null;
  }
};

const flipCamera = async (): Promise<void> => {
  stopCamera();
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user';
  await initializeCamera();
  triggerHaptic('impact');
};

const toggleCameraMode = (): void => {
  cameraMode.value = cameraMode.value === 'photo' ? 'document' : 'photo';
  triggerHaptic('selection');
};

const captureImage = async (): Promise<void> => {
  if (!videoElement.value || !canvasElement.value || isCapturing.value) return;
  
  isCapturing.value = true;
  
  try {
    const video = videoElement.value;
    const canvas = canvasElement.value;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0);
    
    // Apply processing based on camera mode
    if (cameraMode.value === 'document') {
      await enhanceDocumentImage(context, canvas);
    }
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    emit('camera-capture', imageData, cameraMode.value);
    triggerHaptic('success');
    
    // Show capture feedback
    showGestureFeedback('success', 'camera', 'Image captured successfully');
    
  } catch (error) {
    console.error('Image capture failed:', error);
    showGestureFeedback('error', 'camera', 'Capture failed');
  } finally {
    isCapturing.value = false;
  }
};

const enhanceDocumentImage = async (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): Promise<void> => {
  // Apply basic document enhancement
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Increase contrast for document scanning
  const contrast = 1.2;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;     // Red
    data[i + 1] = factor * (data[i + 1] - 128) + 128; // Green
    data[i + 2] = factor * (data[i + 2] - 128) + 128; // Blue
  }
  
  context.putImageData(imageData, 0, 0);
};

// Gesture Methods
const setupGestures = (): void => {
  if (!gestureContainer.value || !props.gesturesEnabled) return;

  const container = gestureContainer.value;

  // Swipe gestures
  registerGesture(container, 'swipe', (event) => {
    handleSwipeGesture(event, container);
  });

  // Long press gestures
  registerGesture(container, 'longpress', (event) => {
    handleLongPressGesture(event, container);
  });

  // Pinch gestures
  registerGesture(container, 'pinch', (event) => {
    handlePinchGesture(event, container);
  });

  // Double tap gestures
  registerGesture(container, 'doubletap', (event) => {
    handleDoubleTapGesture(event, container);
  });
};

const handleSwipeGesture = (event: any, container: HTMLElement): void => {
  const { direction, velocity } = event;
  
  gestureState.hasActiveSwipe = true;
  
  // Show swipe action indicator
  showSwipeAction(direction, event.endPoint);
  
  // Trigger haptic feedback
  triggerHaptic('swipe');
  
  // Emit swipe action
  emit('swipe-action', direction, container);
  
  setTimeout(() => {
    gestureState.hasActiveSwipe = false;
  }, 300);
};

const handleLongPressGesture = (event: any, container: HTMLElement): void => {
  triggerHaptic('longpress');
  showGestureFeedback('info', 'hand', 'Long press detected');
  emit('gesture-action', 'longpress', event);
};

const handlePinchGesture = (event: any, container: HTMLElement): void => {
  gestureState.hasActivePinch = true;
  
  const action = event.scale > 1 ? 'zoom-in' : 'zoom-out';
  emit('gesture-action', 'pinch', { action, scale: event.scale });
  
  setTimeout(() => {
    gestureState.hasActivePinch = false;
  }, 100);
};

const handleDoubleTapGesture = (event: any, container: HTMLElement): void => {
  triggerHaptic('tap');
  showGestureFeedback('success', 'zap', 'Double tap');
  emit('gesture-action', 'doubletap', event);
};

const showSwipeAction = (direction: string, point: { x: number; y: number }): void => {
  const action: SwipeAction = {
    id: Date.now().toString(),
    direction: direction as SwipeAction['direction'],
    icon: getSwipeIcon(direction),
    label: getSwipeLabel(direction),
    style: {
      left: `${point.x}px`,
      top: `${point.y}px`
    }
  };
  
  activeSwipeActions.value.push(action);
  
  setTimeout(() => {
    const index = activeSwipeActions.value.findIndex(a => a.id === action.id);
    if (index !== -1) {
      activeSwipeActions.value.splice(index, 1);
    }
  }, 1000);
};

const getSwipeIcon = (direction: string): string => {
  const icons = {
    left: 'arrow-left',
    right: 'arrow-right',
    up: 'arrow-up',
    down: 'arrow-down'
  };
  return icons[direction as keyof typeof icons] || 'move';
};

const getSwipeLabel = (direction: string): string => {
  const labels = {
    left: 'Swipe Left',
    right: 'Swipe Right',
    up: 'Swipe Up',
    down: 'Swipe Down'
  };
  return labels[direction as keyof typeof labels] || 'Swipe';
};

const showGestureFeedback = (type: GestureFeedback['type'], icon: string, message: string): void => {
  gestureCallback.type = type;
  gestureCallback.icon = icon;
  gestureCallback.message = message;
  gestureCallback.visible = true;
  
  setTimeout(() => {
    gestureCallback.visible = false;
  }, 2000);
};

// Lifecycle
onMounted(() => {
  setupGestures();
});

onUnmounted(() => {
  if (gestureContainer.value) {
    unregisterGesture(gestureContainer.value);
  }
  
  if (recognition) {
    recognition.stop();
  }
  
  stopCamera();
});

// Expose methods
defineExpose({
  openVoiceSearch,
  closeVoiceSearch,
  openCamera,
  closeCamera
});
</script>

<style scoped lang="scss">
@import '@/styles/mobile/breakpoints.scss';
@import '@/styles/mobile/touch-targets.scss';

.mobile-gestures-container {
  position: relative;
  width: 100%;
  height: 100%;
  
  &.gestures-active {
    touch-action: none;
  }
}

// Voice Search Overlay
.voice-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--mobile-spacing-lg);

  .voice-search-modal {
    background: var(--bg-primary);
    border-radius: var(--mobile-radius-2xl);
    padding: var(--mobile-spacing-2xl);
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: var(--mobile-shadow-xl);
  }

  .voice-animation {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--mobile-spacing-xs);
    height: 80px;
    margin-bottom: var(--mobile-spacing-lg);

    .voice-wave {
      width: 4px;
      height: 20px;
      background: var(--primary-color);
      border-radius: 2px;
      animation: none;

      &:nth-child(2) {
        animation-delay: 0.1s;
      }

      &:nth-child(3) {
        animation-delay: 0.2s;
      }
    }

    &.active .voice-wave {
      animation: voiceWave 1.5s infinite ease-in-out;
    }
  }

  .voice-status {
    margin-bottom: var(--mobile-spacing-xl);

    h3 {
      margin-bottom: var(--mobile-spacing-sm);
      color: var(--text-primary);
    }

    p {
      color: var(--text-secondary);
      font-size: var(--mobile-font-size-sm);
    }
  }

  .voice-actions {
    display: flex;
    gap: var(--mobile-spacing-md);
    justify-content: center;
    margin-bottom: var(--mobile-spacing-xl);

    .voice-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mobile-spacing-xs);
      min-width: 80px;
    }
  }

  .voice-results {
    text-align: left;

    h4 {
      margin-bottom: var(--mobile-spacing-md);
      font-size: var(--mobile-font-size-lg);
    }

    .results-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: var(--mobile-spacing-md);
      padding: var(--mobile-spacing-md);
      border-radius: var(--mobile-radius-md);
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background: var(--bg-secondary);
      }

      .result-content {
        flex: 1;

        .result-title {
          font-weight: 600;
          margin-bottom: var(--mobile-spacing-xs);
        }

        .result-description {
          font-size: var(--mobile-font-size-sm);
          color: var(--text-secondary);
        }
      }
    }
  }
}

// Camera Overlay
.camera-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: black;
  z-index: 1000;

  .camera-modal {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .camera-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--mobile-spacing-lg);
    background: rgba(0, 0, 0, 0.8);
    color: white;

    .btn-close {
      background: transparent;
      border: none;
      color: white;
      padding: var(--mobile-spacing-sm);
    }
  }

  .camera-viewport {
    flex: 1;
    position: relative;
    overflow: hidden;

    .camera-feed {
      width: 100%;
      height: 100%;
      object-fit: cover;

      &.scanning {
        filter: contrast(1.2) brightness(1.1);
      }
    }

    .camera-guides {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;

      .guide-frame {
        position: absolute;
        top: 20%;
        left: 10%;
        right: 10%;
        bottom: 30%;
        border: 2px solid rgba(255, 255, 255, 0.8);
        border-radius: 8px;
      }

      .guide-corners {
        .corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border: 3px solid var(--primary-color);

          &.top-left {
            top: calc(20% - 10px);
            left: calc(10% - 10px);
            border-right: none;
            border-bottom: none;
          }

          &.top-right {
            top: calc(20% - 10px);
            right: calc(10% - 10px);
            border-left: none;
            border-bottom: none;
          }

          &.bottom-left {
            bottom: calc(30% - 10px);
            left: calc(10% - 10px);
            border-right: none;
            border-top: none;
          }

          &.bottom-right {
            bottom: calc(30% - 10px);
            right: calc(10% - 10px);
            border-left: none;
            border-top: none;
          }
        }
      }
    }
  }

  .camera-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--mobile-spacing-xl);
    background: rgba(0, 0, 0, 0.8);

    .mode-btn,
    .flip-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mobile-spacing-xs);
      color: white;
      border-color: rgba(255, 255, 255, 0.3);
      min-width: 80px;
    }

    .capture-btn {
      @include touch-target-large;
      background: transparent;
      border: none;
      padding: 0;

      .capture-ring {
        width: 70px;
        height: 70px;
        border: 4px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        .capture-inner {
          width: 56px;
          height: 56px;
          background: white;
          border-radius: 50%;
        }
      }

      &:active .capture-ring {
        transform: scale(0.95);
      }
    }
  }
}

// Gesture Feedback
.gesture-feedback {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: var(--mobile-spacing-lg);
  border-radius: var(--mobile-radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--mobile-spacing-sm);
  z-index: 1001;
  animation: fadeInOut 2s ease-in-out;

  &.success {
    background: rgba(34, 197, 94, 0.9);
  }

  &.error {
    background: rgba(239, 68, 68, 0.9);
  }

  &.info {
    background: rgba(59, 130, 246, 0.9);
  }
}

// Swipe Action Indicators
.swipe-action-indicator {
  position: fixed;
  background: var(--primary-color);
  color: white;
  padding: var(--mobile-spacing-sm) var(--mobile-spacing-md);
  border-radius: var(--mobile-radius-full);
  display: flex;
  align-items: center;
  gap: var(--mobile-spacing-xs);
  font-size: var(--mobile-font-size-sm);
  font-weight: 600;
  z-index: 1001;
  animation: swipeIndicator 1s ease-out;
  pointer-events: none;

  &.left {
    animation-name: swipeLeft;
  }

  &.right {
    animation-name: swipeRight;
  }

  &.up {
    animation-name: swipeUp;
  }

  &.down {
    animation-name: swipeDown;
  }
}

// Animations
@keyframes voiceWave {
  0%, 100% {
    height: 20px;
  }
  50% {
    height: 60px;
  }
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  20%, 80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
}

@keyframes swipeIndicator {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  20% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.9);
  }
}

@keyframes swipeLeft {
  0% {
    opacity: 0;
    transform: translateX(20px) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-20px) scale(0.9);
  }
}

@keyframes swipeRight {
  0% {
    opacity: 0;
    transform: translateX(-20px) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(20px) scale(0.9);
  }
}

@keyframes swipeUp {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
}

@keyframes swipeDown {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .voice-animation .voice-wave,
  .gesture-feedback,
  .swipe-action-indicator {
    animation: none !important;
  }

  .capture-btn:active .capture-ring {
    transform: none;
  }
}
</style>
<template>
  <div 
    v-if="showIndicator" 
    :class="containerClasses"
    role="status"
    :aria-live="urgency"
  >
    <div class="offline-icon">
      <WifiIcon v-if="isOnline" class="w-5 h-5 text-green-500" />
      <NoSymbolIcon v-else class="w-5 h-5 text-orange-500" />
    </div>
    
    <div class="offline-content">
      <div class="offline-status">
        {{ statusText }}
      </div>
      
      <div v-if="syncStatus.pendingOperations > 0" class="offline-details">
        {{ syncStatus.pendingOperations }} change{{ syncStatus.pendingOperations === 1 ? '' : 's' }} pending sync
      </div>
      
      <div v-if="syncStatus.isSyncing" class="offline-details">
        <LoadingSpinner variant="auto" size="sm" />
        Syncing changes...
      </div>
    </div>

    <div class="offline-actions">
      <!-- Sync button when offline with pending changes -->
      <button
        v-if="!isOnline && syncStatus.pendingOperations > 0"
        @click="showPendingChanges"
        class="offline-action-btn secondary"
        :disabled="syncStatus.isSyncing"
      >
        Review Changes
      </button>
      
      <!-- Retry sync button when online with errors -->
      <button
        v-if="isOnline && syncStatus.errors.length > 0"
        @click="retrySync"
        class="offline-action-btn primary"
        :disabled="syncStatus.isSyncing"
      >
        Retry Sync
      </button>
      
      <!-- Manual sync trigger -->
      <button
        v-if="isOnline && !syncStatus.isSyncing"
        @click="triggerSync"
        class="offline-action-btn secondary"
        title="Sync now"
      >
        <ArrowPathIcon class="w-4 h-4" />
      </button>
      
      <!-- Close button -->
      <button
        v-if="dismissible"
        @click="dismiss"
        class="offline-close-btn"
        title="Dismiss"
      >
        <XMarkIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- Offline capabilities indicator -->
    <div v-if="!isOnline" class="offline-capabilities">
      <div class="capability-item">
        <CheckIcon class="w-4 h-4 text-green-500" />
        <span>View cached boards</span>
      </div>
      <div class="capability-item">
        <CheckIcon class="w-4 h-4 text-green-500" />
        <span>Create drafts</span>
      </div>
      <div class="capability-item">
        <XMarkIcon class="w-4 h-4 text-gray-400" />
        <span>Real-time collaboration</span>
      </div>
    </div>
  </div>

  <!-- Pending Changes Modal -->
  <Teleport to="body">
    <div
      v-if="showPendingModal"
      class="pending-modal-overlay"
      @click="closePendingModal"
    >
      <div class="pending-modal" @click.stop>
        <div class="pending-modal-header">
          <h3>Pending Changes</h3>
          <button @click="closePendingModal" class="close-btn">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
        
        <div class="pending-modal-content">
          <p v-if="pendingOperations.length === 0" class="no-pending">
            No pending changes to sync.
          </p>
          
          <div v-else class="pending-list">
            <div
              v-for="operation in pendingOperations"
              :key="operation.id"
              class="pending-item"
            >
              <div class="pending-icon">
                <PlusIcon v-if="operation.type === 'CREATE'" class="w-4 h-4 text-green-500" />
                <PencilIcon v-else-if="operation.type === 'UPDATE'" class="w-4 h-4 text-blue-500" />
                <TrashIcon v-else class="w-4 h-4 text-red-500" />
              </div>
              
              <div class="pending-details">
                <div class="pending-action">
                  {{ operation.type }} {{ operation.resource }}
                  <span v-if="operation.data?.title" class="resource-name">
                    "{{ operation.data.title }}"
                  </span>
                </div>
                <div class="pending-time">
                  {{ formatTime(operation.timestamp) }}
                  <span v-if="operation.retries > 0" class="retry-count">
                    ({{ operation.retries }}/{{ operation.maxRetries }} retries)
                  </span>
                </div>
              </div>
              
              <button
                v-if="isOnline"
                @click="forceSyncOperation(operation.id)"
                class="sync-btn"
                :disabled="syncStatus.isSyncing"
              >
                Sync Now
              </button>
            </div>
          </div>
        </div>
        
        <div class="pending-modal-footer">
          <button
            v-if="isOnline && pendingOperations.length > 0"
            @click="syncAll"
            class="btn primary"
            :disabled="syncStatus.isSyncing"
          >
            Sync All Changes
          </button>
          
          <button
            @click="clearAllPending"
            class="btn secondary"
            :disabled="syncStatus.isSyncing"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  WifiIcon,
  NoSymbolIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/vue/24/solid';
import { useSyncManager } from '@/offline/sync-manager';
import { useServiceWorker } from '@/offline/service-worker';
import { useToast } from '@/stores/toast';
import LoadingSpinner from './LoadingSpinner.vue';

interface Props {
  position?: 'top' | 'bottom';
  dismissible?: boolean;
  showWhenOnline?: boolean;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
  dismissible: true,
  showWhenOnline: false,
  compact: false,
});

const syncManager = useSyncManager();
const serviceWorker = useServiceWorker();
const toast = useToast();

const isOnline = ref(navigator.onLine);
const syncStatus = ref(syncManager.getSyncStatus());
const pendingOperations = ref(syncManager.getPendingOperations());
const dismissed = ref(false);
const showPendingModal = ref(false);

// Computed properties
const showIndicator = computed(() => {
  if (dismissed.value) return false;
  if (!isOnline.value) return true; // Always show when offline
  if (props.showWhenOnline) return true;
  if (syncStatus.value.pendingOperations > 0) return true;
  if (syncStatus.value.isSyncing) return true;
  if (syncStatus.value.errors.length > 0) return true;
  return false;
});

const statusText = computed(() => {
  if (!isOnline.value) {
    return 'You are offline';
  }
  if (syncStatus.value.isSyncing) {
    return 'Syncing changes...';
  }
  if (syncStatus.value.errors.length > 0) {
    return 'Sync errors occurred';
  }
  if (syncStatus.value.pendingOperations > 0) {
    return 'Changes ready to sync';
  }
  return 'You are online';
});

const urgency = computed(() => {
  return isOnline.value ? 'polite' : 'assertive';
});

const containerClasses = computed(() => [
  'offline-indicator',
  `position-${props.position}`,
  {
    'offline': !isOnline.value,
    'online': isOnline.value,
    'syncing': syncStatus.value.isSyncing,
    'errors': syncStatus.value.errors.length > 0,
    'compact': props.compact,
  }
]);

// Event handlers
const dismiss = () => {
  dismissed.value = true;
  
  // Auto-show again when status changes significantly
  setTimeout(() => {
    dismissed.value = false;
  }, 30000); // 30 seconds
};

const showPendingChanges = () => {
  showPendingModal.value = true;
};

const closePendingModal = () => {
  showPendingModal.value = false;
};

const triggerSync = async () => {
  try {
    await syncManager.triggerSync();
  } catch (error) {
    toast.error('Failed to trigger sync. Please try again.');
  }
};

const retrySync = async () => {
  await triggerSync();
};

const syncAll = async () => {
  await triggerSync();
  closePendingModal();
};

const forceSyncOperation = async (operationId: string) => {
  try {
    await syncManager.forceSyncOperation(operationId);
    toast.success('Operation synced successfully');
  } catch (error) {
    toast.error('Failed to sync operation');
  }
};

const clearAllPending = () => {
  if (confirm('Are you sure you want to clear all pending changes? This action cannot be undone.')) {
    syncManager.clearPendingOperations();
    closePendingModal();
    toast.info('All pending changes cleared');
  }
};

// Utility functions
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
};

// Lifecycle
onMounted(() => {
  // Update online status
  const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine;
  };

  // Update sync status
  const updateSyncStatus = (newStatus: any) => {
    syncStatus.value = newStatus;
    pendingOperations.value = syncManager.getPendingOperations();
  };

  // Connection listeners
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Sync manager listeners
  syncManager.on('status-changed', updateSyncStatus);
  syncManager.on('sync-started', () => {
    syncStatus.value = syncManager.getSyncStatus();
  });
  syncManager.on('sync-completed', () => {
    syncStatus.value = syncManager.getSyncStatus();
    pendingOperations.value = syncManager.getPendingOperations();
  });

  // Initial status update
  updateSyncStatus(syncManager.getSyncStatus());
});

onUnmounted(() => {
  window.removeEventListener('online', () => {});
  window.removeEventListener('offline', () => {});
});
</script>

<style scoped>
.offline-indicator {
  position: fixed;
  left: 1rem;
  right: 1rem;
  z-index: 1000;
  background: white;
  border: 1px solid var(--color-gray-200, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  backdrop-filter: blur(8px);
  
  &.position-top {
    top: 1rem;
  }
  
  &.position-bottom {
    bottom: 1rem;
  }
  
  &.offline {
    border-color: #f59e0b;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  }
  
  &.online.syncing {
    border-color: var(--color-primary, #6366f1);
    background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  }
  
  &.errors {
    border-color: #ef4444;
    background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
  }
  
  &.compact {
    padding: 0.5rem;
    
    .offline-content {
      font-size: 0.875rem;
    }
    
    .offline-capabilities {
      display: none;
    }
  }
}

.offline-icon {
  flex-shrink: 0;
}

.offline-content {
  flex: 1;
  min-width: 0;
}

.offline-status {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-gray-900, #111827);
}

.offline-details {
  font-size: 0.75rem;
  color: var(--color-gray-600, #6b7280);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.offline-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.offline-action-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.primary {
    background: var(--color-primary, #6366f1);
    color: white;
    
    &:hover:not(:disabled) {
      background: var(--color-primary-dark, #4f46e5);
    }
  }
  
  &.secondary {
    background: var(--color-gray-100, #f3f4f6);
    color: var(--color-gray-700, #374151);
    
    &:hover:not(:disabled) {
      background: var(--color-gray-200, #e5e7eb);
    }
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.offline-close-btn {
  background: none;
  border: none;
  color: var(--color-gray-400, #9ca3af);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--color-gray-100, #f3f4f6);
    color: var(--color-gray-600, #6b7280);
  }
}

.offline-capabilities {
  width: 100%;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-gray-200, #e5e7eb);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
}

.capability-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-gray-600, #6b7280);
}

/* Pending Changes Modal */
.pending-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.pending-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.pending-modal-header {
  padding: 1.5rem 1.5rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-gray-900, #111827);
  }
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-gray-400, #9ca3af);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  
  &:hover {
    background: var(--color-gray-100, #f3f4f6);
    color: var(--color-gray-600, #6b7280);
  }
}

.pending-modal-content {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.no-pending {
  text-align: center;
  color: var(--color-gray-600, #6b7280);
  font-style: italic;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pending-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--color-gray-200, #e5e7eb);
  border-radius: 6px;
  background: var(--color-gray-50, #f9fafb);
}

.pending-icon {
  flex-shrink: 0;
}

.pending-details {
  flex: 1;
  min-width: 0;
}

.pending-action {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-gray-900, #111827);
  
  .resource-name {
    color: var(--color-primary, #6366f1);
  }
}

.pending-time {
  font-size: 0.75rem;
  color: var(--color-gray-600, #6b7280);
  margin-top: 0.25rem;
  
  .retry-count {
    color: #f59e0b;
    font-weight: 500;
  }
}

.sync-btn {
  background: var(--color-primary, #6366f1);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: var(--color-primary-dark, #4f46e5);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.pending-modal-footer {
  padding: 0 1.5rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.primary {
    background: var(--color-primary, #6366f1);
    color: white;
    
    &:hover:not(:disabled) {
      background: var(--color-primary-dark, #4f46e5);
    }
  }
  
  &.secondary {
    background: var(--color-gray-200, #e5e7eb);
    color: var(--color-gray-700, #374151);
    
    &:hover:not(:disabled) {
      background: var(--color-gray-300, #d1d5db);
    }
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .offline-indicator {
    left: 0.5rem;
    right: 0.5rem;
  }
  
  .offline-capabilities {
    grid-template-columns: 1fr;
  }
  
  .pending-modal {
    margin: 0.5rem;
  }
  
  .pending-item {
    flex-direction: column;
    align-items: flex-start;
    
    .sync-btn {
      align-self: flex-end;
    }
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .offline-indicator,
  .pending-modal {
    background: var(--color-gray-800, #1f2937);
    border-color: var(--color-gray-600, #4b5563);
    color: white;
  }
  
  .pending-item {
    background: var(--color-gray-700, #374151);
    border-color: var(--color-gray-600, #4b5563);
  }
}
</style>
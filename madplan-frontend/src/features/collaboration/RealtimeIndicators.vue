<template>
  <div class="realtime-indicators">
    <!-- Online Users -->
    <div class="online-users">
      <div class="users-list">
        <div 
          v-for="user in onlineUsers" 
          :key="user.userId"
          class="user-avatar"
          :title="user.username || user.email"
        >
          <img v-if="user.avatar" :src="user.avatar" :alt="user.username" />
          <div v-else class="avatar-placeholder">
            {{ getInitials(user.username || user.email) }}
          </div>
          <div class="user-status online"></div>
        </div>
      </div>
      <span class="users-count">{{ onlineUsers.length }} online</span>
    </div>

    <!-- Editing Indicators -->
    <div v-if="editingUsers.length > 0" class="editing-indicators">
      <div 
        v-for="editing in editingUsers" 
        :key="`${editing.userId}-${editing.elementId}`"
        class="editing-indicator"
        :style="getEditingStyle(editing)"
      >
        <div class="editing-user">
          <div class="user-avatar small">
            <img v-if="editing.user?.avatar" :src="editing.user.avatar" :alt="editing.user.username" />
            <div v-else class="avatar-placeholder">
              {{ getInitials(editing.user?.username || editing.user?.email) }}
            </div>
          </div>
          <span class="editing-text">{{ editing.user?.username }} is editing</span>
        </div>
      </div>
    </div>

    <!-- Cursors -->
    <div class="cursors-container">
      <div 
        v-for="cursor in cursors" 
        :key="cursor.userId"
        class="cursor"
        :style="getCursorStyle(cursor)"
      >
        <div class="cursor-pointer" :style="{ borderColor: getUserColor(cursor.userId) }"></div>
        <div class="cursor-label" :style="{ backgroundColor: getUserColor(cursor.userId) }">
          {{ cursor.user?.username || 'Anonymous' }}
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="connection-status" :class="connectionStatus">
      <i :class="getConnectionIcon()"></i>
      <span>{{ getConnectionText() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useRealtimeStore } from '@/stores/realtime';
import { useAuthStore } from '@/stores/auth';

interface OnlineUser {
  userId: string;
  username?: string;
  email?: string;
  avatar?: string;
  joinedAt: Date;
}

interface EditingUser {
  userId: string;
  elementId: string;
  elementType: string;
  startedAt: Date;
  user?: OnlineUser;
}

interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  elementId?: string;
  timestamp: Date;
  user?: OnlineUser;
}

const route = useRoute();
const realtimeStore = useRealtimeStore();
const authStore = useAuthStore();

const boardId = computed(() => route.params.id as string);
const onlineUsers = ref<OnlineUser[]>([]);
const editingUsers = ref<EditingUser[]>([]);
const cursors = ref<CursorPosition[]>([]);
const connectionStatus = ref<'connected' | 'connecting' | 'disconnected'>('connecting');

const userColors = new Map<string, string>();
const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
];

onMounted(() => {
  initializeRealtime();
});

onUnmounted(() => {
  realtimeStore.disconnect();
});

async function initializeRealtime() {
  try {
    await realtimeStore.connect();
    await realtimeStore.joinBoard(boardId.value);
    
    realtimeStore.onUserJoined((data) => {
      if (data.userId !== authStore.user?.id) {
        addOnlineUser(data);
      }
    });

    realtimeStore.onUserLeft((data) => {
      removeOnlineUser(data.userId);
      removeUserCursor(data.userId);
      removeUserEditing(data.userId);
    });

    realtimeStore.onEditingStarted((data) => {
      if (data.userId !== authStore.user?.id) {
        addEditingUser(data);
      }
    });

    realtimeStore.onEditingStopped((data) => {
      removeUserEditing(data.userId, data.elementId);
    });

    realtimeStore.onCursorUpdate((data) => {
      if (data.userId !== authStore.user?.id) {
        updateCursor(data);
      }
    });

    realtimeStore.onConnectionChange((status) => {
      connectionStatus.value = status;
    });

    connectionStatus.value = 'connected';
  } catch (error) {
    console.error('Failed to initialize realtime:', error);
    connectionStatus.value = 'disconnected';
  }
}

function addOnlineUser(userData: any) {
  const existingIndex = onlineUsers.value.findIndex(u => u.userId === userData.userId);
  if (existingIndex >= 0) {
    onlineUsers.value[existingIndex] = { ...onlineUsers.value[existingIndex], ...userData };
  } else {
    onlineUsers.value.push({
      userId: userData.userId,
      username: userData.username,
      email: userData.email,
      avatar: userData.avatar,
      joinedAt: new Date(),
    });
  }
  
  if (!userColors.has(userData.userId)) {
    userColors.set(userData.userId, getNextColor());
  }
}

function removeOnlineUser(userId: string) {
  const index = onlineUsers.value.findIndex(u => u.userId === userId);
  if (index >= 0) {
    onlineUsers.value.splice(index, 1);
  }
}

function addEditingUser(data: any) {
  const user = onlineUsers.value.find(u => u.userId === data.userId);
  editingUsers.value.push({
    userId: data.userId,
    elementId: data.elementId,
    elementType: data.elementType,
    startedAt: new Date(),
    user,
  });
}

function removeUserEditing(userId: string, elementId?: string) {
  if (elementId) {
    const index = editingUsers.value.findIndex(
      e => e.userId === userId && e.elementId === elementId
    );
    if (index >= 0) {
      editingUsers.value.splice(index, 1);
    }
  } else {
    editingUsers.value = editingUsers.value.filter(e => e.userId !== userId);
  }
}

function updateCursor(data: any) {
  const user = onlineUsers.value.find(u => u.userId === data.userId);
  const existingIndex = cursors.value.findIndex(c => c.userId === data.userId);
  
  const cursor = {
    userId: data.userId,
    x: data.x,
    y: data.y,
    elementId: data.elementId,
    timestamp: new Date(),
    user,
  };

  if (existingIndex >= 0) {
    cursors.value[existingIndex] = cursor;
  } else {
    cursors.value.push(cursor);
  }

  setTimeout(() => {
    removeUserCursor(data.userId);
  }, 5000);
}

function removeUserCursor(userId: string) {
  const index = cursors.value.findIndex(c => c.userId === userId);
  if (index >= 0) {
    cursors.value.splice(index, 1);
  }
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getUserColor(userId: string): string {
  if (!userColors.has(userId)) {
    userColors.set(userId, getNextColor());
  }
  return userColors.get(userId)!;
}

function getNextColor(): string {
  return colorPalette[userColors.size % colorPalette.length];
}

function getEditingStyle(editing: EditingUser) {
  const element = document.getElementById(editing.elementId);
  if (!element) return { display: 'none' };

  const rect = element.getBoundingClientRect();
  return {
    position: 'absolute',
    top: `${rect.top - 40}px`,
    left: `${rect.left}px`,
    zIndex: 1000,
  };
}

function getCursorStyle(cursor: CursorPosition) {
  return {
    position: 'absolute',
    top: `${cursor.y}px`,
    left: `${cursor.x}px`,
    zIndex: 999,
    pointerEvents: 'none',
  };
}

function getConnectionIcon(): string {
  const icons = {
    connected: 'fas fa-wifi',
    connecting: 'fas fa-spinner fa-spin',
    disconnected: 'fas fa-wifi-slash',
  };
  return icons[connectionStatus.value];
}

function getConnectionText(): string {
  const texts = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
  };
  return texts[connectionStatus.value];
}
</script>

<style scoped>
.realtime-indicators {
  position: relative;
}

.online-users {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.users-list {
  display: flex;
  gap: 0.25rem;
}

.user-avatar {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.user-avatar.small {
  width: 24px;
  height: 24px;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-100);
  color: var(--primary-700);
  font-size: 0.75rem;
  font-weight: 600;
}

.user-status {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
}

.user-status.online {
  background: var(--green-500);
}

.users-count {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.editing-indicator {
  position: absolute;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.editing-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.editing-text {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cursor {
  position: absolute;
  pointer-events: none;
  z-index: 999;
}

.cursor-pointer {
  width: 0;
  height: 0;
  border-left: 8px solid;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
}

.cursor-label {
  position: absolute;
  top: -30px;
  left: 8px;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  color: white;
  font-size: 0.75rem;
  white-space: nowrap;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  border-radius: 6px;
}

.connection-status.connected {
  color: var(--green-600);
  background: var(--green-50);
}

.connection-status.connecting {
  color: var(--yellow-600);
  background: var(--yellow-50);
}

.connection-status.disconnected {
  color: var(--red-600);
  background: var(--red-50);
}
</style>
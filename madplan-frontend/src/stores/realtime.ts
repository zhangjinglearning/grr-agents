import { defineStore } from 'pinia';
import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export const useRealtimeStore = defineStore('realtime', () => {
  const socket = ref<Socket | null>(null);
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  const currentBoardId = ref<string | null>(null);
  const isConnected = ref(false);

  // Event handlers
  const userJoinedHandlers = ref<((data: any) => void)[]>([]);
  const userLeftHandlers = ref<((data: any) => void)[]>([]);
  const editingStartedHandlers = ref<((data: any) => void)[]>([]);
  const editingStoppedHandlers = ref<((data: any) => void)[]>([]);
  const cursorUpdateHandlers = ref<((data: any) => void)[]>([]);
  const connectionChangeHandlers = ref<((status: ConnectionStatus) => void)[]>([]);
  const boardUpdatedHandlers = ref<((data: any) => void)[]>([]);
  const listChangedHandlers = ref<((data: any) => void)[]>([]);
  const cardChangedHandlers = ref<((data: any) => void)[]>([]);

  async function connect(): Promise<void> {
    if (socket.value?.connected) {
      return;
    }

    const authStore = useAuthStore();
    if (!authStore.token) {
      throw new Error('Authentication required');
    }

    return new Promise((resolve, reject) => {
      connectionStatus.value = 'connecting';
      
      socket.value = io(`${import.meta.env.VITE_API_URL}/boards`, {
        auth: {
          token: authStore.token,
        },
        transports: ['websocket'],
      });

      socket.value.on('connect', () => {
        connectionStatus.value = 'connected';
        isConnected.value = true;
        notifyConnectionChange('connected');
        resolve();
      });

      socket.value.on('disconnect', () => {
        connectionStatus.value = 'disconnected';
        isConnected.value = false;
        notifyConnectionChange('disconnected');
      });

      socket.value.on('connect_error', (error) => {
        connectionStatus.value = 'disconnected';
        isConnected.value = false;
        notifyConnectionChange('disconnected');
        reject(error);
      });

      // Set up event listeners
      setupEventListeners();
    });
  }

  function setupEventListeners() {
    if (!socket.value) return;

    socket.value.on('user_joined', (data) => {
      userJoinedHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('user_left', (data) => {
      userLeftHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('editing_started', (data) => {
      editingStartedHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('editing_stopped', (data) => {
      editingStoppedHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('cursor_update', (data) => {
      cursorUpdateHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('board_updated', (data) => {
      boardUpdatedHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('list_changed', (data) => {
      listChangedHandlers.value.forEach(handler => handler(data));
    });

    socket.value.on('card_changed', (data) => {
      cardChangedHandlers.value.forEach(handler => handler(data));
    });
  }

  async function joinBoard(boardId: string): Promise<void> {
    if (!socket.value?.connected) {
      throw new Error('Not connected to server');
    }

    return new Promise((resolve, reject) => {
      socket.value!.emit('join_board', { boardId }, (response: any) => {
        if (response.success) {
          currentBoardId.value = boardId;
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to join board'));
        }
      });
    });
  }

  async function leaveBoard(): Promise<void> {
    if (!socket.value?.connected || !currentBoardId.value) {
      return;
    }

    return new Promise((resolve) => {
      socket.value!.emit('leave_board', { boardId: currentBoardId.value }, () => {
        currentBoardId.value = null;
        resolve();
      });
    });
  }

  function sendCursorPosition(x: number, y: number, elementId?: string): void {
    if (!socket.value?.connected || !currentBoardId.value) return;

    socket.value.emit('cursor_move', {
      boardId: currentBoardId.value,
      x,
      y,
      elementId,
    });
  }

  function startEditing(elementId: string, elementType: string): void {
    if (!socket.value?.connected || !currentBoardId.value) return;

    socket.value.emit('start_editing', {
      boardId: currentBoardId.value,
      elementId,
      elementType,
    });
  }

  function stopEditing(elementId: string): void {
    if (!socket.value?.connected || !currentBoardId.value) return;

    socket.value.emit('stop_editing', {
      boardId: currentBoardId.value,
      elementId,
    });
  }

  function disconnect(): void {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
    connectionStatus.value = 'disconnected';
    isConnected.value = false;
    currentBoardId.value = null;
  }

  // Event handler registration
  function onUserJoined(handler: (data: any) => void): void {
    userJoinedHandlers.value.push(handler);
  }

  function onUserLeft(handler: (data: any) => void): void {
    userLeftHandlers.value.push(handler);
  }

  function onEditingStarted(handler: (data: any) => void): void {
    editingStartedHandlers.value.push(handler);
  }

  function onEditingStopped(handler: (data: any) => void): void {
    editingStoppedHandlers.value.push(handler);
  }

  function onCursorUpdate(handler: (data: any) => void): void {
    cursorUpdateHandlers.value.push(handler);
  }

  function onConnectionChange(handler: (status: ConnectionStatus) => void): void {
    connectionChangeHandlers.value.push(handler);
  }

  function onBoardUpdated(handler: (data: any) => void): void {
    boardUpdatedHandlers.value.push(handler);
  }

  function onListChanged(handler: (data: any) => void): void {
    listChangedHandlers.value.push(handler);
  }

  function onCardChanged(handler: (data: any) => void): void {
    cardChangedHandlers.value.push(handler);
  }

  function notifyConnectionChange(status: ConnectionStatus): void {
    connectionChangeHandlers.value.forEach(handler => handler(status));
  }

  // Cleanup functions
  function removeHandler<T>(handlers: T[], handler: T): void {
    const index = handlers.indexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  }

  function clearAllHandlers(): void {
    userJoinedHandlers.value = [];
    userLeftHandlers.value = [];
    editingStartedHandlers.value = [];
    editingStoppedHandlers.value = [];
    cursorUpdateHandlers.value = [];
    connectionChangeHandlers.value = [];
    boardUpdatedHandlers.value = [];
    listChangedHandlers.value = [];
    cardChangedHandlers.value = [];
  }

  return {
    // State
    connectionStatus,
    currentBoardId,
    isConnected,
    boardShares,
    sharedBoards,
    boardActivities,
    collaborationStats,
    loading,

    // Computed
    activeShares,
    pendingShares,

    // Connection methods
    connect,
    disconnect,
    joinBoard,
    leaveBoard,

    // Realtime actions
    sendCursorPosition,
    startEditing,
    stopEditing,

    // Data fetching
    fetchBoardShares,
    fetchSharedBoards,
    fetchBoardActivity,

    // Share management
    createBoardShare,
    updateBoardShare,
    revokeBoardShare,
    acceptBoardShare: collaborationService.acceptBoardShare,
    generateShareLink: collaborationService.generateShareLink,
    fetchCollaborationStats: async (boardId: string) => {
      const stats = await collaborationService.getCollaborationStats(boardId);
      collaborationStats.value = stats;
      return stats;
    },

    // Event handlers
    onUserJoined,
    onUserLeft,
    onEditingStarted,
    onEditingStopped,
    onCursorUpdate,
    onConnectionChange,
    onBoardUpdated,
    onListChanged,
    onCardChanged,

    // Cleanup
    clearAllHandlers,
  };
});
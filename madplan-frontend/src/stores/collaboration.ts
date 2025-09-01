import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { collaborationService } from '@/services/collaboration.service';
import type { BoardShare, BoardActivity, CreateShareInput, UpdateShareInput } from '@/types/collaboration';

export const useCollaborationStore = defineStore('collaboration', () => {
  const boardShares = ref<BoardShare[]>([]);
  const sharedBoards = ref<BoardShare[]>([]);
  const boardActivities = ref<BoardActivity[]>([]);
  const collaborationStats = ref<any>(null);
  const loading = ref(false);

  const activeShares = computed(() => 
    boardShares.value.filter(share => share.status === 'active')
  );

  const pendingShares = computed(() => 
    boardShares.value.filter(share => share.status === 'pending')
  );

  async function fetchBoardShares(boardId: string): Promise<void> {
    try {
      loading.value = true;
      const shares = await collaborationService.getBoardShares(boardId);
      boardShares.value = shares;
    } catch (error) {
      console.error('Failed to fetch board shares:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSharedBoards(): Promise<void> {
    try {
      loading.value = true;
      const boards = await collaborationService.getSharedBoards();
      sharedBoards.value = boards;
    } catch (error) {
      console.error('Failed to fetch shared boards:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBoardActivity(boardId: string, limit = 50): Promise<void> {
    try {
      const activities = await collaborationService.getBoardActivity(boardId, limit);
      boardActivities.value = activities;
    } catch (error) {
      console.error('Failed to fetch board activity:', error);
      throw error;
    }
  }

  async function createBoardShare(input: CreateShareInput): Promise<BoardShare> {
    try {
      const share = await collaborationService.createBoardShare(input);
      boardShares.value.push(share);
      return share;
    } catch (error) {
      console.error('Failed to create board share:', error);
      throw error;
    }
  }

  async function updateBoardShare(shareId: string, input: UpdateShareInput): Promise<BoardShare> {
    try {
      const updatedShare = await collaborationService.updateBoardShare(shareId, input);
      const index = boardShares.value.findIndex(share => share.id === shareId);
      if (index >= 0) {
        boardShares.value[index] = updatedShare;
      }
      return updatedShare;
    } catch (error) {
      console.error('Failed to update board share:', error);
      throw error;
    }
  }

  async function revokeBoardShare(shareId: string): Promise<void> {
    try {
      await collaborationService.revokeBoardShare(shareId);
      const index = boardShares.value.findIndex(share => share.id === shareId);
      if (index >= 0) {
        boardShares.value[index].status = 'revoked';
      }
    } catch (error) {
      console.error('Failed to revoke board share:', error);
      throw error;
    }
  }

  async function acceptBoardShare(shareToken: string): Promise<BoardShare> {
    try {
      const share = await collaborationService.acceptBoardShare(shareToken);
      sharedBoards.value.push(share);
      return share;
    } catch (error) {
      console.error('Failed to accept board share:', error);
      throw error;
    }
  }

  async function generateShareLink(
    boardId: string, 
    permission: string, 
    expiresAt?: Date
  ): Promise<string> {
    try {
      return await collaborationService.generateShareLink(boardId, permission, expiresAt);
    } catch (error) {
      console.error('Failed to generate share link:', error);
      throw error;
    }
  }

  async function fetchCollaborationStats(boardId: string): Promise<void> {
    try {
      const stats = await collaborationService.getCollaborationStats(boardId);
      collaborationStats.value = stats;
    } catch (error) {
      console.error('Failed to fetch collaboration stats:', error);
      throw error;
    }
  }

  function addActivity(activity: BoardActivity): void {
    boardActivities.value.unshift(activity);
    if (boardActivities.value.length > 100) {
      boardActivities.value = boardActivities.value.slice(0, 100);
    }
  }

  function clearBoardData(): void {
    boardShares.value = [];
    boardActivities.value = [];
    collaborationStats.value = null;
  }

  function getShareByToken(token: string): BoardShare | undefined {
    return [...boardShares.value, ...sharedBoards.value]
      .find(share => share.shareToken === token);
  }

  function hasPermission(boardId: string, requiredPermission: string): boolean {
    const share = sharedBoards.value.find(share => 
      share.boardId === boardId && share.status === 'active'
    );
    
    if (!share) return false;

    const permissionLevels = {
      view: 1,
      comment: 2,
      edit: 3,
      admin: 4,
    };

    const userLevel = permissionLevels[share.permission] || 0;
    const requiredLevel = permissionLevels[requiredPermission] || 0;

    return userLevel >= requiredLevel;
  }

  return {
    // State
    boardShares,
    sharedBoards,
    boardActivities,
    collaborationStats,
    loading,

    // Computed
    activeShares,
    pendingShares,

    // Actions
    fetchBoardShares,
    fetchSharedBoards,
    fetchBoardActivity,
    createBoardShare,
    updateBoardShare,
    revokeBoardShare,
    acceptBoardShare,
    generateShareLink,
    fetchCollaborationStats,
    addActivity,
    clearBoardData,
    getShareByToken,
    hasPermission,
  };
});
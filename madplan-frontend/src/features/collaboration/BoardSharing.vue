<template>
  <div class="board-sharing">
    <div class="sharing-header">
      <h3>Board Sharing</h3>
      <button @click="showShareDialog = true" class="btn btn-primary">
        <i class="fas fa-share"></i>
        Share Board
      </button>
    </div>

    <!-- Current Shares -->
    <div class="current-shares" v-if="shares.length > 0">
      <h4>Current Shares</h4>
      <div class="shares-list">
        <div v-for="share in shares" :key="share.id" class="share-item">
          <div class="share-info">
            <div class="share-user">
              <i class="fas fa-user"></i>
              <span>{{ share.email || share.sharedWith || 'Link Share' }}</span>
              <span class="permission-badge" :class="share.permission">
                {{ formatPermission(share.permission) }}
              </span>
            </div>
            <div class="share-details">
              <span class="share-status" :class="share.status">{{ share.status }}</span>
              <span v-if="share.expiresAt" class="expires">
                Expires: {{ formatDate(share.expiresAt) }}
              </span>
            </div>
          </div>
          <div class="share-actions">
            <button @click="editShare(share)" class="btn btn-sm">
              <i class="fas fa-edit"></i>
            </button>
            <button @click="revokeShare(share.id)" class="btn btn-sm btn-danger">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Dialog -->
    <div v-if="showShareDialog" class="modal-overlay" @click="closeShareDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>{{ editingShare ? 'Edit Share' : 'Share Board' }}</h4>
          <button @click="closeShareDialog" class="btn btn-ghost">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="share-options">
            <div class="option-group">
              <label class="option-radio">
                <input 
                  type="radio" 
                  v-model="shareForm.inviteMethod" 
                  value="email"
                  @change="shareForm.isLinkShare = false"
                >
                <span>Invite by Email</span>
              </label>
              <label class="option-radio">
                <input 
                  type="radio" 
                  v-model="shareForm.inviteMethod" 
                  value="link"
                  @change="shareForm.isLinkShare = true"
                >
                <span>Generate Share Link</span>
              </label>
            </div>

            <div v-if="shareForm.inviteMethod === 'email'" class="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                v-model="shareForm.email" 
                placeholder="Enter email address"
                class="form-input"
              >
            </div>

            <div class="form-group">
              <label>Permission Level</label>
              <select v-model="shareForm.permission" class="form-select">
                <option value="view">View Only</option>
                <option value="comment">Can Comment</option>
                <option value="edit">Can Edit</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" v-model="hasExpiration">
                Set Expiration
              </label>
              <input 
                v-if="hasExpiration"
                type="datetime-local" 
                v-model="shareForm.expiresAt" 
                class="form-input"
              >
            </div>

            <div class="form-group">
              <label>Message (Optional)</label>
              <textarea 
                v-model="shareForm.message" 
                placeholder="Add a message for the recipient"
                class="form-textarea"
              ></textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeShareDialog" class="btn btn-secondary">Cancel</button>
          <button @click="submitShare" class="btn btn-primary" :disabled="!isValidShare">
            {{ editingShare ? 'Update Share' : 'Create Share' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Generated Link Display -->
    <div v-if="generatedLink" class="generated-link-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h4>Share Link Generated</h4>
          <button @click="generatedLink = null" class="btn btn-ghost">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="link-container">
            <input 
              ref="linkInput"
              type="text" 
              :value="generatedLink" 
              readonly 
              class="form-input"
            >
            <button @click="copyLink" class="btn btn-primary">
              <i class="fas fa-copy"></i>
              Copy
            </button>
          </div>
          <p class="link-note">
            Anyone with this link can access the board with {{ shareForm.permission }} permissions.
          </p>
        </div>
      </div>
    </div>

    <!-- Activity Feed -->
    <div class="activity-section" v-if="activities.length > 0">
      <h4>Recent Activity</h4>
      <div class="activity-feed">
        <div v-for="activity in activities" :key="activity.id" class="activity-item">
          <div class="activity-icon">
            <i :class="getActivityIcon(activity.action)"></i>
          </div>
          <div class="activity-content">
            <span class="activity-text">{{ formatActivity(activity) }}</span>
            <span class="activity-time">{{ formatRelativeTime(activity.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useCollaborationStore } from '@/stores/collaboration';
import { useToast } from '@/composables/useToast';
import type { BoardShare, BoardActivity, CreateShareInput } from '@/types/collaboration';

const route = useRoute();
const collaborationStore = useCollaborationStore();
const toast = useToast();

const boardId = computed(() => route.params.id as string);
const showShareDialog = ref(false);
const editingShare = ref<BoardShare | null>(null);
const generatedLink = ref<string | null>(null);
const hasExpiration = ref(false);
const linkInput = ref<HTMLInputElement>();

const shareForm = ref<CreateShareInput>({
  boardId: boardId.value,
  email: '',
  permission: 'view',
  inviteMethod: 'email',
  isLinkShare: false,
  message: '',
  expiresAt: undefined,
});

const shares = computed(() => collaborationStore.boardShares);
const activities = computed(() => collaborationStore.boardActivities);

const isValidShare = computed(() => {
  if (shareForm.value.inviteMethod === 'email') {
    return shareForm.value.email && shareForm.value.email.includes('@');
  }
  return true;
});

onMounted(async () => {
  await Promise.all([
    collaborationStore.fetchBoardShares(boardId.value),
    collaborationStore.fetchBoardActivity(boardId.value),
  ]);
});

function closeShareDialog() {
  showShareDialog.value = false;
  editingShare.value = null;
  resetForm();
}

function resetForm() {
  shareForm.value = {
    boardId: boardId.value,
    email: '',
    permission: 'view',
    inviteMethod: 'email',
    isLinkShare: false,
    message: '',
    expiresAt: undefined,
  };
  hasExpiration.value = false;
}

function editShare(share: BoardShare) {
  editingShare.value = share;
  shareForm.value = {
    boardId: share.boardId,
    email: share.email || '',
    permission: share.permission,
    inviteMethod: share.inviteMethod,
    isLinkShare: share.isLinkShare,
    message: share.message || '',
    expiresAt: share.expiresAt ? new Date(share.expiresAt).toISOString().slice(0, 16) : undefined,
  };
  hasExpiration.value = !!share.expiresAt;
  showShareDialog.value = true;
}

async function submitShare() {
  try {
    if (hasExpiration.value && shareForm.value.expiresAt) {
      shareForm.value.expiresAt = new Date(shareForm.value.expiresAt);
    } else {
      shareForm.value.expiresAt = undefined;
    }

    if (editingShare.value) {
      await collaborationStore.updateBoardShare(editingShare.value.id, {
        permission: shareForm.value.permission,
        expiresAt: shareForm.value.expiresAt,
      });
      toast.success('Share updated successfully');
    } else {
      if (shareForm.value.isLinkShare) {
        const link = await collaborationStore.generateShareLink(
          boardId.value,
          shareForm.value.permission,
          shareForm.value.expiresAt,
        );
        generatedLink.value = link;
      } else {
        await collaborationStore.createBoardShare(shareForm.value);
        toast.success('Invitation sent successfully');
      }
    }

    closeShareDialog();
    await collaborationStore.fetchBoardShares(boardId.value);
  } catch (error) {
    toast.error('Failed to share board');
    console.error('Share error:', error);
  }
}

async function revokeShare(shareId: string) {
  if (confirm('Are you sure you want to revoke this share?')) {
    try {
      await collaborationStore.revokeBoardShare(shareId);
      toast.success('Share revoked successfully');
      await collaborationStore.fetchBoardShares(boardId.value);
    } catch (error) {
      toast.error('Failed to revoke share');
    }
  }
}

async function copyLink() {
  if (generatedLink.value && linkInput.value) {
    try {
      await navigator.clipboard.writeText(generatedLink.value);
      toast.success('Link copied to clipboard');
    } catch (error) {
      linkInput.value.select();
      document.execCommand('copy');
      toast.success('Link copied to clipboard');
    }
  }
}

function formatPermission(permission: string): string {
  const permissions = {
    view: 'View Only',
    comment: 'Can Comment',
    edit: 'Can Edit',
    admin: 'Admin',
  };
  return permissions[permission] || permission;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString();
}

function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = now.getTime() - time.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getActivityIcon(action: string): string {
  const icons = {
    board_joined: 'fas fa-sign-in-alt',
    board_left: 'fas fa-sign-out-alt',
    share_created: 'fas fa-share',
    share_accepted: 'fas fa-check',
    share_revoked: 'fas fa-ban',
    card_created: 'fas fa-plus',
    card_updated: 'fas fa-edit',
    card_moved: 'fas fa-arrows-alt',
    list_created: 'fas fa-list',
    list_updated: 'fas fa-edit',
  };
  return icons[action] || 'fas fa-info';
}

function formatActivity(activity: BoardActivity): string {
  const actions = {
    board_joined: 'joined the board',
    board_left: 'left the board',
    share_created: 'shared the board',
    share_accepted: 'accepted board invitation',
    share_revoked: 'revoked board access',
    card_created: 'created a card',
    card_updated: 'updated a card',
    card_moved: 'moved a card',
    list_created: 'created a list',
    list_updated: 'updated a list',
  };
  return actions[activity.action] || activity.action;
}
</script>

<style scoped>
.board-sharing {
  padding: 1rem;
}

.sharing-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.current-shares {
  margin-bottom: 2rem;
}

.shares-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.share-item {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
}

.share-info {
  flex: 1;
}

.share-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.permission-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.permission-badge.view { background: var(--gray-100); color: var(--gray-700); }
.permission-badge.comment { background: var(--blue-100); color: var(--blue-700); }
.permission-badge.edit { background: var(--green-100); color: var(--green-700); }
.permission-badge.admin { background: var(--purple-100); color: var(--purple-700); }

.share-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.share-status.active { color: var(--green-600); }
.share-status.pending { color: var(--yellow-600); }
.share-status.revoked { color: var(--red-600); }

.share-actions {
  display: flex;
  gap: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.option-radio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.link-container {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.link-container input {
  flex: 1;
}

.link-note {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
}

.activity-section {
  margin-top: 2rem;
}

.activity-feed {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  background: var(--gray-50);
}

.activity-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--primary-100);
  color: var(--primary-600);
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.activity-text {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-700);
}

.btn-secondary {
  background: var(--gray-200);
  color: var(--gray-700);
}

.btn-danger {
  background: var(--red-600);
  color: white;
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
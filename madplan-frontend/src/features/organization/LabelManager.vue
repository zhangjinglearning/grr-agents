<template>
  <div class="label-manager">
    <div class="manager-header">
      <h3>Labels</h3>
      <button @click="showCreateForm = true" class="btn btn-primary btn-sm">
        <i class="fas fa-plus"></i>
        Add Label
      </button>
    </div>

    <!-- Labels List -->
    <div class="labels-list">
      <div v-if="labels.length === 0" class="empty-state">
        <i class="fas fa-tags text-muted"></i>
        <p>No labels created yet</p>
      </div>

      <div v-else class="labels-grid">
        <div 
          v-for="label in labels" 
          :key="label.id"
          class="label-item"
          :class="`label-${label.color}`"
        >
          <div class="label-content">
            <div class="label-info">
              <span class="label-name">{{ label.name }}</span>
              <span v-if="label.description" class="label-description">{{ label.description }}</span>
              <span class="label-usage">Used {{ label.usageCount }} times</span>
            </div>
            <div class="label-actions">
              <button @click="editLabel(label)" class="btn btn-ghost btn-xs">
                <i class="fas fa-edit"></i>
              </button>
              <button @click="deleteLabel(label.id)" class="btn btn-ghost btn-xs text-danger">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Form Modal -->
    <div v-if="showCreateForm || editingLabel" class="modal-overlay" @click="closeForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>{{ editingLabel ? 'Edit Label' : 'Create Label' }}</h4>
          <button @click="closeForm" class="btn btn-ghost">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="submitForm">
            <div class="form-group">
              <label>Name *</label>
              <input 
                v-model="form.name" 
                type="text" 
                placeholder="Enter label name"
                class="form-input"
                required
              >
            </div>

            <div class="form-group">
              <label>Color *</label>
              <div class="color-picker">
                <div 
                  v-for="color in availableColors" 
                  :key="color"
                  class="color-option"
                  :class="[`color-${color}`, { active: form.color === color }]"
                  @click="form.color = color"
                >
                  <i v-if="form.color === color" class="fas fa-check"></i>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea 
                v-model="form.description" 
                placeholder="Optional description"
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button @click="closeForm" class="btn btn-secondary">Cancel</button>
          <button 
            @click="submitForm" 
            class="btn btn-primary"
            :disabled="!form.name || !form.color || loading"
          >
            {{ loading ? 'Saving...' : (editingLabel ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useOrganizationStore } from '@/stores/organization';
import { useToast } from '@/composables/useToast';
import type { Label, LabelColor } from '@/types/organization';

const route = useRoute();
const organizationStore = useOrganizationStore();
const toast = useToast();

const boardId = computed(() => route.params.id as string);
const labels = computed(() => organizationStore.labels);
const loading = ref(false);
const showCreateForm = ref(false);
const editingLabel = ref<Label | null>(null);

const form = ref({
  name: '',
  color: 'blue' as LabelColor,
  description: '',
});

const availableColors: LabelColor[] = [
  'red', 'orange', 'yellow', 'green', 'blue', 
  'purple', 'pink', 'gray', 'brown', 'teal'
];

onMounted(async () => {
  await organizationStore.fetchBoardLabels(boardId.value);
});

function editLabel(label: Label) {
  editingLabel.value = label;
  form.value = {
    name: label.name,
    color: label.color,
    description: label.description || '',
  };
}

function closeForm() {
  showCreateForm.value = false;
  editingLabel.value = null;
  form.value = {
    name: '',
    color: 'blue',
    description: '',
  };
}

async function submitForm() {
  if (!form.value.name || !form.value.color) return;

  try {
    loading.value = true;

    if (editingLabel.value) {
      await organizationStore.updateLabel(editingLabel.value.id, {
        name: form.value.name,
        color: form.value.color,
        description: form.value.description || undefined,
      });
      toast.success('Label updated successfully');
    } else {
      await organizationStore.createLabel({
        name: form.value.name,
        color: form.value.color,
        boardId: boardId.value,
        description: form.value.description || undefined,
      });
      toast.success('Label created successfully');
    }

    closeForm();
  } catch (error) {
    toast.error('Failed to save label');
  } finally {
    loading.value = false;
  }
}

async function deleteLabel(labelId: string) {
  if (confirm('Are you sure you want to delete this label? It will be removed from all cards.')) {
    try {
      await organizationStore.deleteLabel(labelId);
      toast.success('Label deleted successfully');
    } catch (error) {
      toast.error('Failed to delete label');
    }
  }
}
</script>

<style scoped>
.label-manager {
  padding: 1rem;
}

.manager-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.manager-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.labels-list {
  min-height: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}

.labels-grid {
  display: grid;
  gap: 0.75rem;
}

.label-item {
  border-radius: 8px;
  border: 2px solid;
  overflow: hidden;
  transition: all 0.2s;
}

.label-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.label-content {
  display: flex;
  justify-content: between;
  align-items: flex-start;
  padding: 1rem;
}

.label-info {
  flex: 1;
}

.label-name {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.label-description {
  display: block;
  font-size: 0.875rem;
  opacity: 0.8;
  margin-bottom: 0.5rem;
}

.label-usage {
  display: block;
  font-size: 0.75rem;
  opacity: 0.6;
}

.label-actions {
  display: flex;
  gap: 0.25rem;
}

.color-picker {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.color-option {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  color: white;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px white, 0 0 0 4px var(--primary-500);
}

/* Label Colors */
.label-red, .color-red { background-color: #ef4444; border-color: #dc2626; color: white; }
.label-orange, .color-orange { background-color: #f97316; border-color: #ea580c; color: white; }
.label-yellow, .color-yellow { background-color: #eab308; border-color: #ca8a04; color: black; }
.label-green, .color-green { background-color: #22c55e; border-color: #16a34a; color: white; }
.label-blue, .color-blue { background-color: #3b82f6; border-color: #2563eb; color: white; }
.label-purple, .color-purple { background-color: #8b5cf6; border-color: #7c3aed; color: white; }
.label-pink, .color-pink { background-color: #ec4899; border-color: #db2777; color: white; }
.label-gray, .color-gray { background-color: #6b7280; border-color: #4b5563; color: white; }
.label-brown, .color-brown { background-color: #a16207; border-color: #92400e; color: white; }
.label-teal, .color-teal { background-color: #14b8a6; border-color: #0d9488; color: white; }

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
  background: white;
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

.modal-header h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
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

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-700);
}

.btn-secondary {
  background: var(--gray-200);
  color: var(--gray-700);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover {
  background: var(--gray-100);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-xs {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-danger {
  color: var(--red-600);
}

.text-muted {
  color: var(--text-muted);
}
</style>
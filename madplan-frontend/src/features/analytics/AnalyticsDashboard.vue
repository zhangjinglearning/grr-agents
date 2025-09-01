<template>
  <div class="analytics-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <h2>Analytics Dashboard</h2>
      <div class="dashboard-controls">
        <select v-model="selectedPeriod" @change="loadDashboard" class="form-select">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        
        <select v-if="boardId" v-model="selectedBoard" @change="loadDashboard" class="form-select">
          <option value="">All Boards</option>
          <option :value="boardId">Current Board</option>
        </select>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="quick-stats">
      <div class="stat-card">
        <div class="stat-icon cards-created">
          <i class="fas fa-plus"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ dashboardData.quickStats?.cardsCreatedToday || 0 }}</div>
          <div class="stat-label">Cards Created Today</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon cards-completed">
          <i class="fas fa-check"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ dashboardData.quickStats?.cardsCompletedToday || 0 }}</div>
          <div class="stat-label">Cards Completed Today</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon boards-accessed">
          <i class="fas fa-eye"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ dashboardData.quickStats?.boardsAccessedToday || 0 }}</div>
          <div class="stat-label">Boards Accessed Today</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active-time">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatTime(dashboardData.quickStats?.activeTimeToday || 0) }}</div>
          <div class="stat-label">Active Time Today</div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="dashboard-grid">
      <!-- Productivity Overview -->
      <div class="dashboard-card productivity-overview">
        <div class="card-header">
          <h3>Productivity Overview</h3>
          <button @click="showProductivityDetails = true" class="btn btn-ghost btn-sm">
            <i class="fas fa-expand"></i>
          </button>
        </div>
        <div class="card-content">
          <ProductivityChart 
            v-if="dashboardData.productivity"
            :data="dashboardData.productivity" 
            :height="200"
          />
        </div>
      </div>

      <!-- Activity Heatmap -->
      <div class="dashboard-card activity-heatmap">
        <div class="card-header">
          <h3>Activity Heatmap</h3>
          <button @click="showActivityDetails = true" class="btn btn-ghost btn-sm">
            <i class="fas fa-expand"></i>
          </button>
        </div>
        <div class="card-content">
          <ActivityHeatmap 
            v-if="heatmapData"
            :data="heatmapData" 
            :height="200"
          />
        </div>
      </div>

      <!-- Performance Insights -->
      <div class="dashboard-card insights-panel">
        <div class="card-header">
          <h3>Insights & Recommendations</h3>
          <span v-if="dashboardData.insights?.length" class="insight-count">
            {{ dashboardData.insights.length }}
          </span>
        </div>
        <div class="card-content">
          <div v-if="!dashboardData.insights?.length" class="empty-insights">
            <i class="fas fa-lightbulb text-muted"></i>
            <p>No insights available yet</p>
          </div>
          <div v-else class="insights-list">
            <div 
              v-for="insight in dashboardData.insights.slice(0, 3)" 
              :key="insight.id"
              class="insight-item"
              :class="insight.severity"
            >
              <div class="insight-icon">
                <i :class="getInsightIcon(insight.severity)"></i>
              </div>
              <div class="insight-content">
                <h4>{{ insight.title }}</h4>
                <p>{{ insight.description }}</p>
                <span class="insight-score">Score: {{ Math.round(insight.score * 100) }}%</span>
              </div>
            </div>
            
            <button v-if="dashboardData.insights.length > 3" 
              @click="showAllInsights = true" 
              class="btn btn-link">
              View all {{ dashboardData.insights.length }} insights
            </button>
          </div>
        </div>
      </div>

      <!-- Goal Progress -->
      <div class="dashboard-card goal-progress">
        <div class="card-header">
          <h3>Goal Progress</h3>
        </div>
        <div class="card-content">
          <GoalProgressChart 
            v-if="goalData"
            :data="goalData"
            :height="180"
          />
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="dashboard-card recent-activity">
        <div class="card-header">
          <h3>Recent Activity</h3>
        </div>
        <div class="card-content">
          <div v-if="!dashboardData.recentEvents?.length" class="empty-activity">
            <i class="fas fa-history text-muted"></i>
            <p>No recent activity</p>
          </div>
          <div v-else class="activity-list">
            <div 
              v-for="event in dashboardData.recentEvents.slice(0, 5)" 
              :key="event.id"
              class="activity-item"
            >
              <div class="activity-icon">
                <i :class="getEventIcon(event.eventType)"></i>
              </div>
              <div class="activity-content">
                <span class="activity-text">{{ formatEventText(event) }}</span>
                <span class="activity-time">{{ formatRelativeTime(event.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Board Analytics (if board context) -->
      <div v-if="boardId && dashboardData.board" class="dashboard-card board-analytics">
        <div class="card-header">
          <h3>Board Analytics</h3>
        </div>
        <div class="card-content">
          <BoardAnalyticsChart 
            :data="dashboardData.board"
            :height="180"
          />
        </div>
      </div>
    </div>

    <!-- Detailed Modals -->
    <ProductivityModal 
      v-if="showProductivityDetails"
      :data="dashboardData.productivity"
      @close="showProductivityDetails = false"
    />

    <ActivityModal 
      v-if="showActivityDetails"
      :data="heatmapData"
      @close="showActivityDetails = false"
    />

    <InsightsModal 
      v-if="showAllInsights"
      :insights="dashboardData.insights"
      @close="showAllInsights = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAnalyticsStore } from '@/stores/analytics';
import { useToast } from '@/composables/useToast';
import ProductivityChart from './components/ProductivityChart.vue';
import ActivityHeatmap from './components/ActivityHeatmap.vue';
import GoalProgressChart from './components/GoalProgressChart.vue';
import BoardAnalyticsChart from './components/BoardAnalyticsChart.vue';
import ProductivityModal from './modals/ProductivityModal.vue';
import ActivityModal from './modals/ActivityModal.vue';
import InsightsModal from './modals/InsightsModal.vue';

const route = useRoute();
const analyticsStore = useAnalyticsStore();
const toast = useToast();

const boardId = computed(() => route.params.id as string || null);
const selectedPeriod = ref('30');
const selectedBoard = ref('');
const showProductivityDetails = ref(false);
const showActivityDetails = ref(false);
const showAllInsights = ref(false);

const dashboardData = computed(() => analyticsStore.dashboardData);
const heatmapData = computed(() => analyticsStore.activityHeatmap);
const goalData = computed(() => analyticsStore.goalProgress);
const loading = computed(() => analyticsStore.loading);

onMounted(async () => {
  await loadDashboard();
  if (boardId.value) {
    await loadBoardSpecificData();
  }
});

async function loadDashboard() {
  try {
    const queryBoardId = selectedBoard.value || boardId.value;
    await analyticsStore.fetchDashboardData({
      boardId: queryBoardId,
      daysPeriod: parseInt(selectedPeriod.value),
      includeInsights: true,
      includeComparisons: false,
    });
  } catch (error) {
    toast.error('Failed to load dashboard data');
  }
}

async function loadBoardSpecificData() {
  if (!boardId.value) return;
  
  try {
    await Promise.all([
      analyticsStore.fetchActivityHeatmap(boardId.value, parseInt(selectedPeriod.value) * 3),
      analyticsStore.fetchGoalProgress(boardId.value, 'month'),
    ]);
  } catch (error) {
    console.error('Failed to load board-specific data:', error);
  }
}

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
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

function getInsightIcon(severity: string): string {
  const icons = {
    info: 'fas fa-info-circle',
    warning: 'fas fa-exclamation-triangle',
    critical: 'fas fa-exclamation-circle',
  };
  return icons[severity] || icons.info;
}

function getEventIcon(eventType: string): string {
  const icons = {
    card_created: 'fas fa-plus',
    card_completed: 'fas fa-check',
    card_moved: 'fas fa-arrows-alt',
    list_created: 'fas fa-list',
    board_accessed: 'fas fa-eye',
    collaboration_event: 'fas fa-users',
    search_performed: 'fas fa-search',
    template_used: 'fas fa-layer-group',
  };
  return icons[eventType] || 'fas fa-circle';
}

function formatEventText(event: any): string {
  const actions = {
    card_created: 'created a card',
    card_completed: 'completed a card',
    card_moved: 'moved a card',
    list_created: 'created a list',
    board_accessed: 'accessed a board',
    collaboration_event: 'collaborated on a board',
    search_performed: 'performed a search',
    template_used: 'used a template',
  };
  return actions[event.eventType] || event.eventType;
}
</script>

<style scoped>
.analytics-dashboard {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.dashboard-controls {
  display: flex;
  gap: 1rem;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: white;
}

.stat-icon.cards-created { background: var(--blue-500); }
.stat-icon.cards-completed { background: var(--green-500); }
.stat-icon.boards-accessed { background: var(--purple-500); }
.stat-icon.active-time { background: var(--orange-500); }

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.dashboard-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 1.5rem 1.5rem 0;
}

.card-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.insight-count {
  background: var(--primary-100);
  color: var(--primary-700);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.card-content {
  padding: 1.5rem;
}

.empty-insights, .empty-activity {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-insights i, .empty-activity i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.3;
}

.insights-list, .activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.insight-item.info {
  background: var(--blue-50);
  border-left-color: var(--blue-500);
}

.insight-item.warning {
  background: var(--yellow-50);
  border-left-color: var(--yellow-500);
}

.insight-item.critical {
  background: var(--red-50);
  border-left-color: var(--red-500);
}

.insight-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.insight-item.info .insight-icon { color: var(--blue-600); }
.insight-item.warning .insight-icon { color: var(--yellow-600); }
.insight-item.critical .insight-icon { color: var(--red-600); }

.insight-content h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.insight-content p {
  margin: 0 0 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.insight-score {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.activity-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.activity-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.activity-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-bottom: 0.125rem;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.productivity-overview {
  grid-column: span 2;
}

.activity-heatmap {
  grid-column: span 2;
}

.form-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
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

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover {
  background: var(--gray-100);
}

.btn-link {
  background: none;
  border: none;
  color: var(--primary-600);
  text-decoration: underline;
  font-size: 0.875rem;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.text-muted {
  color: var(--text-muted);
}

/* Responsive Design */
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .productivity-overview,
  .activity-heatmap {
    grid-column: span 1;
  }
  
  .quick-stats {
    grid-template-columns: 1fr;
  }
  
  .dashboard-controls {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
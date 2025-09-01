<template>
  <div class="goal-progress-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-controls">
        <select v-model="selectedPeriod" @change="onPeriodChange" class="period-select">
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
        </select>
      </div>
    </div>
    
    <div class="chart-container">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading goal progress...</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="retry" class="retry-button">Retry</button>
      </div>
      
      <div v-else-if="goalData" class="chart-content">
        <!-- Main progress circle -->
        <div class="main-progress">
          <div class="progress-circle-container">
            <svg class="progress-circle" viewBox="0 0 200 200">
              <!-- Background circle -->
              <circle cx="100" cy="100" r="85" 
                      fill="none" 
                      stroke="#e5e7eb" 
                      stroke-width="10"/>
              
              <!-- Progress arc -->
              <circle cx="100" cy="100" r="85"
                      fill="none"
                      stroke="#3b82f6"
                      stroke-width="10"
                      stroke-linecap="round"
                      :stroke-dasharray="circumference"
                      :stroke-dashoffset="progressOffset"
                      transform="rotate(-90 100 100)"
                      class="progress-arc"/>
              
              <!-- Center content -->
              <text x="100" y="90" 
                    text-anchor="middle" 
                    class="progress-percentage">
                {{ Math.round(completionRate * 100) }}%
              </text>
              <text x="100" y="115" 
                    text-anchor="middle" 
                    class="progress-label">
                Complete
              </text>
            </svg>
          </div>
          
          <div class="progress-details">
            <div class="detail-item">
              <span class="detail-value">{{ goalData.cardsCompleted || 0 }}</span>
              <span class="detail-label">Cards Completed</span>
            </div>
            <div class="detail-item">
              <span class="detail-value">{{ formatActiveTime(goalData.activeTime || 0) }}</span>
              <span class="detail-label">Active Time</span>
            </div>
          </div>
        </div>
        
        <!-- Goal breakdown -->
        <div class="goals-breakdown">
          <h4 class="breakdown-title">Goal Breakdown</h4>
          <div class="goals-list">
            <div v-for="goal in goals" :key="goal.id" class="goal-item">
              <div class="goal-header">
                <span class="goal-name">{{ goal.name }}</span>
                <span class="goal-progress">{{ goal.progress }}%</span>
              </div>
              <div class="goal-bar">
                <div class="goal-bar-bg">
                  <div class="goal-bar-fill" 
                       :style="{ width: goal.progress + '%', backgroundColor: goal.color }"></div>
                </div>
              </div>
              <div class="goal-details">
                <span class="goal-current">{{ goal.current }} / {{ goal.target }}</span>
                <span class="goal-unit">{{ goal.unit }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Productivity insights -->
        <div v-if="productivityInsights.length > 0" class="productivity-insights">
          <h4 class="insights-title">Productivity Insights</h4>
          <div class="insights-list">
            <div v-for="insight in productivityInsights" :key="insight.id" 
                 class="insight-item"
                 :class="getInsightClass(insight.type)">
              <div class="insight-icon">
                <i :class="getInsightIcon(insight.type)"></i>
              </div>
              <div class="insight-content">
                <div class="insight-title">{{ insight.title }}</div>
                <div class="insight-description">{{ insight.description }}</div>
              </div>
              <div class="insight-impact">
                <span class="impact-badge" :class="getImpactClass(insight.impact)">
                  {{ insight.impact }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Weekly comparison -->
        <div v-if="showComparison && comparisonData" class="comparison-section">
          <h4 class="comparison-title">{{ selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1) }} Comparison</h4>
          <div class="comparison-grid">
            <div class="comparison-item">
              <div class="comparison-metric">Cards Completed</div>
              <div class="comparison-values">
                <span class="current-value">{{ comparisonData.current.cards }}</span>
                <span class="comparison-arrow" :class="getComparisonClass(comparisonData.cards.trend)">
                  <i :class="getComparisonIcon(comparisonData.cards.trend)"></i>
                </span>
                <span class="previous-value">{{ comparisonData.previous.cards }}</span>
              </div>
              <div class="comparison-change" :class="getComparisonClass(comparisonData.cards.trend)">
                {{ formatChange(comparisonData.cards.change) }}
              </div>
            </div>
            
            <div class="comparison-item">
              <div class="comparison-metric">Active Time</div>
              <div class="comparison-values">
                <span class="current-value">{{ formatActiveTime(comparisonData.current.time) }}</span>
                <span class="comparison-arrow" :class="getComparisonClass(comparisonData.time.trend)">
                  <i :class="getComparisonIcon(comparisonData.time.trend)"></i>
                </span>
                <span class="previous-value">{{ formatActiveTime(comparisonData.previous.time) }}</span>
              </div>
              <div class="comparison-change" :class="getComparisonClass(comparisonData.time.trend)">
                {{ formatChange(comparisonData.time.change) }}
              </div>
            </div>
            
            <div class="comparison-item">
              <div class="comparison-metric">Completion Rate</div>
              <div class="comparison-values">
                <span class="current-value">{{ Math.round(comparisonData.current.rate * 100) }}%</span>
                <span class="comparison-arrow" :class="getComparisonClass(comparisonData.rate.trend)">
                  <i :class="getComparisonIcon(comparisonData.rate.trend)"></i>
                </span>
                <span class="previous-value">{{ Math.round(comparisonData.previous.rate * 100) }}%</span>
              </div>
              <div class="comparison-change" :class="getComparisonClass(comparisonData.rate.trend)">
                {{ formatPercentageChange(comparisonData.rate.change) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <p>No goal data available for the selected period.</p>
        <p class="empty-subtext">Set some goals to track your progress!</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    default: null
  },
  title: {
    type: String,
    default: 'Goal Progress'
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  showComparison: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['periodChange', 'retry'])

// State
const selectedPeriod = ref('month')

// Data processing
const goalData = computed(() => props.data)

const completionRate = computed(() => {
  if (!goalData.value) return 0
  return goalData.value.completionRate || 0
})

// Progress circle calculations
const circumference = 2 * Math.PI * 85
const progressOffset = computed(() => {
  return circumference - (completionRate.value * circumference)
})

// Sample goals data (in real app, this would come from props or API)
const goals = computed(() => {
  if (!goalData.value) return []
  
  return [
    {
      id: 'cards',
      name: 'Complete Cards',
      current: goalData.value.cardsCompleted || 0,
      target: getTarget('cards'),
      unit: 'cards',
      progress: Math.round(((goalData.value.cardsCompleted || 0) / getTarget('cards')) * 100),
      color: '#10b981'
    },
    {
      id: 'time',
      name: 'Active Time',
      current: Math.round((goalData.value.activeTime || 0) * 10) / 10,
      target: getTarget('time'),
      unit: 'hours',
      progress: Math.round(((goalData.value.activeTime || 0) / getTarget('time')) * 100),
      color: '#3b82f6'
    },
    {
      id: 'consistency',
      name: 'Daily Consistency',
      current: getDaysWorked(),
      target: getPeriodDays(),
      unit: 'days',
      progress: Math.round((getDaysWorked() / getPeriodDays()) * 100),
      color: '#f59e0b'
    }
  ]
})

const productivityInsights = computed(() => {
  if (!goalData.value || !goalData.value.productivity) return []
  return goalData.value.productivity.slice(0, 3)
})

// Sample comparison data
const comparisonData = computed(() => {
  if (!goalData.value || !props.showComparison) return null
  
  // This would come from the API in a real implementation
  return {
    current: {
      cards: goalData.value.cardsCompleted || 0,
      time: goalData.value.activeTime || 0,
      rate: completionRate.value
    },
    previous: {
      cards: Math.max(0, (goalData.value.cardsCompleted || 0) - Math.round(Math.random() * 5)),
      time: Math.max(0, (goalData.value.activeTime || 0) - Math.random() * 2),
      rate: Math.max(0, completionRate.value - (Math.random() * 0.2 - 0.1))
    },
    cards: {
      change: 0.15,
      trend: 'up'
    },
    time: {
      change: 0.08,
      trend: 'up'
    },
    rate: {
      change: 0.05,
      trend: 'up'
    }
  }
})

// Helper functions
const getTarget = (type) => {
  const targets = {
    week: { cards: 20, time: 15 },
    month: { cards: 80, time: 60 },
    quarter: { cards: 240, time: 180 }
  }
  return targets[selectedPeriod.value][type] || 50
}

const getDaysWorked = () => {
  // This would be calculated from actual activity data
  const periodDays = getPeriodDays()
  return Math.round(periodDays * (0.6 + Math.random() * 0.3))
}

const getPeriodDays = () => {
  const days = {
    week: 7,
    month: 30,
    quarter: 90
  }
  return days[selectedPeriod.value] || 30
}

const formatActiveTime = (hours) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  }
  return `${Math.round(hours * 10) / 10}h`
}

const getInsightClass = (type) => {
  const classes = {
    productivity: 'insight-productivity',
    performance: 'insight-performance',
    efficiency: 'insight-efficiency',
    quality: 'insight-quality'
  }
  return classes[type] || 'insight-default'
}

const getInsightIcon = (type) => {
  const icons = {
    productivity: 'fas fa-chart-line',
    performance: 'fas fa-tachometer-alt',
    efficiency: 'fas fa-cogs',
    quality: 'fas fa-star'
  }
  return icons[type] || 'fas fa-info-circle'
}

const getImpactClass = (impact) => {
  const classes = {
    high: 'impact-high',
    medium: 'impact-medium',
    low: 'impact-low'
  }
  return classes[impact] || 'impact-medium'
}

const getComparisonClass = (trend) => {
  const classes = {
    up: 'trend-up',
    down: 'trend-down',
    stable: 'trend-stable'
  }
  return classes[trend] || 'trend-stable'
}

const getComparisonIcon = (trend) => {
  const icons = {
    up: 'fas fa-arrow-up',
    down: 'fas fa-arrow-down',
    stable: 'fas fa-minus'
  }
  return icons[trend] || 'fas fa-minus'
}

const formatChange = (change) => {
  const percent = Math.round(Math.abs(change) * 100)
  return `${percent}% ${change >= 0 ? 'increase' : 'decrease'}`
}

const formatPercentageChange = (change) => {
  const points = Math.round(Math.abs(change) * 100)
  return `${points} ${points === 1 ? 'point' : 'points'} ${change >= 0 ? 'higher' : 'lower'}`
}

// Event handlers
const onPeriodChange = () => {
  emit('periodChange', selectedPeriod.value)
}

const retry = () => {
  emit('retry')
}

// Lifecycle
onMounted(() => {
  // Component is ready
})
</script>

<style scoped>
.goal-progress-chart {
  @apply w-full bg-white rounded-lg border border-gray-200 p-6;
}

.chart-header {
  @apply flex items-center justify-between mb-6;
}

.chart-title {
  @apply text-lg font-semibold text-gray-900;
}

.chart-controls {
  @apply flex items-center gap-3;
}

.period-select {
  @apply px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.chart-container {
  @apply relative;
}

.loading-state {
  @apply flex flex-col items-center justify-center py-16;
}

.loading-spinner {
  @apply w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3;
}

.error-state {
  @apply flex flex-col items-center justify-center py-16;
}

.error-message {
  @apply text-red-600 mb-3;
}

.retry-button {
  @apply px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors;
}

.chart-content {
  @apply space-y-8;
}

.main-progress {
  @apply flex items-center justify-between;
}

.progress-circle-container {
  @apply flex-shrink-0;
  width: 200px;
  height: 200px;
}

.progress-circle {
  @apply w-full h-full;
}

.progress-arc {
  @apply transition-all duration-1000 ease-out;
}

.progress-percentage {
  @apply text-2xl font-bold fill-gray-900;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.progress-label {
  @apply text-sm fill-gray-600;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.progress-details {
  @apply flex-1 ml-8 grid grid-cols-1 gap-6;
}

.detail-item {
  @apply text-center;
}

.detail-value {
  @apply block text-3xl font-bold text-gray-900 mb-1;
}

.detail-label {
  @apply block text-sm text-gray-600;
}

.goals-breakdown {
  @apply border-t border-gray-200 pt-6;
}

.breakdown-title {
  @apply text-base font-semibold text-gray-900 mb-4;
}

.goals-list {
  @apply space-y-4;
}

.goal-item {
  @apply bg-gray-50 rounded-lg p-4;
}

.goal-header {
  @apply flex items-center justify-between mb-2;
}

.goal-name {
  @apply font-medium text-gray-900;
}

.goal-progress {
  @apply text-sm font-semibold text-gray-700;
}

.goal-bar {
  @apply mb-2;
}

.goal-bar-bg {
  @apply w-full h-2 bg-gray-200 rounded-full overflow-hidden;
}

.goal-bar-fill {
  @apply h-full rounded-full transition-all duration-500 ease-out;
}

.goal-details {
  @apply flex items-center justify-between text-sm text-gray-600;
}

.productivity-insights {
  @apply border-t border-gray-200 pt-6;
}

.insights-title {
  @apply text-base font-semibold text-gray-900 mb-4;
}

.insights-list {
  @apply space-y-3;
}

.insight-item {
  @apply flex items-center gap-3 p-3 rounded-lg border;
}

.insight-productivity {
  @apply bg-green-50 border-green-200;
}

.insight-performance {
  @apply bg-blue-50 border-blue-200;
}

.insight-efficiency {
  @apply bg-yellow-50 border-yellow-200;
}

.insight-quality {
  @apply bg-purple-50 border-purple-200;
}

.insight-default {
  @apply bg-gray-50 border-gray-200;
}

.insight-icon {
  @apply w-8 h-8 flex items-center justify-center rounded-full bg-white text-sm;
}

.insight-content {
  @apply flex-1;
}

.insight-title {
  @apply font-medium text-gray-900 text-sm;
}

.insight-description {
  @apply text-xs text-gray-600 mt-1;
}

.insight-impact {
  @apply flex-shrink-0;
}

.impact-badge {
  @apply px-2 py-1 text-xs font-medium rounded;
}

.impact-high {
  @apply bg-red-100 text-red-800;
}

.impact-medium {
  @apply bg-yellow-100 text-yellow-800;
}

.impact-low {
  @apply bg-green-100 text-green-800;
}

.comparison-section {
  @apply border-t border-gray-200 pt-6;
}

.comparison-title {
  @apply text-base font-semibold text-gray-900 mb-4;
}

.comparison-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.comparison-item {
  @apply bg-gray-50 rounded-lg p-4 text-center;
}

.comparison-metric {
  @apply text-sm font-medium text-gray-600 mb-2;
}

.comparison-values {
  @apply flex items-center justify-center gap-2 mb-1;
}

.current-value {
  @apply text-lg font-bold text-gray-900;
}

.comparison-arrow {
  @apply text-sm;
}

.previous-value {
  @apply text-sm text-gray-600;
}

.comparison-change {
  @apply text-xs font-medium;
}

.trend-up {
  @apply text-green-600;
}

.trend-down {
  @apply text-red-600;
}

.trend-stable {
  @apply text-gray-600;
}

.empty-state {
  @apply text-center py-16;
}

.empty-subtext {
  @apply text-sm text-gray-500 mt-1;
}
</style>
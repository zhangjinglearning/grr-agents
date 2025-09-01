<template>
  <div class="activity-heatmap">
    <div class="heatmap-header">
      <h3 class="heatmap-title">{{ title }}</h3>
      <div class="heatmap-controls">
        <select v-model="selectedDays" @change="onDaysChange" class="days-select">
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
          <option value="180">Last 6 Months</option>
        </select>
      </div>
    </div>
    
    <div class="heatmap-container">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading activity data...</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="retry" class="retry-button">Retry</button>
      </div>
      
      <div v-else-if="processedData.length > 0" class="heatmap-content">
        <!-- Month labels -->
        <div class="month-labels">
          <div v-for="month in monthLabels" :key="month.key" class="month-label" :style="{ width: month.width + '%' }">
            {{ month.label }}
          </div>
        </div>
        
        <!-- Day labels -->
        <div class="heatmap-grid">
          <div class="day-labels">
            <div v-for="day in dayLabels" :key="day" class="day-label">
              {{ day }}
            </div>
          </div>
          
          <!-- Heatmap cells -->
          <div class="heatmap-cells">
            <div v-for="week in weeks" :key="week.key" class="week-column">
              <div v-for="cell in week.days" :key="cell.key" 
                   class="heatmap-cell"
                   :class="getCellClass(cell)"
                   :title="getCellTooltip(cell)"
                   @click="onCellClick(cell)">
                <div class="cell-content" :style="{ backgroundColor: getCellColor(cell.intensity) }"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Legend -->
        <div class="heatmap-legend">
          <div class="legend-text">Less</div>
          <div class="legend-scale">
            <div v-for="level in intensityLevels" :key="level" 
                 class="legend-cell"
                 :style="{ backgroundColor: getCellColor(level) }"></div>
          </div>
          <div class="legend-text">More</div>
        </div>
        
        <!-- Stats -->
        <div class="heatmap-stats">
          <div class="stat-item">
            <span class="stat-label">Total Activity:</span>
            <span class="stat-value">{{ totalActivity }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Average Daily:</span>
            <span class="stat-value">{{ averageDaily }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Most Active:</span>
            <span class="stat-value">{{ mostActiveDay }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Current Streak:</span>
            <span class="stat-value">{{ currentStreak }} days</span>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <p>No activity data available for the selected period.</p>
        <p class="empty-subtext">Your activity will appear here as you work on tasks!</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: 'Activity Heatmap'
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['daysChange', 'retry', 'cellClick'])

// State
const selectedDays = ref(90)

// Data processing
const processedData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  
  // Create a map of date -> activity count
  const activityMap = new Map()
  
  props.data.forEach(item => {
    const date = new Date(item.date || item.timestamp).toDateString()
    const count = item.count || item.value || 0
    activityMap.set(date, (activityMap.get(date) || 0) + count)
  })
  
  // Generate all days in the selected period
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - selectedDays.value)
  
  const days = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const dateString = currentDate.toDateString()
    days.push({
      date: new Date(currentDate),
      dateString,
      activity: activityMap.get(dateString) || 0
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return days
})

// Calculate intensity levels
const maxActivity = computed(() => {
  return Math.max(...processedData.value.map(d => d.activity), 1)
})

const intensityLevels = computed(() => {
  return [0, 0.25, 0.5, 0.75, 1].map(level => level * maxActivity.value)
})

// Group data into weeks
const weeks = computed(() => {
  const data = processedData.value
  if (data.length === 0) return []
  
  const weeks = []
  let currentWeek = []
  let weekStart = null
  
  // Find the first Sunday before our data starts
  const firstDate = data[0].date
  const startOfWeek = new Date(firstDate)
  startOfWeek.setDate(firstDate.getDate() - firstDate.getDay())
  
  data.forEach((day, index) => {
    const dayOfWeek = day.date.getDay()
    
    // Start a new week on Sunday or if this is the first day
    if (dayOfWeek === 0 || index === 0) {
      if (currentWeek.length > 0) {
        weeks.push({
          key: weekStart.toISOString(),
          days: [...currentWeek]
        })
      }
      currentWeek = []
      weekStart = new Date(day.date)
    }
    
    currentWeek.push({
      key: day.date.toISOString(),
      date: day.date,
      activity: day.activity,
      intensity: Math.min(day.activity / maxActivity.value, 1),
      dayOfWeek: dayOfWeek
    })
  })
  
  // Add the last week
  if (currentWeek.length > 0) {
    weeks.push({
      key: weekStart.toISOString(),
      days: currentWeek
    })
  }
  
  return weeks
})

// Month labels
const monthLabels = computed(() => {
  if (processedData.value.length === 0) return []
  
  const months = []
  let currentMonth = null
  let monthStart = 0
  let dayCount = 0
  
  processedData.value.forEach((day, index) => {
    const month = day.date.getMonth()
    const year = day.date.getFullYear()
    const monthKey = `${year}-${month}`
    
    if (monthKey !== currentMonth) {
      if (currentMonth !== null) {
        months.push({
          key: currentMonth,
          label: new Date(2000, parseInt(currentMonth.split('-')[1]), 1).toLocaleDateString('en-US', { month: 'short' }),
          width: (dayCount / processedData.value.length) * 100
        })
      }
      currentMonth = monthKey
      monthStart = index
      dayCount = 0
    }
    dayCount++
  })
  
  // Add the last month
  if (currentMonth !== null) {
    months.push({
      key: currentMonth,
      label: new Date(2000, parseInt(currentMonth.split('-')[1]), 1).toLocaleDateString('en-US', { month: 'short' }),
      width: (dayCount / processedData.value.length) * 100
    })
  }
  
  return months
})

// Day labels
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Statistics
const totalActivity = computed(() => {
  return processedData.value.reduce((sum, day) => sum + day.activity, 0)
})

const averageDaily = computed(() => {
  const total = totalActivity.value
  const days = processedData.value.length
  return days > 0 ? Math.round(total / days * 10) / 10 : 0
})

const mostActiveDay = computed(() => {
  if (processedData.value.length === 0) return 'None'
  
  const maxDay = processedData.value.reduce((max, day) => 
    day.activity > max.activity ? day : max
  )
  
  return maxDay.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const currentStreak = computed(() => {
  if (processedData.value.length === 0) return 0
  
  let streak = 0
  const today = new Date().toDateString()
  
  // Start from today and work backwards
  for (let i = processedData.value.length - 1; i >= 0; i--) {
    const day = processedData.value[i]
    if (day.activity > 0) {
      streak++
    } else {
      break
    }
  }
  
  return streak
})

// Helper functions
const getCellClass = (cell) => {
  return {
    'has-activity': cell.activity > 0,
    'high-activity': cell.intensity > 0.7
  }
}

const getCellColor = (intensity) => {
  const colors = [
    '#ebedf0', // Level 0
    '#9be9a8', // Level 1
    '#40c463', // Level 2
    '#30a14e', // Level 3
    '#216e39'  // Level 4
  ]
  
  const level = Math.floor(intensity * (colors.length - 1))
  return colors[Math.min(level, colors.length - 1)]
}

const getCellTooltip = (cell) => {
  const date = cell.date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
  const activity = cell.activity
  return `${activity} activities on ${date}`
}

// Event handlers
const onDaysChange = () => {
  emit('daysChange', selectedDays.value)
}

const retry = () => {
  emit('retry')
}

const onCellClick = (cell) => {
  emit('cellClick', {
    date: cell.date,
    activity: cell.activity
  })
}

// Lifecycle
onMounted(() => {
  // Component is ready
})
</script>

<style scoped>
.activity-heatmap {
  @apply w-full bg-white rounded-lg border border-gray-200 p-6;
}

.heatmap-header {
  @apply flex items-center justify-between mb-6;
}

.heatmap-title {
  @apply text-lg font-semibold text-gray-900;
}

.heatmap-controls {
  @apply flex items-center gap-3;
}

.days-select {
  @apply px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.heatmap-container {
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

.heatmap-content {
  @apply space-y-4;
}

.month-labels {
  @apply flex text-xs text-gray-600 mb-2;
  margin-left: 2rem;
}

.month-label {
  @apply text-left;
  min-width: 3rem;
}

.heatmap-grid {
  @apply flex;
}

.day-labels {
  @apply flex flex-col justify-start space-y-1 mr-2 mt-1;
}

.day-label {
  @apply text-xs text-gray-600 h-3 flex items-center;
}

.heatmap-cells {
  @apply flex gap-1;
}

.week-column {
  @apply flex flex-col gap-1;
}

.heatmap-cell {
  @apply cursor-pointer relative;
  width: 12px;
  height: 12px;
}

.cell-content {
  @apply w-full h-full rounded-sm transition-all duration-200;
  border: 1px solid rgba(27, 31, 35, 0.04);
}

.heatmap-cell:hover .cell-content {
  @apply ring-2 ring-blue-500 ring-opacity-50;
  transform: scale(1.1);
}

.heatmap-legend {
  @apply flex items-center justify-center gap-2 mt-4;
}

.legend-text {
  @apply text-xs text-gray-600;
}

.legend-scale {
  @apply flex gap-1;
}

.legend-cell {
  @apply rounded-sm;
  width: 12px;
  height: 12px;
  border: 1px solid rgba(27, 31, 35, 0.04);
}

.heatmap-stats {
  @apply grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200;
}

.stat-item {
  @apply text-center;
}

.stat-label {
  @apply block text-xs text-gray-600 mb-1;
}

.stat-value {
  @apply block text-lg font-semibold text-gray-900;
}

.empty-state {
  @apply text-center py-16;
}

.empty-subtext {
  @apply text-sm text-gray-500 mt-1;
}
</style>
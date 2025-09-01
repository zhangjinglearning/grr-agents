<template>
  <div class="productivity-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-controls">
        <select v-model="selectedPeriod" @change="onPeriodChange" class="period-select">
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="quarter">Last Quarter</option>
        </select>
      </div>
    </div>
    
    <div class="chart-container">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading productivity data...</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="retry" class="retry-button">Retry</button>
      </div>
      
      <div v-else-if="chartData && chartData.length > 0" class="chart-content">
        <div class="chart-canvas" ref="chartCanvas">
          <svg :viewBox="viewBox" class="productivity-svg">
            <!-- Grid lines -->
            <g class="grid">
              <defs>
                <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e5e5e5" stroke-width="1" opacity="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </g>
            
            <!-- Y-axis labels -->
            <g class="y-axis">
              <text v-for="(tick, index) in yTicks" :key="index"
                    :x="40" :y="tick.y" 
                    text-anchor="end" 
                    class="axis-label">
                {{ tick.label }}
              </text>
            </g>
            
            <!-- Chart lines -->
            <g class="chart-lines">
              <!-- Cards completed line -->
              <path :d="cardsCompletedPath" 
                    class="chart-line cards-line" 
                    fill="none" 
                    stroke="#10b981" 
                    stroke-width="2"/>
              
              <!-- Active time line -->
              <path :d="activeTimePath" 
                    class="chart-line time-line" 
                    fill="none" 
                    stroke="#3b82f6" 
                    stroke-width="2"/>
              
              <!-- Productivity score line -->
              <path :d="productivityPath" 
                    class="chart-line productivity-line" 
                    fill="none" 
                    stroke="#f59e0b" 
                    stroke-width="2"/>
            </g>
            
            <!-- Data points -->
            <g class="data-points">
              <circle v-for="(point, index) in cardsPoints" :key="`cards-${index}`"
                      :cx="point.x" :cy="point.y" r="4"
                      class="data-point cards-point"
                      fill="#10b981"
                      @mouseover="showTooltip($event, point, 'Cards Completed')"
                      @mouseout="hideTooltip"/>
              
              <circle v-for="(point, index) in timePoints" :key="`time-${index}`"
                      :cx="point.x" :cy="point.y" r="4"
                      class="data-point time-point"
                      fill="#3b82f6"
                      @mouseover="showTooltip($event, point, 'Active Time')"
                      @mouseout="hideTooltip"/>
              
              <circle v-for="(point, index) in productivityPoints" :key="`prod-${index}`"
                      :cx="point.x" :cy="point.y" r="4"
                      class="data-point productivity-point"
                      fill="#f59e0b"
                      @mouseover="showTooltip($event, point, 'Productivity Score')"
                      @mouseout="hideTooltip"/>
            </g>
            
            <!-- X-axis labels -->
            <g class="x-axis">
              <text v-for="(tick, index) in xTicks" :key="index"
                    :x="tick.x" :y="chartHeight - 10"
                    text-anchor="middle"
                    class="axis-label">
                {{ tick.label }}
              </text>
            </g>
          </svg>
        </div>
        
        <!-- Legend -->
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color" style="background-color: #10b981;"></span>
            <span class="legend-label">Cards Completed</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: #3b82f6;"></span>
            <span class="legend-label">Active Time (hours)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: #f59e0b;"></span>
            <span class="legend-label">Productivity Score</span>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <p>No productivity data available for the selected period.</p>
        <p class="empty-subtext">Start working on tasks to see your productivity trends!</p>
      </div>
    </div>
    
    <!-- Tooltip -->
    <div v-if="tooltip.show" 
         class="chart-tooltip" 
         :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      <div class="tooltip-title">{{ tooltip.title }}</div>
      <div class="tooltip-value">{{ tooltip.value }}</div>
      <div class="tooltip-date">{{ tooltip.date }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: 'Productivity Trends'
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

const emit = defineEmits(['periodChange', 'retry'])

// State
const selectedPeriod = ref('month')
const chartCanvas = ref(null)
const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  title: '',
  value: '',
  date: ''
})

// Chart dimensions
const chartWidth = 800
const chartHeight = 400
const padding = { top: 20, right: 50, bottom: 60, left: 60 }
const plotWidth = chartWidth - padding.left - padding.right
const plotHeight = chartHeight - padding.top - padding.bottom

const viewBox = computed(() => `0 0 ${chartWidth} ${chartHeight}`)

// Data processing
const processedData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  
  return props.data.map(item => ({
    date: new Date(item.date),
    cardsCompleted: item.cardsCompleted || 0,
    activeTime: item.activeTime || 0,
    productivityScore: item.productivityScore || 0
  })).sort((a, b) => a.date - b.date)
})

// Scale calculations
const xScale = computed(() => {
  const data = processedData.value
  if (data.length === 0) return { min: 0, max: 1, step: 1 }
  
  const minDate = data[0].date
  const maxDate = data[data.length - 1].date
  const range = maxDate - minDate
  
  return {
    min: minDate.getTime(),
    max: maxDate.getTime(),
    step: range / (data.length - 1)
  }
})

const yScale = computed(() => {
  const data = processedData.value
  if (data.length === 0) return { min: 0, max: 100 }
  
  const allValues = data.flatMap(d => [d.cardsCompleted, d.activeTime, d.productivityScore])
  const maxValue = Math.max(...allValues, 10)
  
  return {
    min: 0,
    max: Math.ceil(maxValue * 1.1)
  }
})

// Coordinate conversion
const getX = (date) => {
  const scale = xScale.value
  return padding.left + ((date.getTime() - scale.min) / (scale.max - scale.min)) * plotWidth
}

const getY = (value) => {
  const scale = yScale.value
  return padding.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight
}

// Chart paths
const cardsCompletedPath = computed(() => {
  const data = processedData.value
  if (data.length === 0) return ''
  
  let path = `M ${getX(data[0].date)} ${getY(data[0].cardsCompleted)}`
  for (let i = 1; i < data.length; i++) {
    path += ` L ${getX(data[i].date)} ${getY(data[i].cardsCompleted)}`
  }
  
  return path
})

const activeTimePath = computed(() => {
  const data = processedData.value
  if (data.length === 0) return ''
  
  let path = `M ${getX(data[0].date)} ${getY(data[0].activeTime)}`
  for (let i = 1; i < data.length; i++) {
    path += ` L ${getX(data[i].date)} ${getY(data[i].activeTime)}`
  }
  
  return path
})

const productivityPath = computed(() => {
  const data = processedData.value
  if (data.length === 0) return ''
  
  let path = `M ${getX(data[0].date)} ${getY(data[0].productivityScore)}`
  for (let i = 1; i < data.length; i++) {
    path += ` L ${getX(data[i].date)} ${getY(data[i].productivityScore)}`
  }
  
  return path
})

// Data points
const cardsPoints = computed(() => {
  return processedData.value.map(d => ({
    x: getX(d.date),
    y: getY(d.cardsCompleted),
    value: d.cardsCompleted,
    date: d.date
  }))
})

const timePoints = computed(() => {
  return processedData.value.map(d => ({
    x: getX(d.date),
    y: getY(d.activeTime),
    value: d.activeTime,
    date: d.date
  }))
})

const productivityPoints = computed(() => {
  return processedData.value.map(d => ({
    x: getX(d.date),
    y: getY(d.productivityScore),
    value: d.productivityScore,
    date: d.date
  }))
})

// Axis ticks
const xTicks = computed(() => {
  const data = processedData.value
  if (data.length === 0) return []
  
  const ticks = []
  const step = Math.max(1, Math.floor(data.length / 6))
  
  for (let i = 0; i < data.length; i += step) {
    const item = data[i]
    ticks.push({
      x: getX(item.date),
      label: item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })
  }
  
  return ticks
})

const yTicks = computed(() => {
  const scale = yScale.value
  const ticks = []
  const step = (scale.max - scale.min) / 5
  
  for (let i = 0; i <= 5; i++) {
    const value = scale.min + (step * i)
    ticks.push({
      y: getY(value),
      label: Math.round(value).toString()
    })
  }
  
  return ticks
})

// Event handlers
const onPeriodChange = () => {
  emit('periodChange', selectedPeriod.value)
}

const retry = () => {
  emit('retry')
}

const showTooltip = (event, point, title) => {
  const rect = event.target.getBoundingClientRect()
  tooltip.value = {
    show: true,
    x: rect.left + window.scrollX + 10,
    y: rect.top + window.scrollY - 10,
    title,
    value: formatTooltipValue(point.value, title),
    date: point.date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

const formatTooltipValue = (value, title) => {
  if (title === 'Active Time') {
    return `${value.toFixed(1)} hours`
  } else if (title === 'Productivity Score') {
    return `${value.toFixed(1)}%`
  } else {
    return value.toString()
  }
}

// Lifecycle
onMounted(() => {
  nextTick(() => {
    // Chart is ready
  })
})
</script>

<style scoped>
.productivity-chart {
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
  @apply space-y-4;
}

.chart-canvas {
  @apply w-full;
}

.productivity-svg {
  @apply w-full h-auto;
  max-height: 400px;
}

.axis-label {
  @apply text-xs fill-gray-600;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.chart-line {
  @apply transition-opacity duration-200;
}

.chart-line:hover {
  @apply opacity-80;
}

.data-point {
  @apply cursor-pointer transition-all duration-200;
}

.data-point:hover {
  @apply scale-125;
}

.chart-legend {
  @apply flex items-center justify-center gap-6 mt-4;
}

.legend-item {
  @apply flex items-center gap-2;
}

.legend-color {
  @apply w-3 h-3 rounded-full;
}

.legend-label {
  @apply text-sm text-gray-700;
}

.empty-state {
  @apply text-center py-16;
}

.empty-subtext {
  @apply text-sm text-gray-500 mt-1;
}

.chart-tooltip {
  @apply absolute bg-gray-900 text-white px-3 py-2 rounded-md text-sm pointer-events-none z-10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tooltip-title {
  @apply font-medium;
}

.tooltip-value {
  @apply text-blue-200;
}

.tooltip-date {
  @apply text-gray-300 text-xs mt-1;
}
</style>
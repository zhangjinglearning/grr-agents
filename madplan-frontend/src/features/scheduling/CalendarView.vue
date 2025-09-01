<template>
  <div class="calendar-view">
    <!-- Calendar Header -->
    <div class="calendar-header">
      <div class="header-controls">
        <button @click="previousPeriod" class="nav-button">
          <span class="icon">‹</span>
        </button>
        
        <div class="period-selector">
          <h2 class="current-period">{{ currentPeriodLabel }}</h2>
          <div class="view-modes">
            <button
              v-for="mode in viewModes"
              :key="mode.value"
              @click="currentView = mode.value"
              :class="['view-mode', { active: currentView === mode.value }]"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>
        
        <button @click="nextPeriod" class="nav-button">
          <span class="icon">›</span>
        </button>
      </div>
      
      <div class="header-actions">
        <button @click="goToToday" class="btn btn-secondary">
          <span class="icon">📍</span>
          Today
        </button>
        <button @click="showCreateEvent = true" class="btn btn-primary">
          <span class="icon">➕</span>
          Schedule Task
        </button>
      </div>
    </div>

    <!-- Calendar Content -->
    <div class="calendar-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <LoadingSpinner variant="ghibli" size="large" />
        <p>Loading calendar...</p>
      </div>

      <!-- Month View -->
      <div v-else-if="currentView === 'month'" class="month-view">
        <!-- Day Headers -->
        <div class="month-header">
          <div v-for="day in dayNames" :key="day" class="day-header">
            {{ day }}
          </div>
        </div>
        
        <!-- Calendar Grid -->
        <div class="month-grid">
          <div
            v-for="day in monthDays"
            :key="`${day.date}-${day.month}`"
            :class="['day-cell', {
              'other-month': day.isOtherMonth,
              'today': day.isToday,
              'has-events': day.events.length > 0
            }]"
            @click="selectDay(day)"
          >
            <div class="day-number">{{ day.date }}</div>
            
            <!-- Day Events -->
            <div v-if="day.events.length > 0" class="day-events">
              <div
                v-for="event in day.events.slice(0, 3)"
                :key="event.id"
                :class="['event-item', `priority-${event.priority}`, `status-${event.status}`]"
                @click.stop="selectEvent(event)"
                :title="event.title"
              >
                <span class="event-time">{{ formatTime(event.dueDate) }}</span>
                <span class="event-title">{{ event.title }}</span>
              </div>
              
              <div v-if="day.events.length > 3" class="more-events">
                +{{ day.events.length - 3 }} more
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="currentView === 'week'" class="week-view">
        <!-- Week Header -->
        <div class="week-header">
          <div class="time-column"></div>
          <div
            v-for="day in weekDays"
            :key="day.date"
            :class="['week-day-header', { today: day.isToday }]"
          >
            <div class="day-name">{{ day.dayName }}</div>
            <div class="day-date">{{ day.date }}</div>
          </div>
        </div>
        
        <!-- Week Grid -->
        <div class="week-grid">
          <!-- Time Slots -->
          <div class="time-slots">
            <div
              v-for="hour in dayHours"
              :key="hour"
              class="time-slot"
            >
              {{ formatHour(hour) }}
            </div>
          </div>
          
          <!-- Week Days -->
          <div
            v-for="day in weekDays"
            :key="day.date"
            class="week-day-column"
          >
            <div
              v-for="hour in dayHours"
              :key="hour"
              :class="['hour-slot', { 'current-hour': isCurrentHour(day, hour) }]"
              @click="createEventAtTime(day, hour)"
            >
              <!-- Events in this hour -->
              <div
                v-for="event in getEventsForHour(day, hour)"
                :key="event.id"
                :class="['week-event', `priority-${event.priority}`, `status-${event.status}`]"
                @click.stop="selectEvent(event)"
              >
                <div class="event-time">{{ formatTime(event.dueDate) }}</div>
                <div class="event-title">{{ event.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Day View -->
      <div v-else-if="currentView === 'day'" class="day-view">
        <div class="day-header">
          <h3 class="day-title">
            {{ selectedDay.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) }}
          </h3>
        </div>
        
        <div class="day-schedule">
          <div class="time-slots">
            <div
              v-for="hour in dayHours"
              :key="hour"
              class="time-slot"
            >
              {{ formatHour(hour) }}
            </div>
          </div>
          
          <div class="day-events-column">
            <div
              v-for="hour in dayHours"
              :key="hour"
              :class="['hour-slot', { 'current-hour': isCurrentHourToday(hour) }]"
              @click="createEventAtTime(selectedDay, hour)"
            >
              <!-- Events in this hour -->
              <div
                v-for="event in getEventsForDayHour(hour)"
                :key="event.id"
                :class="['day-event', `priority-${event.priority}`, `status-${event.status}`]"
                @click.stop="selectEvent(event)"
              >
                <div class="event-time">{{ formatTime(event.dueDate) }}</div>
                <div class="event-title">{{ event.title }}</div>
                <div class="event-status">{{ event.status }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Details Modal -->
    <EventDetailsModal
      v-if="selectedEvent"
      :event="selectedEvent"
      :is-open="!!selectedEvent"
      @close="selectedEvent = null"
      @edit="editEvent"
      @delete="deleteEvent"
      @complete="completeEvent"
    />

    <!-- Create/Edit Event Modal -->
    <CreateEventModal
      v-if="showCreateEvent || editingEvent"
      :event="editingEvent"
      :default-date="defaultEventDate"
      :is-open="showCreateEvent || !!editingEvent"
      @close="closeCreateEvent"
      @save="handleEventSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSchedulingStore } from '../../stores/scheduling'
import { SchedulingStatus, type CardScheduling } from '../../services/scheduling.service'
import LoadingSpinner from '../../components/feedback/LoadingSpinner.vue'
import EventDetailsModal from './EventDetailsModal.vue'
import CreateEventModal from './CreateEventModal.vue'

type ViewMode = 'month' | 'week' | 'day'

const schedulingStore = useSchedulingStore()

// Reactive state
const currentView = ref<ViewMode>('month')
const currentDate = ref(new Date())
const selectedDay = ref(new Date())
const selectedEvent = ref<CardScheduling | null>(null)
const editingEvent = ref<CardScheduling | null>(null)
const showCreateEvent = ref(false)
const defaultEventDate = ref<Date | null>(null)
const isLoading = ref(false)

// Computed properties
const viewModes = computed(() => [
  { value: 'month' as const, label: 'Month' },
  { value: 'week' as const, label: 'Week' },
  { value: 'day' as const, label: 'Day' }
])

const currentPeriodLabel = computed(() => {
  const date = currentDate.value
  
  switch (currentView.value) {
    case 'month':
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    case 'week':
      const weekStart = getWeekStart(date)
      const weekEnd = getWeekEnd(date)
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    case 'day':
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    default:
      return ''
  }
})

const dayNames = computed(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

const dayHours = computed(() => Array.from({ length: 24 }, (_, i) => i))

const monthDays = computed(() => {
  const firstDay = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1)
  const lastDay = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0)
  const firstDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  
  const days = []
  const today = new Date()
  
  // Previous month's trailing days
  const prevMonth = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 0)
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = prevMonth.getDate() - i
    const dayDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, date)
    days.push({
      date,
      month: currentDate.value.getMonth() - 1,
      year: currentDate.value.getFullYear(),
      fullDate: dayDate,
      isOtherMonth: true,
      isToday: false,
      events: getEventsForDay(dayDate)
    })
  }
  
  // Current month's days
  for (let date = 1; date <= daysInMonth; date++) {
    const dayDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), date)
    const isToday = dayDate.toDateString() === today.toDateString()
    
    days.push({
      date,
      month: currentDate.value.getMonth(),
      year: currentDate.value.getFullYear(),
      fullDate: dayDate,
      isOtherMonth: false,
      isToday,
      events: getEventsForDay(dayDate)
    })
  }
  
  // Next month's leading days
  const remainingCells = 42 - days.length
  for (let date = 1; date <= remainingCells; date++) {
    const dayDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, date)
    days.push({
      date,
      month: currentDate.value.getMonth() + 1,
      year: currentDate.value.getFullYear(),
      fullDate: dayDate,
      isOtherMonth: true,
      isToday: false,
      events: getEventsForDay(dayDate)
    })
  }
  
  return days
})

const weekDays = computed(() => {
  const weekStart = getWeekStart(currentDate.value)
  const days = []
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + i)
    
    days.push({
      date: day.getDate(),
      fullDate: day,
      dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: day.toDateString() === new Date().toDateString(),
      events: getEventsForDay(day)
    })
  }
  
  return days
})

// Methods
const getWeekStart = (date: Date) => {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  return start
}

const getWeekEnd = (date: Date) => {
  const end = new Date(date)
  end.setDate(date.getDate() + (6 - date.getDay()))
  return end
}

const getEventsForDay = (date: Date) => {
  return schedulingStore.scheduledCards.filter(card => {
    if (!card.dueDate) return false
    const cardDate = new Date(card.dueDate)
    return cardDate.toDateString() === date.toDateString()
  }).map(card => ({
    id: card.id,
    title: card.card?.content || 'Untitled Card',
    dueDate: card.dueDate,
    priority: card.priority || 'medium',
    status: card.status,
    cardId: card.cardId
  }))
}

const getEventsForHour = (day: any, hour: number) => {
  return day.events.filter((event: any) => {
    const eventDate = new Date(event.dueDate)
    return eventDate.getHours() === hour
  })
}

const getEventsForDayHour = (hour: number) => {
  const dayEvents = getEventsForDay(selectedDay.value)
  return dayEvents.filter(event => {
    const eventDate = new Date(event.dueDate)
    return eventDate.getHours() === hour
  })
}

const isCurrentHour = (day: any, hour: number) => {
  const now = new Date()
  return day.isToday && now.getHours() === hour
}

const isCurrentHourToday = (hour: number) => {
  const now = new Date()
  const today = new Date().toDateString()
  return selectedDay.value.toDateString() === today && now.getHours() === hour
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

const formatHour = (hour: number) => {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric',
    hour12: true 
  })
}

const previousPeriod = () => {
  const newDate = new Date(currentDate.value)
  
  switch (currentView.value) {
    case 'month':
      newDate.setMonth(newDate.getMonth() - 1)
      break
    case 'week':
      newDate.setDate(newDate.getDate() - 7)
      break
    case 'day':
      newDate.setDate(newDate.getDate() - 1)
      selectedDay.value = new Date(newDate)
      break
  }
  
  currentDate.value = newDate
}

const nextPeriod = () => {
  const newDate = new Date(currentDate.value)
  
  switch (currentView.value) {
    case 'month':
      newDate.setMonth(newDate.getMonth() + 1)
      break
    case 'week':
      newDate.setDate(newDate.getDate() + 7)
      break
    case 'day':
      newDate.setDate(newDate.getDate() + 1)
      selectedDay.value = new Date(newDate)
      break
  }
  
  currentDate.value = newDate
}

const goToToday = () => {
  const today = new Date()
  currentDate.value = today
  selectedDay.value = today
}

const selectDay = (day: any) => {
  selectedDay.value = day.fullDate
  if (currentView.value !== 'day') {
    currentView.value = 'day'
  }
}

const selectEvent = (event: any) => {
  // Find the full scheduling object
  const fullEvent = schedulingStore.scheduledCards.find(card => card.cardId === event.cardId)
  if (fullEvent) {
    selectedEvent.value = fullEvent
  }
}

const createEventAtTime = (day: any, hour: number) => {
  const eventDate = new Date(day.fullDate || day)
  eventDate.setHours(hour, 0, 0, 0)
  defaultEventDate.value = eventDate
  showCreateEvent.value = true
}

const editEvent = (event: CardScheduling) => {
  editingEvent.value = event
  selectedEvent.value = null
}

const deleteEvent = async (event: CardScheduling) => {
  if (confirm('Are you sure you want to remove the schedule for this card?')) {
    await schedulingStore.deleteScheduling(event.cardId)
    selectedEvent.value = null
  }
}

const completeEvent = async (event: CardScheduling) => {
  await schedulingStore.markCardCompleted(event.cardId)
  selectedEvent.value = null
}

const closeCreateEvent = () => {
  showCreateEvent.value = false
  editingEvent.value = null
  defaultEventDate.value = null
}

const handleEventSave = async (eventData: any) => {
  try {
    if (editingEvent.value) {
      await schedulingStore.updateScheduling({
        cardId: editingEvent.value.cardId,
        ...eventData
      })
    } else {
      await schedulingStore.createScheduling(eventData)
    }
    closeCreateEvent()
  } catch (error) {
    console.error('Failed to save event:', error)
  }
}

const loadCalendarData = async () => {
  try {
    isLoading.value = true
    
    // Calculate date range based on current view
    let startDate: Date, endDate: Date
    
    switch (currentView.value) {
      case 'month':
        startDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1)
        endDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0)
        break
      case 'week':
        startDate = getWeekStart(currentDate.value)
        endDate = getWeekEnd(currentDate.value)
        break
      case 'day':
        startDate = new Date(selectedDay.value)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(selectedDay.value)
        endDate.setHours(23, 59, 59, 999)
        break
    }
    
    await schedulingStore.fetchScheduledCards(
      undefined, // status
      endDate,   // dueBefore
      startDate  // dueAfter
    )
  } catch (error) {
    console.error('Failed to load calendar data:', error)
  } finally {
    isLoading.value = false
  }
}

// Watchers
watch([currentView, currentDate, selectedDay], () => {
  loadCalendarData()
})

// Lifecycle
onMounted(() => {
  loadCalendarData()
})
</script>

<style scoped>
.calendar-view {
  @apply flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm;
}

.calendar-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700;
}

.header-controls {
  @apply flex items-center gap-4;
}

.nav-button {
  @apply p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg 
         text-gray-600 hover:text-gray-900 dark:hover:text-white 
         transition-colors text-xl;
}

.period-selector {
  @apply text-center;
}

.current-period {
  @apply text-xl font-semibold text-gray-900 dark:text-white mb-2;
}

.view-modes {
  @apply flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg;
}

.view-mode {
  @apply px-3 py-1 rounded-md text-sm font-medium
         text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
         hover:bg-white dark:hover:bg-gray-700 transition-colors;
}

.view-mode.active {
  @apply bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm;
}

.header-actions {
  @apply flex gap-2;
}

.calendar-content {
  @apply flex-1 overflow-auto;
}

.loading-container {
  @apply flex flex-col items-center justify-center py-12 text-gray-500;
}

/* Month View Styles */
.month-view {
  @apply p-4;
}

.month-header {
  @apply grid grid-cols-7 gap-1 mb-2;
}

.day-header {
  @apply text-center text-sm font-medium text-gray-500 dark:text-gray-400 p-2;
}

.month-grid {
  @apply grid grid-cols-7 gap-1;
}

.day-cell {
  @apply min-h-[100px] p-2 border border-gray-100 dark:border-gray-700 rounded-lg
         hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors;
}

.day-cell.other-month {
  @apply opacity-50;
}

.day-cell.today {
  @apply bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700;
}

.day-cell.has-events {
  @apply border-blue-300 dark:border-blue-600;
}

.day-number {
  @apply text-sm font-medium text-gray-900 dark:text-white mb-1;
}

.day-events {
  @apply space-y-1;
}

.event-item {
  @apply text-xs p-1 rounded truncate cursor-pointer hover:shadow-sm transition-shadow;
}

.event-item.priority-critical {
  @apply bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300;
}

.event-item.priority-high {
  @apply bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300;
}

.event-item.priority-medium {
  @apply bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300;
}

.event-item.priority-low {
  @apply bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300;
}

.event-item.status-overdue {
  @apply bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300;
}

.event-item.status-completed {
  @apply bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 line-through;
}

.event-time {
  @apply font-mono;
}

.event-title {
  @apply truncate;
}

.more-events {
  @apply text-xs text-gray-500 dark:text-gray-400 text-center;
}

/* Week and Day View Styles */
.week-view,
.day-view {
  @apply p-4;
}

.week-header {
  @apply grid grid-cols-8 gap-1 mb-4;
}

.time-column {
  @apply w-16;
}

.week-day-header {
  @apply text-center p-2 rounded-lg;
}

.week-day-header.today {
  @apply bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400;
}

.day-name {
  @apply text-sm font-medium;
}

.day-date {
  @apply text-lg font-semibold;
}

.week-grid {
  @apply grid grid-cols-8 gap-1;
}

.time-slots {
  @apply space-y-1;
}

.time-slot {
  @apply h-12 text-xs text-gray-500 dark:text-gray-400 text-right pr-2 pt-1;
}

.week-day-column,
.day-events-column {
  @apply space-y-1;
}

.hour-slot {
  @apply h-12 border border-gray-100 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800
         cursor-pointer transition-colors relative;
}

.hour-slot.current-hour {
  @apply bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700;
}

.week-event,
.day-event {
  @apply absolute inset-x-1 top-1 p-1 rounded text-xs cursor-pointer
         hover:shadow-sm transition-shadow z-10;
}

.day-event {
  @apply inset-x-2 p-2;
}

.day-title {
  @apply text-lg font-semibold text-gray-900 dark:text-white mb-4;
}

.day-schedule {
  @apply grid grid-cols-[60px_1fr] gap-1;
}

.event-status {
  @apply text-xs opacity-75 capitalize;
}

/* Common button styles */
.btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 
         flex items-center gap-2;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white shadow-sm;
}

.btn-secondary {
  @apply bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 
         text-gray-900 dark:text-white;
}

.icon {
  @apply inline-block;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .calendar-header {
    @apply flex-col gap-4;
  }
  
  .view-modes {
    @apply text-xs;
  }
  
  .month-grid {
    @apply gap-0.5;
  }
  
  .day-cell {
    @apply min-h-[80px] p-1;
  }
  
  .week-grid {
    @apply grid-cols-1 gap-2;
  }
  
  .day-schedule {
    @apply grid-cols-[50px_1fr];
  }
}
</style>
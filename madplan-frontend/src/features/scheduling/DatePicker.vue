<template>
  <div class="date-picker">
    <!-- Date Input -->
    <div class="date-input-container">
      <label v-if="label" :for="inputId" class="date-label">
        {{ label }}
        <span v-if="required" class="required">*</span>
      </label>
      
      <div class="date-input-wrapper">
        <input
          :id="inputId"
          ref="dateInput"
          v-model="dateValue"
          type="datetime-local"
          :class="['date-input', { 'error': hasError, 'disabled': disabled }]"
          :disabled="disabled"
          :min="minDate"
          :max="maxDate"
          @focus="showCalendar = true"
          @blur="handleBlur"
          @change="handleDateChange"
        >
        
        <div class="input-icons">
          <button
            v-if="dateValue && !disabled"
            @click="clearDate"
            type="button"
            class="clear-button"
            title="Clear date"
          >
            <span class="icon">✕</span>
          </button>
          
          <button
            @click="toggleCalendar"
            type="button"
            class="calendar-button"
            :disabled="disabled"
            title="Open calendar"
          >
            <span class="icon">📅</span>
          </button>
        </div>
      </div>
      
      <span v-if="errorMessage" class="error-message">{{ errorMessage }}</span>
      <span v-if="helpText" class="help-text">{{ helpText }}</span>
    </div>

    <!-- Calendar Popup -->
    <div
      v-if="showCalendar && !disabled"
      ref="calendarPopup"
      class="calendar-popup"
      @click.stop
    >
      <div class="calendar-header">
        <button @click="previousMonth" type="button" class="nav-button">
          <span class="icon">‹</span>
        </button>
        
        <div class="month-year">
          <select v-model="displayMonth" class="month-select">
            <option v-for="(month, index) in monthNames" :key="index" :value="index">
              {{ month }}
            </option>
          </select>
          <select v-model="displayYear" class="year-select">
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}
            </option>
          </select>
        </div>
        
        <button @click="nextMonth" type="button" class="nav-button">
          <span class="icon">›</span>
        </button>
      </div>

      <div class="calendar-grid">
        <!-- Day Headers -->
        <div class="day-header" v-for="day in dayNames" :key="day">
          {{ day }}
        </div>
        
        <!-- Calendar Days -->
        <button
          v-for="day in calendarDays"
          :key="`${day.date}-${day.month}`"
          @click="selectDate(day)"
          type="button"
          :class="[
            'calendar-day',
            {
              'other-month': day.isOtherMonth,
              'today': day.isToday,
              'selected': day.isSelected,
              'disabled': day.isDisabled
            }
          ]"
          :disabled="day.isDisabled"
        >
          {{ day.date }}
        </button>
      </div>

      <!-- Time Selection -->
      <div v-if="includeTime" class="time-selection">
        <div class="time-inputs">
          <div class="time-group">
            <label class="time-label">Hour</label>
            <select v-model="selectedHour" class="time-select">
              <option v-for="hour in hours" :key="hour.value" :value="hour.value">
                {{ hour.label }}
              </option>
            </select>
          </div>
          
          <div class="time-group">
            <label class="time-label">Minute</label>
            <select v-model="selectedMinute" class="time-select">
              <option v-for="minute in minutes" :key="minute" :value="minute">
                {{ minute.toString().padStart(2, '0') }}
              </option>
            </select>
          </div>
          
          <div v-if="use12Hour" class="time-group">
            <label class="time-label">Period</label>
            <select v-model="selectedPeriod" class="time-select">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="calendar-actions">
        <button @click="selectToday" type="button" class="quick-action">
          Today
        </button>
        <button @click="selectTomorrow" type="button" class="quick-action">
          Tomorrow
        </button>
        <button @click="selectNextWeek" type="button" class="quick-action">
          Next Week
        </button>
        <button @click="closeCalendar" type="button" class="quick-action primary">
          Done
        </button>
      </div>
    </div>

    <!-- Overlay to close calendar -->
    <div
      v-if="showCalendar"
      class="calendar-overlay"
      @click="closeCalendar"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

interface Props {
  modelValue?: Date | string | null
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  includeTime?: boolean
  use12Hour?: boolean
  minDate?: string
  maxDate?: string
  errorMessage?: string
  helpText?: string
}

const props = withDefaults(defineProps<Props>(), {
  includeTime: true,
  use12Hour: true,
  disabled: false,
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: Date | null]
  'change': [value: Date | null]
}>()

// Reactive state
const showCalendar = ref(false)
const dateInput = ref<HTMLInputElement>()
const calendarPopup = ref<HTMLElement>()
const displayMonth = ref(new Date().getMonth())
const displayYear = ref(new Date().getFullYear())
const selectedHour = ref(12)
const selectedMinute = ref(0)
const selectedPeriod = ref('PM')

// Generate unique input ID
const inputId = `date-picker-${Math.random().toString(36).substr(2, 9)}`

// Computed properties
const hasError = computed(() => !!props.errorMessage)

const dateValue = computed({
  get: () => {
    if (!props.modelValue) return ''
    
    const date = new Date(props.modelValue)
    if (isNaN(date.getTime())) return ''
    
    // Format for datetime-local input
    return date.toISOString().slice(0, 16)
  },
  set: (value: string) => {
    if (!value) {
      emit('update:modelValue', null)
      return
    }
    
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      emit('update:modelValue', date)
    }
  }
})

const monthNames = computed(() => [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
])

const dayNames = computed(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear - 5; year <= currentYear + 10; year++) {
    years.push(year)
  }
  return years
})

const hours = computed(() => {
  if (props.use12Hour) {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i === 0 ? 12 : i,
      label: (i === 0 ? 12 : i).toString()
    }))
  } else {
    return Array.from({ length: 24 }, (_, i) => ({
      value: i,
      label: i.toString().padStart(2, '0')
    }))
  }
})

const minutes = computed(() => {
  return Array.from({ length: 60 }, (_, i) => i)
})

const calendarDays = computed(() => {
  const firstDayOfMonth = new Date(displayYear.value, displayMonth.value, 1)
  const lastDayOfMonth = new Date(displayYear.value, displayMonth.value + 1, 0)
  const firstDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()
  
  const days = []
  const today = new Date()
  const selectedDate = props.modelValue ? new Date(props.modelValue) : null
  
  // Previous month's trailing days
  const prevMonth = new Date(displayYear.value, displayMonth.value - 1, 0)
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = prevMonth.getDate() - i
    days.push({
      date,
      month: displayMonth.value - 1,
      year: displayYear.value,
      isOtherMonth: true,
      isToday: false,
      isSelected: false,
      isDisabled: true
    })
  }
  
  // Current month's days
  for (let date = 1; date <= daysInMonth; date++) {
    const dayDate = new Date(displayYear.value, displayMonth.value, date)
    const isToday = dayDate.toDateString() === today.toDateString()
    const isSelected = selectedDate && dayDate.toDateString() === selectedDate.toDateString()
    
    days.push({
      date,
      month: displayMonth.value,
      year: displayYear.value,
      isOtherMonth: false,
      isToday,
      isSelected,
      isDisabled: false
    })
  }
  
  // Next month's leading days
  const remainingCells = 42 - days.length // 6 rows × 7 days
  for (let date = 1; date <= remainingCells; date++) {
    days.push({
      date,
      month: displayMonth.value + 1,
      year: displayYear.value,
      isOtherMonth: true,
      isToday: false,
      isSelected: false,
      isDisabled: true
    })
  }
  
  return days
})

// Methods
const toggleCalendar = () => {
  showCalendar.value = !showCalendar.value
}

const closeCalendar = () => {
  showCalendar.value = false
}

const clearDate = () => {
  emit('update:modelValue', null)
  emit('change', null)
}

const handleBlur = (event: FocusEvent) => {
  // Don't close if focus moved to calendar
  if (!calendarPopup.value?.contains(event.relatedTarget as Node)) {
    setTimeout(() => {
      showCalendar.value = false
    }, 200)
  }
}

const handleDateChange = () => {
  const date = props.modelValue ? new Date(props.modelValue) : null
  emit('change', date)
}

const selectDate = (day: any) => {
  if (day.isDisabled) return
  
  const newDate = new Date(day.year, day.month, day.date)
  
  // Set time if includeTime is enabled
  if (props.includeTime) {
    let hour = selectedHour.value
    if (props.use12Hour && selectedPeriod.value === 'PM' && hour !== 12) {
      hour += 12
    } else if (props.use12Hour && selectedPeriod.value === 'AM' && hour === 12) {
      hour = 0
    }
    
    newDate.setHours(hour, selectedMinute.value, 0, 0)
  }
  
  emit('update:modelValue', newDate)
  emit('change', newDate)
  
  if (!props.includeTime) {
    closeCalendar()
  }
}

const selectToday = () => {
  const today = new Date()
  if (props.includeTime) {
    today.setHours(selectedHour.value, selectedMinute.value, 0, 0)
  }
  emit('update:modelValue', today)
  emit('change', today)
  closeCalendar()
}

const selectTomorrow = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (props.includeTime) {
    tomorrow.setHours(selectedHour.value, selectedMinute.value, 0, 0)
  }
  emit('update:modelValue', tomorrow)
  emit('change', tomorrow)
  closeCalendar()
}

const selectNextWeek = () => {
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  if (props.includeTime) {
    nextWeek.setHours(selectedHour.value, selectedMinute.value, 0, 0)
  }
  emit('update:modelValue', nextWeek)
  emit('change', nextWeek)
  closeCalendar()
}

const previousMonth = () => {
  if (displayMonth.value === 0) {
    displayMonth.value = 11
    displayYear.value--
  } else {
    displayMonth.value--
  }
}

const nextMonth = () => {
  if (displayMonth.value === 11) {
    displayMonth.value = 0
    displayYear.value++
  } else {
    displayMonth.value++
  }
}

// Initialize time from current date value
const initializeTime = () => {
  if (props.modelValue && props.includeTime) {
    const date = new Date(props.modelValue)
    let hour = date.getHours()
    
    if (props.use12Hour) {
      selectedPeriod.value = hour >= 12 ? 'PM' : 'AM'
      if (hour === 0) {
        selectedHour.value = 12
      } else if (hour > 12) {
        selectedHour.value = hour - 12
      } else {
        selectedHour.value = hour
      }
    } else {
      selectedHour.value = hour
    }
    
    selectedMinute.value = date.getMinutes()
    displayMonth.value = date.getMonth()
    displayYear.value = date.getFullYear()
  }
}

// Watchers
watch(() => props.modelValue, () => {
  initializeTime()
})

watch([selectedHour, selectedMinute, selectedPeriod], () => {
  if (props.modelValue && props.includeTime) {
    const currentDate = new Date(props.modelValue)
    let hour = selectedHour.value
    
    if (props.use12Hour) {
      if (selectedPeriod.value === 'PM' && hour !== 12) {
        hour += 12
      } else if (selectedPeriod.value === 'AM' && hour === 12) {
        hour = 0
      }
    }
    
    currentDate.setHours(hour, selectedMinute.value, 0, 0)
    emit('update:modelValue', currentDate)
  }
})

// Handle click outside to close calendar
const handleClickOutside = (event: Event) => {
  if (!calendarPopup.value?.contains(event.target as Node) && 
      !dateInput.value?.contains(event.target as Node)) {
    showCalendar.value = false
  }
}

// Lifecycle
onMounted(() => {
  initializeTime()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.date-picker {
  @apply relative;
}

.date-input-container {
  @apply space-y-2;
}

.date-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.required {
  @apply text-red-500;
}

.date-input-wrapper {
  @apply relative;
}

.date-input {
  @apply w-full pl-3 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
         focus:ring-2 focus:ring-blue-500 focus:border-transparent
         disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed;
}

.date-input.error {
  @apply border-red-500 focus:ring-red-500;
}

.input-icons {
  @apply absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1;
}

.clear-button,
.calendar-button {
  @apply p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded 
         text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 
         transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.error-message {
  @apply text-sm text-red-600 dark:text-red-400;
}

.help-text {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.calendar-overlay {
  @apply fixed inset-0 z-40;
}

.calendar-popup {
  @apply absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg 
         border border-gray-200 dark:border-gray-700 p-4 z-50 min-w-[320px];
}

.calendar-header {
  @apply flex items-center justify-between mb-4;
}

.nav-button {
  @apply p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded 
         text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors;
}

.month-year {
  @apply flex gap-2;
}

.month-select,
.year-select {
  @apply px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
         bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm;
}

.calendar-grid {
  @apply grid grid-cols-7 gap-1 mb-4;
}

.day-header {
  @apply text-center text-xs font-medium text-gray-500 dark:text-gray-400 p-2;
}

.calendar-day {
  @apply text-center p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700
         transition-colors min-h-[32px] flex items-center justify-center;
}

.calendar-day.other-month {
  @apply text-gray-400 dark:text-gray-600;
}

.calendar-day.today {
  @apply bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium;
}

.calendar-day.selected {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.calendar-day.disabled {
  @apply opacity-50 cursor-not-allowed hover:bg-transparent;
}

.time-selection {
  @apply border-t border-gray-200 dark:border-gray-700 pt-4 mb-4;
}

.time-inputs {
  @apply flex gap-3;
}

.time-group {
  @apply flex-1;
}

.time-label {
  @apply block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1;
}

.time-select {
  @apply w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
         bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm;
}

.calendar-actions {
  @apply flex gap-2 border-t border-gray-200 dark:border-gray-700 pt-4;
}

.quick-action {
  @apply px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
         bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors;
}

.quick-action.primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white border-blue-600;
}

.icon {
  @apply inline-block text-sm;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .calendar-popup {
    @apply fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
           min-w-[300px] max-w-[90vw];
  }
  
  .time-inputs {
    @apply flex-col gap-2;
  }
  
  .calendar-actions {
    @apply flex-col;
  }
}
</style>
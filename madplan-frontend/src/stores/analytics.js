import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAnalyticsService } from '@/services/analytics'
import { useAuthStore } from './auth'

export const useAnalyticsStore = defineStore('analytics', () => {
  const analyticsService = useAnalyticsService()
  const authStore = useAuthStore()

  // State
  const dashboardData = ref(null)
  const productivityReport = ref(null)
  const boardAnalytics = ref(null)
  const performanceInsights = ref([])
  const activityHeatmap = ref(null)
  const collaborationStats = ref(null)
  const timeTrackingData = ref(null)
  const goalProgress = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => !!error.value)
  const quickStats = computed(() => {
    if (!dashboardData.value) return null
    return {
      cardsCompleted: dashboardData.value.cardsCompletedToday || 0,
      activeTime: dashboardData.value.activeTimeToday || 0,
      productivity: dashboardData.value.productivityScore || 0,
      boardsWorked: dashboardData.value.boardsWorkedToday || 0
    }
  })

  const productivityTrend = computed(() => {
    if (!productivityReport.value) return []
    return productivityReport.value.trends || []
  })

  const currentInsights = computed(() => {
    return performanceInsights.value.filter(insight => 
      insight.type.includes('current') || insight.priority === 'high'
    )
  })

  // Actions
  const clearError = () => {
    error.value = null
  }

  const setLoading = (isLoading) => {
    loading.value = isLoading
  }

  const handleError = (err) => {
    error.value = err.message || 'An error occurred'
    console.error('Analytics store error:', err)
  }

  // Dashboard data
  const fetchDashboardData = async (boardId = null) => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getDashboardData({
        boardId,
        daysPeriod: 30,
        includeInsights: true,
        includeComparisons: true
      })
      
      dashboardData.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Productivity reports
  const fetchProductivityReport = async (options = {}) => {
    try {
      setLoading(true)
      clearError()
      
      const defaultOptions = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        includeComparison: true,
        ...options
      }
      
      const data = await analyticsService.getProductivityReport(defaultOptions)
      productivityReport.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Board analytics
  const fetchBoardAnalytics = async (boardId, options = {}) => {
    try {
      setLoading(true)
      clearError()
      
      const defaultOptions = {
        boardId,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        groupBy: 'day',
        ...options
      }
      
      const data = await analyticsService.getBoardAnalytics(defaultOptions)
      boardAnalytics.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Performance insights
  const fetchPerformanceInsights = async (boardId = null) => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getPerformanceInsights(boardId)
      performanceInsights.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Activity heatmap
  const fetchActivityHeatmap = async (boardId = null, days = 90) => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getActivityHeatmap(boardId, days)
      activityHeatmap.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Collaboration stats
  const fetchCollaborationStats = async (boardId, days = 30) => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getCollaborationStats(boardId, days)
      collaborationStats.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Time tracking data
  const fetchTimeTrackingData = async (boardId = null, days = 7) => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getTimeTrackingData(boardId, days)
      timeTrackingData.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Goal progress
  const fetchGoalProgress = async (boardId = null, period = 'month') => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getGoalProgress(boardId, period)
      goalProgress.value = data
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Event tracking
  const trackEvent = async (eventType, options = {}) => {
    try {
      const eventData = {
        eventType,
        boardId: options.boardId || null,
        entityId: options.entityId || null,
        entityType: options.entityType || null,
        metadata: options.metadata || null,
        sessionId: options.sessionId || `session_${Date.now()}`
      }
      
      await analyticsService.trackEvent(eventData)
    } catch (err) {
      console.warn('Failed to track event:', err)
      // Don't throw - event tracking failures shouldn't break the app
    }
  }

  // Productivity trends
  const fetchProductivityTrends = async (days = 30, boardId = null) => {
    try {
      setLoading(true)
      clearError()
      
      const data = await analyticsService.getUserProductivityTrends(days, boardId)
      return data
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Refresh all data
  const refreshAllData = async (boardId = null) => {
    try {
      setLoading(true)
      clearError()
      
      const promises = [
        fetchDashboardData(boardId),
        fetchProductivityReport({ boardId }),
        fetchPerformanceInsights(boardId),
        fetchActivityHeatmap(boardId),
        fetchGoalProgress(boardId)
      ]
      
      if (boardId) {
        promises.push(
          fetchBoardAnalytics(boardId),
          fetchCollaborationStats(boardId),
          fetchTimeTrackingData(boardId)
        )
      }
      
      await Promise.allSettled(promises)
    } catch (err) {
      handleError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Reset store
  const reset = () => {
    dashboardData.value = null
    productivityReport.value = null
    boardAnalytics.value = null
    performanceInsights.value = []
    activityHeatmap.value = null
    collaborationStats.value = null
    timeTrackingData.value = null
    goalProgress.value = null
    loading.value = false
    error.value = null
  }

  return {
    // State
    dashboardData,
    productivityReport,
    boardAnalytics,
    performanceInsights,
    activityHeatmap,
    collaborationStats,
    timeTrackingData,
    goalProgress,
    loading,
    error,
    
    // Getters
    isLoading,
    hasError,
    quickStats,
    productivityTrend,
    currentInsights,
    
    // Actions
    clearError,
    fetchDashboardData,
    fetchProductivityReport,
    fetchBoardAnalytics,
    fetchPerformanceInsights,
    fetchActivityHeatmap,
    fetchCollaborationStats,
    fetchTimeTrackingData,
    fetchGoalProgress,
    fetchProductivityTrends,
    trackEvent,
    refreshAllData,
    reset
  }
})
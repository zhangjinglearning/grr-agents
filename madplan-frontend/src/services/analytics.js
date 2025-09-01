import { apolloClient } from '@/lib/apollo'
import { gql } from '@apollo/client/core'

// GraphQL mutations
const TRACK_EVENT = gql`
  mutation TrackEvent($input: EventTrackingInput!) {
    trackEvent(input: $input) {
      id
      eventType
      timestamp
      metadata
    }
  }
`

// GraphQL queries
const GET_ANALYTICS = gql`
  query GetAnalytics($query: AnalyticsQueryInput!) {
    getAnalytics(query: $query)
  }
`

const GET_PRODUCTIVITY_REPORT = gql`
  query GetProductivityReport($input: ProductivityReportInput!) {
    getProductivityReport(input: $input)
  }
`

const GET_BOARD_ANALYTICS = gql`
  query GetBoardAnalytics($input: BoardAnalyticsInput!) {
    getBoardAnalytics(input: $input)
  }
`

const GET_PERFORMANCE_INSIGHTS = gql`
  query GetPerformanceInsights($boardId: ID) {
    getPerformanceInsights(boardId: $boardId) {
      id
      type
      title
      description
      priority
      impact
      suggestions
      boardId
      generatedAt
    }
  }
`

const GET_DASHBOARD_DATA = gql`
  query GetDashboardData($query: DashboardQueryInput) {
    getDashboardData(query: $query)
  }
`

const GET_USER_PRODUCTIVITY_TRENDS = gql`
  query GetUserProductivityTrends($days: Int!, $boardId: ID) {
    getUserProductivityTrends(days: $days, boardId: $boardId)
  }
`

const GET_ACTIVITY_HEATMAP = gql`
  query GetActivityHeatmap($boardId: ID, $days: Int) {
    getActivityHeatmap(boardId: $boardId, days: $days)
  }
`

const GET_COLLABORATION_STATS = gql`
  query GetCollaborationStats($boardId: ID!, $days: Int) {
    getCollaborationStats(boardId: $boardId, days: $days)
  }
`

const GET_TIME_TRACKING_DATA = gql`
  query GetTimeTrackingData($boardId: ID, $days: Int) {
    getTimeTrackingData(boardId: $boardId, days: $days)
  }
`

const GET_GOAL_PROGRESS = gql`
  query GetGoalProgress($boardId: ID, $period: String) {
    getGoalProgress(boardId: $boardId, period: $period)
  }
`

export const useAnalyticsService = () => {
  // Event tracking
  const trackEvent = async (eventData) => {
    try {
      const response = await apolloClient.mutate({
        mutation: TRACK_EVENT,
        variables: { input: eventData }
      })
      
      return response.data.trackEvent
    } catch (error) {
      console.error('Failed to track event:', error)
      throw error
    }
  }

  // Get general analytics data
  const getAnalytics = async (query) => {
    try {
      const response = await apolloClient.query({
        query: GET_ANALYTICS,
        variables: { query },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getAnalytics
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      throw error
    }
  }

  // Get productivity report
  const getProductivityReport = async (input) => {
    try {
      const response = await apolloClient.query({
        query: GET_PRODUCTIVITY_REPORT,
        variables: { input },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getProductivityReport
    } catch (error) {
      console.error('Failed to fetch productivity report:', error)
      throw error
    }
  }

  // Get board analytics
  const getBoardAnalytics = async (input) => {
    try {
      const response = await apolloClient.query({
        query: GET_BOARD_ANALYTICS,
        variables: { input },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getBoardAnalytics
    } catch (error) {
      console.error('Failed to fetch board analytics:', error)
      throw error
    }
  }

  // Get performance insights
  const getPerformanceInsights = async (boardId = null) => {
    try {
      const response = await apolloClient.query({
        query: GET_PERFORMANCE_INSIGHTS,
        variables: { boardId },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getPerformanceInsights
    } catch (error) {
      console.error('Failed to fetch performance insights:', error)
      throw error
    }
  }

  // Get dashboard data
  const getDashboardData = async (query = null) => {
    try {
      const response = await apolloClient.query({
        query: GET_DASHBOARD_DATA,
        variables: { query },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getDashboardData
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      throw error
    }
  }

  // Get user productivity trends
  const getUserProductivityTrends = async (days = 30, boardId = null) => {
    try {
      const response = await apolloClient.query({
        query: GET_USER_PRODUCTIVITY_TRENDS,
        variables: { days, boardId },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getUserProductivityTrends
    } catch (error) {
      console.error('Failed to fetch productivity trends:', error)
      throw error
    }
  }

  // Get activity heatmap
  const getActivityHeatmap = async (boardId = null, days = 90) => {
    try {
      const response = await apolloClient.query({
        query: GET_ACTIVITY_HEATMAP,
        variables: { boardId, days },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getActivityHeatmap
    } catch (error) {
      console.error('Failed to fetch activity heatmap:', error)
      throw error
    }
  }

  // Get collaboration stats
  const getCollaborationStats = async (boardId, days = 30) => {
    try {
      const response = await apolloClient.query({
        query: GET_COLLABORATION_STATS,
        variables: { boardId, days },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getCollaborationStats
    } catch (error) {
      console.error('Failed to fetch collaboration stats:', error)
      throw error
    }
  }

  // Get time tracking data
  const getTimeTrackingData = async (boardId = null, days = 7) => {
    try {
      const response = await apolloClient.query({
        query: GET_TIME_TRACKING_DATA,
        variables: { boardId, days },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getTimeTrackingData
    } catch (error) {
      console.error('Failed to fetch time tracking data:', error)
      throw error
    }
  }

  // Get goal progress
  const getGoalProgress = async (boardId = null, period = 'month') => {
    try {
      const response = await apolloClient.query({
        query: GET_GOAL_PROGRESS,
        variables: { boardId, period },
        fetchPolicy: 'cache-first'
      })
      
      return response.data.getGoalProgress
    } catch (error) {
      console.error('Failed to fetch goal progress:', error)
      throw error
    }
  }

  // Helper functions for common event tracking
  const trackCardEvent = async (eventType, cardId, boardId, metadata = {}) => {
    return trackEvent({
      eventType,
      boardId,
      entityId: cardId,
      entityType: 'card',
      metadata,
      sessionId: `session_${Date.now()}`
    })
  }

  const trackBoardEvent = async (eventType, boardId, metadata = {}) => {
    return trackEvent({
      eventType,
      boardId,
      entityId: boardId,
      entityType: 'board',
      metadata,
      sessionId: `session_${Date.now()}`
    })
  }

  const trackUserEvent = async (eventType, metadata = {}) => {
    return trackEvent({
      eventType,
      entityType: 'user',
      metadata,
      sessionId: `session_${Date.now()}`
    })
  }

  // Batch event tracking
  const trackMultipleEvents = async (events) => {
    try {
      const promises = events.map(event => trackEvent(event))
      await Promise.allSettled(promises)
    } catch (error) {
      console.warn('Some events failed to track:', error)
    }
  }

  // Analytics aggregation helpers
  const aggregateMetrics = (data, groupBy = 'day') => {
    if (!data || !Array.isArray(data)) return {}
    
    const groupedData = {}
    
    data.forEach(item => {
      let key
      const date = new Date(item.timestamp || item.date)
      
      switch (groupBy) {
        case 'hour':
          key = `${date.toDateString()}-${date.getHours()}`
          break
        case 'day':
          key = date.toDateString()
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toDateString()
          break
        case 'month':
          key = `${date.getFullYear()}-${date.getMonth()}`
          break
        default:
          key = date.toDateString()
      }
      
      if (!groupedData[key]) {
        groupedData[key] = { key, items: [], count: 0, value: 0 }
      }
      
      groupedData[key].items.push(item)
      groupedData[key].count++
      groupedData[key].value += (item.value || 1)
    })
    
    return groupedData
  }

  const calculateTrends = (data, period = 'week') => {
    const aggregated = aggregateMetrics(data, period)
    const values = Object.values(aggregated).map(item => item.value)
    
    if (values.length < 2) return { trend: 0, direction: 'stable' }
    
    const recent = values.slice(-Math.ceil(values.length / 2))
    const previous = values.slice(0, Math.floor(values.length / 2))
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const previousAvg = previous.reduce((sum, val) => sum + val, 0) / previous.length
    
    const trend = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0
    const direction = trend > 5 ? 'up' : trend < -5 ? 'down' : 'stable'
    
    return { trend: Math.round(trend * 100) / 100, direction }
  }

  return {
    // Core API functions
    trackEvent,
    getAnalytics,
    getProductivityReport,
    getBoardAnalytics,
    getPerformanceInsights,
    getDashboardData,
    getUserProductivityTrends,
    getActivityHeatmap,
    getCollaborationStats,
    getTimeTrackingData,
    getGoalProgress,
    
    // Helper functions
    trackCardEvent,
    trackBoardEvent,
    trackUserEvent,
    trackMultipleEvents,
    aggregateMetrics,
    calculateTrends
  }
}
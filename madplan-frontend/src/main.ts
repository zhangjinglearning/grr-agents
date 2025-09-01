import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { DefaultApolloClient } from '@vue/apollo-composable'
import App from './App.vue'
import router from './router'
import './style.css'

// Performance and UX enhancements
import { initializeOptimizations } from './performance/optimizations'
import { initializeErrorHandling } from './utils/error-handling'
import performanceMonitor from './performance/monitoring'
import serviceWorkerManager from './offline/service-worker'

// Initialize performance optimizations
initializeOptimizations()

// Initialize error handling
initializeErrorHandling()

// Setup performance monitoring
performanceMonitor.setBudgets({
  fcp: 1800,      // 1.8s for First Contentful Paint
  lcp: 2500,      // 2.5s for Largest Contentful Paint
  fid: 100,       // 100ms for First Input Delay
  cls: 0.1,       // 0.1 for Cumulative Layout Shift
  ttfb: 800,      // 800ms for Time to First Byte
  bundleSize: 500 * 1024, // 500KB for initial bundle
  routeChange: 300, // 300ms for route changes
})

// Set up analytics endpoint if available
if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
  performanceMonitor.setReportingEndpoint(import.meta.env.VITE_ANALYTICS_ENDPOINT)
}

// Track initial page load
performanceMonitor.trackPageLoad()

// HTTP link
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
})

// Auth link to add token to requests
const authLink = setContext((_, { headers }) => {
  // Get token from localStorage
  const token = localStorage.getItem('auth-token')
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

// Apollo Client configuration
const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
})

const app = createApp(App)

app.use(createPinia())

// Router with performance tracking
app.use(router)

// Router performance tracking
router.beforeEach((to, from, next) => {
  // Track route change start
  performance.mark('route-change-start')
  
  // Emit custom event for service worker
  window.dispatchEvent(new CustomEvent('routeChangeStart'))
  
  next()
})

router.afterEach((to, from) => {
  // Track route change completion
  performance.mark('route-change-end')
  
  try {
    performance.measure('route-change', 'route-change-start', 'route-change-end')
    const measure = performance.getEntriesByName('route-change')[0]
    
    if (measure) {
      performanceMonitor.reportMetric('route_change_time', measure.duration, {
        from: from.path,
        to: to.path,
      })
    }
  } catch (error) {
    console.warn('Failed to measure route change performance:', error)
  }
  
  // Emit custom event for service worker
  window.dispatchEvent(new CustomEvent('routeChangeComplete'))
})

app.provide(DefaultApolloClient, apolloClient)

// Global error handling for Vue
app.config.errorHandler = (error, instance, info) => {
  console.error('Vue error:', error, info)
  performanceMonitor.reportError({
    message: error.message,
    stack: error.stack,
    componentInfo: info,
    vue: true,
  })
}

// Performance tracking for app mount
const mountTimer = performanceMonitor.startUserTiming('app_mount')

app.mount('#app')

mountTimer() // Complete timing

console.log('[MadPlan] Application initialized with performance optimizations')

// Development helpers
if (import.meta.env.DEV) {
  // Make utilities globally available for debugging
  ;(window as any).__madplan = {
    performanceMonitor,
    serviceWorker: serviceWorkerManager,
    router,
  }
}

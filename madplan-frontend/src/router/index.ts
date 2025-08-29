import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import DashboardView from '../views/DashboardView.vue'

const routes: Array<RouteRecordRaw> = [
  // Public routes
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: {
      title: 'Sign In - MadPlan',
      requiresAuth: false,
      redirectIfAuthenticated: true,
    },
  },
  {
    path: '/register',
    name: 'Register', 
    component: () => import('../views/RegisterView.vue'),
    meta: {
      title: 'Sign Up - MadPlan',
      requiresAuth: false,
      redirectIfAuthenticated: true,
    },
  },
  
  // Protected routes
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard - MadPlan',
      requiresAuth: true,
    },
  },
  
  // 404 route
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
    meta: {
      title: 'Page Not Found - MadPlan',
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guards
router.beforeEach((to, from, next) => {
  // Set document title
  document.title = (to.meta?.title as string) || 'MadPlan'
  
  // Get auth store
  const authStore = useAuthStore()
  
  // Check if route requires authentication
  if (to.meta?.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Redirect to login if not authenticated
      next({ 
        name: 'Login',
        query: { redirect: to.fullPath }
      })
      return
    }
  }
  
  // Check if authenticated user should be redirected from auth pages
  if (to.meta?.redirectIfAuthenticated && authStore.isAuthenticated) {
    // Check if there's a redirect query parameter
    const redirectPath = from.query?.redirect as string || '/dashboard'
    next(redirectPath)
    return
  }
  
  next()
})

export default router

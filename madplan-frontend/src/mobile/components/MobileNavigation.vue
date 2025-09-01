<template>
  <nav class="mobile-navbar" :class="{ 'navbar-open': isMenuOpen }">
    <!-- Mobile Header -->
    <div class="mobile-navbar-header">
      <div class="navbar-brand">
        <img src="/icons/logo.svg" alt="MadPlan" class="brand-logo" />
        <span class="brand-text">MadPlan</span>
      </div>
      
      <button
        class="navbar-toggle btn-icon"
        @click="toggleMenu"
        :aria-expanded="isMenuOpen"
        aria-controls="mobile-menu"
        aria-label="Toggle navigation menu"
      >
        <div class="hamburger-icon" :class="{ active: isMenuOpen }">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
    </div>

    <!-- Mobile Menu Overlay -->
    <div
      v-if="isMenuOpen"
      class="mobile-menu-overlay"
      @click="closeMenu"
      @touchstart.passive="handleOverlayTouch"
    ></div>

    <!-- Mobile Navigation Menu -->
    <div
      id="mobile-menu"
      class="mobile-menu"
      :class="{ 'menu-open': isMenuOpen }"
      @touchstart.passive="handleMenuTouch"
    >
      <div class="mobile-menu-header">
        <div class="user-profile">
          <div class="user-avatar">
            <img :src="userAvatar" :alt="userName" />
          </div>
          <div class="user-info">
            <div class="user-name">{{ userName }}</div>
            <div class="user-email">{{ userEmail }}</div>
          </div>
        </div>
        
        <button
          class="menu-close btn-icon"
          @click="closeMenu"
          aria-label="Close navigation menu"
        >
          <Icon name="x" size="24" />
        </button>
      </div>

      <div class="mobile-menu-content">
        <!-- Quick Actions -->
        <div class="quick-actions">
          <button
            class="quick-action-btn"
            @click="createBoard"
            aria-label="Create new board"
          >
            <Icon name="plus" size="20" />
            <span>New Board</span>
          </button>
          
          <button
            class="quick-action-btn"
            @click="createCard"
            aria-label="Create new card"
          >
            <Icon name="card" size="20" />
            <span>New Card</span>
          </button>
          
          <button
            class="quick-action-btn"
            @click="openSearch"
            aria-label="Search"
          >
            <Icon name="search" size="20" />
            <span>Search</span>
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="mobile-nav-links">
          <router-link
            v-for="link in navigationLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            :class="{ active: $route.path === link.path }"
            @click="handleNavClick"
          >
            <Icon :name="link.icon" size="20" />
            <span>{{ link.label }}</span>
            <div v-if="link.badge" class="nav-badge">{{ link.badge }}</div>
          </router-link>
        </nav>

        <!-- Theme Selector -->
        <div class="theme-selector">
          <div class="section-title">Theme</div>
          <div class="theme-options">
            <button
              v-for="theme in availableThemes"
              :key="theme.id"
              class="theme-option"
              :class="{ active: currentTheme === theme.id }"
              @click="changeTheme(theme.id)"
              :aria-label="`Switch to ${theme.name} theme`"
            >
              <div class="theme-preview" :style="{ backgroundColor: theme.color }"></div>
              <span>{{ theme.name }}</span>
            </button>
          </div>
        </div>

        <!-- Settings -->
        <div class="mobile-settings">
          <div class="section-title">Settings</div>
          <div class="settings-list">
            <button class="settings-item" @click="openNotificationSettings">
              <Icon name="bell" size="20" />
              <span>Notifications</span>
              <Icon name="chevron-right" size="16" class="item-arrow" />
            </button>
            
            <button class="settings-item" @click="openOfflineSettings">
              <Icon name="wifi-off" size="20" />
              <span>Offline Mode</span>
              <div class="settings-toggle">
                <input
                  type="checkbox"
                  v-model="offlineMode"
                  @change="toggleOfflineMode"
                />
                <span class="toggle-slider"></span>
              </div>
            </button>
            
            <button class="settings-item" @click="openAccessibilitySettings">
              <Icon name="accessibility" size="20" />
              <span>Accessibility</span>
              <Icon name="chevron-right" size="16" class="item-arrow" />
            </button>
            
            <button class="settings-item" @click="openHelpCenter">
              <Icon name="help-circle" size="20" />
              <span>Help & Support</span>
              <Icon name="chevron-right" size="16" class="item-arrow" />
            </button>
          </div>
        </div>
      </div>

      <!-- Menu Footer -->
      <div class="mobile-menu-footer">
        <div class="app-info">
          <div class="app-version">v{{ appVersion }}</div>
          <div class="connection-status" :class="connectionStatus">
            <Icon :name="connectionStatus === 'online' ? 'wifi' : 'wifi-off'" size="16" />
            <span>{{ connectionStatus === 'online' ? 'Online' : 'Offline' }}</span>
          </div>
        </div>
        
        <button class="logout-btn" @click="handleLogout">
          <Icon name="log-out" size="20" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useThemeStore } from '@/stores/theme';
import { useConnectionStore } from '@/stores/connection';
import Icon from '@/components/common/Icon.vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const themeStore = useThemeStore();
const connectionStore = useConnectionStore();

// Reactive state
const isMenuOpen = ref(false);
const offlineMode = ref(false);

// Computed properties
const userName = computed(() => userStore.currentUser?.name || 'User');
const userEmail = computed(() => userStore.currentUser?.email || '');
const userAvatar = computed(() => userStore.currentUser?.avatar || '/icons/default-avatar.png');
const currentTheme = computed(() => themeStore.currentTheme);
const connectionStatus = computed(() => connectionStore.isOnline ? 'online' : 'offline');
const appVersion = computed(() => import.meta.env.VITE_APP_VERSION || '1.0.0');

// Navigation links
const navigationLinks = ref([
  { path: '/dashboard', label: 'Dashboard', icon: 'home', badge: null },
  { path: '/boards', label: 'My Boards', icon: 'trello', badge: null },
  { path: '/shared', label: 'Shared with Me', icon: 'users', badge: 3 },
  { path: '/templates', label: 'Templates', icon: 'layout-template', badge: null },
  { path: '/analytics', label: 'Analytics', icon: 'bar-chart-2', badge: null },
  { path: '/calendar', label: 'Calendar', icon: 'calendar', badge: null },
  { path: '/tasks', label: 'My Tasks', icon: 'check-square', badge: 5 },
  { path: '/archive', label: 'Archive', icon: 'archive', badge: null },
]);

// Available themes
const availableThemes = ref([
  { id: 'ghibli', name: 'Ghibli', color: '#6B46C1' },
  { id: 'sky', name: 'Sky', color: '#0284c7' },
  { id: 'forest', name: 'Forest', color: '#166534' },
  { id: 'sunset', name: 'Sunset', color: '#c2410c' },
  { id: 'ocean', name: 'Ocean', color: '#1e40af' },
]);

// Touch handling
let touchStartX = 0;
let touchStartY = 0;

const handleOverlayTouch = (event: TouchEvent) => {
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
};

const handleMenuTouch = (event: TouchEvent) => {
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
};

// Methods
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
  
  // Prevent body scroll when menu is open
  if (isMenuOpen.value) {
    document.body.style.overflow = 'hidden';
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  } else {
    document.body.style.overflow = '';
  }
};

const closeMenu = () => {
  isMenuOpen.value = false;
  document.body.style.overflow = '';
};

const handleNavClick = () => {
  closeMenu();
  // Add haptic feedback for navigation
  if ('vibrate' in navigator) {
    navigator.vibrate(30);
  }
};

const createBoard = () => {
  closeMenu();
  router.push('/boards/new');
};

const createCard = () => {
  closeMenu();
  // Emit event to parent component
  emit('create-card');
};

const openSearch = () => {
  closeMenu();
  // Emit event to parent component
  emit('open-search');
};

const changeTheme = (themeId: string) => {
  themeStore.setTheme(themeId);
  // Add haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(40);
  }
};

const toggleOfflineMode = () => {
  // Handle offline mode toggle
  connectionStore.setOfflineMode(offlineMode.value);
};

const openNotificationSettings = () => {
  closeMenu();
  router.push('/settings/notifications');
};

const openOfflineSettings = () => {
  closeMenu();
  router.push('/settings/offline');
};

const openAccessibilitySettings = () => {
  closeMenu();
  router.push('/settings/accessibility');
};

const openHelpCenter = () => {
  closeMenu();
  router.push('/help');
};

const handleLogout = async () => {
  try {
    await userStore.logout();
    closeMenu();
    router.push('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};

// Handle escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isMenuOpen.value) {
    closeMenu();
  }
};

// Handle swipe gestures
const handleTouchEnd = (event: TouchEvent) => {
  if (!isMenuOpen.value) return;
  
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = Math.abs(touch.clientY - touchStartY);
  
  // Close menu on right swipe (if starting from menu area)
  if (deltaX > 100 && deltaY < 50 && touchStartX < 300) {
    closeMenu();
  }
};

// Emit events
const emit = defineEmits(['create-card', 'open-search']);

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('touchend', handleTouchEnd, { passive: true });
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('touchend', handleTouchEnd);
  document.body.style.overflow = ''; // Cleanup body overflow
});
</script>

<style scoped lang="scss">
@import '@/styles/mobile/breakpoints.scss';
@import '@/styles/mobile/touch-targets.scss';

.mobile-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color-light);
  backdrop-filter: blur(10px);

  @include respond-to(desktop) {
    display: none; // Hide on desktop
  }
}

.mobile-navbar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mobile-spacing-sm) var(--mobile-spacing-md);
  height: 64px;

  .navbar-brand {
    display: flex;
    align-items: center;
    gap: var(--mobile-spacing-sm);

    .brand-logo {
      width: 32px;
      height: 32px;
    }

    .brand-text {
      font-size: var(--mobile-font-size-lg);
      font-weight: 700;
      color: var(--primary-color);
    }
  }

  .navbar-toggle {
    @include touch-target-recommended;
    background: transparent;
    border: none;
    padding: var(--mobile-spacing-xs);
    border-radius: var(--mobile-radius-md);
    transition: background-color 0.2s ease;

    &:active {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .hamburger-icon {
      width: 24px;
      height: 18px;
      position: relative;
      cursor: pointer;

      span {
        display: block;
        position: absolute;
        height: 3px;
        width: 100%;
        background: var(--text-primary);
        border-radius: 2px;
        opacity: 1;
        left: 0;
        transform: rotate(0deg);
        transition: 0.25s ease-in-out;

        &:nth-child(1) {
          top: 0px;
        }

        &:nth-child(2) {
          top: 7px;
        }

        &:nth-child(3) {
          top: 14px;
        }
      }

      &.active {
        span {
          &:nth-child(1) {
            top: 7px;
            transform: rotate(135deg);
          }

          &:nth-child(2) {
            opacity: 0;
            left: -60px;
          }

          &:nth-child(3) {
            top: 7px;
            transform: rotate(-135deg);
          }
        }
      }
    }
  }
}

.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1001;
  opacity: 0;
  animation: fadeIn 0.3s ease forwards;

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }
}

.mobile-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 320px;
  height: 100vh;
  background: var(--bg-primary);
  z-index: 1002;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  &.menu-open {
    transform: translateX(0);
  }

  .mobile-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--mobile-spacing-lg);
    border-bottom: 1px solid var(--border-color-light);

    .user-profile {
      display: flex;
      align-items: center;
      gap: var(--mobile-spacing-md);

      .user-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid var(--primary-color);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .user-info {
        .user-name {
          font-size: var(--mobile-font-size-base);
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-email {
          font-size: var(--mobile-font-size-sm);
          color: var(--text-secondary);
        }
      }
    }

    .menu-close {
      @include touch-target-recommended;
      background: transparent;
      border: none;
      padding: var(--mobile-spacing-xs);
      border-radius: var(--mobile-radius-md);
    }
  }

  .mobile-menu-content {
    flex: 1;
    padding: var(--mobile-spacing-lg);
    overflow-y: auto;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--mobile-spacing-sm);
    margin-bottom: var(--mobile-spacing-xl);

    .quick-action-btn {
      @include touch-target-comfortable;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mobile-spacing-xs);
      padding: var(--mobile-spacing-md);
      background: var(--bg-secondary);
      border: none;
      border-radius: var(--mobile-radius-lg);
      color: var(--text-primary);
      font-size: var(--mobile-font-size-sm);
      font-weight: 500;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.95);
        background: var(--bg-tertiary);
      }
    }
  }

  .mobile-nav-links {
    margin-bottom: var(--mobile-spacing-xl);

    .nav-link {
      display: flex;
      align-items: center;
      gap: var(--mobile-spacing-md);
      padding: var(--mobile-spacing-md) var(--mobile-spacing-sm);
      text-decoration: none;
      color: var(--text-primary);
      border-radius: var(--mobile-radius-md);
      margin-bottom: var(--mobile-spacing-xs);
      min-height: var(--touch-target-recommended);
      position: relative;
      transition: background-color 0.2s ease;

      &:active {
        background-color: var(--bg-secondary);
      }

      &.active {
        background-color: var(--primary-light);
        color: var(--primary-color);
        font-weight: 600;
      }

      .nav-badge {
        margin-left: auto;
        background: var(--primary-color);
        color: white;
        font-size: var(--mobile-font-size-xs);
        padding: 2px 6px;
        border-radius: var(--mobile-radius-full);
        min-width: 20px;
        text-align: center;
      }
    }
  }

  .theme-selector,
  .mobile-settings {
    margin-bottom: var(--mobile-spacing-xl);

    .section-title {
      font-size: var(--mobile-font-size-sm);
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--mobile-spacing-md);
    }
  }

  .theme-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--mobile-spacing-sm);

    .theme-option {
      display: flex;
      align-items: center;
      gap: var(--mobile-spacing-sm);
      padding: var(--mobile-spacing-sm);
      background: transparent;
      border: 2px solid var(--border-color-light);
      border-radius: var(--mobile-radius-md);
      font-size: var(--mobile-font-size-sm);
      transition: all 0.2s ease;
      min-height: var(--touch-target-minimum);

      &.active {
        border-color: var(--primary-color);
        background: var(--primary-light);
      }

      &:active {
        transform: scale(0.98);
      }

      .theme-preview {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
    }
  }

  .settings-list {
    .settings-item {
      display: flex;
      align-items: center;
      gap: var(--mobile-spacing-md);
      width: 100%;
      padding: var(--mobile-spacing-md) var(--mobile-spacing-sm);
      background: transparent;
      border: none;
      text-align: left;
      color: var(--text-primary);
      border-radius: var(--mobile-radius-md);
      margin-bottom: var(--mobile-spacing-xs);
      min-height: var(--touch-target-recommended);
      transition: background-color 0.2s ease;

      &:active {
        background-color: var(--bg-secondary);
      }

      .settings-toggle {
        margin-left: auto;
        position: relative;
        width: 44px;
        height: 24px;

        input[type="checkbox"] {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--border-color);
          border-radius: 24px;
          transition: 0.3s;

          &:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background: white;
            border-radius: 50%;
            transition: 0.3s;
          }
        }

        input:checked + .toggle-slider {
          background: var(--primary-color);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }
      }

      .item-arrow {
        margin-left: auto;
        color: var(--text-secondary);
      }
    }
  }

  .mobile-menu-footer {
    padding: var(--mobile-spacing-lg);
    border-top: 1px solid var(--border-color-light);

    .app-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--mobile-spacing-md);
      font-size: var(--mobile-font-size-sm);
      color: var(--text-secondary);

      .connection-status {
        display: flex;
        align-items: center;
        gap: var(--mobile-spacing-xs);

        &.online {
          color: var(--success-color);
        }

        &.offline {
          color: var(--warning-color);
        }
      }
    }

    .logout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--mobile-spacing-sm);
      width: 100%;
      padding: var(--mobile-spacing-md);
      background: var(--danger-color);
      color: white;
      border: none;
      border-radius: var(--mobile-radius-md);
      font-weight: 600;
      min-height: var(--touch-target-recommended);
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.98);
        background: var(--danger-dark);
      }
    }
  }
}

// Animation for menu items
.mobile-nav-links .nav-link,
.settings-item {
  animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .mobile-menu,
  .mobile-menu-overlay,
  .navbar-toggle .hamburger-icon span,
  .quick-action-btn,
  .theme-option,
  .settings-item,
  .logout-btn {
    transition: none;
    animation: none;
  }

  .mobile-menu {
    transform: translateX(0) !important;
  }

  .mobile-menu-overlay {
    opacity: 1 !important;
  }
}
</style>
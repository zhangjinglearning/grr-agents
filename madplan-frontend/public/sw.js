/**
 * Service Worker for MadPlan Frontend
 * Implements Story 4.2 offline capability and caching requirements
 */

const CACHE_VERSION = 'madplan-v1.0.0';
const CACHE_NAMES = {
  APP_SHELL: `${CACHE_VERSION}-app-shell`,
  API: `${CACHE_VERSION}-api`,
  IMAGES: `${CACHE_VERSION}-images`,
  FONTS: `${CACHE_VERSION}-fonts`,
  RUNTIME: `${CACHE_VERSION}-runtime`,
};

// Cache strategies as defined in story requirements
const CACHE_STRATEGIES = {
  appShell: 'cache-first',      // HTML, CSS, JS core files
  api: 'network-first',         // GraphQL API calls
  images: 'cache-first',        // Theme backgrounds, icons
  fonts: 'cache-first',         // Typography assets
  data: 'network-first'         // User board data
};

// App shell resources to cache immediately
const APP_SHELL_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS files will be added dynamically based on build output
];

// API endpoints that can work offline
const CACHEABLE_API_PATTERNS = [
  /\/graphql.*boards/,
  /\/graphql.*themes/,
  /\/api\/boards/,
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(CACHE_NAMES.APP_SHELL).then((cache) => {
      console.log('[SW] Caching app shell resources');
      return cache.addAll(APP_SHELL_RESOURCES);
    }).then(() => {
      console.log('[SW] App shell cached successfully');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[SW] Failed to cache app shell:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete old caches that don't match current version
            return !Object.values(CACHE_NAMES).includes(cacheName);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Cache cleanup completed');
      // Take control of all clients immediately
      return self.clients.claim();
    }).catch((error) => {
      console.error('[SW] Cache cleanup failed:', error);
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { url, method } = request;

  // Only handle GET requests
  if (method !== 'GET') return;

  // Handle different types of requests
  if (url.includes('/graphql') || url.includes('/api/')) {
    // API requests - network first with fallback
    event.respondWith(handleAPIRequest(request));
  } else if (isImageRequest(url)) {
    // Image requests - cache first
    event.respondWith(handleImageRequest(request));
  } else if (isFontRequest(url)) {
    // Font requests - cache first
    event.respondWith(handleFontRequest(request));
  } else if (isAppShellRequest(url)) {
    // App shell requests - cache first with network fallback
    event.respondWith(handleAppShellRequest(request));
  } else {
    // Runtime requests - network first with cache fallback
    event.respondWith(handleRuntimeRequest(request));
  }
});

// API request handler - Network first strategy
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request.clone());
    
    if (networkResponse.ok) {
      // Cache successful responses for offline access
      if (isCacheableAPI(url.pathname)) {
        const cache = await caches.open(CACHE_NAMES.API);
        cache.put(request.clone(), networkResponse.clone());
      }
      return networkResponse;
    }
    
    // Network failed but response exists, try cache
    throw new Error(`Network response not ok: ${networkResponse.status}`);
    
  } catch (error) {
    console.log('[SW] Network failed for API request, trying cache:', url.pathname);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add offline indicator header
      const offlineResponse = new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: {
          ...cachedResponse.headers,
          'X-Offline-Response': 'true',
        }
      });
      return offlineResponse;
    }
    
    // Return offline fallback for GraphQL
    if (url.pathname.includes('graphql')) {
      return createOfflineGraphQLResponse(request);
    }
    
    throw error;
  }
}

// Image request handler - Cache first strategy
async function handleImageRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.IMAGES);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to load image:', request.url);
    
    // Return placeholder image
    return new Response(
      createPlaceholderSVG(),
      {
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Font request handler - Cache first strategy
async function handleFontRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.FONTS);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to load font:', request.url);
    throw error; // Let browser fallback handle fonts
  }
}

// App shell request handler - Cache first with network fallback
async function handleAppShellRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Fetch network version in background for next time
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        caches.open(CACHE_NAMES.APP_SHELL).then(cache => {
          cache.put(request, networkResponse);
        });
      }
    }).catch(() => {
      // Network update failed, keep using cache
    });
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.APP_SHELL);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // If this is navigation, return cached index.html
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// Runtime request handler - Network first with cache fallback
async function handleRuntimeRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.RUNTIME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Helper functions
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|svg|gif|webp|ico)(\?.*)?$/i.test(url);
}

function isFontRequest(url) {
  return /\.(woff|woff2|eot|ttf|otf)(\?.*)?$/i.test(url);
}

function isAppShellRequest(url) {
  const appShellPatterns = [
    /\/$/, // Root
    /\/index\.html$/,
    /\/manifest\.json$/,
    /\.(css|js)$/,
  ];
  
  return appShellPatterns.some(pattern => pattern.test(url));
}

function isCacheableAPI(pathname) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(pathname));
}

function createOfflineGraphQLResponse(request) {
  // Return minimal offline data structure for GraphQL queries
  const offlineData = {
    data: {
      boards: [],
      themes: [
        {
          id: 'spirited-away',
          name: 'spirited-away',
          displayName: 'Spirited Away',
          description: 'Available offline',
        }
      ]
    },
    errors: [{
      message: 'You are currently offline. Limited data is available.',
      extensions: { offline: true }
    }]
  };
  
  return new Response(JSON.stringify(offlineData), {
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Response': 'true',
    }
  });
}

function createPlaceholderSVG() {
  return `
    <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">
        Image unavailable offline
      </text>
    </svg>
  `;
}

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-boards') {
    event.waitUntil(syncPendingChanges());
  }
});

async function syncPendingChanges() {
  try {
    // Get pending changes from IndexedDB
    const pendingChanges = await getPendingChanges();
    
    for (const change of pendingChanges) {
      try {
        await fetch('/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth header from stored credentials
          },
          body: JSON.stringify(change.mutation)
        });
        
        // Remove successfully synced change
        await removePendingChange(change.id);
        
      } catch (error) {
        console.error('[SW] Failed to sync change:', change.id, error);
      }
    }
    
    // Notify clients of sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        timestamp: Date.now()
      });
    });
    
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Placeholder functions for IndexedDB operations (to be implemented)
async function getPendingChanges() {
  // TODO: Implement IndexedDB storage for pending changes
  return [];
}

async function removePendingChange(id) {
  // TODO: Remove synced change from IndexedDB
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', data.type);
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

console.log('[SW] Service worker script loaded');
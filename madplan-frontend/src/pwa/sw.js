/**
 * MadPlan Service Worker
 * Advanced PWA service worker with sophisticated caching strategies
 */

// Service worker version and cache names
const SW_VERSION = '1.0.0';
const CACHE_PREFIX = 'madplan';

const CACHE_NAMES = {
  static: `${CACHE_PREFIX}-static-v${SW_VERSION}`,
  dynamic: `${CACHE_PREFIX}-dynamic-v${SW_VERSION}`,
  api: `${CACHE_PREFIX}-api-v${SW_VERSION}`,
  images: `${CACHE_PREFIX}-images-v${SW_VERSION}`,
  fonts: `${CACHE_PREFIX}-fonts-v${SW_VERSION}`
};

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard',
  '/boards',
  '/manifest.json',
  '/css/main.css',
  '/js/main.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/offline.html'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^https:\/\/api\.madplan\.app\/.*$/,
  /^\/api\/boards\/.*$/,
  /^\/api\/cards\/.*$/,
  /^\/api\/users\/profile$/
];

// Network-first patterns (always try network first)
const NETWORK_FIRST_PATTERNS = [
  /^\/api\/auth\/.*$/,
  /^\/api\/sync\/.*$/,
  /^\/api\/realtime\/.*$/,
  /^\/api\/notifications\/.*$/
];

// Cache-first patterns (serve from cache if available)
const CACHE_FIRST_PATTERNS = [
  /\.(png|jpg|jpeg|gif|webp|svg|ico)$/,
  /\.(woff|woff2|ttf|otf|eot)$/,
  /\.(css|js)$/
];

// Maximum cache sizes
const MAX_CACHE_SIZES = {
  dynamic: 50,
  api: 100,
  images: 60,
  fonts: 30
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRY = {
  static: 24 * 60 * 60 * 1000, // 24 hours
  api: 10 * 60 * 1000, // 10 minutes
  images: 7 * 24 * 60 * 60 * 1000, // 7 days
  fonts: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// Background sync tags
const SYNC_TAGS = {
  boardSync: 'board-sync',
  cardSync: 'card-sync',
  userSync: 'user-sync',
  imageUpload: 'image-upload',
  offlineActions: 'offline-actions'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log(`Service Worker ${SW_VERSION} installing...`);
  
  event.waitUntil(
    Promise.all([
      cacheStaticAssets(),
      self.skipWaiting()
    ])
  );
});

// Activate event - clean old caches and take control
self.addEventListener('activate', (event) => {
  console.log(`Service Worker ${SW_VERSION} activating...`);
  
  event.waitUntil(
    Promise.all([
      cleanOldCaches(),
      self.clients.claim(),
      setupPeriodicSync()
    ])
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    event.respondWith(handleNonGetRequest(request));
    return;
  }

  // Route to appropriate strategy based on request
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.static));
  } else if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
  } else if (isImageRequest(url)) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.images));
  } else if (isFontRequest(url)) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.fonts));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAMES.dynamic));
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.boardSync:
      event.waitUntil(syncBoards());
      break;
    case SYNC_TAGS.cardSync:
      event.waitUntil(syncCards());
      break;
    case SYNC_TAGS.userSync:
      event.waitUntil(syncUserData());
      break;
    case SYNC_TAGS.imageUpload:
      event.waitUntil(uploadPendingImages());
      break;
    case SYNC_TAGS.offlineActions:
      event.waitUntil(syncOfflineActions());
      break;
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push message received:', event);
  
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    event.waitUntil(handlePushNotification(data));
  } catch (error) {
    console.error('Error parsing push data:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  event.waitUntil(handleNotificationClick(action, data));
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'CACHE_BOARD':
      event.waitUntil(cacheBoardData(payload));
      break;
    case 'CLEAR_CACHE':
      event.waitUntil(clearSpecificCache(payload.cacheName));
      break;
    case 'GET_CACHE_STATUS':
      event.waitUntil(getCacheStatus().then(status => 
        event.ports[0].postMessage(status)
      ));
      break;
    case 'QUEUE_OFFLINE_ACTION':
      event.waitUntil(queueOfflineAction(payload));
      break;
  }
});

// Periodic background sync (when supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(performPeriodicSync());
  }
});

// Cache static assets on install
async function cacheStaticAssets() {
  try {
    const cache = await caches.open(CACHE_NAMES.static);
    await cache.addAll(STATIC_ASSETS);
    console.log('Static assets cached successfully');
  } catch (error) {
    console.error('Failed to cache static assets:', error);
  }
}

// Clean old caches
async function cleanOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => 
      name.startsWith(CACHE_PREFIX) && !Object.values(CACHE_NAMES).includes(name)
    );
    
    await Promise.all(oldCaches.map(name => caches.delete(name)));
    console.log('Old caches cleaned:', oldCaches);
  } catch (error) {
    console.error('Failed to clean old caches:', error);
  }
}

// Cache-first strategy
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached && !isExpired(cached, cacheName)) {
      return cached;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);
    
    // Return cached version if network fails
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    // Return offline page for navigation requests
    if (isNavigationRequest(request)) {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Network-first strategy
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Network request failed, trying cache:', error);
    
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
      limitCacheSize(cacheName);
    }
    return response;
  }).catch(error => {
    console.warn('Stale-while-revalidate fetch failed:', error);
  });
  
  return cached || fetchPromise;
}

// Handle API requests
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Network-first for real-time endpoints
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return networkFirstStrategy(request, CACHE_NAMES.api);
  }
  
  // Cache-first for data endpoints
  return cacheFirstStrategy(request, CACHE_NAMES.api);
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Return cached page or offline page
    const cache = await caches.open(CACHE_NAMES.static);
    let response = await cache.match(request);
    
    if (!response) {
      response = await cache.match('/offline.html');
    }
    
    return response || new Response('Offline', { status: 503 });
  }
}

// Handle non-GET requests
async function handleNonGetRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Queue for background sync if offline
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      await queueOfflineAction({
        method: request.method,
        url: request.url,
        body: await request.text(),
        headers: Object.fromEntries(request.headers.entries())
      });
      
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Limit cache size
async function limitCacheSize(cacheName) {
  const maxSize = MAX_CACHE_SIZES[cacheName.split('-')[1]] || 50;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    const sortedKeys = keys.sort((a, b) => {
      const aTime = getCacheTime(a);
      const bTime = getCacheTime(b);
      return aTime - bTime;
    });
    
    // Remove oldest entries
    const toDelete = sortedKeys.slice(0, keys.length - maxSize);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

// Check if cache entry is expired
function isExpired(response, cacheName) {
  const cacheTime = response.headers.get('sw-cache-time');
  if (!cacheTime) return false;
  
  const expiry = CACHE_EXPIRY[cacheName.split('-')[1]] || CACHE_EXPIRY.static;
  return Date.now() - parseInt(cacheTime) > expiry;
}

// Get cache time from response
function getCacheTime(request) {
  return parseInt(request.headers.get('sw-cache-time')) || 0;
}

// Request type checkers
function isStaticAsset(url) {
  return STATIC_ASSETS.includes(url.pathname);
}

function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname);
}

function isFontRequest(url) {
  return /\.(woff|woff2|ttf|otf|eot)$/i.test(url.pathname);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Background sync functions
async function syncBoards() {
  try {
    const pendingBoards = await getFromIndexedDB('pendingBoards');
    
    for (const board of pendingBoards) {
      try {
        const response = await fetch('/api/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(board)
        });
        
        if (response.ok) {
          await removeFromIndexedDB('pendingBoards', board.id);
        }
      } catch (error) {
        console.error('Failed to sync board:', board.id, error);
      }
    }
  } catch (error) {
    console.error('Board sync failed:', error);
  }
}

async function syncCards() {
  try {
    const pendingCards = await getFromIndexedDB('pendingCards');
    
    for (const card of pendingCards) {
      try {
        const response = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(card)
        });
        
        if (response.ok) {
          await removeFromIndexedDB('pendingCards', card.id);
        }
      } catch (error) {
        console.error('Failed to sync card:', card.id, error);
      }
    }
  } catch (error) {
    console.error('Card sync failed:', error);
  }
}

async function syncUserData() {
  try {
    const pendingUserData = await getFromIndexedDB('pendingUserData');
    
    if (pendingUserData) {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingUserData)
      });
      
      if (response.ok) {
        await removeFromIndexedDB('pendingUserData', 'profile');
      }
    }
  } catch (error) {
    console.error('User data sync failed:', error);
  }
}

async function uploadPendingImages() {
  try {
    const pendingImages = await getFromIndexedDB('pendingImages');
    
    for (const imageData of pendingImages) {
      try {
        const formData = new FormData();
        formData.append('file', imageData.file);
        formData.append('metadata', JSON.stringify(imageData.metadata));
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          await removeFromIndexedDB('pendingImages', imageData.id);
        }
      } catch (error) {
        console.error('Failed to upload image:', imageData.id, error);
      }
    }
  } catch (error) {
    console.error('Image upload sync failed:', error);
  }
}

async function syncOfflineActions() {
  try {
    const offlineActions = await getFromIndexedDB('offlineActions');
    
    for (const action of offlineActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        if (response.ok) {
          await removeFromIndexedDB('offlineActions', action.id);
        }
      } catch (error) {
        console.error('Failed to sync offline action:', action.id, error);
      }
    }
  } catch (error) {
    console.error('Offline actions sync failed:', error);
  }
}

// Push notification handlers
async function handlePushNotification(data) {
  const { title, body, icon, badge, actions, data: notificationData } = data;
  
  const options = {
    body,
    icon: icon || '/icons/icon-192.png',
    badge: badge || '/icons/badge.png',
    data: notificationData,
    actions: actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false
  };
  
  return self.registration.showNotification(title, options);
}

async function handleNotificationClick(action, data) {
  let url = '/dashboard';
  
  if (action === 'view' && data?.boardId) {
    url = `/boards/${data.boardId}`;
  } else if (action === 'reply' && data?.cardId) {
    url = `/cards/${data.cardId}`;
  } else if (data?.url) {
    url = data.url;
  }
  
  const clients = await self.clients.matchAll({ type: 'window' });
  
  // Focus existing window if available
  for (const client of clients) {
    if (client.url.includes(url)) {
      return client.focus();
    }
  }
  
  // Open new window
  return self.clients.openWindow(url);
}

// Periodic sync
async function setupPeriodicSync() {
  if ('periodicSync' in self.registration) {
    try {
      await self.registration.periodicSync.register('content-sync', {
        minInterval: 24 * 60 * 60 * 1000 // 24 hours
      });
      console.log('Periodic sync registered');
    } catch (error) {
      console.log('Periodic sync registration failed:', error);
    }
  }
}

async function performPeriodicSync() {
  try {
    // Sync critical data in background
    await Promise.all([
      syncBoards(),
      syncCards(),
      syncUserData()
    ]);
    
    console.log('Periodic sync completed');
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

// IndexedDB helpers
async function getFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MadPlanDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function removeFromIndexedDB(storeName, key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MadPlanDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const deleteRequest = store.delete(key);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Queue offline action
async function queueOfflineAction(action) {
  const actionWithId = {
    ...action,
    id: Date.now() + Math.random(),
    timestamp: Date.now()
  };
  
  // Store in IndexedDB
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MadPlanDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const addRequest = store.add(actionWithId);
      
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Cache board data
async function cacheBoardData(boardData) {
  const cache = await caches.open(CACHE_NAMES.api);
  const response = new Response(JSON.stringify(boardData), {
    headers: {
      'Content-Type': 'application/json',
      'sw-cache-time': Date.now().toString()
    }
  });
  
  await cache.put(`/api/boards/${boardData.id}`, response);
}

// Clear specific cache
async function clearSpecificCache(cacheName) {
  const fullCacheName = Object.values(CACHE_NAMES).find(name => name.includes(cacheName));
  if (fullCacheName) {
    await caches.delete(fullCacheName);
    console.log(`Cache cleared: ${fullCacheName}`);
  }
}

// Get cache status
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    status[cacheName] = {
      size: keys.length,
      keys: keys.map(key => key.url)
    };
  }
  
  return status;
}

console.log(`MadPlan Service Worker ${SW_VERSION} loaded successfully`);
// Dissident Bot PWA Service Worker v3.0.0

const CACHE_NAME = 'dissident-v3.0.0';
const STATIC_CACHE = 'dissident-static-v3';
const DYNAMIC_CACHE = 'dissident-dynamic-v3';
const API_CACHE = 'dissident-api-v3';

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/login',
    '/static/css/output.css',
    '/static/js/charts.js',
    '/static/js/socket.js',
    '/static/js/app.js',
    '/static/js/push.js',
    '/static/pwa/icon.svg',
    '/pwa/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip Socket.IO requests
    if (url.pathname.includes('socket.io')) return;
    
    // Handle API requests - network only with timeout
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstWithTimeout(request, API_CACHE));
        return;
    }
    
    // Handle page requests - network first
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstWithTimeout(request, DYNAMIC_CACHE));
        return;
    }
    
    // Handle static assets - cache first
    if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/pwa/')) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }
    
    // Default - network first
    event.respondWith(networkFirstWithTimeout(request, DYNAMIC_CACHE));
});

// Cache first strategy
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Cache first failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

// Network first with timeout
async function networkFirstWithTimeout(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        
        // Race network with timeout
        const response = await Promise.race([
            fetch(request),
            timeoutPromise
        ]);
        
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', error);
        
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlinePage = await cache.match('/');
            if (offlinePage) {
                return offlinePage;
            }
        }
        
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Sync any pending data when back online
    console.log('[SW] Syncing pending data...');
}

// Push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    
    let data = {
        title: 'Dissident Bot',
        body: 'New notification',
        icon: '/static/pwa/icon.svg'
    };
    
    try {
        if (event.data) {
            data = { ...data, ...event.data.json() };
        }
    } catch (error) {
        console.log('[SW] Push data error:', error);
    }
    
    const options = {
        body: data.body,
        icon: data.icon || '/static/pwa/icon.svg',
        badge: '/static/pwa/icon.svg',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/dashboard',
            dateOfArrival: Date.now()
        },
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'dismiss') return;
    
    const url = event.notification.data?.url || '/dashboard';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window or open new one
                for (const client of clientList) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(url);
            })
    );
});

// Message handling
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data?.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data?.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((names) => {
                return Promise.all(names.map(caches.delete));
            })
        );
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-stats') {
        event.waitUntil(syncStats());
    }
});

async function syncStats() {
    // Sync stats in background
    console.log('[SW] Periodic sync of stats...');
}

// Handle errors
self.addEventListener('error', (event) => {
    console.error('[SW] Error:', event.error);
});

console.log('[SW] Service worker loaded');

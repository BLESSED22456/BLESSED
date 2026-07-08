const CACHE_NAME = 'blessed-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/products.json',
  '/app_logo.jpg'
];

// Install Service Worker and cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate and clean up old caches (this discards v1 immediately)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Dynamic fetch routing: Network-First for HTML/JSON, Cache-First for assets
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  
  const isDynamic = event.request.url.includes('products.json') || 
                    event.request.url.endsWith('/') || 
                    event.request.url.includes('index.html');
  
  if (isDynamic) {
    // Network-First: Always attempt to fetch from internet, fallback to cache if offline
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  } else {
    // Cache-First: Serve static files (images, icons) from cache, fallback to network
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
  }
});

// Family Budget — Service Worker
// Caches app shell, network-first for API calls

const CACHE_VERSION = 'v1';
const CACHE_NAME = `family-budget-${CACHE_VERSION}`;

const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app/api.js',
  '/app/currency.js',
  '/app/tags.js',
  '/app/add.js',
  '/app/history.js',
  '/app/charts.js'
];

// ============================================================================
// Install Event — Pre-cache app shell
// ============================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).then(() => {
        self.skipWaiting();
      });
    })
  );
});

// ============================================================================
// Activate Event — Clean up old caches
// ============================================================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('family-budget-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// ============================================================================
// Fetch Event — Cache-first for app shell, network-only for API
// ============================================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for Google Apps Script API calls
  if (url.host === 'script.google.com') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Offline: Cannot reach backend. Check your connection.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
    );
    return;
  }

  // Network-only for external APIs (NBU exchange rates)
  if (url.host === 'bank.gov.ua') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Offline: Cannot reach exchange rate service.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
    );
    return;
  }

  // Cache-first for app shell and static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Cache GET requests to our own domain
        if (event.request.method === 'GET' && url.origin === self.location.origin) {
          const cacheable = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheable);
          });
        }

        return response;
      }).catch(() => {
        // Fallback for offline app shell
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Offline: Resource not cached.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

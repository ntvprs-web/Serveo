/* ============================================
   SERVEO — Progressive Web App Service Worker
   Enables offline capabilities & cached assets for disaster/emergency zones
   ============================================ */

const CACHE_NAME = 'serveo-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/map.html',
  '/events.html',
  '/event-detail.html',
  '/impact.html',
  '/about.html',
  '/post-event.html',
  '/organizer.html',
  '/css/base.css',
  '/css/navbar.css',
  '/css/map.css',
  '/css/events.css',
  '/css/event-detail.html',
  '/css/home.css',
  '/css/impact.css',
  '/css/organizer.css',
  '/css/post-event.css',
  '/js/app.js',
  '/js/data.js',
  '/js/db.js',
  '/js/firebase.js',
  '/js/maptiles.js',
  '/js/notifications.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Stale-while-revalidate for local assets
  if (e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const networkFetch = fetch(e.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

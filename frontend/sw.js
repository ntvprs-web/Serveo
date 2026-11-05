/* ============================================
   SERVEO — Progressive Web App Service Worker
   Enables offline capabilities & cached assets for emergency zones
   ============================================ */

const CACHE_NAME = 'serveo-cache-v50';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/map.html',
  '/events.html',
  '/event-detail.html',
  '/impact.html',
  '/about.html',
  '/post-event.html',
  '/premium.html',
  '/badges.html',
  '/terms.html',
  '/privacy.html',
  '/urgent-blood.html',
  '/organizer.html',
  '/css/base.css',
  '/css/navbar.css',
  '/css/map.css',
  '/css/events.css',
  '/css/event-detail.css',
  '/css/home.css',
  '/css/impact.css',
  '/css/organizer.css',
  '/css/post-event.css',
  '/css/premium.css',
  '/css/badges.css',
  '/css/urgent-blood.css',
  '/css/terms.css',
  '/js/app.js',
  '/js/data.js',
  '/js/db.js',
  '/js/volunteer-flow.js',
  '/js/maptiles.js',
  '/js/notifications.js',
  '/js/urgent-blood.js',
  '/js/legal-content.js',
  '/js/terms.js',
  '/js/badges.js',
  '/vendor/gsap.min.js',
  '/vendor/lenis.min.js',
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
  // Never cache API or SSE stream requests — always use network
  if (e.request.url.includes('/api/')) {
    return;
  }

  // Stale-while-revalidate for local static assets
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







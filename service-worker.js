const CACHE = 'floosy-v4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css?v=10',
  './js/db.js?v=3',
  './js/app.js?v=11',
  './js/planner.js?v=3',
  './js/monthly-summary.js?v=2',
  './images/favicon.png',
  './images/icon-192.png',
  './images/icon-512.png',
  './vendor/chart.js',
  './vendor/toastify-js.js',
  './vendor/toastify.min.css',
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-brands-400.ttf',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.ttf',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/fontawesome/webfonts/fa-solid-900.ttf',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-v4compatibility.ttf',
  './vendor/fontawesome/webfonts/fa-v4compatibility.woff2'
  // add every other file from css/, js/ and images/ that the app uses
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('floosy-') && k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            event.waitUntil((async () => {
              const cache = await caches.open(CACHE);
              await cache.put(req, copy);
            })());
          }
          return res;
        })
        .catch((error) => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then((cachedPage) => {
              if (cachedPage) return cachedPage;
              throw error;
            });
          }
          throw error;
        });
    })
  );
});
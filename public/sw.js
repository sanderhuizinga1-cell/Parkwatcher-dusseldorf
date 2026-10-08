const CACHE_NAME = 'dus-parking-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/parking')) {
    // API calls bypass cache
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

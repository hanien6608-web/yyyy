const CACHE_NAME = 'utopia-v1';
const assets = [
  './index.html',
  './manifest.json',
  'https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/oo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
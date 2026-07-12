const CACHE_NAME = 'bible-journey-map-v1.2.0';
const LOCAL_ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/css/styles.css', './assets/js/app.js', './assets/js/data-service.js',
  './assets/icons/app-icon.svg', './assets/icons/app-icon-192.png', './assets/icons/app-icon-512.png',
  './assets/icons/city-placeholder.svg', './assets/icons/journey-1.svg', './assets/icons/journey-2.svg',
  './assets/icons/journey-3.svg', './assets/icons/journey-rome.svg',
  './data/cities.json', './data/journeys.json', './data/events.json', './data/people.json',
  './data/countries.json', './data/routes.geojson', './data/images.json', './data/metadata.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(LOCAL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // OSM 타일과 Leaflet CDN은 오프라인 캐시에 저장하지 않는다.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const fresh = fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

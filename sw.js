const CACHE = 'kidcare-v2';
const ASSETS = [
  '/kidcare-pwa/',
  '/kidcare-pwa/index.html',
  '/kidcare-pwa/manifest.webmanifest',
  '/kidcare-pwa/css/styles.css',
  '/kidcare-pwa/js/app.js',
  '/kidcare-pwa/js/db.js',
  '/kidcare-pwa/js/chart.js',
  '/kidcare-pwa/js/export.js',
  '/kidcare-pwa/icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});

const CACHE = 'mgh-v3.9.0';
const ASSETS = ['./', './index.html', './manifest.json', './styles.css', './styles.part0.css', './styles.part1.css', './styles.part2.css', './tailwind-config.js', './app-core-0.js', './app-core-1.js', './app-core-2.js', './app-core-3.js', './app-ui-0.js', './app-ui-1.js', './app-ui-2.js', './app-ui-3.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => {
            try { c.put(e.request, copy); } catch (err) {}
          });
          return res;
        })
        .catch(() => cached || caches.match('./index.html'))
    )
  );
});

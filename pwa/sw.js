// Offline support. The page itself is fetched network-first so every deploy shows up
// on the next open; icons and fonts are cache-first. Each build gets its own cache.
const CACHE = 'tidepool-__VERSION__';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => {
  const font = /fonts\.(googleapis|gstatic)\.com/.test(req.url);
  if ((res.ok && (res.type === 'basic' || res.type === 'cors')) || (font && res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const page = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  if (page) {
    // Network first, bypassing the HTTP cache; fall back to the cached page offline.
    e.respondWith(fetch(req, { cache: 'no-store' }).then((res) => keep(req, res))
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
});

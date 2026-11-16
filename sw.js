// Service worker: guarda la app para que abra rápido y sin internet
const CACHE = 'apuntador-v6';
const FILES = ['./', './index.html', './match.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './textos.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Primero internet (para recibir cambios); si no hay, lo guardado
function networkFirst(req, key) {
  return fetch(req)
    .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key || req, copy)); } return r; })
    .catch(() => caches.match(key || req));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') { e.respondWith(networkFirst(e.request, './index.html')); return; }
  if (url.pathname.endsWith('/textos.json') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/match.js')) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

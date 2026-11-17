// Service worker: guarda la app para que abra rápido y sin internet
const CACHE = 'apuntador-v14';
const FILES = ['./', './index.html', './match.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './textos.json'];
const ESPERA_MAX = 1500; // ms que se espera a internet antes de usar la copia guardada

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

// Primero internet (para recibir cambios), pero si tarda más de ESPERA_MAX
// o falla, se usa la copia guardada. La descarga sigue por detrás y deja
// lista la versión nueva para la siguiente vez que abras la app.
function networkFirst(e, key) {
  const k = key || e.request;
  // cache: 'no-cache' = preguntar siempre al servidor si hay versión nueva
  const red = fetch(e.request.url, { cache: 'no-cache' })
    .then(r => {
      if (r.ok) { const copy = r.clone(); return caches.open(CACHE).then(c => c.put(k, copy)).then(() => r); }
      return r;
    });
  e.waitUntil(red.catch(() => {})); // que la descarga termine aunque ya se haya mostrado la copia

  const deRed = red.catch(() => caches.match(k));
  const porTiempo = new Promise(res => setTimeout(res, ESPERA_MAX)).then(() => caches.match(k));
  return Promise.race([deRed, porTiempo]).then(r => r || deRed).then(r => r || Response.error());
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') { e.respondWith(networkFirst(e, './index.html')); return; }
  if (url.pathname.endsWith('/textos.json') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/match.js')) {
    e.respondWith(networkFirst(e));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

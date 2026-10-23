/* Service worker: deixa o app funcionando sem internet (obras costumam ter sinal fraco).
 * Ao publicar uma nova versão, troque o número em CACHE. */
const CACHE = 'visitas-obra-v6';
// A página entra só como './' (sem 'index.html'): alguns hosts redirecionam /index.html → /,
// e uma resposta redirecionada não pode ser usada para navegação offline.
const ASSETS = [
  './',
  'css/styles.css',
  'js/config.js',
  'js/db.js',
  'js/photos.js',
  'js/zip.js',
  'js/auth.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (para receber atualizações), com cache de reserva após 3 s ou sem internet.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const cached = (await cache.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await cache.match('./') : undefined);
    if (!cached) return network;
    const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 3000));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});

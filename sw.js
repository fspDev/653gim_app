// Cambiar esta versión invalida todo el caché viejo en el próximo deploy.
const CACHE_NAME = '653gym-v3';
const SCOPE = '/653gim_app/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isHashedAsset(url) {
  // Los bundles y assets de Expo llevan hash en el nombre: si el nombre no
  // cambió, el contenido tampoco. Son seguros de cachear para siempre.
  return url.pathname.includes('/_expo/static/') || url.pathname.includes('/assets/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // El HTML SIEMPRE se pide a la red y nunca se sirve de caché si hay conexión.
  // Si se cachea, el navegador queda pegado a una versión vieja de la app
  // (y con él, a un bundle viejo) aunque ya se haya publicado una nueva.
  if (req.mode === 'navigate' || url.pathname === SCOPE || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match(SCOPE)))
    );
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(SCOPE) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(SCOPE);
    })
  );
});

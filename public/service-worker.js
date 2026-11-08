const VERSION = 'kos-digital-v1.1.0';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/public.js',
  '/js/admin.js',
  '/js/penghuni.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('kos-digital-') && key !== STATIC_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isPrivatePath(pathname) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/penghuni') ||
    pathname === '/login' ||
    pathname === '/logout'
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    if (isPrivatePath(url.pathname)) {
      event.respondWith(
        fetch(request).catch(() => caches.match('/offline.html'))
      );
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.headers.get('X-Kos-Auth')) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('/')) || (await caches.match('/offline.html'));
        })
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json';

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

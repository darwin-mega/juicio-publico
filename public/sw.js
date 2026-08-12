const CACHE_VERSION = 'jp-shell-v2';
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const PAGE_CACHE = `${CACHE_VERSION}:pages`;
const CORE_ASSETS = [
  '/offline.html',
  '/jugar',
  '/img/Juicio-logo.png',
  '/img/Fondo-juicio.png',
];
const OFFLINE_TABLE_ROUTES = new Set([
  '/',
  '/jugar',
  '/setup',
  '/room',
  '/reveal',
  '/operative',
  '/news',
  '/trial',
  '/vote',
  '/resolution',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('jp-shell-') && !key.startsWith(CACHE_VERSION))
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

async function networkFirstPage(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && OFFLINE_TABLE_ROUTES.has(url.pathname)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: url.searchParams.has('_rsc') });
    return cached ?? caches.match('/offline.html');
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request, url));
    return;
  }

  if (url.searchParams.has('_rsc') && OFFLINE_TABLE_ROUTES.has(url.pathname)) {
    event.respondWith(networkFirstPage(request, url));
    return;
  }

  const isStatic = url.pathname.startsWith('/_next/static/')
    || ['style', 'script', 'font', 'image'].includes(request.destination);

  if (isStatic) {
    event.respondWith(cacheFirstStatic(request));
  }
});

const CACHE_NAME = '__CACHE_NAME__';
const APP_BASE = '__APP_BASE__';
const PRECACHE_URLS = __PRECACHE_URLS__;
const APP_SHELL_URL = `${APP_BASE}index.html`;

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function cacheUrl(url) {
  const cache = await caches.open(CACHE_NAME);
  const request = new Request(url, { cache: 'reload' });
  const response = await fetch(request);
  if (!response.ok) throw new Error(`No se pudo cachear ${url}`);
  await cache.put(url, response);
}

async function cachePreload() {
  const optionalUrls = PRECACHE_URLS.filter((url) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url));
  const criticalUrls = PRECACHE_URLS.filter((url) => !optionalUrls.includes(url));
  await Promise.all(criticalUrls.map((url) => cacheUrl(url)));
  await Promise.allSettled(optionalUrls.map((url) => cacheUrl(url)));
}

function offlineShellResponse() {
  return new Response(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jireh sin conexion</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif;background:#f7f8fa;color:#18202a"><main style="max-width:420px;text-align:center"><h1 style="font-size:1.35rem">Jireh sin conexion</h1><p>Abre la app una vez con internet para guardar los archivos necesarios. Luego podras entrar sin conexion.</p></main></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function fetchNavigation(request, preloadResponse) {
  const preloaded = await preloadResponse;
  return preloaded || fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    cachePreload()
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.navigationPreload?.enable?.(),
      caches.keys()
        .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('jireh-pwa-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
        )),
    ]).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === `${APP_BASE}sw.js`) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(APP_SHELL_URL).then((cachedShell) => {
        const networkUpdate = fetchNavigation(request, event.preloadResponse)
          .then((response) => {
            void putInCache(APP_SHELL_URL, response);
            return response;
          });

        if (cachedShell) {
          event.waitUntil(networkUpdate.catch(() => undefined));
          return cachedShell;
        }

        return networkUpdate.catch(() => caches.match(APP_SHELL_URL).then((shell) => shell || offlineShellResponse()));
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        void putInCache(request, response);
        return response;
      }).catch(() => caches.match(request).then((fallback) => fallback || Response.error()));
    }),
  );
});

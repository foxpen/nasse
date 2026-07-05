const CACHE_NAME = 'nase-images-v1';
const IMAGE_PROXY = '/.netlify/functions/image-proxy';

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith(IMAGE_PROXY)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
      cache.put(event.request, response.clone());
    }
    return response;
  })());
});

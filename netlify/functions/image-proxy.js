import { requireAuth } from './_lib/auth.js';
import { createHash } from 'node:crypto';

const ALLOWED = [
  /(^|\.)sdn\.cz$/i,
  /^api\.bezrealitky\.cz$/i,
  /(^|\.)bezrealitky\.cz$/i
];

const CACHE_HEADERS = {
  'cache-control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400'
};

async function imageStore() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('listing-images');
  } catch {
    return null;
  }
}

function cacheKey(url) {
  return createHash('sha256').update(url).digest('hex');
}

function imageResponse(bytes, type, extra = {}) {
  return {
    statusCode: 200,
    headers: {
      'content-type': type || 'image/jpeg',
      ...CACHE_HEADERS,
      ...extra
    },
    isBase64Encoded: true,
    body: Buffer.from(bytes).toString('base64')
  };
}

export async function handler(event) {
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  const raw = event.queryStringParameters?.url || '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED.some(re => re.test(url.hostname))) {
      return { statusCode: 400, body: 'bad image url' };
    }
    if (/sdn\.cz$/i.test(url.hostname) && /\/d_18\/c_img_/i.test(url.pathname) && !url.searchParams.has('fl')) {
      url.search = '?fl=res,1200,1200,1|shr,,20|jpg,80';
    }
    const key = cacheKey(url.href);
    const store = await imageStore();
    if (store) {
      try {
        const cached = await store.get(key, { type: 'arrayBuffer' });
        const meta = await store.getMetadata(key);
        if (cached) return imageResponse(Buffer.from(cached), meta?.contentType || 'image/jpeg', { 'x-nase-image-cache': 'hit' });
      } catch {
        // Blob cache is an optimization. If it is unavailable, keep proxying normally.
      }
    }
    const res = await fetch(url.href, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'cs,en;q=0.9',
        'referer': url.hostname.includes('sdn.cz') ? 'https://www.sreality.cz/' : 'https://www.bezrealitky.cz/'
      }
    });
    if (!res.ok) return { statusCode: res.status, body: 'image unavailable' };
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return { statusCode: 415, body: 'not an image' };
    const bytes = Buffer.from(await res.arrayBuffer());
    if (store) {
      try {
        await store.set(key, bytes, { metadata: { contentType: type, source: url.href } });
      } catch {
        // Ignore cache write failures; the image can still be served.
      }
    }
    return imageResponse(bytes, type, { 'x-nase-image-cache': 'miss' });
  } catch {
    return { statusCode: 400, body: 'bad image url' };
  }
}

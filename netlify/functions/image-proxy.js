import { requireAuth } from './_lib/auth.js';

const ALLOWED = [
  /(^|\.)sdn\.cz$/i,
  /^api\.bezrealitky\.cz$/i,
  /(^|\.)bezrealitky\.cz$/i
];

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
    return {
      statusCode: 200,
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400'
      },
      isBase64Encoded: true,
      body: bytes.toString('base64')
    };
  } catch {
    return { statusCode: 400, body: 'bad image url' };
  }
}

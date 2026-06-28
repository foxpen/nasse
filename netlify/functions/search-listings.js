import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';
import { cleanListing } from './_lib/validate.js';
import { extractUrl } from './extract.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MAPY_KEY = process.env.MAPY_API_KEY;

function slug(value) {
  return String(value || 'praha')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'praha';
}

function buildUrl(q = {}, typeValue = 'byt') {
  const type = typeValue === 'dum' ? 'domy' : 'byty';
  const url = new URL(`https://www.sreality.cz/hledani/prodej/${type}/${slug(q.locality)}`);
  if (q.priceFrom) url.searchParams.set('cena-od', q.priceFrom);
  if (q.priceTo) url.searchParams.set('cena-do', q.priceTo);
  if (q.areaFrom) url.searchParams.set('plocha-od', q.areaFrom);
  if (q.areaTo) url.searchParams.set('plocha-do', q.areaTo);
  if (q.disp) url.searchParams.set('velikost', q.disp);
  return url.href;
}

async function mapyGeocode(q) {
  if (!MAPY_KEY || !q) return null;
  const r = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=1&apikey=${MAPY_KEY}&query=${encodeURIComponent(q)}`);
  const j = await r.json();
  const it = j.items?.[0] || j.results?.[0] || (Array.isArray(j) ? j[0] : null);
  return it?.position || (it && it.lon != null ? { lon: it.lon, lat: it.lat } : null);
}

async function commute(origin, dest) {
  if (!MAPY_KEY || !origin || !dest) return {};
  const start = await mapyGeocode(origin);
  const end = await mapyGeocode(dest);
  if (!start || !end) return {};
  const r = await fetch(`https://api.mapy.com/v1/routing/route?apikey=${MAPY_KEY}&lang=cs&routeType=car_fast&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`);
  const j = await r.json();
  const durSec = j.duration ?? j.time ?? null;
  const car = durSec != null ? Math.round(durSec / 60) : 0;
  return { car, pt: car ? Math.max(car + 15, Math.round(car * 1.65)) : 0, lon: start.lon, lat: start.lat, commuteDest: dest };
}

function detailLinks(html, limit) {
  const links = [];
  const seen = new Set();
  for (const m of String(html || '').matchAll(/(?:https?:\\?\/\\?\/www\.sreality\.cz)?\\?\/detail\\?\/prodej\\?\/[^"' <]+/g)) {
    let href = m[0].replace(/\\\//g, '/');
    if (href.startsWith('/')) href = 'https://www.sreality.cz' + href;
    if (!seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
    if (links.length >= limit) break;
  }
  return links;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  try {
    const q = JSON.parse(event.body || '{}');
    const limit = Math.max(1, Math.min(12, Number(q.limit) || 8));
    const types = Array.isArray(q.types) && q.types.length ? q.types.filter(t => ['byt', 'dum'].includes(t)) : [q.type === 'dum' ? 'dum' : 'byt'];
    const perType = Math.max(1, Math.ceil(limit / Math.max(1, types.length)));
    const links = [];
    const searchUrls = [];
    for (const type of types) {
      const searchUrl = buildUrl(q, type);
      searchUrls.push(searchUrl);
      const res = await fetch(searchUrl, { headers: { 'user-agent': UA, accept: 'text/html' } });
      if (!res.ok) continue;
      const html = await res.text();
      links.push(...detailLinks(html, perType));
    }
    const limitedLinks = [...new Set(links)].slice(0, limit);
    const existingRows = await sql`SELECT data FROM listings WHERE section = 'byd'`;
    const existing = new Set(existingRows.map(r => r.data?.url).filter(Boolean));
    const added = [];
    const errors = [];

    for (const url of limitedLinks) {
      if (existing.has(url)) continue;
      try {
        const extracted = await extractUrl(url);
        const commutePatch = q.commuteDest ? await commute(extracted.data?.origin || extracted.data?.n, q.commuteDest) : {};
        const data = { ...(extracted.data || {}), ...commutePatch, status: 'candidate', sourceSearch: searchUrls.join('\n') };
        const clean = cleanListing('byd', data);
        if (!clean) throw new Error('neplatná data');
        const rows = await sql`INSERT INTO listings (section, data) VALUES ('byd', ${clean}) RETURNING id`;
        existing.add(url);
        added.push({ id: rows[0].id, n: clean.n, url });
      } catch (e) {
        errors.push({ url, message: String(e?.message || e) });
      }
    }

    return json(200, { searchUrl: searchUrls[0] || '', searchUrls, found: limitedLinks.length, added, skipped: limitedLinks.length - added.length - errors.length, errors });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

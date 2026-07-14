import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';
import { cleanListing } from './_lib/validate.js';
import { extractUrl } from './extract.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MAPY_KEY = process.env.MAPY_API_KEY;
// Netlify synchronní funkce má limit 10 s — extrakce se musí vejít do rozpočtu
const TIME_BUDGET_MS = 8500;

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
  const disp = wantedDispositions(q.disp);
  if (disp.length === 1) url.searchParams.set('velikost', disp[0]);
  return url.href;
}

const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const norm = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

function wantedDispositions(value) {
  return norm(value)
    .split(/[,\s;]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function allowedByUrl(url, type, q = {}) {
  const u = norm(url);
  if (type === 'byt') return /\/detail\/prodej\/byt\//.test(u);
  if (type !== 'dum') return true;
  if (q.excludeRecreation !== false && /\/(chata|chalupa|rekreacni-objekt)\//.test(u)) return false;
  if (q.houseKind === 'all') return /\/detail\/prodej\//.test(u);
  if (q.houseKind === 'family-villa') return /\/detail\/prodej\/dum\/(rodinny|vila|radovy|dvojdum)/.test(u);
  return /\/detail\/prodej\/dum\/(rodinny|radovy|dvojdum)/.test(u);
}

function energyRank(value) {
  const letter = String(value || '').trim().toUpperCase()[0];
  return 'ABCDEFG'.indexOf(letter);
}

function matchesFilters(data = {}, q = {}) {
  if (!data || !data.n) return { ok: false, reason: 'bez dat' };
  if (q.photosOnly && !(data.img || (Array.isArray(data.imgs) && data.imgs.length))) return { ok: false, reason: 'bez fotek' };
  if (q.priceFrom && num(data.price) < num(q.priceFrom)) return { ok: false, reason: 'cena pod limitem' };
  if (q.priceTo && num(data.price) > num(q.priceTo)) return { ok: false, reason: 'cena nad limitem' };
  if (q.areaFrom && num(data.area) < num(q.areaFrom)) return { ok: false, reason: 'mala plocha' };
  if (q.areaTo && num(data.area) > num(q.areaTo)) return { ok: false, reason: 'velka plocha' };
  if (q.plotFrom && num(data.plotArea) < num(q.plotFrom)) return { ok: false, reason: 'maly pozemek' };
  if (q.gardenFrom && num(data.gardenArea) < num(q.gardenFrom)) return { ok: false, reason: 'mala zahrada' };
  if (q.carTo && num(data.car) && num(data.car) > num(q.carTo)) return { ok: false, reason: 'dojezd nad limitem' };
  if (q.ready === 'ready' && !data.ready) return { ok: false, reason: 'neni k nastehovani' };
  if (q.ready === 'build' && data.ready) return { ok: false, reason: 'neni ve vystavbe' };
  if (q.energyMax) {
    const actual = energyRank(data.en);
    const max = energyRank(q.energyMax);
    if (actual >= 0 && max >= 0 && actual > max) return { ok: false, reason: 'PENB mimo limit' };
  }
  const disp = wantedDispositions(q.disp);
  if (disp.length && !disp.some(d => norm(data.disp).includes(d))) return { ok: false, reason: 'dispozice nesedi' };
  const f = q.features && typeof q.features === 'object' ? q.features : {};
  for (const key of ['terrace', 'balcony', 'garage', 'parking']) {
    if (f[key] && !data[key]) return { ok: false, reason: `chybi ${key}` };
  }
  return { ok: true };
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

  const startedAt = Date.now();
  try {
    const q = JSON.parse(event.body || '{}');
    const limit = Math.max(1, Math.min(24, Number(q.limit) || 12));
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
      links.push(...detailLinks(html, perType * 3).filter(url => allowedByUrl(url, type, q)));
    }
    const limitedLinks = [...new Set(links)].slice(0, limit * 2);
    const existingRows = await sql`SELECT data FROM listings WHERE section = 'byd'`;
    const existing = new Set(existingRows.map(r => r.data?.url).filter(Boolean));
    const candidates = [];
    const errors = [];
    const filtered = [];
    let timedOut = false;

    for (const url of limitedLinks) {
      if (candidates.length >= limit) break;
      if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      if (existing.has(url)) continue;
      try {
        const extracted = await extractUrl(url);
        const commutePatch = q.commuteDest ? await commute(extracted.data?.origin || extracted.data?.n, q.commuteDest) : {};
        const data = { ...(extracted.data || {}), ...commutePatch, status: 'candidate', sourceSearch: searchUrls.join('\n') };
        const verdict = matchesFilters(data, q);
        if (!verdict.ok) {
          filtered.push({ url, reason: verdict.reason });
          continue;
        }
        const clean = cleanListing('byd', data);
        if (!clean) throw new Error('neplatná data');
        candidates.push(clean);
      } catch (e) {
        errors.push({ url, message: String(e?.message || e) });
      }
    }

    return json(200, { searchUrl: searchUrls[0] || '', searchUrls, found: limitedLinks.length, candidates, skipped: limitedLinks.length - candidates.length - errors.length - filtered.length, filtered, errors, timedOut });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';
import { cleanListing } from './_lib/validate.js';
import { extractUrl } from './extract.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
// Netlify synchronní funkce má limit 10 s — extrakce se musí vejít do rozpočtu
const TIME_BUDGET_MS = 8500;

function slug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const norm = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

// mapování na seo hodnoty sauto.cz; extraktor pak normalizuje na benzin/diesel/hybrid/elektro
const FUEL_PARAM = { benzin: 'benzin', diesel: 'nafta', hybrid: 'hybridni', elektro: 'elektro', lpg: 'lpg-benzin', cng: 'cng-benzin' };

function buildUrl(q = {}) {
  const parts = ['https://www.sauto.cz/inzerce/osobni'];
  const brand = slug(q.brand);
  const model = slug(q.model);
  if (brand) parts.push(brand);
  if (brand && model) parts.push(model);
  const url = new URL(parts.join('/'));
  if (q.priceFrom) url.searchParams.set('cena-od', num(q.priceFrom));
  if (q.priceTo) url.searchParams.set('cena-do', num(q.priceTo));
  if (q.yearFrom) url.searchParams.set('vyrobeno-od', num(q.yearFrom));
  if (q.kmTo) url.searchParams.set('tachometr-do', num(q.kmTo));
  if (FUEL_PARAM[norm(q.fuel)]) url.searchParams.set('palivo', FUEL_PARAM[norm(q.fuel)]);
  return url.href;
}

function detailLinks(html, limit) {
  const links = [];
  const seen = new Set();
  for (const m of String(html || '').matchAll(/(?:https?:\\?\/\\?\/www\.sauto\.cz)?\\?\/osobni\\?\/detail\\?\/[a-z0-9-]+\\?\/[a-z0-9-]+\\?\/\d+/gi)) {
    let href = m[0].replace(/\\\//g, '/');
    if (href.startsWith('/')) href = 'https://www.sauto.cz' + href;
    if (!seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
    if (links.length >= limit) break;
  }
  return links;
}

function matchesFilters(data = {}, q = {}) {
  if (!data || !data.n) return { ok: false, reason: 'bez dat' };
  const priceCzk = num(data.czk) || Math.round(num(data.price) * 24.5);
  if (q.photosOnly !== false && !(data.img || (Array.isArray(data.imgs) && data.imgs.length))) return { ok: false, reason: 'bez fotek' };
  if (q.priceFrom && priceCzk && priceCzk < num(q.priceFrom)) return { ok: false, reason: 'cena pod limitem' };
  if (q.priceTo && priceCzk && priceCzk > num(q.priceTo)) return { ok: false, reason: 'cena nad limitem' };
  if (q.yearFrom && num(data.year) && num(data.year) < num(q.yearFrom)) return { ok: false, reason: 'starší ročník' };
  if (q.kmTo && num(data.km) && num(data.km) > num(q.kmTo)) return { ok: false, reason: 'najeto nad limitem' };
  if (q.psFrom && num(data.ps) && num(data.ps) < num(q.psFrom)) return { ok: false, reason: 'slabý výkon' };
  if (q.fuel && norm(data.fuel) && norm(data.fuel) !== norm(q.fuel)) return { ok: false, reason: 'jiné palivo' };
  if (q.awd && !data.awd) return { ok: false, reason: 'není 4×4' };
  const brand = norm(q.brand);
  if (brand && !norm(data.brand + ' ' + data.n).includes(brand)) return { ok: false, reason: 'jiná značka' };
  return { ok: true };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const startedAt = Date.now();
  try {
    const q = JSON.parse(event.body || '{}');
    const dryRun = Boolean(q.dryRun);
    const limit = Math.max(1, Math.min(10, Number(q.limit) || 6));
    const searchUrl = buildUrl(q);
    const res = await fetch(searchUrl, { headers: { 'user-agent': UA, accept: 'text/html' } });
    if (!res.ok) return json(502, { error: `sauto.cz nedostupné (${res.status})`, searchUrl });
    const html = await res.text();
    const links = detailLinks(html, limit * 4);
    const existingRows = dryRun ? [] : await sql`SELECT data FROM listings WHERE section = 'auto'`;
    const existing = new Set(existingRows.map(r => r.data?.url).filter(Boolean));
    const added = [];
    const errors = [];
    const filtered = [];
    let timedOut = false;

    for (const url of links) {
      if (added.length >= limit) break;
      if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      if (existing.has(url)) continue;
      try {
        const extracted = await extractUrl(url);
        const data = { ...(extracted.data || {}), sourceSearch: searchUrl };
        const verdict = matchesFilters(data, q);
        if (!verdict.ok) {
          filtered.push({ url, n: data.n || '', reason: verdict.reason });
          continue;
        }
        const clean = cleanListing('auto', data);
        if (!clean) throw new Error('neplatná data');
        let id = null;
        if (!dryRun) {
          const rows = await sql`INSERT INTO listings (section, data) VALUES ('auto', ${clean}) RETURNING id`;
          id = rows[0].id;
          existing.add(url);
        }
        added.push({ id, n: clean.n, url });
      } catch (e) {
        errors.push({ url, message: String(e?.message || e) });
      }
    }

    return json(200, { dryRun, searchUrl, found: links.length, added, filtered, errors, timedOut });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

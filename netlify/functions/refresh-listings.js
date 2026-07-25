import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';
import { cleanListing } from './_lib/validate.js';
import { extractUrl } from './extract.js';

const KEEP = new Set(['flags', 'dealPrice', 'note', 'status', 'car', 'pt', 'commuteDest', 'lat', 'lon', 'history']);
const WATCH = ['n', 'disp', 'price', 'area', 'land', 'plotArea', 'gardenArea', 'terrace', 'balcony', 'garage', 'parking', 'ready', 'when', 'en', 'origin', 'img', 'imgs', 'feats', 'listedAt', 'updatedAt', 'url',
  'brand', 'variant', 'stav', 'made', 'year', 'km', 'fuel', 'body', 'awd', 'kw', 'ps', 'czk'];

function diff(before, after) {
  return WATCH
    .filter(key => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .map(key => ({ key, from: before[key] ?? null, to: after[key] ?? null }));
}

function mergeData(section, before, fresh) {
  const preserved = {};
  for (const key of KEEP) if (key in before) preserved[key] = before[key];
  const merged = { ...before, ...fresh, ...preserved };
  return cleanListing(section, merged) || merged;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const section = body.section || 'byd';
    const dryRun = Boolean(body.dryRun);
    const rows = await sql`SELECT id, section, data FROM listings WHERE section = ${section} ORDER BY id`;
    const out = [];
    let updated = 0, unchanged = 0, errors = 0, notFound = 0;
    for (const row of rows) {
      const before = row.data || {};
      if (!before.url) { unchanged++; out.push({ id: row.id, n: before.n, status: 'skipped', message: 'bez odkazu', url: before.url || '' }); continue; }
      try {
        const extracted = await extractUrl(before.url);
        const fresh = extracted.data || {};
        const merged = mergeData(row.section, before, fresh);
        const changes = diff(before, merged);
        if (!changes.length) {
          unchanged++;
          out.push({ id: row.id, n: before.n, status: 'unchanged', url: before.url });
          continue;
        }
        merged.history = [{ at: new Date().toISOString(), type: 'refresh', changes }, ...(Array.isArray(before.history) ? before.history : [])].slice(0, 30);
        if (!dryRun) await sql`UPDATE listings SET data = ${merged} WHERE id = ${row.id}`;
        updated++;
        out.push({ id: row.id, n: merged.n || before.n, status: dryRun ? 'would_update' : 'updated', changes: changes.length, url: before.url });
      } catch (e) {
        const code = Number(e.status || 0);
        if (code === 404 || code === 410) notFound++; else errors++;
        out.push({ id: row.id, n: before.n, status: code === 404 || code === 410 ? 'not_found' : 'error', message: String(e?.message || e), url: before.url, removable: code === 404 || code === 410 });
      }
    }
    return json(200, { ok: true, dryRun, summary: { total: rows.length, updated, unchanged, errors, notFound }, items: out });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';
import { cleanPatch } from './_lib/validate.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const id = Number(body.id);
    const patch = body.patch;
    if (!id || !patch || typeof patch !== 'object') return json(400, { error: 'missing id/patch' });
    const clean = cleanPatch(patch);
    const rows = await sql`SELECT data FROM listings WHERE id = ${id}`;
    if (!rows[0]) return json(404, { error: 'not found' });
    const before = rows[0].data || {};
    const changes = Object.entries(clean)
      .filter(([key, value]) => JSON.stringify(before[key] ?? null) !== JSON.stringify(value ?? null))
      .map(([key, value]) => ({ key, from: before[key] ?? null, to: value ?? null }));
    const history = changes.length
      ? [{ at: new Date().toISOString(), type: 'manual', changes }, ...(Array.isArray(before.history) ? before.history : [])].slice(0, 30)
      : (Array.isArray(before.history) ? before.history : []);
    const data = { ...before, ...clean, history };
    await sql`UPDATE listings SET data = ${data} WHERE id = ${id}`;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

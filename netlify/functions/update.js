import { sql } from './_lib/db.js';
import { json, preflight } from './_lib/http.js';

const ALLOWED = ['flags', 'dealPrice', 'note', 'car', 'pt', 'en', 'when'];

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const id = Number(body.id);
    const patch = body.patch;
    if (!id || !patch || typeof patch !== 'object') return json(400, { error: 'missing id/patch' });
    const clean = {};
    for (const k of ALLOWED) if (k in patch) clean[k] = patch[k];
    const rows = await sql`SELECT data FROM listings WHERE id = ${id}`;
    if (!rows[0]) return json(404, { error: 'not found' });
    const data = { ...rows[0].data, ...clean };
    await sql`UPDATE listings SET data = ${data} WHERE id = ${id}`;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

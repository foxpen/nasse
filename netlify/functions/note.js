import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const id = Number(body.id);
    const note = String(body.note ?? '');
    if (!id) return json(400, { error: 'missing id' });
    const rows = await sql`SELECT data FROM listings WHERE id = ${id}`;
    if (!rows[0]) return json(404, { error: 'not found' });
    const data = { ...rows[0].data, note };
    await sql`UPDATE listings SET data = ${data} WHERE id = ${id}`;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

import { sql } from './_lib/db.js';
import { json, preflight } from './_lib/http.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  try {
    const id = Number(event.queryStringParameters?.id || JSON.parse(event.body || '{}').id);
    if (!id) return json(400, { error: 'missing id' });
    await sql`DELETE FROM listings WHERE id = ${id}`;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

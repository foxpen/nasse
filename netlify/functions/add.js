import { sql } from './_lib/db.js';
import { json, preflight } from './_lib/http.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const section = body.section;
    const data = body.data;
    if (!['byd', 'auto'].includes(section)) return json(400, { error: 'bad section' });
    if (!data || typeof data !== 'object') return json(400, { error: 'missing data' });
    const rows = await sql`INSERT INTO listings (section, data) VALUES (${section}, ${data}) RETURNING id`;
    return json(200, { id: rows[0].id });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

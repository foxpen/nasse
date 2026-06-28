import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';
import { cleanListing } from './_lib/validate.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const section = body.section;
    const data = body.data;
    if (!['byd', 'auto'].includes(section)) return json(400, { error: 'bad section' });
    const clean = cleanListing(section, data);
    if (!clean) return json(400, { error: 'invalid data' });
    const rows = await sql`INSERT INTO listings (section, data) VALUES (${section}, ${clean}) RETURNING id`;
    return json(200, { id: rows[0].id });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

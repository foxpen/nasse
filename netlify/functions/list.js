import { sql } from './_lib/db.js';
import { json } from './_lib/http.js';

export async function handler(event) {
  try {
    const section = event.queryStringParameters?.section;
    const rows = section
      ? await sql`SELECT id, data FROM listings WHERE section = ${section} ORDER BY id`
      : await sql`SELECT id, section, data FROM listings ORDER BY id`;
    return json(200, rows.map(r => ({ id: r.id, ...(r.section ? { section: r.section } : {}), ...r.data })));
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

import { sql } from './_lib/db.js';
import { json } from './_lib/http.js';

// Žádná demo data — seed jen připraví prázdnou tabulku.
// Inzeráty se přidávají v appce (Přidat / extraktor), data žijí jen v DB.
const PROPS = [];
const CARS = [];

export async function handler(event) {
  try {
    const force = event.queryStringParameters?.force === '1';
    // vytvoří tabulku, pokud ještě není (nemusíš spouštět schema.sql ručně)
    await sql`CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      section TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_section ON listings(section)`;

    const existing = await sql`SELECT COUNT(*)::int AS c FROM listings`;
    if (existing[0].c > 0 && !force) {
      return json(200, { ok: true, skipped: true, message: 'DB už obsahuje data' });
    }
    for (const p of PROPS) await sql`INSERT INTO listings (section, data) VALUES ('byd', ${p})`;
    for (const c of CARS) await sql`INSERT INTO listings (section, data) VALUES ('auto', ${c})`;
    return json(200, { ok: true, message: 'tabulka připravena', inserted: { byd: PROPS.length, auto: CARS.length } });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

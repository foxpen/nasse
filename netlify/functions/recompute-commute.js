import { sql } from './_lib/db.js';
import { json } from './_lib/http.js';
import { geocode, route, resolveDest, via } from './_lib/route.js';

// Přepočítá dojezd autem u všech nemovitostí v DB.
// Cíl lze přepsat přes ?dlat=&dlon= nebo ?dq=<adresa>, jinak Arkády Pankrác (viz _lib/route.js).
// Bez MAPY_API_KEY jede přes veřejné OSM služby.
export async function handler(event) {
  const p = event?.queryStringParameters || {};
  try {
    const dest = await resolveDest(p);
    const rows = await sql`SELECT id, data FROM listings WHERE section = 'byd' ORDER BY id`;
    const out = [];
    for (const r of rows) {
      const d = r.data || {};
      let res = null;
      try {
        // u nálezů z hledání známe souřadnice, jinak se adresa dohledá
        const from = (d.lat != null && d.lon != null) ? { lat: d.lat, lon: d.lon } : await geocode(d.origin || d.n);
        res = from ? await route(from, dest) : null;
      } catch (e) { res = null; }
      if (res && res.car) {
        const nd = { ...d, car: res.car, km_car: res.km };
        await sql`UPDATE listings SET data = ${nd} WHERE id = ${r.id}`;
        out.push({ id: r.id, n: d.n, car: res.car, km: res.km });
      } else {
        out.push({ id: r.id, n: d.n, car: d.car, note: 'nenalezeno – ponechán odhad' });
      }
    }
    return json(200, { ok: true, via: via(), dest, updated: out });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

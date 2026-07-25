import { json, preflight } from './_lib/http.js';
import { geocode, route, resolveDest, pool, via } from './_lib/route.js';

// Dávkový dojezd pro výsledky hledání.
// POST { dest:{lat,lon} | dq:"adresa", points:[{ k, lat, lon } | { k, q }] }
// Vrací { via, results:[{ k, car, km }] } — položky, které se nepodařilo spočítat, mají car:null.
// Kvůli limitu serverless funkce bere maximálně MAX bodů na jedno volání; klient si to nakrájí.
const MAX = 24;
const PARALEL = 6;

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = JSON.parse(event.body || '{}');
    const points = Array.isArray(body.points) ? body.points.slice(0, MAX) : [];
    if (!points.length) return json(400, { error: 'missing points' });

    const dest = await resolveDest({
      dlat: body.dest?.lat, dlon: body.dest?.lon, dq: body.dq
    });

    const out = await pool(points, PARALEL, async (pt) => {
      let from = Number.isFinite(pt.lat) && Number.isFinite(pt.lon) ? { lat: pt.lat, lon: pt.lon } : null;
      if (!from && pt.q) from = await geocode(pt.q);
      if (!from) return { k: pt.k, car: null, km: null };
      const r = await route(from, dest);
      return { k: pt.k, car: r?.car ?? null, km: r?.km ?? null, lat: from.lat, lon: from.lon };
    });

    return json(200, { via: via(), dest, results: out.map((r, i) => r || { k: points[i].k, car: null, km: null }) });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

import { sql } from './_lib/db.js';
import { json } from './_lib/http.js';

const KEY = process.env.MAPY_API_KEY;
const DEST = { lon: 14.4430, lat: 50.0598 }; // Arkády Pankrác, Praha 4

async function carCommute(q) {
  const gr = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=1&apikey=${KEY}&query=${encodeURIComponent(q)}`);
  const gj = await gr.json();
  const pos = gj.items?.[0]?.position;
  if (!pos) return null;
  const rr = await fetch(`https://api.mapy.com/v1/routing/route?apikey=${KEY}&lang=cs&routeType=car_fast&start=${pos.lon},${pos.lat}&end=${DEST.lon},${DEST.lat}`);
  const rj = await rr.json();
  const dur = rj.duration ?? rj.time ?? null;
  const len = rj.length ?? rj.distance ?? null;
  return { car: dur != null ? Math.round(dur / 60) : null, km: len != null ? Math.round(len / 1000) : null };
}

export async function handler() {
  if (!KEY) return json(200, { error: 'no_key' });
  try {
    const rows = await sql`SELECT id, data FROM listings WHERE section = 'byd' ORDER BY id`;
    const out = [];
    for (const r of rows) {
      const d = r.data || {};
      const q = d.origin || d.n;
      let res = null;
      try { res = await carCommute(q); } catch (e) { res = null; }
      if (res && res.car) {
        const nd = { ...d, car: res.car, km_car: res.km };
        await sql`UPDATE listings SET data = ${nd} WHERE id = ${r.id}`;
        out.push({ id: r.id, n: d.n, car: res.car, km: res.km });
      } else {
        out.push({ id: r.id, n: d.n, car: d.car, note: 'nenalezeno – ponechán odhad' });
      }
    }
    return json(200, { ok: true, updated: out });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

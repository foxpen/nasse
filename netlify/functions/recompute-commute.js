import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json } from './_lib/http.js';

const KEY = process.env.MAPY_API_KEY;
const DEFAULT_DEST = 'Jankovcova 1522/53, Praha 7';
const DEFAULT_DEST_POS = { lon: 14.4529, lat: 50.1090 };

async function geocode(query) {
  if (!KEY || !query) return null;
  const res = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=1&apikey=${KEY}&query=${encodeURIComponent(query)}`);
  const data = await res.json();
  const item = data.items?.[0] || data.results?.[0] || (Array.isArray(data) ? data[0] : null);
  return item?.position || (item && item.lon != null ? { lon: item.lon, lat: item.lat } : null);
}

async function carCommute(origin, dest) {
  const start = await geocode(origin);
  const end = dest === DEFAULT_DEST ? DEFAULT_DEST_POS : await geocode(dest);
  if (!start || !end) return null;
  const res = await fetch(`https://api.mapy.com/v1/routing/route?apikey=${KEY}&lang=cs&routeType=car_fast&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`);
  const data = await res.json();
  const dur = data.duration ?? data.time ?? null;
  const len = data.length ?? data.distance ?? null;
  const car = dur != null ? Math.round(dur / 60) : null;
  return {
    car,
    pt: car ? Math.max(car + 15, Math.round(car * 1.65)) : null,
    km: len != null ? Math.round(len / 1000) : null,
    lon: start.lon,
    lat: start.lat
  };
}

export async function handler(event) {
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (!KEY) return json(200, { error: 'no_key' });
  try {
    const dest = event.queryStringParameters?.dest || DEFAULT_DEST;
    const rows = await sql`SELECT id, data FROM listings WHERE section = 'byd' ORDER BY id`;
    const updated = [];

    for (const row of rows) {
      const data = row.data || {};
      const origin = data.origin || data.n;
      let result = null;
      try {
        result = await carCommute(origin, dest);
      } catch {
        result = null;
      }

      if (result?.car) {
        const next = {
          ...data,
          car: result.car,
          pt: result.pt || data.pt || 0,
          km_car: result.km,
          lat: result.lat,
          lon: result.lon,
          commuteDest: dest
        };
        await sql`UPDATE listings SET data = ${next} WHERE id = ${row.id}`;
        updated.push({ id: row.id, n: data.n, car: next.car, pt: next.pt, km: result.km });
      } else {
        updated.push({ id: row.id, n: data.n, car: data.car || 0, pt: data.pt || 0, note: 'nenalezeno - ponechan odhad' });
      }
    }

    return json(200, { ok: true, updated });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

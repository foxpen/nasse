import { json } from './_lib/http.js';

const KEY = process.env.MAPY_API_KEY;
// Arkády Pankrác, Praha 4 (lon, lat)
const DEST = { lon: 14.4430, lat: 50.0598 };

export async function handler(event) {
  if (!KEY) return json(200, { error: 'no_key', message: 'MAPY_API_KEY není nastavený v Netlify' });
  const q = event.queryStringParameters?.q;
  if (!q) return json(400, { error: 'missing q' });
  try {
    const gr = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=1&apikey=${KEY}&query=${encodeURIComponent(q)}`);
    const gj = await gr.json();
    const pos = gj.items?.[0]?.position;
    if (!pos) return json(200, { error: 'not_found', message: 'adresa nenalezena: ' + q });

    const rr = await fetch(`https://api.mapy.com/v1/routing/route?apikey=${KEY}&lang=cs&routeType=car_fast&start=${pos.lon},${pos.lat}&end=${DEST.lon},${DEST.lat}`);
    const rj = await rr.json();
    const durSec = rj.duration ?? rj.time ?? null;
    const lenM = rj.length ?? rj.distance ?? null;
    return json(200, {
      car: durSec != null ? Math.round(durSec / 60) : null,
      km: lenM != null ? Math.round(lenM / 1000) : null,
      lon: pos.lon, lat: pos.lat
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';

const KEY = process.env.MAPY_API_KEY;

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  const q = String(event.queryStringParameters?.q || '').trim();
  if (!q || q.length < 3) return json(200, { items: [] });
  if (!KEY) return json(200, { items: [] });
  try {
    const res = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=6&apikey=${KEY}&query=${encodeURIComponent(q)}`);
    if (!res.ok) return json(200, { items: [] });
    const data = await res.json();
    const raw = data.items || data.results || [];
    const items = raw.map(item => {
      const label = item.name || item.label || item.title || item.address || '';
      const locality = item.location || item.regionalStructure?.map(x => x.name).filter(Boolean).join(', ') || '';
      const value = [label, locality].filter(Boolean).join(', ');
      return {
        value,
        label: value,
        lon: item.position?.lon ?? item.lon,
        lat: item.position?.lat ?? item.lat
      };
    }).filter(x => x.value);
    return json(200, { items });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

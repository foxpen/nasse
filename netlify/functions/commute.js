import { requireAuth } from './_lib/auth.js';
import { json } from './_lib/http.js';

const MAPY_KEY = process.env.MAPY_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DEFAULT_DEST = 'Jankovcova 1522/53, Praha 7';
const DEFAULT_DEST_POS = { lon: 14.4529, lat: 50.1090 };

async function googleRoute(origin, destination, mode) {
  if (!GOOGLE_KEY) return null;
  const travelMode = mode === 'transit' ? 'TRANSIT' : 'DRIVE';
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GOOGLE_KEY,
      'x-goog-fieldmask': 'routes.duration,routes.distanceMeters'
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode,
      computeAlternativeRoutes: false,
      languageCode: 'cs-CZ',
      units: 'METRIC'
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    minutes: route.duration ? Math.round(Number(String(route.duration).replace('s', '')) / 60) : null,
    km: route.distanceMeters != null ? Math.round(route.distanceMeters / 1000) : null,
    source: 'google'
  };
}

async function mapyGeocode(q) {
  const gr = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=1&apikey=${MAPY_KEY}&query=${encodeURIComponent(q)}`);
  const gj = await gr.json();
  const it = gj.items?.[0] || gj.results?.[0] || (Array.isArray(gj) ? gj[0] : null);
  return it?.position || (it && it.lon != null ? { lon: it.lon, lat: it.lat } : null);
}

async function mapyCar(origin, destination) {
  if (!MAPY_KEY) return null;
  const start = await mapyGeocode(origin);
  const end = destination === DEFAULT_DEST ? DEFAULT_DEST_POS : await mapyGeocode(destination);
  if (!start || !end) return null;
  const rr = await fetch(`https://api.mapy.com/v1/routing/route?apikey=${MAPY_KEY}&lang=cs&routeType=car_fast&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`);
  const rj = await rr.json();
  const durSec = rj.duration ?? rj.time ?? null;
  const lenM = rj.length ?? rj.distance ?? null;
  return {
    minutes: durSec != null ? Math.round(durSec / 60) : null,
    km: lenM != null ? Math.round(lenM / 1000) : null,
    lon: start.lon,
    lat: start.lat,
    source: 'mapy'
  };
}

export async function handler(event) {
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  const q = event.queryStringParameters?.q;
  const dest = event.queryStringParameters?.dest || DEFAULT_DEST;
  if (!q) return json(400, { error: 'missing q' });
  try {
    const [carGoogle, transitGoogle] = await Promise.all([
      googleRoute(q, dest, 'drive'),
      googleRoute(q, dest, 'transit')
    ]);
    const carFallback = carGoogle ? null : await mapyCar(q, dest);
    const car = carGoogle || carFallback;
    if (!car && !transitGoogle) {
      return json(200, { error: 'no_key', message: 'Pro automatický výpočet nastav GOOGLE_MAPS_API_KEY, případně MAPY_API_KEY pro auto.' });
    }
    const transitEstimate = transitGoogle?.minutes ?? (car?.minutes ? Math.max(car.minutes + 15, Math.round(car.minutes * 1.65)) : null);
    return json(200, {
      car: car?.minutes ?? null,
      pt: transitEstimate,
      km: car?.km ?? null,
      dest,
      source: { car: car?.source || null, pt: transitGoogle?.source || (transitEstimate ? 'estimate' : null) },
      lon: car?.lon, lat: car?.lat
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

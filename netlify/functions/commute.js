import { json } from './_lib/http.js';
import { geocode, route, resolveDest, via } from './_lib/route.js';

// Dojezd autem na cíl. Přijímá buď adresu (?q=...), nebo přímo souřadnice (?lat=&lon=).
// Cíl lze přepsat přes ?dlat=&dlon= nebo ?dq=<adresa>; jinak Arkády Pankrác.
// Bez MAPY_API_KEY jede přes veřejné OSM služby (viz _lib/route.js).
export async function handler(event) {
  const p = event.queryStringParameters || {};
  try {
    // ?geocode=<adresa> jen dohledá souřadnice (používá hledání pro cíl dojezdu)
    if (p.geocode) {
      const g = await geocode(p.geocode);
      if (!g) return json(200, { error: 'not_found', message: 'adresa nenalezena: ' + p.geocode });
      return json(200, { lat: g.lat, lon: g.lon, via: via() });
    }
    const lat = parseFloat(p.lat), lon = parseFloat(p.lon);
    let from = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
    if (!from) {
      if (!p.q) return json(400, { error: 'missing q' });
      from = await geocode(p.q);
      if (!from) return json(200, { error: 'not_found', message: 'adresa nenalezena: ' + p.q });
    }
    const dest = await resolveDest(p);
    if (p.debug) return json(200, { from, dest, via: via() });

    const r = await route(from, dest);
    if (!r) return json(200, { error: 'no_route', message: 'trasu se nepodařilo spočítat', lon: from.lon, lat: from.lat });
    return json(200, { car: r.car, km: r.km, lon: from.lon, lat: from.lat, via: via() });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

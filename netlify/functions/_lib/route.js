// Geokódování a výpočet dojezdu autem.
// S klíčem MAPY_API_KEY jede přes api.mapy.com, bez klíče přes veřejné OSM služby
// (Photon pro adresy, OSRM pro trasy) — bez záruky, ale funkční zdarma.
// Pozn.: Nominatim tu záměrně není, jeho pravidla dávkové geokódování nedovolují.

const KEY = process.env.MAPY_API_KEY;
const UA = 'nase-bydlenicko/1.0 (soukromy rodinny prehled)';
// Česko, aby se „Kolín" netrefil do Německa
const CZ_BBOX = '12.09,48.55,18.87,51.06';

// výchozí cíl: Arkády Pankrác, Praha 4
export const DEST = { lon: 14.4430, lat: 50.0598 };
export const via = () => (KEY ? 'mapy' : 'osm');

export async function geocode(q) {
  if (!q) return null;
  if (KEY) {
    const r = await fetch(`https://api.mapy.com/v1/geocode?lang=cs&limit=1&apikey=${KEY}&query=${encodeURIComponent(q)}`);
    const j = await r.json();
    const it = j.items?.[0] || j.results?.[0] || (Array.isArray(j) ? j[0] : null);
    const pos = it?.position || (it && it.lon != null ? { lon: it.lon, lat: it.lat } : null);
    return pos ? { lon: pos.lon, lat: pos.lat } : null;
  }
  // „Praha - východ 250 73" je okres, ne adresa; Photonu stačí zbytek
  const clean = String(q).replace(/\s*-\s*(východ|západ|sever|jih)\b/gi, '').trim();
  const r = await fetch(`https://photon.komoot.io/api/?limit=1&bbox=${CZ_BBOX}&q=` + encodeURIComponent(clean),
    { headers: { 'user-agent': UA } });
  if (!r.ok) return null;
  const f = (await r.json()).features?.[0];
  if (!f) return null;
  return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
}

// Trasa autem z bodu do cíle. Vrací minuty a kilometry.
export async function route(from, to) {
  if (!from || !to) return null;
  if (KEY) {
    const r = await fetch(`https://api.mapy.com/v1/routing/route?apikey=${KEY}&lang=cs&routeType=car_fast`
      + `&start=${from.lon},${from.lat}&end=${to.lon},${to.lat}`);
    const j = await r.json();
    const sec = j.duration ?? j.time ?? null;
    const m = j.length ?? j.distance ?? null;
    if (sec == null) return null;
    return { car: Math.round(sec / 60), km: m != null ? Math.round(m / 1000) : null };
  }
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/`
    + `${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`, { headers: { 'user-agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  const rt = j.routes?.[0];
  if (!rt) return null;
  return { car: Math.round(rt.duration / 60), km: Math.round(rt.distance / 1000) };
}

// Cíl z parametrů: dlat/dlon (souřadnice), dq (adresa k dohledání) nebo výchozí Pankrác.
export async function resolveDest(p) {
  const lat = parseFloat(p?.dlat), lon = parseFloat(p?.dlon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  if (p?.dq) { const g = await geocode(p.dq); if (g) return g; }
  return DEST;
}

// Souběžné zpracování s omezením počtu paralelních requestů.
export async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await worker(items[idx], idx); }
      catch (e) { out[idx] = null; }
    }
  }));
  return out;
}

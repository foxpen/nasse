import { json, preflight } from './_lib/http.js';
import { requireAuth } from './_lib/auth.js';
import { SOURCES } from './_lib/sources.js';

// Načte JEDNU stránku výsledků z JEDNOHO portálu a vrátí je v jednotném tvaru.
// Klient (bydleni.html) si volá tenhle endpoint opakovaně (zdroj × typ × stránka),
// takže se každé volání vejde do limitu serverless funkce a jde ukázat průběh.

const list = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const int = (v) => { const n = parseInt(String(v ?? '').replace(/\s/g, ''), 10); return Number.isFinite(n) ? n : null; };
const flt = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

// vzdušná vzdálenost v km (pojistka, když portál ignoruje okruh)
function distKm(aLat, aLon, bLat, bLon) {
  const R = 6371, rad = (x) => x * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const CHATY = /^(chata|chalupa|zem[ěe]d[ěe]lsk|na kl[íi][čc])/i;

// Dofiltrování toho, co portály samy neumí (nebo umí nespolehlivě).
function refine(items, c) {
  const out = [];
  let dropped = 0;
  for (const it of items) {
    const bad =
      (c.cenaOd && it.price && it.price < c.cenaOd) ||
      (c.cenaDo && it.price && it.price > c.cenaDo) ||
      (c.cenaDo && !it.price) ||                                   // bez ceny nemá smysl porovnávat
      (c.plochaOd && it.area && it.area < c.plochaOd) ||
      (c.plochaDo && it.area && it.area > c.plochaDo) ||
      (c.pozemekOd && it.t === 'dum' && it.landM != null && it.landM < c.pozemekOd) ||
      (c.bezChat && CHATY.test(it.sub || '')) ||
      // dispozice: filtruj jen když ji inzerát vůbec uvádí
      (c.disp?.length && (() => { const d = (it.disp.match(/\d\+(?:kk|1)/) || [])[0]; return d && !c.disp.includes(d); })()) ||
      // okruh od cíle podle GPS
      (c.okruh && c.dlat != null && it.lat != null && distKm(c.dlat, c.dlon, it.lat, it.lon) > c.okruh * 1.15);
    if (bad) { dropped++; continue; }
    if (c.dlat != null && it.lat != null) it.vzdusne = Math.round(distKm(c.dlat, c.dlon, it.lat, it.lon));
    out.push(it);
  }
  return { items: out, dropped };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  const p = event.queryStringParameters || {};
  const src = SOURCES[p.source];
  if (!src) return json(400, { error: 'neznámý zdroj (sreality / bezrealitky / bazos)' });
  const typ = p.typ === 'byt' ? 'byt' : 'dum';
  const page = Math.max(1, int(p.page) || 1);

  const c = {
    typ,
    cenaOd: int(p.cenaOd), cenaDo: int(p.cenaDo),
    plochaOd: int(p.plochaOd), plochaDo: int(p.plochaDo),
    pozemekOd: int(p.pozemekOd),
    disp: list(p.disp), stav: list(p.stav), regiony: list(p.regiony),
    dlat: flt(p.dlat), dlon: flt(p.dlon), okruh: int(p.okruh),
    psc: p.psc || '', osobni: p.osobni === '1', bezChat: p.bezChat === '1'
  };

  try {
    const { total, items } = await src.fn(c, page);
    const r = refine(items, c);
    return json(200, {
      source: p.source, label: src.label, typ, page,
      perPage: src.perPage,
      total,
      pages: Math.max(1, Math.ceil((total || 0) / src.perPage)),
      found: items.length, dropped: r.dropped,
      items: r.items
    });
  } catch (e) {
    return json(502, { error: String(e?.message || e), source: p.source, typ, page });
  }
}

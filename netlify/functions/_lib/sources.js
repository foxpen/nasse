// Adaptéry na inzertní portály pro hledání (search.js).
// Každý adaptér umí načíst JEDNU stránku výsledků a vrátit jednotný tvar:
//   { src, url, n, t, disp, price, area, land, ready, when, en, origin, img, feats, lat, lon }
// což je přímo tvar `data` v tabulce listings (plus src/lat/lon pro skórování a dojezd).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const num = (s) => {
  const n = parseInt(String(s == null ? '' : s).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Stav nemovitosti: jednotné klíče appky → hodnoty portálů.
export const STAV = {
  novostavba:     { sr: 'novostavby',       bz: ['NEW'],                                          l: 'novostavba' },
  velmidobry:     { sr: 'velmi-dobry-stav', bz: ['VERY_GOOD'],                                    l: 'velmi dobrý' },
  porekonstrukci: { sr: 'po-rekonstrukci',  bz: ['AFTER_RECONSTRUCTION', 'AFTER_PARTIAL_RECONSTRUCTION'], l: 'po rekonstrukci' },
  dobry:          { sr: 'dobry-stav',       bz: ['GOOD'],                                         l: 'dobrý' },
  vevystavbe:     { sr: 've-vystavbe',      bz: ['CONSTRUCTION', 'PROJECT'],                      l: 've výstavbě' }
};

// Dispozice: "3+kk" → enum bezrealitky
const dispToBz = (d) => 'DISP_' + d.replace('+kk', '_KK').replace('+1', '_1');
const dispFromBz = (e) => String(e || '').replace(/^DISP_/, '').replace('_KK', '+kk').replace('_1', '+1').replace('_IZB', '+izb');

const parseArea = (s) => {
  const m = String(s || '').match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:m²|m2|㎡)/);
  return m ? Math.round(parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))) : 0;
};
const parseLand = (s) => {
  const m = String(s || '').match(/pozemek\s*([\d\s]+)\s*(?:m²|m2)/i);
  return m ? num(m[1]) : null;
};
const parseDisp = (s) => (String(s || '').match(/(\d\s?\+\s?(?:kk|1))/i) || [])[1]?.replace(/\s/g, '').toLowerCase() || '';

async function getText(url, headers) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs', ...(headers || {}) } });
  if (!res.ok) throw new Error(url.replace(/^https?:\/\/([^/]+).*/, '$1') + ' vrátil ' + res.status);
  return res.text();
}

/* ---------------------------------------------------------------- sreality */
// Výsledky hledání jsou v SSR datech stránky (<script id="__NEXT_DATA__">).
export const SREALITY_PER_PAGE = 22;

function srealityUrl(c, page) {
  const cat = c.typ === 'byt' ? 'byty' : 'domy';
  const loc = (c.regiony || []).map(slug).filter(Boolean).join(',');
  const p = new URLSearchParams();
  if (c.cenaOd) p.set('cena-od', c.cenaOd);
  if (c.cenaDo) p.set('cena-do', c.cenaDo);
  if (c.plochaOd) p.set('plocha-od', c.plochaOd);
  if (c.plochaDo) p.set('plocha-do', c.plochaDo);
  // `velikost` = dispozice; u domů koliduje s druhem stavby, proto jen u bytů
  if (c.typ === 'byt' && c.disp?.length) p.set('velikost', c.disp.join(','));
  const stav = (c.stav || []).map(k => STAV[k]?.sr).filter(Boolean);
  if (stav.length) p.set('stav', stav.join(','));
  // vlastnictví je atribut bytů (osobní/družstevní); u domů ho inzeráty neuvádějí a filtr by je vymazal
  if (c.osobni && c.typ === 'byt') p.set('vlastnictvi', 'osobni');
  if (page > 1) p.set('strana', page);
  return `https://www.sreality.cz/hledani/prodej/${cat}${loc ? '/' + loc : ''}?${p}`;
}

function srealityItem(r) {
  const loc = r.locality || {};
  const t = r.categoryMainCb?.value === 1 ? 'byt' : 'dum';
  const sub = r.categorySubCb?.name || '';
  const city = loc.city || loc.district || '';
  const part = loc.cityPart && loc.cityPart !== city ? ' · ' + loc.cityPart : '';
  const area = parseArea(r.name);
  const land = parseLand(r.name);
  const disp = parseDisp(r.name);
  let img = r.images?.[0]?.url || '';
  if (img.startsWith('//')) img = 'https:' + img;
  // Sreality si detail najde podle ID a přesměruje na kanonickou adresu, ale kategorie
  // v cestě musí být platná: u bytů dispozice (3+kk), u domů druh stavby. Držíme se
  // tvarů, které projdou vždy, zbytek dořeší přesměrování.
  const kat = t === 'byt' ? (/^\d\+(kk|1)$/.test(disp) ? disp : 'atypicky') : 'rodinny';
  return {
    src: 'sreality',
    url: `https://www.sreality.cz/detail/prodej/${t}/${kat}/${loc.citySeoName || 'x'}/${r.id}`,
    n: (city + part) || r.name,
    t,
    disp: (t === 'dum' ? 'dům' : 'byt') + (disp ? ' ' + disp : ''),
    price: r.priceCzk || r.priceSummaryCzk || null,
    area,
    land: land ? 'pozemek ' + land + ' m²' : '',
    landM: land,
    ready: 1,
    when: '',
    en: '',
    origin: (city + (loc.cityPart && loc.cityPart !== city ? ' ' + loc.cityPart : '')).trim(),
    img,
    feats: sub ? [sub.toLowerCase()] : [],
    sub,
    lat: loc.latitude ?? null,
    lon: loc.longitude ?? null
  };
}

async function sreality(c, page) {
  const html = await getText(srealityUrl(c, page));
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('sreality: nepodařilo se přečíst data stránky');
  const nd = JSON.parse(m[1]);
  const q = (nd.props?.pageProps?.dehydratedState?.queries || []).find(x => x.queryKey?.[0] === 'estatesSearch');
  const data = q?.state?.data;
  if (!data) throw new Error('sreality: ve stránce nejsou výsledky hledání');
  const total = data.pagination?.total ?? nd.props.pageProps.total ?? 0;
  return { total, items: (data.results || []).map(srealityItem) };
}

/* ------------------------------------------------------------ bezrealitky */
// Veřejné GraphQL API (vyžaduje hlavičky origin/referer). Umí i hledání v okruhu od bodu.
export const BEZREALITKY_PER_PAGE = 30;

const BZ_COND = {
  NEW: 'novostavba', VERY_GOOD: 'velmi dobrý', GOOD: 'dobrý', BAD: 'špatný',
  CONSTRUCTION: 've výstavbě', PROJECT: 'projekt', DEMOLITION: 'k demolici',
  BEFORE_RECONSTRUCTION: 'před rekonstrukcí', AFTER_RECONSTRUCTION: 'po rekonstrukci',
  AFTER_PARTIAL_RECONSTRUCTION: 'po částečné rekonstrukci', IN_RECONSTRUCTION: 'v rekonstrukci'
};

const BZ_QUERY = `query S($p:GPSPointInput,$r:Int,$pf:Int,$pt:Int,$sf:Int,$st:Int,$lf:Int,
  $et:[EstateType],$d:[Disposition],$c:[Condition],$lim:Int,$off:Int){
  listAdverts(offerType:PRODEJ, estateType:$et, disposition:$d, condition:$c,
    locationPoint:$p, locationRadius:$r, priceFrom:$pf, priceTo:$pt, currency:CZK,
    surfaceFrom:$sf, surfaceTo:$st, surfaceLandFrom:$lf,
    limit:$lim, offset:$off, order:TIMEORDER_DESC, locale:CS){
    totalCount
    list{ id uri title price currency surface surfaceLand disposition estateType condition penb
          city(locale:CS) zip address(locale:CS) gps{lat lng} mainImage{url(filter:RECORD_MAIN)}
          terrace garage parking cellar lift frontGarden }
  }}`;

function bezrealitkyItem(a) {
  const t = a.estateType === 'BYT' ? 'byt' : 'dum';
  const disp = dispFromBz(a.disposition);
  const when = BZ_COND[a.condition] || '';
  const feats = [];
  if (a.frontGarden) feats.push('předzahrádka');
  if (a.terrace) feats.push('terasa');
  if (a.garage) feats.push('garáž');
  if (a.parking) feats.push('parkování');
  if (a.cellar) feats.push('sklep');
  if (a.lift) feats.push('výtah');
  return {
    src: 'bezrealitky',
    url: 'https://www.bezrealitky.cz/nemovitosti-byty-domy/' + a.uri,
    n: [a.city, a.zip].filter(Boolean).join(' ') || a.address || a.title,
    t,
    disp: (t === 'dum' ? 'dům' : 'byt') + (disp && !/undefined/i.test(disp) ? ' ' + disp : ''),
    price: a.price || null,
    area: Math.round(a.surface || 0),
    land: a.surfaceLand ? 'pozemek ' + a.surfaceLand + ' m²' : '',
    landM: a.surfaceLand || null,
    ready: /^(CONSTRUCTION|PROJECT)$/.test(a.condition || '') ? 0 : 1,
    when,
    en: /^[A-G]$/.test(a.penb || '') ? a.penb : '',
    origin: [a.city, a.zip].filter(Boolean).join(' ') || a.address || '',
    img: a.mainImage?.url || '',
    feats,
    sub: '',
    lat: a.gps?.lat ?? null,
    lon: a.gps?.lng ?? null
  };
}

async function bezrealitky(c, page) {
  const vars = {
    et: [c.typ === 'byt' ? 'BYT' : 'DUM'],
    d: c.typ === 'byt' && c.disp?.length ? c.disp.map(dispToBz) : null,
    c: c.stav?.length ? c.stav.flatMap(k => STAV[k]?.bz || []) : null,
    p: c.dlat != null && c.dlon != null ? { lat: c.dlat, lng: c.dlon } : null,
    r: c.okruh ? Math.min(100, Math.max(1, Math.round(c.okruh))) : null, // pozor: v kilometrech
    pf: c.cenaOd || null, pt: c.cenaDo || null,
    sf: c.plochaOd || null, st: c.plochaDo || null,
    lf: c.typ === 'dum' && c.pozemekOd ? c.pozemekOd : null,
    lim: BEZREALITKY_PER_PAGE, off: (page - 1) * BEZREALITKY_PER_PAGE
  };
  const res = await fetch('https://api.bezrealitky.cz/graphql/', {
    method: 'POST',
    headers: {
      'user-agent': UA, 'content-type': 'application/json', 'accept': '*/*',
      'origin': 'https://www.bezrealitky.cz', 'referer': 'https://www.bezrealitky.cz/', 'accept-language': 'cs'
    },
    body: JSON.stringify({ query: BZ_QUERY, variables: vars })
  });
  const j = await res.json();
  if (j.errors) throw new Error('bezrealitky: ' + (j.errors[0]?.message || 'chyba API'));
  const d = j.data?.listAdverts;
  if (!d) throw new Error('bezrealitky: prázdná odpověď API');
  return { total: d.totalCount || 0, items: (d.list || []).map(bezrealitkyItem) };
}

/* ------------------------------------------------------------------ bazoš */
// Klasické HTML. Umí hledat v okruhu od PSČ, ale nedává GPS ani plochu (jen v textu).
export const BAZOS_PER_PAGE = 20;

function bazosUrl(c, page) {
  const rub = c.typ === 'byt' ? 'byt' : 'dum';
  const p = new URLSearchParams();
  if (c.psc) { p.set('hlokalita', String(c.psc).replace(/\s/g, '')); p.set('humkreis', String(c.okruh || 50)); }
  if (c.cenaOd) p.set('cenaod', c.cenaOd);
  if (c.cenaDo) p.set('cenado', c.cenaDo);
  const off = (page - 1) * BAZOS_PER_PAGE;
  return `https://reality.bazos.cz/prodam/${rub}/${off ? off + '/' : ''}?${p}`;
}

function bazosItem(block, typ) {
  const href = (block.match(/href="(\/inzerat\/[^"]+)"/) || [])[1];
  if (!href) return null;
  const title = (block.match(/<h2 class=nadpis><a[^>]*>([^<]+)/) || [])[1] || '';
  const price = num((block.match(/inzeratycena[^>]*><b><span[^>]*>([^<]+)/) || [])[1]);
  const lok = block.match(/inzeratylok">([^<]*)<br>([\d\s]+)/) || [];
  const city = (lok[1] || '').trim(), zip = (lok[2] || '').trim();
  let img = (block.match(/<img src="(https:\/\/www\.bazos\.cz\/img\/[^"]+)"/) || [])[1] || '';
  const desc = (block.match(/<div class=popis>([\s\S]*?)<\/div>/) || [])[1] || '';
  const disp = parseDisp(title) || parseDisp(desc);
  const t = /\bbyt|\d\s?\+\s?(kk|1)\b/i.test(title) && typ === 'byt' ? 'byt' : typ;
  return {
    src: 'bazos',
    url: 'https://reality.bazos.cz' + href,
    n: [city, zip].filter(Boolean).join(' ') || title,
    t,
    disp: (t === 'dum' ? 'dům' : 'byt') + (disp ? ' ' + disp : ''),
    price: price && price > 100000 ? price : null,
    area: parseArea(title) || parseArea(desc),
    land: parseLand(title) || parseLand(desc) ? 'pozemek ' + (parseLand(title) || parseLand(desc)) + ' m²' : '',
    landM: parseLand(title) || parseLand(desc),
    ready: 1,
    when: '',
    en: '',
    origin: [city, zip].filter(Boolean).join(' '),
    img,
    feats: [],
    sub: '',
    title,
    lat: null,
    lon: null
  };
}

async function bazos(c, page) {
  const html = await getText(bazosUrl(c, page));
  const blocks = html.split(/<div class="inzeraty inzeratyflex">/).slice(1);
  const items = blocks.map(b => bazosItem(b, c.typ)).filter(Boolean);
  const total = num((html.match(/z\s*celkem\s*([\d\s]+)\s*inzer/i) || [])[1]);
  return { total: total || (items.length === BAZOS_PER_PAGE ? page * BAZOS_PER_PAGE + 1 : (page - 1) * BAZOS_PER_PAGE + items.length), items };
}

/* ------------------------------------------------------------------------ */
export const SOURCES = {
  sreality:    { fn: sreality,    perPage: SREALITY_PER_PAGE,    label: 'sreality.cz' },
  bezrealitky: { fn: bezrealitky, perPage: BEZREALITKY_PER_PAGE, label: 'bezrealitky.cz' },
  bazos:       { fn: bazos,       perPage: BAZOS_PER_PAGE,       label: 'bazoš' }
};

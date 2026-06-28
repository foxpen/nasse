import { requireAuth } from './_lib/auth.js';
import { json } from './_lib/http.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const M2 = '(?:m²|m2|mÂ²|mÂ˛)';

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, prop) {
  const re = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)`, 'i');
  const m = html.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function num(value) {
  return parseInt(String(value || '').replace(/[^\d]/g, ''), 10) || null;
}

function dec(value) {
  const n = Number(String(value ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cleanImageUrl(url) {
  let out = String(url || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
  if (out.startsWith('//')) out = 'https:' + out;
  if (/sdn\.cz\/d_18\/c_img_/i.test(out) && !/[?&]fl=/.test(out)) {
    out += '?fl=res,1200,1200,1|shr,,20|jpg,80';
  }
  return /^https?:\/\//i.test(out) ? out : '';
}

function imageKey(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/media\/cache\/[^/]+\//, '/media/cache/');
  } catch {
    return url.split('?')[0];
  }
}

function uniqueImages(urls, limit = 30) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const url = cleanImageUrl(raw);
    if (!url || /logo|avatar|icon|map|sprite/i.test(url)) continue;
    const key = imageKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

function stripHtml(html) {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function imagesFrom(html, primary = '', limit = 30) {
  const found = [];
  const add = value => {
    const url = cleanImageUrl(value);
    if (!url || /logo|avatar|icon|map|sprite/i.test(url)) return;
    found.push(url);
  };
  add(primary);
  for (const m of String(html || '').matchAll(/https?:\\?\/\\?\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]*)?/gi)) {
    add(m[0]);
    if (found.length >= limit * 3) break;
  }
  return uniqueImages(found, limit);
}

function srealityGalleryImages(html, primary = '') {
  const structured = srealityStructuredImages(html);
  if (structured.length) return structured;
  const end = html.indexOf('__NEXT_DATA__') > 0 ? html.indexOf('__NEXT_DATA__') : Math.min(html.length, 190000);
  const galleryHtml = html.slice(0, end);
  const count = num((html.match(/Zobrazit\s+všech\s+(\d+)\s+fotek/i) || [])[1]) || 30;
  const imgs = imagesFrom(galleryHtml, primary, 30)
    .filter(u => /sdn\.cz\/d_18\/c_img_|d\d+-a\.sdn\.cz/i.test(u));
  if (imgs.length > 1) return imgs.slice(0, count);
  const allListingCdn = imagesFrom(html, primary, 30)
    .filter(u => /sdn\.cz\/d_18\/c_img_|d\d+-a\.sdn\.cz/i.test(u));
  return allListingCdn.length ? allListingCdn.slice(0, count) : imagesFrom(galleryHtml, primary, 18);
}

function srealityStructuredImages(html) {
  try {
    const scripts = [...String(html || '').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map(m => m[1])
      .filter(Boolean);
    const raw = scripts.find(s => s.trim().startsWith('{"props"'));
    if (!raw) return [];
    const data = JSON.parse(raw);
    const queries = data?.props?.pageProps?.dehydratedState?.queries || [];
    for (const q of queries) {
      const estate = q?.state?.data;
      if (Array.isArray(estate?.images) && estate.images.length) {
        const sorted = estate.images.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        return uniqueImages(sorted.map(img => img.url), 40);
      }
    }
  } catch {
    return [];
  }
  return [];
}

function interestingFacts(text, desc) {
  const source = `${desc || ''} ${text || ''}`;
  const checks = [
    [/novostavba/i, 'Novostavba'],
    [/parkov[aá]n[ií]|parkovac/i, 'Parkování je zmíněné v inzerátu'],
    [/gar[aá][zž]/i, 'Garáž je zmíněná v inzerátu'],
    [/terasa/i, 'Terasa'],
    [/balk[oó]n|lod[zž]ie/i, 'Balkon nebo lodžie'],
    [/zahrad/i, 'Zahrada'],
    [/vlak|n[aá]dra[zž]/i, 'V inzerátu je zmíněný vlak / nádraží'],
    [/\bbus|autobus|zast[aá]vk/i, 'V inzerátu je zmíněný autobus / zastávka'],
    [/supermarket|obchod|potravin|lidl|billa|kaufland|albert|tesco|penny/i, 'V okolí je zmíněný obchod nebo supermarket'],
    [/škol|skol|školk|skolk/i, 'V okolí je zmíněná škola nebo školka'],
    [/rekuperace|tepeln[eé] [cč]erpadlo|podlahov[eé] topen[ií]|fotovolta/i, 'Technologie domu jsou zmíněné v inzerátu'],
    [/rekonstruk/i, 'Rekonstrukce je zmíněná v inzerátu'],
    [/p[rř][ií]zemn[ií]/i, 'Přízemní dispozice'],
    [/řadov|radov/i, 'Řadový dům'],
    [/sklep/i, 'Sklep'],
    [/baz[eé]n/i, 'Bazén']
  ];
  const facts = [];
  for (const [re, label] of checks) {
    if (re.test(source) && !facts.includes(label)) facts.push(label);
    if (facts.length >= 10) break;
  }
  return facts;
}

function dateNear(text, labels) {
  const date = '(\\d{1,2}\\.\\s*\\d{1,2}\\.\\s*\\d{4}|\\d{4}-\\d{2}-\\d{2})';
  for (const label of labels) {
    const m = text.match(new RegExp(label + '[^0-9]{0,80}' + date, 'i'));
    if (m) return m[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

function getAny(obj, names) {
  for (const name of names) {
    if (obj && obj[name] != null && obj[name] !== '') return obj[name];
  }
  return '';
}

function refValue(cache, value) {
  if (!value) return null;
  if (value.__ref && cache) return cache[value.__ref] || null;
  return value;
}

function bezImages(adv, cache, html) {
  const urls = [];
  const main = refValue(cache, adv.mainImage);
  if (main) urls.push(getAny(main, ['url', 'url({"filter":"RECORD_MAIN"})', 'url({"filter":"RECORD_THUMB"})']));
  for (const item of (adv.publicImages || [])) {
    const img = refValue(cache, item);
    if (img) urls.push(getAny(img, ['url', 'url({"filter":"RECORD_MAIN"})', 'url({"filter":"RECORD_THUMB"})']));
  }
  return uniqueImages(urls.length ? urls : imagesFrom(html, '', 30), 30);
}

function firstM2(source, prefix = '') {
  const re = prefix
    ? new RegExp(prefix + '[^0-9]{0,30}([0-9][0-9\\s]*)\\s*' + M2, 'i')
    : new RegExp('([0-9][0-9\\s]*)\\s*' + M2, 'i');
  const m = String(source || '').match(re);
  return m ? num(m[1]) : 0;
}

function m2Near(source, words) {
  const s = String(source || '');
  for (const word of words) {
    const before = new RegExp(word + '[^0-9]{0,48}([0-9][0-9\\s,.]*)\\s*' + M2, 'i');
    const direct = s.match(before);
    if (direct) return dec(direct[1]);
    const after = new RegExp('([0-9][0-9\\s,.]*)\\s*' + M2 + '[^\\n\\r.;]{0,64}' + word, 'ig');
    const matches = [...s.matchAll(after)];
    if (matches.length) return dec(matches[matches.length - 1][1]);
  }
  return 0;
}

function m2BeforeWord(source, words) {
  const s = String(source || '');
  for (const word of words) {
    const wordRe = new RegExp(word, 'ig');
    const positions = [...s.matchAll(wordRe)].map(m => m.index ?? 0);
    for (const pos of positions) {
      const before = s.slice(Math.max(0, pos - 140), pos);
      const nums = [...before.matchAll(new RegExp('([0-9][0-9\\s,.]*)\\s*' + M2, 'ig'))];
      if (nums.length) return dec(nums[nums.length - 1][1]);
    }
  }
  return 0;
}

function parseSreality(url, html) {
  const title = meta(html, 'og:title');
  const desc = meta(html, 'og:description');
  const text = stripHtml(html);
  const joined = `${title} ${desc} ${text}`;
  const imgs = srealityGalleryImages(html, meta(html, 'og:image'));
  const img = imgs[0] || '';
  const t = /\/dum\//.test(url) ? 'dum' : 'byt';
  const area = firstM2(title) || firstM2(desc);
  const plotArea = m2Near(joined, ['pozem(?:ek|ku|kem)?']) || 0;
  const gardenArea = m2BeforeWord(joined, ['zahrad(?:a|y|u|ou)?']) || 0;
  const dispM = title.match(/(\d\+(?:kk|1))/i) || desc.match(/(\d\+(?:kk|1))/i);
  const priceM = html.match(/"price":\s*(\d{5,})/) || desc.match(/([\d\s]{6,})\s*K[čc]/i);
  const price = priceM ? num(priceM[1]) : null;
  const locParts = title.split(',')
    .map(x => x.replace(/\s*•\s*Sreality\.cz.*/i, '').trim())
    .filter(x => x && !/^Prodej\b/i.test(x) && !/^pozemek\b/i.test(x));
  const loc = locParts.slice(-2).join(', ') || title.replace(/\s*•\s*Sreality\.cz.*/i, '');
  const novostavba = /novostavba/i.test(joined);
  const vystavba = /ve v[ýy]stavb|projekt|v p[rř][ií]prav/i.test(joined);
  const listedAt = dateNear(text, ['vytvo[rř]eno', 'zve[rř]ejn[eě]no', 'vlo[zž]eno']);
  const updatedAt = dateNear(text, ['upraveno', 'aktualizov[aá]no', 'posledn[ií]\\s+[uú]prava']);
  const phone = (text.match(/(?:\+420\s*)?\d{3}\s*\d{3}\s*\d{3}/) || [])[0] || '';
  const agency = (text.match(/([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ&. ]{3,}\s+(?:REALITY|Realit|reality|s\.r\.o\.))/) || [])[1] || '';
  return { section: 'byd', data: {
    n: loc, t, disp: (t === 'dum' ? 'dům ' : 'byt ') + (dispM ? dispM[1] : ''), price, area,
    land: plotArea ? `pozemek ${plotArea} m²` : '', plotArea, gardenArea,
    terrace: /terasa/i.test(joined), balcony: /balk[oó]n|lod[zž]ie/i.test(joined), garage: /gar[aá][zž]/i.test(joined), parking: /parkov[aá]n[ií]|parkovac/i.test(joined),
    ready: vystavba ? 0 : 1, when: novostavba ? 'novostavba' : (vystavba ? 've výstavbě' : ''), en: '', car: 0, pt: 0,
    origin: loc.split('-')[0].trim(), img, imgs,
    feats: [...interestingFacts(text, desc), listedAt ? 'Vytvořeno / zveřejněno: ' + listedAt : '', updatedAt ? 'Poslední úprava: ' + updatedAt : ''].filter(Boolean).slice(0, 10),
    listedAt, updatedAt, contact: [agency, phone].filter(Boolean).join(' · '), url
  } };
}

function parseBezrealitky(url, html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  let data = null;
  if (m) { try { data = JSON.parse(m[1]); } catch { data = null; } }
  const idMatch = url.match(/\/(\d+)-/);
  const wantId = idMatch ? idMatch[1] : null;
  const objs = [];
  (function walk(o){ if (o && typeof o === 'object') { if (!Array.isArray(o)) objs.push(o); for (const k in o) walk(o[k]); } })(data);
  const pageProps = data?.props?.pageProps || {};
  const cache = pageProps.apolloCache || {};
  const adv = (pageProps.origAdvert && String(pageProps.origAdvert.id) === wantId ? pageProps.origAdvert : null)
    || objs.find(o => String(o.id) === wantId && 'price' in o)
    || objs.find(o => 'price' in o && ('disposition' in o || 'estateType' in o));
  if (!adv) return { section: 'byd', data: { n: '', t: 'dum', disp: '', price: null, area: 0, land: '', ready: 1, when: '', en: '', car: 0, pt: 0, origin: '', img: '', imgs: [], feats: [], url } };
  const imgs = bezImages(adv, cache, html).filter(u => /bezrealitky\.cz|api\.bezrealitky\.cz/.test(u));
  const img = imgs[0] || '';
  const disp = String(adv.disposition || '').replace('DISP_', '').replace('_KK', '+kk').replace('_1', '+1').replace(/_/g, '+').toLowerCase();
  const t = adv.estateType === 'DUM' ? 'dum' : 'byt';
  const condMap = { NOVOSTAVBA: 'Novostavba', VELMI_DOBRY: 'Velmi dobrý', VERY_GOOD: 'Velmi dobrý', GOOD: 'Dobrý', PO_REKONSTRUKCI: 'Po rekonstrukci', DOBRY: 'Dobrý', VE_VYSTAVBE: 've výstavbě', K_REKONSTRUKCI: 'Před rekonstrukcí' };
  const when = condMap[adv.condition] || '';
  const en = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(adv.penb) ? adv.penb : '';
  const land = adv.surfaceLand || 0;
  const garden = adv.frontGardenSurface || adv.gardenSurface || 0;
  const desc = getAny(adv, ['descriptionByLocale', 'descriptionByLocale({"locale":"CS"})', 'description']);
  const address = getAny(adv, ['address', 'address({"locale":"CS"})', 'address({"locale":"CS","withHouseNumber":false})']);
  const street = adv.street || (address ? String(address).split(',')[0] : '');
  const city = adv.city || adv['city({"locale":"CS"})'] || (address ? String(address).split(',')[1]?.trim().split(' - ')[0] : '') || (url.split('/').pop() || '').replace(/^\d+-/, '').replace(/^(nabidka-)?prodej-(domu|bytu|rodinneho-domu)-/, '').replace(/-/g, ' ');
  const loggia = dec(adv.loggiaSurface);
  const balcony = dec(adv.balconySurface);
  const terrace = dec(adv.terraceSurface);
  const feats = [];
  if (adv.terrace || terrace) feats.push(terrace ? `terasa ${terrace} m²` : 'terasa');
  if (adv.balcony || adv.loggia || balcony || loggia) feats.push(loggia ? `lodžie ${loggia} m²` : (balcony ? `balkon ${balcony} m²` : 'balkon/lodžie'));
  if (adv.garage) feats.push('garáž'); if (adv.parking) feats.push('parkování'); if (adv.cellar || adv.cellarSurface) feats.push(adv.cellarSurface ? `sklep ${adv.cellarSurface} m²` : 'sklep'); if (adv.frontGarden) feats.push('předzahrádka'); if (adv.lift) feats.push('výtah');
  feats.push(...interestingFacts(stripHtml(desc), desc).filter(x => !feats.includes(x)));
  return { section: 'byd', data: {
    n: [street || city || 'Nemovitost', city && street !== city ? city : '', disp].filter(Boolean).join(', '), t, disp: (t === 'dum' ? 'dům ' : 'byt ') + disp,
    price: adv.price || null, area: adv.surface || firstM2(desc) || 0, land: land ? `pozemek ${land} m²` : (loggia ? `lodžie ${loggia} m²` : ''),
    plotArea: land || 0, gardenArea: garden || 0,
    terrace: Boolean(adv.terrace || terrace), balcony: Boolean(adv.balcony || adv.loggia || balcony || loggia), garage: Boolean(adv.garage), parking: Boolean(adv.parking),
    ready: when === 've výstavbě' ? 0 : 1, when, en, car: 0, pt: 0, origin: address || [street, city].filter(Boolean).join(', '), img, imgs, feats: feats.slice(0, 12), contact: adv.userName || '', url
  } };
}

function parseSauto(url, html) {
  const title = meta(html, 'og:title').replace(/\s*\|\s*Sauto\.cz.*/i, '').trim();
  const desc = meta(html, 'og:description');
  const img = cleanImageUrl(meta(html, 'og:image'));
  const imgs = imagesFrom(html, img);
  const brand = (title.split(/\s+/)[0] || '').toLowerCase();
  const kw = num((html.match(/(\d{2,3})\s*kW/) || [])[1]);
  const ps = kw ? Math.round(kw * 1.35962) : null;
  const km = num((desc.match(/tachometr\s*([\d\s]+)\s*km/i) || [])[1]);
  const czk = num((desc.match(/cena\s*([\d\s]+)\s*K[čc]/i) || html.match(/"price":\s*(\d{5,})/) || [])[1]);
  const year = num((html.match(/"manufacturing_date":"(\d{4})/) || desc.match(/(20\d{2})/) || [])[1]);
  const fuelM = desc.match(/\b(Benzín|Nafta|Diesel|Elektro|Hybrid)\b/i);
  const fuel = fuelM ? fuelM[1].toLowerCase().replace('nafta', 'diesel').replace('benzín', 'benzin') : 'benzin';
  const awd = /\b(AWD|4x4|4×4|4WD)\b/i.test(title + ' ' + desc);
  return { section: 'auto', data: { brand, n: title, variant: (awd ? '4×4' : 'FWD'), stav: /ojet/i.test(desc) ? 'ojeté' : 'nové', year: year || new Date().getFullYear(), km: km || 0, fuel, awd, kw: kw || 0, ps: ps || 0, czk: czk || null, img, imgs, feats: [], url } };
}

function parseBazos(url, html) {
  const title = meta(html, 'og:title');
  const desc = meta(html, 'og:description');
  const img = cleanImageUrl(meta(html, 'og:image'));
  return { section: 'auto', data: { brand: (title.split(/\s+/)[0] || '').toLowerCase(), n: title, variant: '', stav: 'ojeté', year: 0, km: 0, fuel: '', awd: false, kw: 0, ps: 0, czk: num(desc), price: null, img, imgs: imagesFrom(html, img), feats: [], url } };
}

export async function extractUrl(url) {
  if (!url || !/^https?:\/\//.test(url)) throw new Error('missing url');
  const host = new URL(url).hostname;
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs,en' } });
  if (!res.ok) { const err = new Error('zdroj nedostupný (' + res.status + ')'); err.status = res.status; err.host = host; throw err; }
  const html = await res.text();
  if (/sreality\.cz/.test(host)) return parseSreality(url, html);
  if (/bezrealitky\.cz/.test(host)) return parseBezrealitky(url, html);
  if (/sauto\.cz/.test(host)) return parseSauto(url, html);
  if (/bazos\.cz/.test(host)) return parseBazos(url, html);
  const err = new Error('tento web extraktor neumí'); err.status = 422; err.host = host; throw err;
}

export async function handler(event) {
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  try {
    const url = event.queryStringParameters?.url;
    if (!url || !/^https?:\/\//.test(url)) return json(400, { error: 'missing url' });
    return json(200, await extractUrl(url));
  } catch (e) {
    return json(e.status || 500, { error: String(e?.message || e), source: e.host || '' });
  }
}

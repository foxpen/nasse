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
  if (/sdn\.cz\/d_(?:18|19)\/c_img_/i.test(out)) {
    out = out.split('?')[0];
    out += '?fl=res,1200,1200,1|shr,,20|jpg,80';
  }
  return /^https?:\/\//i.test(out) ? out : '';
}

function isBadImageUrl(url) {
  const s = String(url || '').toLowerCase();
  return !s
    || /logo|avatar|icon|sprite|map|marker|agency|reality-logo|watermark/.test(s)
    || /bewertung|bewertungen|review|rating|stars|trusted|beste|autobazar|autoscout|google|facebook|mobile\.png/.test(s)
    || /cebia|autobezobav|affiliate|utm_/.test(s)
    || /\/_next\/static\//.test(s)
    || /favicon|placeholder|default-image|no-photo/.test(s);
}

function imageKey(url) {
  try {
    const u = new URL(url);
    if (/pics\.carcalc\.de$/i.test(u.hostname)) return u.href.split('&')[0];
    let path = u.pathname
      .replace(/\/media\/cache\/[^/]+\//, '/media/cache/')
      .replace(/\/data\/images\/advert\/[^/]+\/\d+\/(\d+)-[^/]+$/i, '/data/images/advert/$1')
      .replace(/\/d_18\/c_img_[^/]+\/([^/?]+)$/i, '/d_18/$1')
      .replace(/\.(?:jpg|jpeg|png|webp)$/i, '');
    return u.hostname.replace(/^www\./, '') + path;
  } catch {
    return url.split('?')[0];
  }
}

function uniqueImages(urls, limit = 30) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const url = cleanImageUrl(raw);
    if (!url || isBadImageUrl(url)) continue;
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
    if (!url || isBadImageUrl(url)) return;
    found.push(url);
  };
  add(primary);
  for (const m of String(html || '').matchAll(/https?:\\?\/\\?\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]*)?/gi)) {
    add(m[0]);
    if (found.length >= limit * 3) break;
  }
  return uniqueImages(found, limit);
}

function sautoGalleryImages(html, primary = '') {
  const structured = [...String(html || '').matchAll(/"url"\s*:\s*"((?:https?:)?\/\/d19-a\.sdn\.cz\/d_19\/c_img_[^"]+\.(?:jpg|jpeg|png|webp))"/gi)]
    .map(m => m[1]);
  if (structured.length) return uniqueImages([primary, ...structured], 36);
  const imgs = imagesFrom(html, primary, 40)
    .filter(u => /sdn\.cz\/d_(?:18|19)\/c_img_/i.test(u))
    .filter(u => /\.(?:jpg|jpeg|webp)(?:\?|$)/i.test(u));
  return uniqueImages(imgs, 30);
}

function normalizeMonthYear(value) {
  const m = String(value || '').match(/\b(0?[1-9]|1[0-2])\s*[/.]\s*((?:19|20)\d{2})\b/);
  if (m) return `${String(Number(m[1])).padStart(2, '0')}/${m[2]}`;
  return String(value || '').trim();
}

function firstMatch(source, patterns) {
  for (const re of patterns) {
    const m = String(source || '').match(re);
    if (m?.[1]) return decodeHtml(m[1]);
  }
  return '';
}

function titleFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean).map(x => decodeURIComponent(x));
    const slug = [...parts].reverse().find(x => /[a-zA-Z]/.test(x) && !/^[a-f0-9]{12,}$/i.test(x) && !/^\d+$/.test(x)) || parts.pop() || '';
    return slug
      .replace(/[_-]+/g, ' ')
      .replace(/\b([a-f0-9]{12,}|\d{5,})\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

function normalizeFuel(value) {
  const s = String(value || '').toLowerCase();
  if (/diesel|nafta/.test(s)) return 'diesel';
  if (/hybrid/.test(s)) return 'hybrid';
  if (/elektro|electric/.test(s)) return 'elektro';
  if (/lpg/.test(s)) return 'lpg';
  if (/cng/.test(s)) return 'cng';
  if (/benz|petrol|skyactiv-g|t-gdi|\bgdi\b|tsi|tfsi/.test(s)) return 'benzin';
  return value || '';
}

function autoFeatures(text) {
  const source = String(text || '');
  const feats = [];
  const addIf = (re, label) => { if (re.test(source) && !feats.includes(label)) feats.push(label); };
  addIf(/1\.\s*maj|prvn[ií]\s+majitel|1st owner/i, '1. majitel');
  addIf(/servisn[ií]\s+kn|scheckheft|service history/i, 'servisní knížka');
  addIf(/nehavar|unfallfrei/i, 'nehavarované');
  addIf(/panorama|panoramat/i, 'panoramatická střecha');
  addIf(/navigac|navigation|navi\b/i, 'navigace');
  addIf(/adaptiv|ACC|abstandsregel/i, 'adaptivní tempomat');
  addIf(/tempomat|cruise/i, 'tempomat');
  addIf(/\bLED\b|matrix/i, 'LED světla');
  addIf(/kamera|rear view|r[üu]ckfahrkamera|360/i, 'parkovací kamera');
  addIf(/parkovac[ií]\s+senzor|parksensor|pdc/i, 'parkovací senzory');
  addIf(/vyh[řr][ií]van|sitzheizung|lenkradheizung/i, 'vyhřívání');
  addIf(/ta[žz]n[eé]|anh[aä]ngerkupplung|tow/i, 'tažné zařízení');
  addIf(/keyless|bezkl[ií][čc]ov/i, 'keyless');
  addIf(/carplay|android auto/i, 'Apple CarPlay / Android Auto');
  addIf(/head.?up/i, 'head-up displej');
  addIf(/totwinkel|blind spot|mrtv[eé]ho [uú]hlu/i, 'hlídání mrtvého úhlu');
  addIf(/spurhalte|lane assist|j[ií]zdn[ií]ho pruhu/i, 'hlídání jízdního pruhu');
  addIf(/DPH|MwSt/i, 'možný odpočet DPH');
  return feats.slice(0, 14);
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

function imageUrlFromObject(img) {
  if (!img || typeof img !== 'object') return '';
  const direct = getAny(img, [
    'url({"filter":"RECORD_MAIN"})',
    'url({"filter":"RECORD_DETAIL"})',
    'url({"filter":"RECORD_THUMB"})',
    'url',
    'path'
  ]);
  if (direct) return direct;
  for (const value of Object.values(img)) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }
  return '';
}

function bezImages(adv, cache, html) {
  const urls = [];
  const main = refValue(cache, adv.mainImage);
  if (main) urls.push(imageUrlFromObject(main));
  for (const item of (adv.publicImages || [])) {
    const img = refValue(cache, item);
    if (img) urls.push(imageUrlFromObject(img));
  }
  const cleaned = uniqueImages(urls, 36);
  if (cleaned.length) return cleaned;
  return imagesFrom(html, '', 30)
    .filter(u => /\/media\/cache\/record_|\/data\/images\/advert\//i.test(u));
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
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const snippet = s.slice(m.index, Math.min(s.length, m.index + m[0].length + 80));
      if (/u[žz]itn|obytn|podlahov|plocha\s+(?:bytu|domu|jednotky)/i.test(snippet)) continue;
      return dec(m[1]);
    }
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

function hasOutdoorLabel(source, word) {
  return new RegExp(word, 'i').test(String(source || ''));
}

function cleanOutdoorArea(value, usableArea, source, word) {
  const n = Number(value) || 0;
  if (!n) return 0;
  if (usableArea && n === Number(usableArea) && !hasOutdoorLabel(source, word)) return 0;
  return n;
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
  let plotArea = m2Near(joined, ['(?:plocha\\s+)?pozem(?:ek|ku|kem)?']) || 0;
  let gardenArea = m2Near(joined, ['zahrad(?:a|y|u|ou)?']) || m2BeforeWord(joined, ['zahrad(?:a|y|u|ou)?']) || 0;
  plotArea = cleanOutdoorArea(plotArea, area, joined, 'pozem');
  gardenArea = cleanOutdoorArea(gardenArea, area, joined, 'zahrad');
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
  const land = cleanOutdoorArea(adv.surfaceLand || 0, adv.surface || 0, 'pozemek', 'pozem');
  const garden = cleanOutdoorArea(adv.frontGardenSurface || adv.gardenSurface || 0, adv.surface || 0, 'zahrada', 'zahrad');
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
  const text = stripHtml(html);
  const img = cleanImageUrl(meta(html, 'og:image'));
  const imgs = sautoGalleryImages(html, img);
  const brand = (title.split(/\s+/)[0] || '').toLowerCase();
  const kw = num((text.match(/(\d{2,3})\s*kW/i) || html.match(/"power"\s*:\s*(\d{2,3})/i) || [])[1]);
  const ps = kw ? Math.round(kw * 1.35962) : null;
  const km = num((text.match(/(?:tachometr|najeto)\D{0,24}([\d\s]+)\s*km/i) || desc.match(/tachometr\s*([\d\s]+)\s*km/i) || [])[1]);
  const czk = num((desc.match(/cena\s*([\d\s]+)\s*K[čc]/i) || text.match(/cena\D{0,20}([\d\s]{5,})\s*K[čc]/i) || html.match(/"price":\s*(\d{5,})/) || [])[1]);
  const made = (
    text.match(/(?:rok\s+v[ýy]roby|vyrobeno|prvn[ií]\s+registrace|uveden[ií]\s+do\s+provozu|v\s+provozu\s+od)\D{0,28}((?:0?[1-9]|1[0-2])\s*[/.]\s*(?:19|20)\d{2})/i)
    || text.match(/(?:rok\s+v[ýy]roby|vyrobeno|prvn[ií]\s+registrace|uveden[ií]\s+do\s+provozu|v\s+provozu\s+od)\D{0,28}((?:19|20)\d{2})/i)
    || []
  )[1] || '';
  const year = num((made.match(/(19|20)\d{2}/) || html.match(/"manufacturing_date"\s*:\s*"((?:19|20)\d{2})/) || [])[0]);
  const fuelM = text.match(/\b(Benzín|Nafta|Diesel|Elektro|Hybrid|LPG|CNG)\b/i);
  const fuel = fuelM ? fuelM[1].toLowerCase().replace('nafta', 'diesel').replace('benzín', 'benzin') : 'benzin';
  const awd = /\b(AWD|4x4|4×4|4WD|pohon\s+4)/i.test(title + ' ' + text);
  const transmission = (text.match(/\b(automat|manu[aá]l|DSG)\b/i) || [])[1] || '';
  const body = (text.match(/\b(SUV|kombi|sedan|hatchback|liftback|kup[eé]|MPV)\b/i) || [])[1] || '';
  const feats = [];
  const addIf = (re, label) => { if (re.test(title + ' ' + text) && !feats.includes(label)) feats.push(label); };
  addIf(/1\.\s*maj|prvn[ií]\s+majitel/i, '1. majitel');
  addIf(/servisn[ií]\s+kn/i, 'servisní knížka');
  addIf(/nehavar/i, 'nehavarované');
  addIf(/panorama|panoramat/i, 'panoramatická střecha');
  addIf(/navigac/i, 'navigace');
  addIf(/tempomat/i, 'tempomat');
  addIf(/\bLED\b|matrix/i, 'LED světla');
  addIf(/kamera/i, 'parkovací kamera');
  addIf(/parkovac[ií]\s+senzor/i, 'parkovací senzory');
  addIf(/vyh[řr][íi]van/i, 'vyhřívání');
  addIf(/ta[žz]n[eé]/i, 'tažné zařízení');
  addIf(/DPH/i, 'možný odpočet DPH');
  const variant = [body, transmission, awd ? '4×4' : 'FWD', fuel].filter(Boolean).join(' · ');
  return { section: 'auto', data: { brand, n: title, variant, stav: /ojet|použit/i.test(text) ? 'ojeté' : 'nové', made: normalizeMonthYear(made), year: year || new Date().getFullYear(), km: km || 0, fuel, body: [transmission, body].filter(Boolean).join(' · '), awd, kw: kw || 0, ps: ps || 0, czk: czk || null, img: imgs[0] || img, imgs, feats: feats.slice(0, 12), url } };
}

function parseGermanAuto(url, html) {
  const rawTitle = meta(html, 'og:title') || firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) || titleFromUrl(url);
  const title = decodeHtml(rawTitle)
    .replace(/\s+Neuwagen Angebot.*/i, '')
    .replace(/\s+\|\s+.*/i, '')
    .replace(/\s+-\s*$/, '')
    .trim() || titleFromUrl(url);
  const desc = meta(html, 'og:description');
  const text = stripHtml(html);
  const joined = `${title} ${desc} ${text}`;
  const imgs = imagesFrom(html, meta(html, 'og:image'), 36)
    .filter(u => !/fav|favicon|energieeffizienz|logo/i.test(u));
  const price = num(firstMatch(joined, [
    /Unser\s+Gesamtpreis\D{0,40}([\d.\s]+),?\d*\s*€/i,
    /Gesamtpreis\D{0,40}([\d.\s]+),?\d*\s*€/i,
    /Preis\D{0,40}([\d.\s]+),?\d*\s*€/i,
    /([\d.\s]{5,}),\d{2}\s*€/i
  ]));
  const km = num(firstMatch(joined, [
    /(?:Kilometerstand|Laufleistung|km-stand|Mileage)\D{0,28}([\d.\s]+)\s*km/i,
    /([\d.\s]{1,8})\s*km\b/i
  ]));
  const kw = num(firstMatch(joined, [
    /(\d{2,3})\s*kW\b/i,
    /Leistung\D{0,28}(\d{2,3})/i
  ]));
  const ps = num(firstMatch(joined, [/(\d{2,3})\s*(?:PS|HP)\b/i])) || (kw ? Math.round(kw * 1.35962) : null);
  const made = firstMatch(joined, [
    /(?:EZ|Erstzulassung|Zulassung|Baujahr|Neuzulassung)\D{0,36}((?:0?[1-9]|1[0-2])\s*[/.]\s*(?:19|20)\d{2})/i,
    /(?:EZ|Erstzulassung|Zulassung|Baujahr)\D{0,36}((?:19|20)\d{2})/i
  ]);
  const year = num((made.match(/(19|20)\d{2}/) || joined.match(/\b(20\d{2})\b/) || [])[0]);
  const fuel = normalizeFuel(firstMatch(joined, [/(Benzin|Diesel|Hybrid|Elektro|Electric|Petrol)/i]) || title);
  const transmission = firstMatch(joined, [/(Automatik|Schaltgetriebe|DCT7|DCT|AT)\b/i]);
  const body = firstMatch(joined, [/\b(SUV|Kombi|Limousine|Hatchback|Van|MPV)\b/i]) || (/CX-5|Sportage/i.test(title) ? 'SUV' : '');
  const awd = /\b(AWD|4x4|4×4|4WD|Allrad)\b/i.test(joined);
  const brand = (title.split(/\s+/)[0] || '').toLowerCase();
  const variant = [body, transmission, awd ? '4×4' : 'FWD', fuel].filter(Boolean).join(' · ');
  const isNew = /neuwagen|new car|tageszulassung/i.test(joined) && !/gebrauchtwagen|used/i.test(joined);
  return { section: 'auto', data: {
    brand, n: title, variant, stav: isNew ? 'nové' : 'ojeté',
    made: normalizeMonthYear(made), year: year || new Date().getFullYear(),
    km: km || 0, fuel, body: [transmission, body].filter(Boolean).join(' · '),
    awd, kw: kw || 0, ps: ps || 0, price: price || null, czk: null,
    img: imgs[0] || '', imgs, feats: autoFeatures(joined), url
  } };
}

function parseB2BAuto(url, html) {
  const title = titleFromUrl(url) || firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) || 'Auto z B2B showroomu';
  const cleanTitle = title.replace(/\bKia Kia\b/i, 'Kia').trim();
  const kw = num((cleanTitle.match(/(\d{2,3})\s*kW/i) || [])[1]);
  const fuel = normalizeFuel(cleanTitle);
  const transmission = firstMatch(cleanTitle, [/(DCT7|DCT|AT|Automat)/i]);
  const brand = (cleanTitle.split(/\s+/)[0] || '').toLowerCase();
  const feats = autoFeatures(cleanTitle);
  if (/ACC/i.test(cleanTitle) && !feats.includes('adaptivní tempomat')) feats.push('adaptivní tempomat');
  if (/KEYLESS/i.test(cleanTitle) && !feats.includes('keyless')) feats.push('keyless');
  const variant = [transmission, fuel].filter(Boolean).join(' · ');
  return { section: 'auto', data: {
    brand, n: cleanTitle, variant, stav: 'ojeté', made: '', year: new Date().getFullYear(),
    km: 0, fuel, body: transmission, awd: /\bAWD|4x4|4WD|Allrad\b/i.test(cleanTitle),
    kw: kw || 0, ps: kw ? Math.round(kw * 1.35962) : 0, price: null, czk: null,
    img: '', imgs: [], feats: feats.slice(0, 10), url
  } };
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
  if (/rahmen-automobile\.de/.test(host)) return parseGermanAuto(url, html);
  if (/b2b-fahrzeuge\.de/.test(host)) return parseB2BAuto(url, html);
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

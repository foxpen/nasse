import { json } from './_lib/http.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`, 'i'));
  return m ? m[1] : '';
};
const num = (s) => parseInt(String(s).replace(/[^\d]/g, ''), 10) || null;

function parseSreality(url, html) {
  const title = meta(html, 'og:title');
  const desc = meta(html, 'og:description');
  let img = meta(html, 'og:image');
  if (img.startsWith('//')) img = 'https:' + img;

  const t = /\/dum\//.test(url) ? 'dum' : 'byt';
  const area = num((title.match(/(\d[\d\s]*)\s*m²/) || [])[1]);
  const land = (title.match(/pozemek\s*([\d\s]+)\s*m²/i) || desc.match(/pozemek\s*([\d\s]+)\s*m²/i));
  const dispM = (title.match(/(\d\+(?:kk|1))/i) || desc.match(/(\d\+(?:kk|1))/i));
  const priceM = html.match(/"price":\s*(\d{5,})/) || desc.match(/([\d\s]{6,})\s*Kč/);
  const price = priceM ? num(priceM[1]) : null;
  const loc = (title.split(',').slice(-2).join(',').trim()) || title;
  const novostavba = /novostavba/i.test(desc);
  const vystavba = /ve výstavbě|projekt|v přípravě/i.test(desc + ' ' + html.slice(0, 4000));

  const featWords = ['sklep', 'garáž', 'parkování', 'zahrada', 'terasa', 'výtah', 'balkón', 'lodžie', 'bazén'];
  const feats = featWords.filter(w => new RegExp(w, 'i').test(desc));

  return {
    section: 'byd',
    data: {
      n: loc,
      t,
      disp: (t === 'dum' ? 'dům ' : 'byt ') + (dispM ? dispM[1] : ''),
      price,
      area,
      land: land ? 'pozemek ' + land[1].replace(/\s+/g, ' ').trim() + ' m²' : '',
      ready: vystavba ? 0 : 1,
      when: novostavba ? 'novostavba' : (vystavba ? 've výstavbě' : ''),
      en: '',
      car: 0,
      pt: 0,
      origin: loc.split('-')[0].trim(),
      img,
      feats: feats.length ? [feats.join(', ')] : [],
      url
    }
  };
}

function parseSauto(url, html) {
  const title = meta(html, 'og:title').replace(/\s*\|\s*Sauto\.cz.*/i, '').trim();
  const desc = meta(html, 'og:description');
  let img = meta(html, 'og:image');
  if (img.startsWith('//')) img = 'https:' + img;

  const brand = (title.split(/\s+/)[0] || '').toLowerCase();
  const kw = num((html.match(/(\d{2,3})\s*kW/) || [])[1]);
  const ps = kw ? Math.round(kw * 1.35962) : null;
  const km = num((desc.match(/tachometr\s*([\d\s]+)\s*km/i) || [])[1]);
  const czk = num((desc.match(/cena\s*([\d\s]+)\s*Kč/i) || html.match(/"price":\s*(\d{5,})/) || [])[1]);
  const year = num((html.match(/"manufacturing_date":"(\d{4})/) || desc.match(/(20\d{2})/) || [])[1]);
  const fuelM = desc.match(/\b(Benzín|Nafta|Diesel|Elektro|Hybrid)\b/i);
  const fuel = fuelM ? fuelM[1].toLowerCase().replace('nafta', 'diesel').replace('benzín', 'benzin') : 'benzin';
  const awd = /\b(AWD|4x4|4×4|4WD)\b/i.test(title + ' ' + desc);

  return {
    section: 'auto',
    data: {
      brand: ['mazda', 'kia', 'hyundai', 'jeep', 'škoda', 'skoda', 'volkswagen', 'toyota'].includes(brand) ? brand : brand,
      n: title,
      variant: (awd ? '4×4' : 'FWD') + ' · ' + (/ojet/i.test(desc) ? 'ojeté' : 'nové'),
      stav: /ojet/i.test(desc) ? 'ojeté' : 'nové',
      year: year || new Date().getFullYear(),
      km: km || 0,
      fuel,
      awd,
      kw: kw || 0,
      ps: ps || 0,
      czk: czk || null,
      img,
      feats: [],
      url
    }
  };
}

function parseBezrealitky(url, html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  let data = null;
  if (m) { try { data = JSON.parse(m[1]); } catch (e) { data = null; } }
  const idMatch = url.match(/\/(\d+)-/);
  const wantId = idMatch ? idMatch[1] : null;
  const objs = [];
  (function walk(o){ if (o && typeof o === 'object') { if (!Array.isArray(o)) objs.push(o); for (const k in o) walk(o[k]); } })(data);
  let adv = objs.find(o => String(o.id) === wantId && 'price' in o)
         || objs.find(o => 'price' in o && ('disposition' in o || 'estateType' in o));
  if (!adv) {
    let img2 = '';
    const im = html.match(/https:\/\/api\.bezrealitky\.cz\/media\/cache\/record_main\/[^"\\ ]+\.jpg/);
    if (im) img2 = im[0];
    return { section: 'byd', data: { n: '', t: 'dum', disp: '', price: null, area: 0, land: '', ready: 1, when: '', en: '', car: 0, pt: 0, origin: '', img: img2, feats: [], url } };
  }
  let img = '';
  const ref = adv.mainImage && adv.mainImage.__ref;
  for (const o of objs) {
    if (o.__typename === 'Image' && ('Image:' + o.id) === ref) {
      for (const k in o) { const v = o[k]; if (typeof v === 'string' && v.startsWith('http') && /record_main/.test(v)) { img = v; break; } }
    }
  }
  if (!img) { const im = html.match(/https:\/\/api\.bezrealitky\.cz\/media\/cache\/record_main\/[^"\\ ]+\.jpg/); if (im) img = im[0]; }
  const disp = String(adv.disposition || '').replace('DISP_', '').replace('_KK', '+kk').replace('_1', '+1').replace(/_/g, '+');
  const t = adv.estateType === 'DUM' ? 'dum' : 'byt';
  const condMap = { NOVOSTAVBA: 'Novostavba', VELMI_DOBRY: 'Velmi dobrý', PO_REKONSTRUKCI: 'Po rekonstrukci', DOBRY: 'Dobrý', VE_VYSTAVBE: 've výstavbě', K_REKONSTRUKCI: 'Před rekonstrukcí' };
  const when = condMap[adv.condition] || '';
  const en = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(adv.penb) ? adv.penb : '';
  const land = adv.surfaceLand;
  let city = '';
  for (const k in adv) { if (/^city/.test(k) && typeof adv[k] === 'string' && adv[k]) { city = adv[k]; break; } }
  if (!city) {
    const slug = (url.split('/').pop() || '').replace(/^\d+-/, '').replace(/^(nabidka-)?prodej-(domu|bytu|rodinneho-domu)-/, '');
    city = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  const feats = [];
  if (adv.terrace) feats.push('terasa');
  if (adv.garage) feats.push('garáž');
  if (adv.parking) feats.push('parkování');
  if (adv.cellar) feats.push('sklep');
  if (adv.frontGarden) feats.push('předzahrádka');
  if (adv.lift) feats.push('výtah');
  return { section: 'byd', data: {
    n: (city || 'Nemovitost') + (disp ? ' ' + disp : ''),
    t, disp: (t === 'dum' ? 'dům ' : 'byt ') + disp,
    price: adv.price || null, area: adv.surface || 0,
    land: land ? ('pozemek ' + land + ' m²' + (t === 'dum' ? ' · zahrada' : '')) : '',
    ready: when === 've výstavbě' ? 0 : 1, when, en, car: 0, pt: 0,
    origin: city || '', img, feats, url
  } };
}

function parseBazos(url, html) {
  const t = meta(html, 'og:title') || '';
  const desc = meta(html, 'og:description') || '';
  let img = meta(html, 'og:image') || '';
  if (img.startsWith('//')) img = 'https:' + img;
  const title = t.replace(/\s*-\s*[^-]+$/, '').trim() || t;
  const brand = (title.split(/\s+/)[0] || '').toLowerCase();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const priceM = desc.match(/Cena:\s*([\d\s .]+)\s*K[čc]/i) || text.match(/Cena:\s*([\d\s .]+)\s*K[čc]/i);
  const czk = priceM ? num(priceM[1]) : null;
  const kmM = text.match(/(?:najeto|nájezd|tachometr)[^0-9]{0,12}([\d][\d\s. ]{2,})\s*km/i) || text.match(/([\d][\d\s. ]{3,})\s*km\b/i);
  const km = kmM ? num(kmM[1]) : 0;
  const yM = text.match(/(?:rok|r\.?\s?v\.?|výrob[ay])[^\d]{0,10}((?:19[789]|20[012])\d)/i) || text.match(/\b(20[0-2]\d)\b/);
  const year = yM ? num(yM[1]) : 0;
  const fM = text.match(/\b(benz[ií]n|nafta|diesel|hybrid|plug[- ]?in|elektro|lpg|cng)\b/i);
  let fuel = fM ? fM[1].toLowerCase() : 'benzin';
  fuel = fuel.replace('nafta', 'diesel').replace('benzín', 'benzin').replace(/plug.?in/, 'hybrid');
  const kwM = text.match(/(\d{2,3})\s*kW\b/i);
  const kw = kwM ? num(kwM[1]) : 0;
  const ps = kw ? Math.round(kw * 1.35962) : 0;
  const awd = /\b(4x4|4motion|quattro|awd|xdrive|4wd)\b/i.test(t + ' ' + text);
  return { section: 'auto', data: {
    brand, n: title, variant: '', stav: 'ojeté', year, km, fuel, awd, kw, ps,
    czk: czk || null, price: null, img, feats: [], url
  } };
}

export async function handler(event) {
  try {
    const url = event.queryStringParameters?.url;
    if (!url || !/^https?:\/\//.test(url)) return json(400, { error: 'missing url' });
    const host = new URL(url).hostname;

    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs,en' } });
    if (!res.ok) return json(502, { error: 'zdroj nedostupný (' + res.status + ') — vyplň ručně', source: host });
    const html = await res.text();

    if (/sreality\.cz/.test(host)) return json(200, parseSreality(url, html));
    if (/sauto\.cz/.test(host)) return json(200, parseSauto(url, html));
    if (/bezrealitky\.cz/.test(host)) return json(200, parseBezrealitky(url, html));
    if (/bazos\.cz/.test(host)) return json(200, parseBazos(url, html));
    return json(422, { error: 'tento web extraktor neumí (zkus sreality.cz / sauto.cz / bezrealitky.cz / bazos.cz, jinak vyplň ručně)', source: host });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

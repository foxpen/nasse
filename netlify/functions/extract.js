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
    return json(422, { error: 'tento web extraktor neumí (zkus sreality.cz / sauto.cz, jinak vyplň ručně)', source: host });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

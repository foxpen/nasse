const str = value => String(value ?? '').trim();
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function cleanUrl(value) {
  const raw = str(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function cleanList(value) {
  return Array.isArray(value) ? value.map(v => str(v)).filter(Boolean).slice(0, 12) : [];
}

function cleanUrls(value) {
  return Array.isArray(value) ? [...new Set(value.map(cleanUrl).filter(Boolean))].slice(0, 30) : [];
}

export function cleanListing(section, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  if (section === 'byd') {
    const out = {
      ...data,
      n: str(data.n),
      t: data.t === 'dum' ? 'dum' : 'byt',
      disp: str(data.disp),
      price: num(data.price),
      area: num(data.area) || 0,
      land: str(data.land),
      plotArea: num(data.plotArea) || 0,
      gardenArea: num(data.gardenArea) || 0,
      terrace: Boolean(data.terrace),
      balcony: Boolean(data.balcony),
      garage: Boolean(data.garage),
      parking: Boolean(data.parking),
      ready: data.ready ? 1 : 0,
      when: str(data.when),
      en: str(data.en).slice(0, 4),
      car: num(data.car) || 0,
      pt: num(data.pt) || 0,
      origin: str(data.origin),
      img: cleanUrl(data.img),
      imgs: cleanUrls(data.imgs),
      feats: cleanList(data.feats),
      url: cleanUrl(data.url),
      note: str(data.note)
    };
    return out.n && out.price && out.area ? out : null;
  }

  if (section === 'auto') {
    const out = {
      ...data,
      brand: str(data.brand).toLowerCase(),
      n: str(data.n),
      variant: str(data.variant),
      stav: str(data.stav) || 'ojeté',
      year: num(data.year) || new Date().getFullYear(),
      km: num(data.km) || 0,
      fuel: str(data.fuel),
      awd: Boolean(data.awd),
      kw: num(data.kw) || 0,
      ps: num(data.ps) || 0,
      price: num(data.price),
      czk: num(data.czk),
      img: cleanUrl(data.img),
      imgs: cleanUrls(data.imgs),
      feats: cleanList(data.feats),
      url: cleanUrl(data.url),
      note: str(data.note)
    };
    return out.n && (out.price || out.czk) ? out : null;
  }

  return null;
}

export function cleanPatch(patch) {
  const out = {};
  if ('n' in patch) out.n = str(patch.n);
  if ('t' in patch) out.t = patch.t === 'dum' ? 'dum' : 'byt';
  if ('disp' in patch) out.disp = str(patch.disp);
  if ('price' in patch) out.price = num(patch.price);
  if ('area' in patch) out.area = num(patch.area) || 0;
  if ('land' in patch) out.land = str(patch.land);
  if ('plotArea' in patch) out.plotArea = num(patch.plotArea) || 0;
  if ('gardenArea' in patch) out.gardenArea = num(patch.gardenArea) || 0;
  if ('terrace' in patch) out.terrace = Boolean(patch.terrace);
  if ('balcony' in patch) out.balcony = Boolean(patch.balcony);
  if ('garage' in patch) out.garage = Boolean(patch.garage);
  if ('parking' in patch) out.parking = Boolean(patch.parking);
  if ('ready' in patch) out.ready = patch.ready ? 1 : 0;
  if ('origin' in patch) out.origin = str(patch.origin);
  if ('img' in patch) out.img = cleanUrl(patch.img);
  if ('imgs' in patch) out.imgs = cleanUrls(patch.imgs);
  if ('feats' in patch) out.feats = cleanList(patch.feats);
  if ('url' in patch) out.url = cleanUrl(patch.url);
  if ('flags' in patch) out.flags = cleanList(patch.flags).filter(v => ['favorit', 'prohlidka', 'po', 'zamitnuto'].includes(v));
  if ('dealPrice' in patch) out.dealPrice = num(patch.dealPrice);
  if ('note' in patch) out.note = str(patch.note);
  if ('car' in patch) out.car = num(patch.car) || 0;
  if ('pt' in patch) out.pt = num(patch.pt) || 0;
  if ('commuteDest' in patch) out.commuteDest = str(patch.commuteDest);
  if ('lat' in patch) out.lat = num(patch.lat);
  if ('lon' in patch) out.lon = num(patch.lon);
  if ('en' in patch) out.en = str(patch.en).slice(0, 4);
  if ('when' in patch) out.when = str(patch.when);
  return out;
}

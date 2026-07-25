import { sql } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';
import { json } from './_lib/http.js';

const PROPS = [
  {n:"Nymburk, K Lesu", t:"byt", disp:"byt 3+kk", price:7980000, area:71, land:"zahrada 79 m²", ready:1, when:"hotovo · novostavba", en:"B", car:50, pt:80, origin:"Nymburk, K Lesu", img:"img/nymburk.jpg", feats:["sklep, výtah, 2 terasy","bezbariérový vstup"], url:"https://www.sreality.cz/detail/prodej/byt/3+kk/nymburk-nymburk-k-lesu/38028108"},
  {n:"Hlízov (u Kutné Hory)", t:"dum", disp:"dům 4+kk", price:8396320, area:94, land:"pozemek 209 / zahr. 143 m²", ready:1, when:"novostavba 2024", en:"B", car:65, pt:110, origin:"Hlízov", img:"img/hlizov.jpg", feats:["tep. čerpadlo + podlah. topení","provize + právní služby v ceně"], url:"https://www.sreality.cz/detail/prodej/dum/rodinny/hlizov-hlizov-/407994444"},
  {n:"Králův Dvůr — Levín", t:"byt", disp:"3+kk · 1/3 řadovky", price:8699000, area:80, land:"zahrada 140 m²", ready:1, when:"jako nová", en:"B", car:35, pt:65, origin:"Králův Dvůr, Větrná", img:"img/kraluvdvur.jpg", feats:["2 parkovací místa","~2 km Beroun, ~25 km Praha"], url:"https://www.sreality.cz/detail/prodej/byt/3+kk/kraluv-dvur-levin-vetrna/2757694284"},
  {n:"Mělník, Pod Chloumečkem", t:"dum", disp:"dům 4+kk · dvojdomek", price:8790000, area:79, land:"pozemek 333 m²", ready:0, when:"ve výstavbě · 2026", en:"G*", car:40, pt:75, origin:"Mělník, Pod Chloumečkem", img:"img/melnik.jpg", feats:["příprava FVE + wallbox","2 parkovací místa"], url:"https://www.sreality.cz/detail/prodej/dum/rodinny/melnik-melnik-pod-chloumeckem/2291920972"},
  {n:"Pečky, Letohradská", t:"byt", disp:"byt 3+kk", price:8797500, area:71, land:"zahrada až 212 m²", ready:0, when:"ve výstavbě · 2027", en:"G*", car:45, pt:65, origin:"Pečky, Letohradská", img:"img/pecky.jpg", feats:["velká zahrada, sklep","rekuperace + příprava na EV"], url:"https://www.sreality.cz/detail/prodej/byt/3+kk/pecky-pecky-letohradska/1506517068"},
  {n:"Brandýs n. Labem", t:"byt", disp:"byt 3+kk", price:9290000, area:75, land:"zahrada 67 m²", ready:1, when:"novostavba 2021 · 7/2026", en:"B", car:35, pt:65, origin:"Brandýs nad Labem, Seifertova", img:"img/brandys.jpg", feats:["garáž v suterénu","sklep, terasa, výtah"], url:"https://www.sreality.cz/detail/prodej/byt/3+kk/brandys-nad-labem-stara-boleslav-brandys-nad-labem-seifertova/4115431500"},
  {n:"Bukovany (Benešovsko)", t:"dum", disp:"dům 4+kk · řadovka", price:9999000, area:106, land:"pozemek 150 m²", ready:1, when:"novostavba 2022", en:"A", car:50, pt:90, origin:"Bukovany u Benešova", img:"img/bukovany.jpg", feats:["pasivní standard, zařízený","lze rozšířit na 5+kk"], url:"https://www.sreality.cz/detail/prodej/dum/rodinny/bukovany-bukovany-/2288403276"},
  {n:"Dolní Beřkovice — Podvlčí", t:"dum", disp:"dům 4+kk · řadový", price:8500000, area:99, land:"pozemek 1000 m²", ready:1, when:"novostavba · hotové", en:"B", car:45, pt:85, origin:"Dolní Beřkovice", img:"img/dolni-berkovice.jpg", feats:["velký pozemek 1000 m², sklep","cena vč. provize + práv. servisu"], url:"https://www.sreality.cz/detail/prodej/dum/rodinny/dolni-berkovice-podvlci-/1606042444"},
  {n:"Mukařov — Srbín, Akátová", t:"dum", disp:"dům 3+kk · řadový", price:9990000, area:82, land:"pozemek 123 m² · zahrada", ready:1, when:"novostavba · hotové", en:"B", car:35, pt:60, origin:"Mukařov, Srbín", img:"img/mukarov-srbin.jpg", feats:["zahrada, parkování","cena vč. provize + práv. služeb","~25 km na východ od Prahy"], url:"https://www.sreality.cz/detail/prodej/dum/rodinny/mukarov-srbin-akatova/497852492"}
];

const CARS = [
  {brand:"kia", n:"Kia Sportage 1.6T 48V Vision Komfort", variant:"FWD · 1 maj. · 48V mild-hybrid · ★ vítěz ojetých", stav:"ojeté", year:2023, km:34000, fuel:"benzin", awd:false, kw:110, ps:150, price:24996, win:true, feats:["1 majitel, 34 tis. km, hned","7letá záruka do 04/2030 (kryje turbo/DCT)"], url:""},
  {brand:"kia", n:"Kia Sportage 1.6 T-GDI Vision", variant:"FWD · 2 maj. · Vision", stav:"ojeté", year:2023, km:58000, fuel:"benzin", awd:false, kw:110, ps:150, price:24999, feats:["spotřeba 5,7 l, 3-zón. klima","⚠️ 58 tis. km, 2 majitelé"], url:""},
  {brand:"jeep", n:"Jeep Compass 1.5 mHEV Summit", variant:"FWD · Summit (top výbava)", stav:"ojeté", year:2025, km:16690, fuel:"hybrid", awd:false, kw:96, ps:131, price:25000, feats:["top výbava, nízký nájezd","⚠️ 131 PS nejslabší, Stellantis"], url:""},
  {brand:"hyundai", n:"Hyundai Tucson 1.6 T-GDI Trend (Panorama)", variant:"4×4 · panorama", stav:"ojeté", year:2023, km:31000, fuel:"benzin", awd:true, kw:132, ps:179, price:25000, feats:["179 PS, panoramatická střecha","❌ 4×4 — nepotřebuješ"], url:"https://suchen.mobile.de/fahrzeuge/details.html?id=454549301"},
  {brand:"hyundai", n:"Hyundai Tucson 1.6 T-GDI Trend", variant:"FWD · 1 maj. (T1)", stav:"ojeté", year:2025, km:25562, fuel:"benzin", awd:false, kw:118, ps:160, price:null, feats:["160 PS, FWD, hned","⚠️ cena neuvedena"], url:"https://x.b2b-fahrzeuge.de/2209/Kia/Kia-Sportage-1-6T-GDI-DCT7-NAVI-KAM/68ded912fac0cfddf80bc614"},
  {brand:"hyundai", n:"Hyundai Tucson 1.6 T-GDI Trend", variant:"4×4 · 1 maj. (T2)", stav:"ojeté", year:2025, km:14756, fuel:"benzin", awd:true, kw:118, ps:160, price:29999, feats:["nízký nájezd 14,7 tis.","❌ 4×4 — nepotřebuješ"], url:"https://x.b2b-fahrzeuge.de/2209/Kia/Kia-Sportage-1-6-T-GDI-DCT7-ACC-KEYLESS/68a62676fe771908380a9f6f"},
  {brand:"mazda", n:"Mazda CX-5 e-Skyactiv-G 141 Prime-Line", variant:"FWD · nová · základ", stav:"nové", year:2025, km:15, fuel:"benzin", awd:false, kw:104, ps:141, price:null, feats:["skladem hned","⚠️ ověřit klimatizaci (bez ní)"], url:"https://suchen.mobile.de/fahrzeuge/details.html?id=457164408"},
  {brand:"mazda", n:"Mazda CX-5 e-Skyactiv-G 141 Exclusive-Line", variant:"FWD · nová · 48V", stav:"nové", year:2025, km:0, fuel:"benzin", awd:false, kw:104, ps:141, price:29900, feats:["Bose, kůže na volantu, 2-zón. klima","dodání ~5 měsíců"], url:"https://rahmen-automobile.de/fahrzeuge/alle-angebote/Mazda-CX-5-e-Skyactiv-G-141-48V-AT--Exclusive-Line_120-106805"},
  {brand:"mazda", n:"Mazda CX-5 Exclusive-Line AWD", variant:"4×4 · nová · 48V", stav:"nové", year:2025, km:0, fuel:"benzin", awd:true, kw:104, ps:141, price:31490, feats:["4×4","umělá kůže, 12,9\" displej"], url:"https://rahmen-automobile.de/fahrzeuge/alle-angebote/Mazda-CX-5-e-Skyactiv-G-141-48V-AT-AWD-Exclusive-Line_120-106808"},
  {brand:"mazda", n:"Mazda CX-5 Homura 48V", variant:"FWD · nová · top výbava", stav:"nové", year:2025, km:0, fuel:"benzin", awd:false, kw:104, ps:141, price:31500, feats:["pravá kůže, ventilace sedaček","15,6\" Google displej, adapt. LED"], url:"https://rahmen-automobile.de/fahrzeuge/alle-angebote/Mazda-CX-5-e-Skyactiv-G-141-48V-AT-Homura_120-106806"},
  {brand:"mazda", n:"Mazda CX-5 Homura AWD", variant:"4×4 · nová · top výbava", stav:"nové", year:2025, km:0, fuel:"benzin", awd:true, kw:104, ps:141, price:32990, feats:["4×4 + top výbava (jediná)","tan kůže, ventilace sedaček"], url:"https://rahmen-automobile.de/fahrzeuge/alle-angebote/Mazda-CX-5-e-Skyactiv-G-141-48V-AT-AWD-Homura_120-106809"},
  {brand:"mazda", n:"Mazda CX-5 Homura (nakonfig.)", variant:"FWD · nová · top + příplatky", stav:"nové", year:2025, km:0, fuel:"benzin", awd:false, kw:104, ps:141, price:34590, feats:["bohatě nakonfig. (pano/lak)","⚠️ nejdražší FWD Homura"], url:"https://rahmen-automobile.de/fahrzeuge/alle-angebote/Mazda-CX-5-e-Skyactiv-G-141-48V-AT-Homura_120-105061M"},
  {brand:"mazda", n:"Mazda CX-5 2.5i AWD Homura", variant:"4×4 · ojeté · ČR (Beroun)", stav:"ojeté", year:2024, km:42000, fuel:"benzin", awd:true, kw:142, ps:193, czk:789900, img:"img/auta/mazda-cx5-sauto.jpg", feats:["2.5 atmosféra 193 PS (silná, bez turba)","Bose, kůže, 360° kamera · česká nabídka"], url:"https://www.sauto.cz/osobni/detail/mazda/cx-5/210620069"}
];

export async function handler(event) {
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  if (event.queryStringParameters?.confirm !== 'seed') {
    return json(403, { error: 'Seed je zamknuty. Spust ho jen vedome s ?confirm=seed.' });
  }
  try {
    const force = event.queryStringParameters?.force === '1';
    // vytvoří tabulku, pokud ještě není (nemusíš spouštět schema.sql ručně)
    await sql`CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      section TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_listings_section ON listings(section)`;

    const counts = await sql`SELECT section, COUNT(*)::int AS c FROM listings GROUP BY section`;
    const bySection = Object.fromEntries(counts.map(r => [r.section, r.c]));
    if ((bySection.byd || 0) > 0 && (bySection.auto || 0) > 0 && !force) {
      return json(200, { ok: true, skipped: true, counts: bySection, message: 'DB už obsahuje obě sekce (přidej ?force=1 pro doplnění)' });
    }
    let insertedByd = 0, insertedAuto = 0;
    if (force || !(bySection.byd > 0)) {
      for (const p of PROPS) { await sql`INSERT INTO listings (section, data) VALUES ('byd', ${p})`; insertedByd++; }
    }
    if (force || !(bySection.auto > 0)) {
      for (const c of CARS) { await sql`INSERT INTO listings (section, data) VALUES ('auto', ${c})`; insertedAuto++; }
    }
    return json(200, { ok: true, counts: bySection, inserted: { byd: insertedByd, auto: insertedAuto } });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

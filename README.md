<p align="center"><img src="img/logo.png" alt="Naše — dlaně nesoucí tři barevné tečky" width="480"></p>

# Naše Bydleníčko

Soukromá webová aplikace pro výběr a porovnávání nemovitostí a aut. Běží jako statický frontend na Netlify, data drží v Neon Postgres a praktické věci kolem importu, dojezdu, aktualizací a fotek řeší Netlify Functions.

Aktuální verze: `1.5.0`.

## Co umí

- správa vlastního shortlistu domů, bytů a aut,
- hromadné mazání vybraných nemovitostí i aut s potvrzovacím modalem,
- Autíčko má vlastní skóre, detail s galerií, TOP metriky podle roku, nájezdu a výkonu a aktualizaci inzerátů s ověřením a mazáním nenalezených odkazů,
- Autíčko počítá orientační měsíční náklady podle ročního nájezdu, paliva, servisu, pojištění, pneumatik a dálniční známky,
- import nemovitostí ze `sreality.cz` a `bezrealitky.cz`,
- hledání nových inzerátů podle uloženého filtru („Hledat nové") — nemovitosti na sreality.cz, auta na sauto.cz; nové nabídky se rovnou uloží a zduplikované odkazy se přeskočí,
- import aut ze `sauto.cz`, `bazos.cz`, `rahmen-automobile.de` a základní fallback pro B2B showroom `b2b-fahrzeuge.de`,
- samostatná pole pro adresu, název, užitnou plochu, pozemek, zahradu, terasu, balkon/lodžii, garáž, parkování, PENB, stav a kontakt,
- deduplikovaná galerie fotek v detailu, šipky mezi fotkami a proxy cache obrázků přes Netlify funkci,
- detail nemovitosti jako rozhodovací panel s fotkami, plusy, riziky, financemi, dojezdem a mapou,
- mapa nemovitostí s body podle skóre a dopočtem chybějících souřadnic,
- hypotéční kalkulačka s fixací, úrokem, dobou, procentem půjčky a pojištěním,
- automatický přepočet měsíční splátky na kartách,
- uložené cíle dojezdu, našeptávač adres přes Mapy API a ruční přepočet po kliknutí,
- Google Maps odkazy na trasu autem i MHD,
- porovnávací režim až pro 3 nemovitosti,
- tabulka s řazením podle sloupců,
- aktualizace inzerátů a mazání nenalezených nabídek,
- sjednocený přepínač světlého, tmavého a systémového motivu,
- jednoduché heslo před vstupem do aplikace.

## Architektura

```text
statické HTML/CSS/JS
        |
        v
Netlify Functions
        |
        v
Neon Postgres: listings(id, section, data jsonb, created_at)
```

Frontend je bez build kroku. Hlavní soubory:

- `index.html` - vstup a rozcestník,
- `bydleni.html` - aplikace pro nemovitosti,
- `auta.html` - aplikace pro auta,
- `app-utils.js` - sdílené helpery,
- `styles.css` - sdílené styly,
- `sw.js` - klientská cache fotek z `image-proxy`,
- `netlify/functions/*` - API funkce,
- `db/schema.sql` - základní DB schema.

## Netlify Functions

Vybrané funkce:

- `list` - načtení nabídek,
- `add` - přidání nabídky,
- `update` - uložení úprav,
- `delete` - smazání,
- `extract` - import dat z inzerátu,
- `refresh-listings` - aktualizace uložených inzerátů,
- `search-listings` - hledání nových nemovitostí na sreality.cz podle filtru,
- `search-cars` - hledání nových aut na sauto.cz podle filtru,
- `delete-not-found` - smazání nenalezených inzerátů,
- `commute` - přepočet dojezdu,
- `recompute-commute` - dávkový přepočet dojezdů,
- `address-suggest` - našeptávač adres,
- `image-proxy` - proxy/cache fotek z inzerátu.

## Proměnné prostředí

| Proměnná | Povinná | Popis |
| --- | --- | --- |
| `DATABASE_URL` nebo `NETLIFY_DATABASE_URL` | ano | Postgres connection string |
| `APP_PASSWORD` nebo `NASE_PASSWORD` | ano | heslo do aplikace |
| `AUTH_SECRET` | doporučeno | podpis přihlašovací cookie |
| `MAPY_API_KEY` | doporučeno | geokódování, našeptávač a auto dojezd |
| `GOOGLE_MAPS_API_KEY` | volitelné | připraveno pro případné přesnější Google routování |

API klíče nikdy necommituj do repozitáře. Na Netlify patří do Environment variables. Pro Seznam/Mapy použij `MAPY_API_KEY`; používá se pro Mapy.com geokódování, našeptávač a routing. Importy Sauto/Sreality/Bezrealitky běží přes parser stránky, ne přes uložený veřejný klíč v kódu.

## Lokální spuštění

```powershell
npm install
npx netlify dev
```

Pro lokální běh nastav `.env` nebo env proměnné stejně jako na Netlify.

## Deploy

Projekt je připravený na Netlify. Build command zůstává prázdný a publish directory je `.`.

Ruční deploy:

```powershell
npx netlify deploy --prod --dir .
```

## Poznámky k importu fotek

Fotky se ukládají jako původní URL z inzerátu, ale aplikace je zobrazuje přes `image-proxy`. Tím se sníží závislost UI na hotlinku, obrázky se cacheují na Netlify/CDN i v prohlížeči přes `sw.js` a duplicity z galerie se filtrují podle URL bez velikostních parametrů. Import navíc zahazuje typická loga, avatary, placeholdery a statické obrázky webu.

Není to plnohodnotné trvalé úložiště souborů. Pokud má být každá fotka fyzicky uložená a mazaná spolu s nemovitostí, další krok je přidat objektové úložiště typu Cloudinary, Uploadcare, S3/R2 nebo Supabase Storage.

## Co je dobré vědět

- MHD čas je dnes kombinace dostupných dat a fallbacku na Google Maps odkaz; pro přesné živé MHD by dávalo smysl přidat placené Google Routes API.
- Mapy.com API se používá pro geokódování a auto trasu, odkazy pro uživatele vedou do Google Maps.

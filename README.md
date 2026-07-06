# Nase Bydlenicko

Soukroma webova aplikace pro vyber a porovnavani nemovitosti. Bezi jako staticky frontend na Netlify, data drzi v Neon Postgres a prakticke veci kolem importu, dojezdu a refreshu resi Netlify Functions.

Aktualni verze: `1.2.2`.

## Co umi

- sprava vlastniho shortlistu domu a bytu,
- import z `sreality.cz` a `bezrealitky.cz`,
- samostatne pole pro adresu, nazev, uzitnou plochu, pozemek, zahradu, terasu, balkon/lodzii, garaz, parkovani, PENB, stav a kontakt,
- galerie fotek v detailu, sipky mezi fotkami a proxy cache obrazku pres Netlify funkci,
- deduplikace fotek z importu a klientska cache `image-proxy` odpovedi pres service worker,
- detail nemovitosti s mapou, trasou autem, trasou MHD a odkazem na puvodni inzerat,
- detail nemovitosti jako rozhodovaci panel s plusy, riziky, financemi, dojezdem a mapou,
- hypotecni kalkulacka s fixaci, urokem, dobou, procentem pujcky a pojistenim,
- automaticky prepocet mesicni splatky na kartach,
- ulozene cile dojezdu, naseptavac adres pres Mapy API a rucni prepocet po kliknuti,
- Google Maps odkazy na trasu autem i MHD,
- mapa nemovitosti s body podle score,
- porovnavaci rezim az pro 3 nemovitosti,
- tabulka s razenim podle sloupcu,
- refresh inzeratu a mazani nenalezenych nabidek,
- jednoduche heslo pred vstupem do aplikace.

## Architektura

```text
staticke HTML/CSS/JS
        |
        v
Netlify Functions
        |
        v
Neon Postgres: listings(id, section, data jsonb, created_at)
```

Frontend je bez build kroku. Hlavni soubory:

- `index.html` - vstup a rozcestnik,
- `bydleni.html` - hlavni aplikace pro nemovitosti,
- `auta.html` - starsi sekce pro auta,
- `styles.css` - sdilene styly,
- `sw.js` - klientska cache fotek z `image-proxy`,
- `netlify/functions/*` - API funkce,
- `db/schema.sql` - zakladni DB schema.

## Netlify Functions

Vybrane funkce:

- `list` - nacteni nabidek,
- `add` - pridani nabidky,
- `update` - ulozeni uprav,
- `delete` - smazani,
- `extract` - import dat z inzeratu,
- `refresh-listings` - aktualizace ulozenych inzeratu,
- `delete-not-found` - smazani nenalezenych inzeratu,
- `commute` - prepocet dojezdu,
- `address-suggest` - naseptavac adres,
- `image-proxy` - proxy/cache fotek z inzeratu.

## Promenne prostredi

| Promenna | Povinna | Popis |
| --- | --- | --- |
| `DATABASE_URL` nebo `NETLIFY_DATABASE_URL` | ano | Postgres connection string |
| `APP_PASSWORD` nebo `NASE_PASSWORD` | ano | heslo do aplikace |
| `AUTH_SECRET` | doporuceno | podpis prihlasovaci cookie |
| `MAPY_API_KEY` | doporuceno | geokodovani, naseptavac a auto dojezd |
| `GOOGLE_MAPS_API_KEY` | volitelne | pripraveno pro pripadne presnejsi Google routovani |

## Lokalni spusteni

```powershell
npm install
npx netlify dev
```

Pro lokalni beh nastav `.env` nebo env promenne stejne jako na Netlify.

## Deploy

Projekt je pripraveny na Netlify. Build command zustava prazdny a publish directory je `.`.

Rucni deploy:

```powershell
npx netlify deploy --prod --dir .
```

## Poznamky k importu fotek

Fotky se ukladaji jako puvodni URL z inzeratu, ale aplikace je zobrazuje pres `image-proxy`. Tim se snizi zavislost UI na hotlinku, obrazky se cacheuji na Netlify/CDN i v prohlizeci pres `sw.js` a duplicity z galerie se filtruji podle URL bez velikostnich parametru. Import navic zahazuje typicka loga, avatary, placeholdery a staticke obrazky webu.

Neni to plnohodnotne trvale uloziste souboru. Pokud ma byt kazda fotka fyzicky ulozena a mazana spolu s nemovitosti, dalsi krok je pridat objektove uloziste typu Cloudinary, Uploadcare, S3/R2 nebo Supabase Storage.

## Co je dobre vedet

- MHD cas je dnes kombinace dostupnych dat a fallbacku na Google Maps odkaz; pro presne zive MHD by davalo smysl pridat placene Google Routes API.
- Mapy.com API se pouziva pro geokodovani a auto trasu, odkazy pro uzivatele vedou do Google Maps.

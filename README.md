# Naše 🏠🚗

Soukromá webová appka na **výběr nemovitosti a auta** pod jednou střechou. Jedno místo, kde si rodina drží shortlist nabídek, porovnává je, počítá hypotéku, dojezd a značkuje stav (prohlídka domluvená, usmlouvaná cena…).

- **Naše Bydleníčko** — nemovitosti: cena, m², cena/m², dojezd autem, hypoteční splátka, poznámky, stavové štítky, domluvená cena, záložka „K roztřídění" pro kandidáty.
- **Naše Autíčko** — auta: cena (Kč/€), rok, najeto, výkon, palivo, poznámky.
- **Rozcestník** (`index.html`) — výběr sekce.

Statický frontend (HTML/CSS/JS, bez build kroku) + **Netlify Functions** (serverless) + **Neon Postgres**. Vše běží zdarma na free tierech.

---

## Co appka umí
- **Hledání na portálech podle kritérií** — zadáš cenu, plochu, dispozice, stav, kraje a **maximální dojezd autem**, dáš Projet a appka projede **sreality.cz, bezrealitky.cz i bazoš**, spočítá dojezd, oboduje shodu (0 až 100) a nejlepší nálezy uloží do „K roztřídění". Viz [Hledání](#-hledání-na-portálech).
- Přidávání přes **odkaz** s auto-extraktorem (sreality.cz, bezrealitky.cz, sauto.cz, bazoš, mobil.de) + ruční fallback.
- **Hypoteční kalkulačka** (úrok / doba / akontace / pojištění) — splátka u každé nemovitosti, živě.
- **Dojezd autem** na zvolené místo (Mapy.com s klíčem, jinak zdarma přes OSM).
- **Mazání**, **poznámky**, **stavové štítky** (⭐ favorit, 📅 prohlídka, ✓ po prohlídce, ✕ zamítnuto) a **domluvená cena** (přepočítá splátku i cenu/m²).
- Záložky **Naše** / **K roztřídění** (kandidáti se skóre).
- Filtrování, řazení, srovnávací tabulka, dark mode, mobil.

---

## Architektura

```
Neon Postgres  (tabulka `listings`: id, section, data jsonb, created_at)
      ▲
Netlify Functions (Node ESM, /netlify/functions/*)
   list · add · delete · update · note · status · seed · recompute-commute
   extract        (jeden inzerát z odkazu)
   search         (stránka výsledků z portálu, adaptéry v _lib/sources.js)
   commute        (dojezd jedné adresy nebo GPS, i geokódování)
   commute-batch  (dojezd pro dávku nálezů; geokódování a trasy v _lib/route.js)
      ▲  fetch /.netlify/functions/*
public (statické): index.html · bydleni.html · auta.html · styles.css · img/
```

Vše je v jedné tabulce `listings`. Typ řeší `section` (`byd` / `auto`), zbytek je v `data` (JSONB) — žádné migrace při přidání pole. „K roztřídění" = řádky s `data.status = "candidate"`.

---

## 🚀 Zprovoznění pro sebe

### Co to obecně potřebuje (nezávisle na konkrétní službě)
1. **Postgres databáze** — kdekoli (Neon, Supabase, Railway, Render, vlastní Postgres…). Její connection string dáš do proměnné prostředí (`DATABASE_URL`, případně `NETLIFY_DATABASE_URL`).
2. **Hosting, který servíruje statické soubory + umí serverless funkce** (Netlify, Vercel, Cloudflare Pages…), nebo vlastní malý Node server.
3. **Vytvořit tabulku** `listings` z `db/schema.sql` — funguje na jakémkoli Postgresu.
4. *(volitelně)* **API klíč na mapy** pro auto-výpočet dojezdu (Mapy.com).

Proměnné prostředí:

| Proměnná | Povinná? | K čemu |
|---|---|---|
| `DATABASE_URL` *(nebo `NETLIFY_DATABASE_URL`)* | **ano** | připojení k Postgresu |
| `MAPY_API_KEY` | volitelná | dojezd autem přes [api.mapy.com](https://api.mapy.com) (free) |

> **Dojezd bez klíče:** když `MAPY_API_KEY` chybí, počítá se dojezd přes veřejné OSM služby
> (Photon pro adresy, OSRM pro trasy). Funguje to zdarma a bez registrace, ale je to bez záruky
> dostupnosti a časy bývají o pár minut pesimističtější. S klíčem od Mapy.com je to spolehlivější.

> Funkce čtou DB z `process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL` (viz `netlify/functions/_lib/db.js`).

---

### 📦 Příklad: Netlify + Neon (nejjednodušší, doporučeno)
Tohle je konkrétní postup pro nejrychlejší rozjezd. Klidně použij jinou DB/hosting (viz níže).

1. **Repo:** forkni / naklonuj tenhle repozitář na svůj GitHub.
2. **DB (Neon):** na [neon.tech](https://neon.tech) vytvoř projekt a zkopíruj **pooled** connection string (obsahuje `-pooler`, např. `postgresql://user:pass@ep-xxx-pooler.<region>.neon.tech/neondb?sslmode=require`).
3. **Deploy (Netlify):** [netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → vyber repo. Build command **prázdný**, **Publish directory = `.`** (je v `netlify.toml`), funkce se najdou v `netlify/functions`.
4. **Env:** Netlify → Site configuration → Environment variables → přidej `NETLIFY_DATABASE_URL` (= Neon string) a volitelně `MAPY_API_KEY`. Pak **Deploys → Trigger deploy**.
5. **Tabulka + data:**
   - *prázdný start:* v Neon SQL editoru spusť `db/schema.sql`;
   - *nebo s ukázkovými daty:* otevři jednou `https://<tvuj-web>.netlify.app/.netlify/functions/seed` (vytvoří tabulku i naimportuje ukázkový shortlist, který pak smažeš/upravíš).

Hotovo — appka jede na `https://<tvuj-web>.netlify.app`. 🎉

---

### 🔁 Chci to jinde (Vercel / Cloudflare / vlastní server / jiná DB)
Jádro je přenositelné, jen je potřeba pár úprav:
- **DB:** jakýkoli Postgres — nastav `DATABASE_URL`. (Driver `@neondatabase/serverless` mluví běžným Postgres protokolem; pro lokální/jiný Postgres lze přepsat na `pg` v `_lib/db.js`.)
- **Funkce:** jsou psané v **Netlify formátu** `export async function handler(event)` (čtou `event.httpMethod`, `event.queryStringParameters`, `event.body`). Na Vercelu/Cloudflare je přepíšeš na jejich signaturu (`(req, res)` resp. `fetch` handler) — logika SQL uvnitř zůstává stejná.
- **Cesty:** frontend volá `/.netlify/functions/<name>`. Na jiném hostingu buď nastav redirect/rewrite na svoje endpointy, nebo uprav konstantu `API` v `index.html`, `bydleni.html`, `auta.html`.

---

## 🔧 Přizpůsobení sobě

| Co změnit | Kde |
|---|---|
| **Cíl dojezdu** | přímo v appce: pole **Cíl dojezdu** v panelu hledání (K roztřídění). Podle něj se řídí i odkazy na trasu a popisky. Výchozí hodnota (Arkády Pankrác) je `CRIT_DEF.dest` v `bydleni.html`, pro `recompute-commute.js` konstanta `DEST` v `_lib/route.js`. |
| **Výchozí hypotéka** (úrok 3,95 %, doba 30, akontace 10 %) | `bydleni.html` → pole `m-rate`, `m-years`, `m-down` + proměnné `mRate/mYears/mDown`. |
| **Barvy sekcí** (zelená / azurová) | `styles.css` → `:root` a `.theme-auto`. |
| **Kurz EUR→CZK** (u aut) | `auta.html` → konstanta `RATE`. |

---

## 💻 Lokální vývoj
```bash
npm install
npx netlify dev    # spustí statiku + funkce; potřebuje netlify login + nastavené env
```
Bez připojené DB appka jen ukáže hlášku „nepodařilo se načíst" — to je v pořádku.

---

## 🔎 Hledání na portálech

V Bydleníčku na záložce **K roztřídění** je panel **Hledat na portálech**: nastavíš kritéria, dáš **Projet** a appka sama najde nabídky, spočítá dojezd a nejlepší uloží jako kandidáty. Pak je vyřídíš tlačítky **Vzít do Naše** / **Zahodit** (zahozené si pamatuje, aby je příště nenabízela znovu).

**Kritéria:** cíl dojezdu (adresa) a maximální dojezd autem · cena od/do · plocha od/do · typ (domy/byty) · dispozice · stav · kraje · v Pokročilém pak pozemek od, PSČ pro bazoš, hloubka hledání, hranice skóre a strop uložených. Nastavení se drží v prohlížeči (localStorage), takže příští hledání začíná tam, kde jsi skončil.

**Jak to běží:** klient volá `search` opakovaně (zdroj × typ × stránka), takže se každé volání vejde do limitu serverless funkce a jde vidět průběh i to zastavit. Pak `commute-batch` spočítá dojezd, u nadějných sreality nálezů se přes `extract` doplní PENB a stav a nakonec se to oboduje a uloží.

**Zdroje** (adaptéry v [`netlify/functions/_lib/sources.js`](netlify/functions/_lib/sources.js)):

| Zdroj | Jak se čte | Co dává |
|---|---|---|
| **sreality.cz** | výsledky hledání ze SSR dat stránky (`__NEXT_DATA__`), 22 na stránku | cena, cena/m², plocha i pozemek z názvu, GPS, foto, druh stavby |
| **bezrealitky.cz** | veřejné GraphQL `listAdverts`, 30 na stránku | navíc dispozice, PENB, stav, vybavení; umí i hledání v okruhu |
| **bazoš** | HTML výpisu, 20 na stránku, okruh od PSČ | název, cena, město + PSČ, foto (bez GPS → dojezd z geokódu města) |

**Skóre shody (0 až 100)** se počítá z plochy, dispozice, stavu a PENB, venkovního prostoru, dojezdu, druhu stavby a ceny/m² proti mediánu nálezu. Hodnotí se **jen to, co inzerát prozradí** — chybějící údaj se z výpočtu vynechá, aby portál se skoupějšími daty nevycházel systematicky horší.

> Pozn.: nálezy jsou návrhy, ne ověřená data. Ceny, plochy a dojezdy si u vážných kandidátů ověř u zdroje.

---

## 🔐 Bezpečnost / pozn.
- Appka **nemá heslo** — kdokoli s URL ji vidí i edituje. Pro soukromá data dej repo **Private** a/nebo dopiš jednoduché přihlášení (cookie + heslo přes funkci).
- `.env`, `.apify_token`, `node_modules` jsou v `.gitignore` — necommituj tajné klíče.
- Po změně env proměnných v Netlify je nutný **redeploy**.
- Ceny i dojezdy jsou orientační — ověř u zdroje.

---

## 📄 Licence

**© 2026 foxpen.** Tento projekt je licencován pod **GNU Affero General Public License v3.0 (AGPL-3.0)** — viz [`LICENSE`](LICENSE).

Stručně co to znamená:
- ✅ Můžeš to používat, studovat, upravovat i sdílet.
- 🔁 **Pokud to ale dál šíříš nebo provozuješ jako službu (web), musíš zveřejnit zdrojový kód** svojí verze pod stejnou licencí a **uvést autora**.
- 🚫 Nelze z toho udělat uzavřený/proprietární produkt ani si to „přivlastnit".


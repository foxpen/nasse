# Naše 🏠🚗

Soukromá webová appka na **výběr nemovitosti a auta** pod jednou střechou. Jedno místo, kde si rodina drží shortlist nabídek, porovnává je, počítá hypotéku, dojezd a značkuje stav (prohlídka domluvená, usmlouvaná cena…).

- **Naše Bydleníčko** — nemovitosti: cena, m², cena/m², dojezd autem, hypoteční splátka, poznámky, stavové štítky, domluvená cena, záložka „K roztřídění" pro kandidáty.
- **Naše Autíčko** — auta: cena (Kč/€), rok, najeto, výkon, palivo, poznámky.
- **Rozcestník** (`index.html`) — výběr sekce.

Statický frontend (HTML/CSS/JS, bez build kroku) + **Netlify Functions** (serverless) + **Neon Postgres**. Vše běží zdarma na free tierech.

---

## Co appka umí
- Přidávání přes **odkaz** s auto-extraktorem (sreality.cz, bezrealitky.cz, sauto.cz) + ruční fallback.
- **Hypoteční kalkulačka** (úrok / doba / akontace / pojištění) — splátka u každé nemovitosti, živě.
- **Dojezd autem** na zvolené místo přes **Mapy.com API** (volitelné).
- **Mazání**, **poznámky**, **stavové štítky** (⭐ favorit, 📅 prohlídka, ✓ po prohlídce, ✕ zamítnuto) a **domluvená cena** (přepočítá splátku i cenu/m²).
- Záložky **Naše** / **K roztřídění** (kandidáti se skóre).
- Filtrování, řazení, srovnávací tabulka, dark mode, mobil.

---

## Architektura

```
Neon Postgres  (tabulka `listings`: id, section, data jsonb, created_at)
      ▲
Netlify Functions (Node ESM, /netlify/functions/*)
   list · add · delete · update · note · status · extract · commute · seed · recompute-commute
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
| `MAPY_API_KEY` | volitelná | dojezd autem ([api.mapy.com](https://api.mapy.com), free) |

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
| **Cíl dojezdu** (teď Arkády Pankrác, Praha) | `netlify/functions/commute.js` a `recompute-commute.js` → konstanta `DEST` (lon/lat). V `bydleni.html` text „na Pankrác". |
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

## 🔎 Hledání podobných nemovitostí (volitelné, pokročilé)
Profil hledání (charakteristika shortlistu + sreality filtr + skórování podobnosti 0–100) je popsán v souboru `nase-reality-filter` (Claude skill). Vyhledávání běží jako lokální skript (čte veřejná sreality data) a nahrává kandidáty do DB se `status:"candidate"` → objeví se v záložce „K roztřídění". Není součástí nasazené appky.

---

## 🔐 Bezpečnost / pozn.
- Appka **nemá heslo** — kdokoli s URL ji vidí i edituje. Pro soukromá data dej repo **Private** a/nebo dopiš jednoduché přihlášení (cookie + heslo přes funkci).
- `.env`, `.apify_token`, `node_modules` jsou v `.gitignore` — necommituj tajné klíče.
- Po změně env proměnných v Netlify je nutný **redeploy**.
- Ceny i dojezdy jsou orientační — ověř u zdroje.

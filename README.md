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

## 🚀 Zprovoznění pro sebe (krok za krokem)

Budeš potřebovat účet na **GitHubu**, **Netlify** a **Neon** (všechny mají free tier).

### 1) Vlastní kopie repa
Forkni nebo naklonuj tenhle repozitář na svůj GitHub.

### 2) Neon databáze
1. Na [neon.tech](https://neon.tech) vytvoř projekt.
2. Zkopíruj **connection string** — ten **pooled** (obsahuje `-pooler`, vypadá jako `postgresql://user:pass@ep-xxx-pooler.<region>.neon.tech/neondb?sslmode=require`).

### 3) Nasazení na Netlify
1. Na [netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → vyber svůj repo.
2. Build command nech **prázdný**, **Publish directory = `.`** (už je v `netlify.toml`), funkce se najdou samy v `netlify/functions`.
3. Deploy.

### 4) Proměnné prostředí (Netlify → Site configuration → Environment variables)

| Proměnná | Povinná? | K čemu |
|---|---|---|
| `NETLIFY_DATABASE_URL` | **ano** | Neon pooled connection string |
| `MAPY_API_KEY` | volitelná | Auto-výpočet dojezdu autem ([api.mapy.com](https://api.mapy.com) → REST API klíč, free) |

Po přidání proměnných dej **Deploys → Trigger deploy** (env se načte do funkcí).

### 5) Vytvoření tabulky a (volitelně) dat
- **Prázdný start (doporučeno pro vlastní data):** v Neon SQL editoru spusť obsah **`db/schema.sql`** (vytvoří tabulku `listings`). Pak přidávej přes appku.
- **S ukázkovými daty:** otevři jednou `https://<tvuj-web>.netlify.app/.netlify/functions/seed` — vytvoří tabulku **i** naimportuje ukázkový shortlist, který si pak smažeš/upravíš.

Hotovo — appka jede na `https://<tvuj-web>.netlify.app`. 🎉

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

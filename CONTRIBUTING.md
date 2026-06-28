# Jak přispívat (CONTRIBUTING)

Ahoj 👋 Díky, že chceš pomoct s **Naše**. Tady je vše, co potřebuješ, abys mohl/a začít.

> Nejdřív si přečti [`README.md`](README.md) — popisuje, co appka dělá a jak ji zprovoznit. Tady je doplněk pro vývoj a posílání změn.

---

## 1. Rozjetí lokálně

```bash
git clone https://github.com/foxpen/nasse.git
cd nasse
npm install
```

Pro běh i s funkcemi (DB) potřebuješ **vlastní Postgres** (klidně free Neon) a Netlify CLI:

```bash
# nastav si vlastní připojení k databázi (NE sdílet, NE commitovat)
#   Windows PowerShell:  $env:DATABASE_URL = "postgresql://..."
#   bash:                export DATABASE_URL="postgresql://..."
# (volitelně export MAPY_API_KEY="..." pro výpočet dojezdu)

npx netlify dev          # spustí statiku + funkce na http://localhost:8888
```

Pak v Neon/Postgresu spusť `db/schema.sql` (vytvoří tabulku), nebo otevři `/.netlify/functions/seed`.

> Bez DB se appka načte, jen ukáže „nepodařilo se načíst" — to je v pořádku pro úpravy čistě vzhledu.

---

## 2. Pracovní postup (důležité)

`main` se **automaticky nasazuje na Netlify**, takže do něj nepushuj napřímo.

```bash
git checkout -b moje-zmena      # nová větev
# ... úpravy ...
git commit -m "krátký popis"    # styl: krátký, lowercase, věcný
git push -u origin moje-zmena
```
Pak otevři **Pull Request** na GitHubu. Po review se merguje do `main`.

- Drobné, soustředěné PR > jeden obří.
- Commit zprávy česky/anglicky, hlavně srozumitelně.

---

## 3. Tajné klíče 🔐
- **Nikdy necommituj** `.env`, `.apify_token`, connection stringy ani API klíče (jsou v `.gitignore`).
- Tajné hodnoty patří do **env proměnných** (lokálně shell, na produkci Netlify), ne do kódu.

---

## 4. Konvence projektu
- **Vanilla** HTML/CSS/JS, **žádný build step**. Nepřidávej bundler/framework bez domluvy.
- **Funkce** (`netlify/functions/*`) jsou Node ESM, formát `export async function handler(event)`; DB přes `_lib/db.js`, odpovědi přes `_lib/http.js` (`json(...)`).
- **DB** = jedna tabulka `listings` (`section` + `data` jsonb). Nové pole = jen klíč v `data`, žádná migrace. Pro nový stav stačí hodnota v `data` (např. `status`, `flags`, `dealPrice`).
- **Vzhled** = CSS proměnné v `:root` / `.theme-auto` v `styles.css` (nehardcoduj barvy).
- **Jazyk UI** = čeština. **Bez em-dashů** (`—`) v textech (používej `·` nebo čárku).
- Ikony jako inline SVG, žádné emoji jako strukturální ikony (emoji ve štítcích/hláškách OK).

---

## 5. Jak otestovat
- **Frontend:** otevři stránku, mrkni do konzole, že nejsou chyby; vyzkoušej přidání/mazání/poznámku/stav.
- **Funkce:** zavolej endpoint, např.
  ```
  curl "http://localhost:8888/.netlify/functions/list?section=byd"
  curl -X POST -H "content-type: application/json" -d '{}' http://localhost:8888/.netlify/functions/add
  ```

---

## 6. Licence
Příspěvky jsou pod **AGPL-3.0** (viz [`LICENSE`](LICENSE)) — tím, že pošleš PR, souhlasíš, že se tvůj příspěvek šíří pod touto licencí.

Díky! 🙌

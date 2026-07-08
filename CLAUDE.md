# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Co je to za projekt

„Naše" — soukromá rodinná webová aplikace (UI kompletně česky) se třemi sekcemi:

| Sekce | Stránka | Barva (světlý/tmavý) | Data |
|---|---|---|---|
| Naše Bydleníčko (nemovitosti) | `bydleni.html` | teal `#0F766E` / `#5DCAA5` | Neon Postgres přes Netlify Functions |
| Naše Autíčko (auta) | `auta.html` | azurová `#0284C7` / `#38BDF8` | Neon Postgres přes Netlify Functions |
| Naše Hospodařeníčko (rozpočet) | `hospodareni.html` | zlatá `#D97706` / `#FBBF24` | **jen localStorage** (`nase.finance.v1`), žádný server |

`index.html` je rozcestník. Frontend je vanilla HTML/CSS/JS **bez build kroku** — žádný framework, žádný bundler, žádné testy ani lint. Backend jsou Netlify Functions (ESM) nad jednou tabulkou `listings(id, section 'byd'|'auto', data jsonb, created_at)`.

## Příkazy

```powershell
npm install                        # závislosti (pnpm-lock existuje, ale pnpm na tomto stroji není — používej npm/npx)
npx netlify dev                    # plný lokální běh s funkcemi; vyžaduje env proměnné (.env)
npx netlify deploy --prod --dir .  # ruční deploy (build command prázdný, publish ".")
python -m http.server 8642         # rychlý statický náhled UI bez funkcí
```

Povinné env: `DATABASE_URL`/`NETLIFY_DATABASE_URL`, `APP_PASSWORD`/`NASE_PASSWORD`; doporučené `AUTH_SECRET`, `MAPY_API_KEY` (detaily v README).

Při statickém náhledu funkce neběží → přihlášení projde do chybového stavu; bránu lze v konzoli obejít `document.getElementById('auth-gate').remove()` a stránka poběží s prázdnými daty. Sekce Hospodařeníčko funguje staticky celá (localStorage).

Emoce, záměr a designový jazyk aplikace popisuje [design-brief.md](design-brief.md) — přečti si ho před návrhem čehokoli vizuálního.

## Architektura a konvence

### Theming (nejčastější past)

Vše řídí CSS custom properties v `styles.css`. Každá barevná definice existuje **ve čtyřech blocích**: `:root` (světlý), `@media (prefers-color-scheme: dark)` (systémový tmavý), `html[data-theme="light"]` a `html[data-theme="dark"]` (ruční přepínač, ukládá se do `localStorage['nase.theme']`). Při změně barev vždy uprav všechny čtyři, jinak se rozjede ruční vs. systémový motiv.

Sekce se přebarvují třídou na `<body>`: `theme-auto` (auta), `theme-finance` (hospodaření); bydlení používá výchozí `:root`. Tyto třídy přepisují `--primary`, `--accent`, `--tint-*` — komponenty pak barvy dědí automaticky. Nikdy nepiš sekční hex přímo do komponent.

### Autentizace

Jedno sdílené heslo pro celou aplikaci. `auth.js` běží na každé stránce: GET na `/.netlify/functions/auth`, při neúspěchu vloží celoobrazovkovou bránu `#auth-gate` (split-screen: vlevo karusel sekcí s „lava lamp" pozadím, vpravo formulář hesla). Stránky čekají na `window.naseAuthReady` (promise) než volají API. Server (`netlify/functions/_lib/auth.js`) vydává HMAC-podepsanou cookie `nase_auth` (session 1 den / remember 180 dní). Barvy brány řídí proměnná `--gp` nastavovaná z JS podle aktivní sekce karuselu.

### Netlify Functions

`netlify/functions/*.js`, sdílené helpery v `_lib/` (`db.js` — neon klient, `auth.js`, `http.js`, `validate.js`). Redirect `/api/*` → `/.netlify/functions/*` v `netlify.toml`. Klíčové funkce: `list`, `add`, `update`, `delete`, `extract` (import inzerátů ze sreality/bezrealitky/sauto/bazoš/mobile.de), `refresh-listings`, `commute`/`recompute-commute` (Mapy.com API), `address-suggest`, `image-proxy` (cache fotek; klientsky ji cachuje i `sw.js` — jediné, co service worker dělá).

### Frontend konvence

- JS každé stránky je inline v jejím HTML; sdílené helpery v `app-utils.js` (`window.Nase`: `esc()`, `initThemeToggle()`); do HTML vkládaných šablon vždy `esc()`.
- Ikony jsou výhradně inline SVG `stroke="currentColor"` stroke-width 1.8–2, žádné emoji ani ikonfonty.
- Intro/splash animace: každá stránka má overlay, který se hraje **jen jednou za session** (`sessionStorage['nase.intro.*']`) a respektuje `prefers-reduced-motion` (globální kill-switch v `styles.css` + kontroly v JS).
- Destruktivní akce v Hospodaříčku používají undo toast (`showUndo()` v `hospodareni.html`), ne confirm.
- Peníze formátuj `toLocaleString('cs-CZ')`; písmo Plus Jakarta Sans s `font-feature-settings: "tnum"`.
- Počty vždy skloňuj přes `Nase.plural(n, '1 tvar', '2–4 tvar', '5+ tvar')` (např. vůz/vozy/vozů) — nikdy nelep pevnou koncovku k číslu. U vět se s počtem musí shodovat i sloveso („Připravena 1 nemovitost" vs. „Připraveno 5 nemovitostí").
- Layout je fluidní — `main` nemá max-width; karty používají `auto-fill, minmax()`. Nezaváděj pevné šířky stránek.
- `login-demo.html` je jen referenční demo (claymorphism), není nalinkované z aplikace.

### Verzování

Verze aplikace je v `package.json` a bumpuje se samostatným commitem (viz historie „Bump app version"). Commity jsou česky nebo anglicky, krátké, imperativní.

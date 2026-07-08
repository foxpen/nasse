# Naše — designový brief

Popis emocí, záměru a designového jazyka aplikace. Určeno pro lidi i AI, které navrhují cokoli nového v tomto projektu (obrazovky, komponenty, grafiku, ilustrace). Technická pravidla implementace jsou v [CLAUDE.md](CLAUDE.md) — tento dokument říká **proč a jak to má působit**.

## Co to je

Soukromá rodinná aplikace pro dva lidi, kteří spolu plánují život: vybírají dům, auto a hlídají rodinný rozpočet. Není to produkt pro zákazníky — je to společný deník velkých rozhodnutí. Celé UI je česky.

## Hlavní emoce

**Bezpečí a těšení se.** Aplikace má působit jako večer u kuchyňského stolu, kdy si dva lidi rozloží papíry a plánují budoucnost — vážné téma (miliony korun, hypotéka), ale dělané s láskou a lehkostí.

Klíčové napětí, které design drží: **dospělá spolehlivost × dětská něha**. Proto se sekce jmenují zdrobněle — Bydleníčko, Autíčko, Hospodařeníčko — a proto je logo pár dlaní, které opatrují tři barevné tečky.

## Záměr designu

Uklidnit a povzbudit. Žádný growth-hacking, žádné urgence, žádné „AKCE!". Čísla jsou upřímná a čitelná (tabulkové číslice), destruktivní akce jdou vrátit zpět, nic na uživatele nekřičí. Zároveň to nesmí být nudný úřad — aplikace je živá: věci plavou, přelévají se, rozsvěcují se.

**Osobnost značky (kdyby to byl člověk):** pečlivý partner s hřejivým humorem. Má v pořádku tabulky, ale na ledničce lepí barevné magnety.

## Barevný systém — tři sekce, tři nálady

| Sekce | Světlý | Tmavý | Nálada |
|---|---|---|---|
| Bydleníčko | `#0F766E` teal | `#5DCAA5` | domov, stabilita, zakořenění (základ značky) |
| Autíčko | `#0284C7` azurová | `#38BDF8` | pohyb, vítr, cesta |
| Hospodařeníčko | `#D97706` zlatá | `#FBBF24` | mince, sklizeň, hojnost |

- Pozadí: off-black s teal nádechem (`#0A1413`) / světlá šalvějová bílá (`#F4F7F6`). Nikdy čistá černá ani čistá šedá — všechny neutrály jsou zabarvené do zelena.
- Sekce se pozná barvou, komponenty barvy dědí z CSS tokenů, nikdy se nemíchá víc akcentů v jednom pohledu.

## Tvary a povrchy

Měkké. Zaoblení 14–20 px, pilulková tlačítka. Na přihlašovací obrazovce claymorphism — vystouplé/zamáčknuté „hliněné" povrchy s tintovanými stíny (nikdy černý stín). Hrany mezi plochami se nelámou tvrdě — přecházejí organickou vlnou. Přes barevné plochy jemné filmové zrno, aby nic nebylo digitálně sterilní.

## Pohyb

Pomalý, tekutý, dýchající — jako **lávová lampa** (doslova motiv login obrazovky: tři barvy sekcí v ní plavou a aktivní se rozsvítí). Mikrointerakce 150–300 ms, nájezdy kaskádově odspodu, karty se při stisku jemně zmáčknou. Vše respektuje `prefers-reduced-motion`. Intro animace jsou vyprávěcí (domeček se postaví z cihel, auto přijede, graf vyroste) a hrají se jen jednou za session.

## Typografie

Plus Jakarta Sans — kulatá, přátelská, ale profesionální. Nadpisy těžké (800) se staženým prokladem, čísla tabulková (`tnum`). Texty lidské a konkrétní („Rozpočet dává prostor", „Zbývá 12 400 Kč měsíčně"), žádné marketingové fráze. Počty vždy správně vyskloňované.

## Ikonografie a logo

Výhradně linkové SVG, stroke 1.8–2, žádné emoji ani ikonfonty. **Logo: dvě dlaně nesoucí tři barevné tečky** = rodina opatruje tři oblasti života. Domeček samotný patří jen sekci Bydleníčko, nikdy značce jako celku.

## Co design nikdy nedělá

- fialovo-modré „AI" gradienty,
- čistě černé stíny,
- confirm dialogy (mazání se řeší přes undo),
- pevné šířky stránek,
- infantilnost — něha se dělá barvou, tvarem a pohybem, ne Comic Sans kýčem,
- urgence, vykřičníky, „Oops!".

## Kompaktní anglický prompt pro generátory

> Private family life-planning app "Naše" (Czech). Emotional core: safe, warm, quietly joyful — two people planning their future home, car and budget at the kitchen table. Personality: caring partner with tidy spreadsheets and colorful fridge magnets. Design: soft claymorphism accents on clean flat UI, sage-tinted off-black/off-white surfaces, three section accents (teal #0F766E home, azure #0284C7 car, amber #D97706 budget), lava-lamp ambient motion, organic wave dividers, film grain, pill buttons, 14–20px radii, Plus Jakarta Sans with heavy tight headlines and tabular figures, line SVG icons (1.8–2 stroke), logo = two cupped hands holding three colored dots. Slow fluid 150–300ms micro-interactions, staggered reveals, undo instead of confirmations. Never: purple-blue AI gradients, pure black shadows, urgency, childish kitsch.

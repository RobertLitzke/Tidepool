# Tidepool: guide for Claude sessions

Read this first; it should save you from reading most files whole.

## The game
Cozy single-player engine builder PWA for Rob's Pixel phone, 10-15 minute runs. A 4x4 reef, 12 tides. Each tide you buy tiles from a 3-card shop with shells (place new or level up), then the reef "fires": tiles make shells and pearls, many based on touching neighbors. Pearl goals at checkpoint tides (fail = run over); final pearls held give 0-3 stars. Pearls also buy rock cells (new spots) and Treasures (permanent rule changes, markets at tides 5/7/9; called Tide Charms before v17, internally still `CHARMS`). Each run has one forecast event (Storm Surge, Hungry Shark, Undertow) revealed at tide 5 that strikes after tide 10.

Kinds: Flora (plant), Shellfish, Critter, plus Object, Mover (Dolphin) and Item (one-shot, v29). Tiles cap at ★3 except stackers (`stack: true`: Conch, Sargassum).

Ecosystems (v17): the app opens on a picker. `reef` is the game above. `forest` (Eastern US deciduous forest) runs November to October, one month a round, on two rules only (v18, Rob asked for simple interactions): every tile makes ×2 in its season, and fall leaves from trees grow touching understory plants (or wait on empty spots). Logs clear for amber or seeds. Its bonuses are Heirlooms. Current design: `notes/forest-simple.md`; `notes/forest.md` is the older, bigger design. Keep new forest ideas to seasons plus the leaves mechanic. Sea ecosystems pay shells and pearls, land ones seeds and amber; code always says `shells`/`pearls`, and ui.html swaps the words and icons (`REALM`). Every player-facing word comes from the ecosystem's `terms` (board, round, rock, clear, go, bonus...).

`serengeti` (v20, Rob's spec in `notes/serengeti.md`): turns alternate Wet (odd) and Dry (even); grazers graze Lush flora and leave it Grazed (`tile.grazed`) until something restores it. Seeds and amber, bonuses called Treasures, kopjes for rocks. Phases are shared engine code: `CONFIG.calendar` (forest months) or `CONFIG.cycle` (`['wet','dry']`), `TP.phase(state, tide)`, `state.phaseAt` overrides, `CONFIG.phaseIncome`. Reuse these for any new ecosystem with alternating turns. v22 parked the Crocodile (`CONFIG.disabled`) and limited Oxpecker echoes to grazers: Rob wants echoes to stay weak next to the seasons and grazing themes.

Modifiers and invasives (v23): new runs start on a modifiers sheet (`showSetup` in ui.html, `MODIFIERS` in engine.js: `noEvent`, `noInvasive`); `state.mods` lists them and `rated(state)` is false when any is on (no stars, no best). Each eco module may export `INVASIVES` ({name, emoji, eats: kind tag, verb, blurb}); the engine's walk-and-bite rule (`invasiveTurn`, `invasivePlan`) runs them from round `CONFIG.invasiveTide` (default `eventRevealTide`). Bots: `MODS=noInvasive node sim.js ...` (also tune.js).

Audit fixes (v26-v30, 2026-11-04; report in the project folder `notes/audit-2026-11.md`): every new run picks one of two starters (`TP.starterOptions(seed)`, `newGame(seed, mods, starter)`; the forest keeps White Oak and picks an understory). Serengeti: Star Grass 2 seeds, Giraffe counts all touching flora, Oxpecker parked, Savanna Echo retired (`retired: true` charms stay in `CHARMS` for saves but leave the market). Forest: leaves grow plants past ★3 (`CONFIG.leafUncapped`), seeds left at the end convert to amber (`CONFIG.endShells`, number or function; `TP.endShellsPer`), Evergreen and Acorn Hoard Heirlooms, Seed Rain and Tailwind retired. Reef: **items** from tide 9 (`CONFIG.itemsFrom`): a fourth shop slot with a one-shot tile that acts on a placed tile and takes no spot (`TILES[k].item`, `targets`, `use`, `fromTide`, `priceStep`; `TP.itemTargets`/`useItem`; `tile.encore` fires a tile twice). Help text comes from each module's `help(h)`. Keep retired charms, parked tiles and old ids in the data so saves load.

Play: https://robertlitzke.github.io/Tidepool/ . Repo: github.com/RobertLitzke/Tidepool.

## File map
| File | Role |
|---|---|
| `engine.js` | Shared rules engine, pure logic, no DOM. `forEco(id)` returns a cached engine for one ecosystem; `require('./engine.js')` alone is the reef engine (old API) plus `forEco`/`list`. |
| `eco-reef.js`, `eco-forest.js`, `eco-serengeti.js` | One module per ecosystem: `{id, name, realm, terms, icon, help(h), def(E)}`; `def` returns `CONFIG`, `KINDS`, `TILES`, `EVENTS`, `CHARMS`, `INVASIVES` and `hooks` (init, startTide, afterFire, onRemove, onPlace, onLevelUp, tileState, inSeason...). Forest tile numbers live in `CONFIG.k`. In the page they load before engine.js. |
| `ui.html` (~1200 lines) | Touch UI, CSS (forest theme and seasonal tints via `data-eco`/`data-season`), ecosystem picker, overlays, help screen. `/*ENGINE*/` and `<!--ART-->` are placeholders filled by build.sh. |
| `art.js` | Sticker-style SVG art for every tile of both ecosystems, rock, log, cache, shell, pearl, seed, amber. `node art.js` prints `<symbol>`s; `node art.js --preview out.html` previews all icons. Charms, events and kind chips still use emoji. |
| `build.sh` | `sh build.sh` writes `tidepool.html` (single file) and `dist/` (PWA). Both are gitignored build output: never edit them. |
| `pwa/` | `head.html`, `tail.html`, `sw.js` (`__VERSION__` stamped by build), manifest, icons. |
| `sim.js` | Bots (`ECO=forest` or `ECO=serengeti`, same for tune.js, ablate.js, test.js and CI): `node sim.js 500 [random\|greedy\|planner\|all]`. Prints finish rate, score spread, stars, pearl curve, pick rates. Exports `makeSim(TP)` plus `play`/`newRun` for the current eco; bots pick starters by playing three greedy rounds on each. |
| `test.js` | `node test.js`: golden-seed hashes per eco and bot (`tests/golden.json`), save fixtures from older versions (`tests/saves/`) replayed with greedy, data checks. CI runs it first. `node test.js --update` after a deliberate rule change; a changed golden without a rule change is a bug. |
| `tune.js` | Parallel batches: `node tune.js planner 2000 [variant.js\|-] [seed0] [workers]`. A variant exports `(TP) => { ...mutate TP.CONFIG/TP.TILES... }`. `DUMP=out.json` saves per-run rows. |
| `ablate.js` | Drop-one tile test in worker processes: `ECO=... node ablate.js [runs=200] [seed0=9000] [bot=planner] [workers=4]`. Prints avg without each tile and finish rate. |
| `README.md` | Short file list, then the **balance log** (v1..vN). Read only the last 2-3 entries (`tail -20 README.md`). |
| `notes/tile-report.md` | Latest per-tile effectiveness and drop-one numbers. |
| `.github/workflows/pages.yml` | On push to main: `node sim.js 100 greedy` as a smoke test, `sh build.sh`, deploy `dist/` to Pages. |

## Rules anchors (grep the names; reef data is in eco-reef.js, the flow in engine.js)
- `CONFIG`: board size, tides, income, `startKinds`, `disabled` (parked tiles: `clown`, `anemone`), goals/checkpoints, `stars` (reef 550/1005/2090, forest 1330/1555/1895, Serengeti 965/1520/2120 as of v29), price steps (`stackPriceEvery`, `levelUpStep`, `charmPriceStep`), event settings, `rockLayouts`, `itemsFrom` (reef items), `leafUncapped`/`endShells` (forest).
- `KINDS` and `kindNames(tag)` (~L55-65): kind labels; rules text names kind members through `kindNames`.
- `TILES` (~L70): every tile: `name`, `emoji`, `cost`, `rarity`, `tag` (kind), `text(L)`, `fire(c, L)` returning `{s, p}`, optional `reads`, `stack`, `flat`, `afterFirstGoal`.
- `EVENTS` (~L141), `CHARMS` (~L151).
- Turn flow: `starterOptions`, `newGame(seed, mods, starter)`, `startTide`, `rollOffers`/`reroll`, `canPlace`/`buy`, `useMover`, `itemTargets`/`useItem`, `sell`, `breakRock`, `buyCharm`, `runTide` (end-of-run shell conversion), `strikeEvent`. Helpers: `forecast`, `links`, `nextCheckpoint`, `starsFor`, `validSave`, `eventDef`, `inSeason`, `endShellsPer`. `api` export near the end.

## Tile ids are old names (save compatibility)
Tile ids and save keys never change; only display `name`s do. Current id -> name: `scallop` Conch, `kelp` Sargassum, `oyster` Oyster, `crab` Hermit Crab, `shrimp` Giant Clam, `jelly` Seagrass, `coral` Staghorn, `urn` Shipwreck, `puffer` Pufferfish, `star` Sea Star, `otter` Mantis Shrimp, `octo` Octopus, `whale` Manta Ray, `turtle` Sea Turtle, `dolphin` Dolphin; parked `anemone`, `clown`. Tag `plant` displays as Flora.

Saves: ui.html stores the reef run in `localStorage['tidepool.run']` (also `seenHelp`, `best`, `playlog`); other ecosystems use `tidepool.<eco>.run` etc., and `tidepool.eco` remembers the last one picked. `start()` keeps any save `TP.validSave` accepts (grid present and the right size), so a renamed id or removed state field breaks players' saved runs. Add new state fields with safe defaults instead of renaming; `tests/saves/` fixtures catch regressions. The page also keeps `runlog` (last 200 finished runs per eco) which the help screen's "Copy play log" exports as JSON: ask Rob for it when real-play numbers would help a balance decision.

## Workflow
- Work on `main`: `git pull` before editing, rebase before pushing, push straight to main (it deploys Pages). Rob wants no PRs for this repo.
- Run `sh build.sh` locally to check the page builds; don't commit its output.
- Balance changes: rerun bots (planner is the reference; greedy and random for spread), compare before/after on the same seeds, and add a vN entry to the README balance log with the numbers. Star cutoffs are calibrated so the planner gets 0/1/2/3 stars about 30/35/25/10% (failures count as 0): take p30/p65/p90 from `tune.js planner 1000 - 5001 4` and recalibrate after any rule change that moves the average. Then `node test.js --update` and commit the goldens with the change. Don't add more bots.
- Keep `/mnt/project-files/tidepool` (the project's shared folder) in sync with the repo after pushing. It also holds extra notes not in git: `notes/audit-2026-11.md` (the design/tech audit behind v26-v30, with `notes/audit-sims/`), `notes/late-game.md` (tides 11-12 analysis), `notes/predator.md` (invasive-species proposal, partly shipped in v15), their sim scripts, and old ablation outputs.

## Reading tips
- Don't read `tidepool.html` or `dist/index.html` (110+ KB build output). Read `engine.js` or grep `ui.html` instead.
- `ui.html` render functions: `useEco`, `showPicker`, `renderYear`, `renderReef`, `renderShop`, `renderInfo`, `showTile`, `showCache`, `showHelp`/`helpText`, `runTide`, `endRun`, `showForecast`, `showCharms`. Grep for them.
- `art.js` palettes are keyed by tile id (`PAL.scallop`, ...).

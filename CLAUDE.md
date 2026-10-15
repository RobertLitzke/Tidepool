# Tidepool: guide for Claude sessions

Read this first; it should save you from reading most files whole.

## The game
Cozy single-player engine builder PWA for Rob's Pixel phone, 10-15 minute runs. A 4x4 reef, 12 tides. Each tide you buy tiles from a 3-card shop with shells (place new or level up), then the reef "fires": tiles make shells and pearls, many based on touching neighbors. Pearl goals at checkpoint tides (fail = run over); final pearls held give 0-3 stars. Pearls also buy rock cells (new spots) and Tide Charms (permanent rule changes, markets at tides 5/7/9). Each run has one forecast event (Storm Surge, Hungry Shark, Undertow) revealed at tide 5 that strikes after tide 10.

Kinds: Flora (plant), Shellfish, Critter, plus Object and Mover (Dolphin). Tiles cap at ★3 except stackers (`stack: true`: Conch, Sargassum).

Play: https://robertlitzke.github.io/Tidepool/ . Repo: github.com/RobertLitzke/Tidepool.

## File map
| File | Role |
|---|---|
| `engine.js` (~500 lines) | All rules, pure logic, no DOM. Shared by the page and the bots. |
| `ui.html` (~1000 lines) | Touch UI, CSS, overlays, help screen. `/*ENGINE*/` and `<!--ART-->` are placeholders filled by build.sh. |
| `art.js` | Sticker-style SVG art for every tile, rock, shell, pearl. `node art.js` prints `<symbol>`s; `node art.js --preview out.html` previews all icons. Charms, events and kind chips still use emoji. |
| `build.sh` | `sh build.sh` writes `tidepool.html` (single file) and `dist/` (PWA). Both are gitignored build output: never edit them. |
| `pwa/` | `head.html`, `tail.html`, `sw.js` (`__VERSION__` stamped by build), manifest, icons. |
| `sim.js` | Bots: `node sim.js 500 [random\|greedy\|planner\|all]`. Prints finish rate, score spread, stars, pearl curve, pick rates. Exports `play`. |
| `tune.js` | Parallel batches: `node tune.js planner 2000 [variant.js\|-] [seed0] [workers]`. A variant exports `(TP) => { ...mutate TP.CONFIG/TP.TILES... }`. `DUMP=out.json` saves per-run rows. |
| `ablate.js` | Drop-one tile test: `node ablate.js [tally=100] [drop=50] [bot]`. |
| `README.md` | Short file list, then the **balance log** (v1..vN). Read only the last 2-3 entries (`tail -20 README.md`). |
| `notes/tile-report.md` | Latest per-tile effectiveness and drop-one numbers. |
| `.github/workflows/pages.yml` | On push to main: `node sim.js 100 greedy` as a smoke test, `sh build.sh`, deploy `dist/` to Pages. |

## engine.js anchors (approximate line numbers; grep the names)
- `CONFIG` (~L4): board size, tides, income, `startKinds`, `disabled` (parked tiles: `clown`, `anemone`), goals/checkpoints, `stars` (currently 500/1000/1500), price steps (`stackPriceEvery`, `levelUpStep`, `charmPriceStep`), event settings, `rockLayouts`.
- `KINDS` and `kindNames(tag)` (~L55-65): kind labels; rules text names kind members through `kindNames`.
- `TILES` (~L70): every tile: `name`, `emoji`, `cost`, `rarity`, `tag` (kind), `text(L)`, `fire(c, L)` returning `{s, p}`, optional `reads`, `stack`, `flat`, `afterFirstGoal`.
- `EVENTS` (~L141), `CHARMS` (~L151).
- Turn flow: `newGame`, `startTide`, `rollOffers`/`reroll`, `canPlace`/`buy`, `useMover`, `sell`, `breakRock`, `buyCharm`, `runTide`, `strikeEvent`. Helpers: `forecast`, `links`, `nextCheckpoint`, `starsFor`. `api` export near the end.

## Tile ids are old names (save compatibility)
Tile ids and save keys never change; only display `name`s do. Current id -> name: `scallop` Conch, `kelp` Sargassum, `oyster` Oyster, `crab` Hermit Crab, `shrimp` Giant Clam, `jelly` Seagrass, `coral` Staghorn, `urn` Shipwreck, `puffer` Pufferfish, `star` Sea Star, `otter` Mantis Shrimp, `octo` Octopus, `whale` Manta Ray, `turtle` Sea Turtle, `dolphin` Dolphin; parked `anemone`, `clown`. Tag `plant` displays as Flora.

Saves: ui.html stores the run in `localStorage['tidepool.run']` (also `seenHelp`, `playlog`). `start()` only discards a save whose grid is missing or the wrong size, so a renamed id or removed state field breaks players' saved runs. Add new state fields with safe defaults instead of renaming.

## Workflow
- Work on `main`: `git pull` before editing, rebase before pushing, push straight to main (it deploys Pages). Rob wants no PRs for this repo.
- Run `sh build.sh` locally to check the page builds; don't commit its output.
- Balance changes: rerun bots (planner is the reference; greedy and random for spread), compare before/after on the same seeds, and add a vN entry to the README balance log with the numbers. Star cutoffs are calibrated so the planner gets 0/1/2/3 stars about 30/35/25/10% (failures count as 0). Don't add more bots.
- Keep `/mnt/project-files/tidepool` (the project's shared folder) in sync with the repo after pushing. It also holds extra notes not in git: `notes/late-game.md` (tides 11-12 analysis), `notes/predator.md` (invasive-species proposal, partly shipped in v15), their sim scripts, and old ablation outputs.

## Reading tips
- Don't read `tidepool.html` or `dist/index.html` (110+ KB build output). Read `engine.js` or grep `ui.html` instead.
- `ui.html` render functions: `renderReef`, `renderShop`, `renderInfo`, `showTile`, `showHelp`, `runTide`, `endRun`, `showForecast`, `showCharms`. Grep for them.
- `art.js` palettes are keyed by tile id (`PAL.scallop`, ...).

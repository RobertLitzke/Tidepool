# Tidepool

A cozy reef engine builder for phones. Twelve tides, one tiny reef.

Play and install: https://robertlitzke.github.io/Tidepool/ (open in Chrome on Android, then Install app).
Every push to `main` builds and deploys through `.github/workflows/pages.yml`.

- `engine.js`: all rules. Tunables are in `CONFIG` and `TILES` (cost, rarity, effect).
- `ui.html`: touch UI; `/*ENGINE*/` gets replaced by engine.js.
- `build.sh`: `sh build.sh` writes `tidepool.html` (the published single file).
- `sim.js`: `node sim.js 500 [random|greedy|planner|all]` prints finish rate, score spread, stars, pearl curve, tile pick rates.
- `tune.js`: `node tune.js planner 2000 [variant.js] [seed0]` runs bots in parallel for big batches and variant tests (drop-one, cost tweaks); `DUMP=out.json` saves per-run rows.
- `notes/tile-report.md`: per-tile effectiveness, drop-one tests and proposed changes (latest round).

## Balance log
- v1 (2026-10-14): Pufferfish multipliers stacked exponentially, so now max(). Octopus 2→1 per kind. Checkpoints 8 by tide 4, 80 by tide 8; stars 300/600/1000.
  Greedy bot: 81% finish, median 737, stars 0/1/2/3 = 20/73/77/72 of 242 finishers. Random bot: 13% finish.
  Top pearl makers for the bot: Anemone, Coral, Whale, Octopus. Urn and Clownfish look weak.
- v2 (2026-10-14, Rob's feedback: level-ups unclear, early shop too pricey): tile text is now `text(level)`; shop card, reef and info strip show the next level's exact effect. Shop: no rares before tide 3, uncommons rarer on tide 1, and at least 2 of 3 offers are affordable.
  Greedy bot: 85% finish (was 81%), median 786, stars 0/1/2/3 = 32/121/131/142 of 426. Random bot: 9%.
- v3 (2026-10-14, Rob: needs adjacency hints, rerolls too cheap, unclear midgame, Clownfish useless, pearls need a use, stacks should count as multiples):
  Pearls are now spent: 4 rock cells (5/10/16/24 pearls) and Tide Charm markets at tides 3/6/9 (10 charms, base + 6 per market). Goals and score use pearls held.
  Neighbor counts weight by level. Kelp: +1 shell, +1 pearl per touching Kelp. Oyster: +1 per touching shellfish. Clownfish: +2 pearls, +2 per touching Anemone (cost 4). New tiles: 2, then +2 each.
  Goals 15 held by tide 4, 120 by tide 8; stars 500/1000/1800. Tap a tile for feeds/fed/powered hints; every tile shows its next-tide yield.
  Greedy bot: 83% finish, median 902, stars 0/1/2/3 = 58/173/110/73 of 414, 1.2 rocks/run, charms in about 60% of runs (Deep Echo top). Random bot: 7%.
  Late value per level per tide: Anemone 36, Oyster 22, Coral 18, Whale 14, Octopus 12, Clownfish 10, Shrimp 10, Kelp 4 (the one-step bot doesn't build forests).
- v4 (2026-10-14, after drop-one test): Hermit Crab counts touching tiles once (levels don't add). Sea Otter: up to 6 shells per level, 3 pearls per 2 shells. Octopus 7 → 5 shells. Clownfish parked (CONFIG.disabled) because it overlapped Anemone.
  Greedy bot: 85% finish, median 846, stars 0/1/2/3 = 66/189/123/49. Drop-one test (ablation-v4.txt): Conch −29%, Crab −22%, Anemone −14%; Otter +36%, Octopus +25%, Whale +21% still look like traps.
- v5 (2026-10-14, Rob: first charm market came before the tide 4 goal; rocks unclear): charm markets at tides 5/7/9. Rocks are striped "New spot" cells with a price, plus tips in the info line at the start and when the reef is nearly full.
  Greedy bot: 85% finish, median 860; charms bought in about 80% of runs (Deep Echo 29%).
- v6 (2026-10-14, Rob: some tiles should scale forever at a fixed rate, some with declining or negative returns): no level cap. Growth curves: Steady (Conch, Oyster, Kelp, Shrimp, Coral) power = level; Tapering (Anemone, Urn, Pufferfish, Starfish, Otter, Octopus, Whale, Turtle) +1 per 2 levels past ★3; Crowding (Hermit Crab, Jellyfish) falls past ★3 and goes negative from ★7. Stars 500/1000/2000.
  Greedy bot: 85% finish, median 973, p90 3048 (more snowball). Highest level on board p50 5, p90 9, max 15 (Conch). Bot still levels crowded Crabs because neighbors count them by level.
- v7 (2026-10-14, Rob: only a few cheap tiles should stack without limit; most stop at ★3): growth curves removed. All tiles cap at ★3 except Kelp and Conch (stack: true), which level forever at a steady rate.
  Greedy bot: 85% finish, median 883, p90 2259, stars 0/1/2/3 = 69/163/134/58. Highest Conch p50 ★3, p90 ★8, max ★15; highest Kelp p50 ★1, p90 ★4, max ★12. Kelp and Conch make about 5% of final-tide pearls directly (most Conch value shows up in Oysters).
- v8 (2026-10-14, Rob: some early games are unwinnable without pearl tiles): through tide 4 every shop includes an affordable Oyster, Shrimp, Jellyfish or Coral (0 of 2,000 tide-1 shops lack one). Tide 4 goal 15 → 12.
  Greedy bot: 90% finish (was 85%), tide-4 failures 40 → 11 of 500, median 835, stars 0/1/2/3 = 82/194/123/49. With the guarantee alone (goal 15) tide-4 failures were 34, mostly near misses at 11 to 14 pearls.
- v9 (2026-10-14, Rob: Octopus, Hermit Crab, Shrimp and Anemone feel alike; plant vs animal unclear; wants a pricey tile that moves another tile):
  New Dolphin (rare, 7 shells, "Mover"), in the shop only after the tide 4 goal. Place it on an empty spot touching a tile, then move that tile one space up, down, left or right; a filled spot swaps. It makes nothing and leaves the reef at once. Each play is logged in the run (`state.moves`) and in a cross-run `tidepool.playlog` in localStorage.
  Anemone parked to make room. Greedy drop-one test (500 runs, before the Dolphin): none 90% finish / avg 946; without Octopus 88% / 1017; without Hermit Crab 91% / 814; without Shrimp 95% / 1045; without Anemone 92% / 996. Shrimp scored a little better, but Anemone was the "plant" that is really an animal, so cutting it also fixes the kinds: plants are now just Kelp and Coral.
  Kinds are shown by color: shop cards and reef tiles are tinted green (plant), orange (shellfish) or lilac (critter); the help screen labels each tile and has a kinds list in the help, and rules text names the members ("each touching plant (Kelp, Coral)").
  Greedy bot: 91% finish (was 90%), median 850 (was 835), p90 1953, stars 0/1/2/3 = 84/185/146/42. Dolphin played in 11% of runs (0.12 per run).
- v10 (2026-10-15, Rob: tides 11-12 are a grind of stacking whatever fits; see notes/late-game.md in the project files): Conch and Kelp cost 1 more shell for every 2 of that kind you have placed (new tiles and level-ups both count; `CONFIG.stackPriceEvery`). The late snowball was mostly stacked Conch feeding Oysters, which echoes then multiply.
  Greedy bot: 89% finish (was 91%; tide-8 failures 32 → 42 of 500), median 801 (was 850), p90 1809 (was 1953), stars 0/1/2/3 = 93/187/138/29 (was 84/185/146/42). Highest Conch p90 ★9 → ★7, Kelp p90 ★4 → ★3.
- v11 (2026-10-15, Rob: stacking should compete with claiming new spots; a forecast event should shake up the last tides): leveling up a ★3-capped tile costs 2 more per level it already has (Starfish 5 → 7 → 9; `CONFIG.levelUpStep`).
  Forecast: each run gets one event, picked from the seed and shown at the start of tide 5 before the first charm market. It strikes after tide 10 fires. Storm Surge washes away the four center tiles unless one touches 2+ Kelp tiles (a stacked Kelp counts once). Hungry Shark eats the 2 tiles with the most shells spent on them (level-ups and stacking prices count; `tile.paid`). Undertow shifts the whole reef one space left and one row down, wrapping around, rocks included. Threatened tiles get a dashed red outline.
  Retune to keep the old spread: tide 8 goal 120 → 110, stars 500/1000/2000 → 350/650/1300.
  Greedy bot (500 runs; it does not plan for the event, so these are unprepared losses): 91% finish, median 516, p90 1153, stars 0/1/2/3 = 88/208/129/31 (v10 was 93/187/138/29). By event, median vs no event (618): Undertow 558, Surge 526 (3.2 tiles lost), Shark 490. Capped tiles at ★3 on the final board 2.6 → 1.0.
- v12 (2026-10-15, Rob: the Conch always started in the same place; rocks always flat): each new reef starts with one random tile (Conch, Kelp, Oyster or Hermit Crab) on a random open spot, and the 4 rocks sit flat across the bottom half the time or as a shelf piled on the left or right (`CONFIG.startKinds`, `CONFIG.rockLayouts`; the start is saved in `state.start`).
  Starter test (1500 runs, greedy bot): Conch 92% finish, Crab 88%, Oyster 88%, Kelp 83%. With Shrimp, Jellyfish or Urn in the pool they finished 68%, 70% and 51% (an Urn alone makes about 1 shell), so those are left out. Rock layout made no difference (77-78% each).
  Greedy bot, 1000 runs: 88% finish (v11 91%, the fixed center Conch was a strong start), median 475, p90 1009, stars 0/1/2/3 = 185/443/211/39.
- v13 (2026-10-15, Rob: one stacker with a flat price and a modest linear effect; add a stronger bot; best bot should get 0/1/2/3 stars about 30/35/25/10%): Kelp always costs 2 (`flat: true`) and each level makes +1 shell and +1 pearl (no more touching-Kelp pearls). New planner bot: greedy's buy search, but it judges each buy by playing the frozen reef out to tide 12 (discount 0.6 per tide, shells weighted up, pearl chasing when off pace for a goal within 3 tides). Stars 350/650/1300 → 550/1000/1550.
  Kelp variants (1000 runs, planner/greedy avg): old 825/524, +1 shell +1 pearl flat 881/543 (chosen), +1 pearl only 666/384.
  Fresh seeds, failures count as 0 stars: planner (5000 runs) 92.5% finish, avg 865, stars 0/1/2/3 = 31.3/33.9/24.1/10.7%. Greedy (3000) 89.4%, avg 537, 63.6/26.5/7.9/2.0%. Random (3000) 10.3%, avg 69, all 0 stars.
  Drop-one (1000 runs, planner): Conch −29%, Crab −16%, Kelp −6%, Turtle −6%; Shrimp +23%, Otter +13%, Jelly +11%, Octopus +9%, Coral +9% (weaker than the shop slot they use). Proposals in notes/tile-report.md (not applied): Otter keeps your shells (+1 pearl per 3 held), Shrimp base pearl, Coral 3 shells.
- v14 (2026-10-15, Rob picked tile changes from notes/tile-report.md): Coral 4 → 3 shells. Sea Otter 6 → 4 shells, trades up to 6 shells a level at 2 pearls per shell (was 3 per 2). Shrimp +1 pearl, +1 more per touching plant. Whale 8 → 7, Octopus 5 → 4. Stars 550/1000/1550 → 500/1000/1500.
  Fresh seeds (failures count as 0 stars): planner (5000 runs) 97.2% finish (v13 92.5%), avg 971 (865), stars 0/1/2/3 = 19.8/39.3/24.7/16.2%. Greedy (3000) 93.7%, avg 547, 56.7/33.8/7.0/2.5%. Random (3000) 22.4% finish, avg 116, 99.5% 0 stars.
  Planner p30/p65/p90 = 605/1105/1714, so cutoffs near 600/1100/1700 would bring it back to 30/35/25/10. Otter is now bought in 81% of planner runs (was 71%) and makes 22 pearls per shell spent, the best rate of any tile.

## Installable app (PWA)
`sh build.sh` also writes `dist/`: index.html, manifest, offline service worker (cache-first, version-stamped per build), icons from `pwa/icons` (rendered by a canvas script). GitHub Pages hosts `dist/`, open it in Chrome on the Pixel, then Install app.

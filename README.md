# Tidepool

A cozy reef engine builder for phones. Twelve tides, one tiny reef.

Play and install: https://robertlitzke.github.io/Tidepool/ (open in Chrome on Android, then Install app).
Every push to `main` builds and deploys through `.github/workflows/pages.yml`.

- `engine.js`: all rules. Tunables are in `CONFIG` and `TILES` (cost, rarity, effect).
- `ui.html`: touch UI; `/*ENGINE*/` gets replaced by engine.js.
- `build.sh`: `sh build.sh` writes `tidepool.html` (the published single file).
- `sim.js`: `node sim.js 500 [greedy|random|all]` prints finish rate, score spread, stars, pearl curve, tile pick rates.

## Balance log
- v1 (2026-10-14): Pufferfish multipliers stacked exponentially, so now max(). Octopus 2→1 per kind. Checkpoints 8 by tide 4, 80 by tide 8; stars 300/600/1000.
  Greedy bot: 81% finish, median 737, stars 0/1/2/3 = 20/73/77/72 of 242 finishers. Random bot: 13% finish.
  Top pearl makers for the bot: Anemone, Coral, Whale, Octopus. Urn and Clownfish look weak.
- v2 (2026-10-14, Rob's feedback: level-ups unclear, early shop too pricey): tile text is now `text(level)`; shop card, reef and info strip show the next level's exact effect. Shop: no rares before tide 3, uncommons rarer on tide 1, and at least 2 of 3 offers are affordable.
  Greedy bot: 85% finish (was 81%), median 786, stars 0/1/2/3 = 32/121/131/142 of 426. Random bot: 9%.

## Installable app (PWA)
`sh build.sh` also writes `dist/`: index.html, manifest, offline service worker (cache-first, version-stamped per build), icons from `pwa/icons` (rendered by a canvas script). GitHub Pages hosts `dist/`, open it in Chrome on the Pixel, then Install app.

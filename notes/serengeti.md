# Serengeti (eco-serengeti.js)

Rob's spec (2026-10-16), as built. Two mechanics only: the 1-turn Wet/Dry pulse and Lush/Grazed flora.

## Phases (shared engine concept)
`engine.js` now has a generic phase layer that the forest's seasons and the Serengeti's wet/dry both use:
- `CONFIG.calendar` (forest: months -> seasons) or `CONFIG.cycle` (Serengeti: `['wet', 'dry']`, one per round, repeating).
- `state.phaseAt[tide]` overrides either (Endless Drought sets turn 11 to dry).
- `TP.phase(state, tide)` (alias `TP.season`), `TP.phased`, `ctx.phase` in tile `fire`, `CONFIG.phaseIncome` (per-phase income), eco `seasons: { id: { name, emoji } }` for the UI.
- New generic hooks: `hooks.startTide`, `hooks.onLevelUp`, `hooks.tileState` (board badge), `afterFire(state, events, fire)` can fire tiles again, tile `beforeEcho`, tile `repeats`, mover `onMove`, event `strike(state) -> { lost, note }`, and charm hook values may be functions of state (`shopBonus`, `freeRerolls`, `income`, `costDelta(kind)`).
Reef and forest give byte-identical bot runs on the same seeds before and after.

## Rules
- Odd turns Wet: start of turn, all flora Lush; +3 seeds at turn end. Even turns Dry: no reset; +1 seed. Goals (12 amber at turn 4, 110 at turn 8) fall on Dry turns.
- Grazed flora still fire normally. Grazing: Gazelle (1 touching Lush flora, highest level then reading order), Wildebeest (all). Restoring: Wet start, placement/level-up, Oxpecker, Dung Beetle, Crocodile (wet), Waterhole (turn end), Elephant.
- 16 tiles, 3 events, 10 Treasures exactly as in the spec table; tile ids are the spec's (`red_oat_grass`, `dung_beetle`, ...).

## Calls made where the spec was open
- Flash Flood: Dry turns pay 3 seeds total (the same as Wet), not 1 + 3.
- Oasis Mirage "fires twice" = the tile activates twice in a row (`repeats`), so a Cheetah only boosts the first.
- Oxpecker restores one Grazed flora (highest level) touching the tile above it, once, then echoes L times.
- Great Migration: every grazer marches, Zebra and Giraffe included. Whatever a grazer steps onto takes the spot it left. Their graze is cleared again by the turn 11 rain; the +5 amber each is the payoff.
- Brushfire: ties between rows go to the higher row.
- Fresh Sprouts amber from mid-turn restores (Dung Beetle) is part of that tile's output, so a Cheetah multiplies it.
- Acacia counts its own level ("per Acacia level on the board"), like the reef's Seagrass.
- Kopjes clear for amber only (no seed option, like the reef).

## Changed from the spec after bot runs (v20)
- Baobab Dry: +L amber per age (spec 2L). With 2L the planner averaged 2165 amber and Baobab made 1132 of it (half of all amber; 4157 in the top 10% of runs).
- Stars 500/1000/1500 -> 950/1700/2700 so the planner gets 0/1/2/3 about 30/35/25/10% (CLAUDE.md rule). With the spec's stars it got 3 stars in 45% of runs.

## Bot caveats
The bots value a Treasure only by the next turn's frozen yield, so they never buy Migration Trail, Flash Flood, Deep Taproot, Oasis Mirage or Termite Symbiosis. Their real value is untested.

## v21: Grazed made common (Rob)
- Every Dry turn starts with all flora Grazed except the ones a Waterhole waters. Wet turns still start all Lush.
- A Waterhole waters only the three touching cells in the row above it (end of turn, and at the start of Dry turns).
- Stars 950/1800/2850. Flora Grazed at the start of Dry turns: 27% -> 66%.
- `CONFIG.graze` keeps the other tested knobs (off): `zebra` (Zebras graze 1 Lush flora), `herdRain` (the rain skips flora beside a grazer), `dung`/`croc`/`waterhole` (max flora restored per level).

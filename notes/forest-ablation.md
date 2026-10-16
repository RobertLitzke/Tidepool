# Forest drop-one test (2026-10-15, v18 plus the Beech dropping leaves in March and April)

How it was run: the planner bot played 600 runs per row on the same seeds (9000 to 9599), once with the full shop and once with each tile removed from the shop. If the score drops when a tile is removed, that tile is pulling its weight. If the score rises, the tile is weaker than whatever the bot would buy in its place. Differences under about 2% are noise.

Baseline: average 1022 amber, 98.2% of runs finished, stars 0/1/2/3 = 28/31.5/29.5/11%. That's on target, so the current star cutoffs still fit.

| Tile removed | Average | Change | Reading |
|---|---|---|---|
| Bumblebee | 911 | −10.9% | Strongest. It's the engine's multiplier, so a big effect is fine. |
| Mountain Laurel | 909 | −11.1% | Strongest even after the v18 nerf. Earns 23 amber per seed spent; the next best earns 8. |
| Beech | 954 | −6.7% | Strong. |
| Sugar Maple | 975 | −4.6% | Good. It carries the February goal: removing it triples failures there. |
| Black Bear | 977 | −4.4% | Good. |
| White Oak | 989 | −3.2% | Good. |
| Birch | 1008 | −1.4% | Fine. |
| White-tailed Deer | 1010 | −1.2% | Fine. |
| Chipmunk | 1034 | +1.2% | Slightly weak. |
| Witch Hazel | 1047 | +2.4% | Weak. |
| Gray Squirrel | 1068 | +4.5% | Weak. |
| Trillium | 1079 | +5.6% | Weak. |
| Wild Ginger | 1094 | +7.0% | Weakest. |

## Retunes tried (same seeds)
- **B:** Wild Ginger makes +3 amber per level instead of +2. Witch Hazel makes +2 amber instead of +1. Mountain Laurel costs 5 instead of 4. Gray Squirrel gets +1 seed as a base. Result: average 1128.
  - Dropping a tile from B: Bumblebee −10%, Laurel −4.8%, Ginger +1.6%, Hazel +1.7%, Squirrel +5.0%, Trillium +5.8%. Laurel and Ginger end up close to the rest; Trillium and Squirrel are still weak.
- **C:** B plus Trillium at +3 amber per level instead of +2. Result: average 1199.
  - Dropping a tile from C: Trillium −0.3% (now pulls its weight), Ginger +2.7%, Squirrel +4.5% (still weak).
  - The greedy bot gets an average of 1136 on C.

## Applied in v19 (2026-10-16): retune C with a 2-seed Squirrel
Stars are now 1115/1280/1450, so the planner gets 0/1/2/3 stars 30/34/26/10%. The Squirrel still tests weak: dropping it raises the planner's average by 4%.

## Suggested retune (C), plus stars
- Mountain Laurel costs 5 seeds instead of 4.
- Wild Ginger makes +3 amber per level instead of +2.
- Witch Hazel makes +2 seeds and +2 amber instead of +2 seeds and +1 amber.
- Trillium makes +3 amber per level instead of +2.
- Gray Squirrel makes +1 seed, plus 1 more for each touching tree (it was only 1 per touching tree).
- Stars move up to about 1100/1270/1430 to match the higher scores (the planner gets 0/1/2/3 stars 30/35/25/10%).

## Still open
The Squirrel stays weak even after its buff. Seed makers in general (Squirrel, Chipmunk, Hazel) test weaker than amber makers. That suggests seeds aren't actually short for a bot that plans; the bots get by on 3 seeds a month plus the Oak.

Two options:
- Make the Squirrel cheaper (2 seeds).
- Give the Squirrel some amber too, for example +1 amber for each touching tree in fall.

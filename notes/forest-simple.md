# Forest, simplified

Built in v18 (2026-10-15) with Rob's additions: leaves also land on empty spots (a critter placed there gets 2 seeds a leaf; a plant grows from them), a new Chipmunk (+2 seeds, spring) and a seed-making Birch. Live numbers are in `eco-forest.js`; tuned values (Laurel 4 seeds and uncommon, Trillium 2, Deer 4, goals 40/300, stars 925/1080/1250) differ from the starting numbers below.

The forest in v17 has too many interactions to plan around. This proposal cuts it back to two ideas: **every tile has a season**, and **one core mechanic**. A few tiles interact with that mechanic. Everything else is a plain, readable effect.

## Rule 1: seasons
Every tile has one season and only two states:

- **Producers** (most tiles) make their normal amount all year and **×2 in their season**.
- **Helpers** (Bumblebee only, for now) are **on in their season and off the rest of the year**.

There's no dormancy, hibernation, shop windows, migration or per-month special cases. The ✦ mark and the year strip show which tiles are in season.

## Rule 2: one core mechanic
Recommended: **Leaves.**

> In fall (September, October and November), each tree drops 1 leaf on every touching understory plant. Every 2 leaves grows that plant one level, for free, up to ★3.

Why this one: it's the most seasonal of the three ideas, you can see it on the board, and it's easy to plan. A plant touching 2 trees grows one level per fall month. Trees become worth more for where they stand, not only for what they make.

The other two options, and why I'd pass on them:

- **Felling** (cut a tree for its value): it rewards tearing your board down, which pulls against building an engine.
- **Stashing** (tiles plant new tiles nearby): it fills spots without asking you, and that's the kind of surprise we're trying to remove.

Tiles that touch the mechanic: **Beech** (keeps its leaves and drops them in March and April instead, the one mid-year source), **Wild Ginger** (grows from 1 leaf, not 2), and the **Deep Litter** Heirloom (trees drop 2 leaves).

One wrinkle: the run goes November to October, so leaves fall in month 1 and months 11 to 12. The early drop is a good teaching moment, since the starters touch. Mid-year growth comes only from the Beech. If that feels thin, start the year in October so fall covers months 1 and 2.

## Logs
There's no Stash object any more. Tapping a log offers a one-time choice: clear it for **10 seeds or 5 amber**. Each later log costs more (the rises still need tuning).

## Tiles (12, down from 16)
Numbers are starting points for the bots to tune.

| Tile | Kind | Season | Effect (×2 in season unless a helper) |
|---|---|---|---|
| White Oak | Tree | Fall | +2 seeds, +1 per touching White Oak |
| Sugar Maple | Tree | Winter | +3 amber |
| Beech | Tree | Fall | +1 amber per touching critter. Drops its leaves in March and April, not fall |
| Birch | Tree | Summer | +1 amber, +1 per touching empty spot |
| Trillium | Understory | Spring | +3 amber |
| Mountain Laurel | Understory | Summer | +1 amber per touching tree |
| Witch Hazel | Understory | Fall | +2 seeds, +1 amber |
| Wild Ginger | Understory | Winter | +2 amber. Grows from 1 leaf |
| Gray Squirrel | Critter | Fall | +1 seed per touching tree |
| Black Bear | Critter | Summer | +1 amber per touching tile |
| White-tailed Deer | Critter | Spring | +3 amber |
| Bumblebee | Critter, helper | Spring and summer | On: touching understory plants make ×2. Off the rest of the year |

**Cut:** Wood Frog (echo), Wood Thrush (migration), Beaver (felling), Seedlings, caches, litter-eating, Birch growth, Deer browsing, the Bear eating seeds, and the Forager's Stash.

## Events (forecast after month 10, as now)
- **Derecho:** your 2 biggest trees fall into logs.
- **Drought:** understory plants make nothing in September and October.
- **Mast Year:** White Oaks and Squirrels make ×3 in fall.

## Heirlooms
Cut to ones that touch seasons or leaves:

- Deep Litter: trees drop 2 leaves.
- Long Summer: summer tiles are in season in September too.
- Busy Bees: Bumblebees are on all year.
- Rich Soil: understory +1 amber.
- Thicket: critters touching 2+ critters +1 amber.
- Seed Rain: +3 seeds a month.
- Clearing: a 4th shop slot.
- Tailwind: one free New tiles a month.

## After you pick
Build it, rerun the bots to retune the goals and stars (same targets as the reef), update the help text, and push.

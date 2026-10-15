# Deciduous Forest, and ecosystems as data

The forest design, rev 3 (forest tiles and invasives built on their own seasonal dynamics; Beech, Birch and new understory plants; bonuses are Treasures at sea and Heirlooms on land). Built in v17 except the invasives; **As built** below lists where the code differs. It covers three things: turning the game's names, look and rules into a per-ecosystem preset, an ecosystem picker, and the second ecosystem, an Eastern US hardwood forest played over one year, from November to harvest.

Built on main at 5867991 (v16 reef, sticker art, stars 500/1000/1500), the "Mechanics & Ecosystems" doc, and `notes/predator.md`.


## As built (v17, 2026-10-15)
The live numbers are in `eco-forest.js` (`CONFIG` and `CONFIG.k`); tile texts there are the source of truth. Where the build differs from the outline below:
- **Not built yet:** the invasives (Spongy Moth, Garlic Mustard, Jumping Worm). Event pool is Derecho, Drought, Mast Year.
- **Economy:** 3 seeds a month; starters are a White Oak plus one of Wild Ginger, Mountain Laurel or Witch Hazel; 2 fallen logs at random spots, cleared for 4/8/12/18/24/30 amber. Goals 14 amber in February, 100 in June (greedy bots can't plan seasons, so June is lenient); stars 500/650/850.
- **Litter:** up to 3 per spot. Trees drop it September to November, the Beech in April, and any tile that leaves (sold, felled, eaten) leaves litter equal to its level (not a migrating Thrush).
- **Caches:** you can dig one up for 4 amber; placing a tile on it gives back its 3 seeds. Squirrels earn +1 amber per touching cache from December to March instead of digging them up. Caches sprout at the end of March.
- **Seed sources added for balance:** Oak and Beech make seeds in leaf (May to August), Squirrels +1 seed per touching tree April to August.
- **Birch** seeds a touching log into a Seedling in **May**, not October. The trader is the **Forager's Stash** (first log cleared, 10 for 5 either way, once a month).
- **Beaver** is a feller: tap a tree, it becomes a log and you get back every seed spent on it.
- Bot numbers (300 planner runs): 100% finish, avg 619 amber, stars 0/1/2/3 = 25/40/25/10%.

## 1. What an ecosystem is

An ecosystem is one data module. The engine runs whichever one it is given, Simple ecosystems are pure data. The forest also needs a few new rule hooks (a calendar, per-cell layers, tiles that change over time), and later ecosystems can reuse them.

| Part | Reef (today) | Deciduous Forest |
|---|---|---|
| Realm | Sea | Land |
| Build currency | Shells | Seeds |
| Score currency | Pearls | Amber |
| Board | Reef | Forest floor |
| Round | Tide (1 to 12) | Month (November to October) |
| Blocked cell | Rock | Fallen log |
| Kinds | Critter, Flora, Shellfish | Tree, Understory, Critter |
| Bonuses (permanent rule tweaks) | Treasures | Heirlooms |
| Forecast event | Surge, Shark, Undertow | Derecho, Drought, Mast Year |
| Invasive (proposal) | Lionfish, Sea Urchin, Drill Snail | Spongy Moth, Garlic Mustard, Jumping Worm |
| House rule | Stacking vs new spots | The year: leaf-out and leaf fall, litter, caches, seedlings |

**Currencies come from the realm.** Every sea ecosystem uses shells and pearls, and every land ecosystem uses seeds and amber, as Rob set. An ecosystem names its own board, round and blocked cell.

**Bonus terms.** One word per realm for the permanent rule tweaks you buy mid-run: **Treasures** for every sea ecosystem (the reef's old Tide Charms) and **Heirlooms** for every land ecosystem (heirloom seeds carry traits forward). The market just uses the term: the Treasures button, the Heirlooms sheet. Both are placeholders, and the open questions list alternatives.

**The ecosystem module holds:**
- `terms`: realm, board, round (with a `roundName(n)` so the forest can say "March"), blocked cell, bonus term (Treasures at sea, Heirlooms on land) and its market, and singular and plural forms. Amber is a mass noun, so it reads "+1 amber" and "+3 amber", never "ambers".
- `config`: today's `CONFIG` (board size, income, checkpoints, stars, rocks, shop rules, starters, event timing), plus an optional `calendar` (round to month and season).
- `kinds`, `tiles`, `charms`, `events` and `invasives`. Simple tiles keep today's shape. Forest tiles add per-month hooks (see below).
- `theme`: CSS color tokens for light and dark, the board background, and the season tints.
- `art`: the sticker-style SVG symbols for its tiles, blocked cell and two currencies. Seed is an acorn, and amber is a gold teardrop with a tiny leaf caught inside.

### What has to change in the code

These are the places where the engine and UI assume the reef today:

- **Tile ids in rules.** `runTide` checks for `puffer` (booster), the `heart` charm checks `coral`, and the surge counts `kelp`. These become flags and hooks on the tile or event: `booster: true`, a grower flag the charm reads, and each event's own `threat(state)` and `strike(state)`.
- **Charm ids in rules.** `runTide`, `tileCost`, `shopSize` and `rerollCost` check charm ids by name. Each charm gets hooks instead (`bonus`, `income`, `shopSize`, `costDelta`, `rerollFree`, `echoExtra`, `firstFiresTwice`, `growRate`), so a forest charm can reuse a reef effect under its own name. The `CHARMS` table and ids stay internal; the UI only ever shows `terms.bonus`.
- **Kind ids.** `plant`, `shellfish` and `critter` become whatever the ecosystem declares. The forest uses `tree`, `understory` and `critter`.
- **Text.** Tile, charm, event and help text use helpers such as `amt(n, 'score')`, which renders "+2 pearls" or "+2 amber" with the right icon. The "Tide Charms" button, sheet titles and help text become `terms.bonus`. The roughly 250 mentions of "tide", "reef", "shell" and "pearl" in `ui.html` become `terms` lookups.
- **New engine hooks for the forest.** A `calendar`; per-cell layers next to `rock` (`litter` and `cache` counts); tile hooks `onMonthStart`, `fire(c, L)` with the month and season in `c`, and `onMonthEnd`; per-tile flags (`pollinated`, `defoliated`, `away`); and the ability for a rule to place, replace or remove tiles (seedlings sprouting, a seedling growing into a tree, the Beaver felling a tree into a log). Removing a tile for any reason drops litter, so this goes in one `removeTile` helper.
- **Saves.** Keys move from `tidepool.run` to `tidepool.reef.run` and `tidepool.forest.run`, with a one-time migration so a reef run in progress survives. Best stars and the play log are kept per ecosystem.
- **Bots.** `sim.js` and `tune.js` take `--eco forest`. The planner already judges buys by playing the frozen board to the end through `runTide`, so it sees seasons, caches and seedlings for free, as long as they all run inside `runTide`.

**Step 1 must change nothing on the reef.** After the refactor, the same seeds should give the same planner and greedy numbers to the pearl. That is the test that the abstraction is clean.

## 2. The ecosystem picker

- **Home screen.** The app opens on a short list of ecosystem cards instead of going straight into a run. Each card shows its art, name, region, a kindness rating (Very kind to Very harsh), the headline mechanic in one line, your best stars, and Continue if a run is in progress.
- **Separate runs.** Each ecosystem keeps its own saved run, so switching doesn't throw one away. The in-run menu gets "Ecosystems" next to "New run".
- **Theme.** The page takes the chosen ecosystem's color tokens, so the reef stays blue and sandy and the forest has leaf-litter browns. The forest board also changes tint with the season (see below).
- **Locking.** Both are open from the start. Locks or unlocks can come later if the list grows.
- **Name.** The app can stay "Tidepool" for now, with Reef as the first card. A broader name is a separate decision once there are three or more ecosystems.

## 3. Deciduous Forest

**Vibe.** An Appalachian hardwood forest through one full year. Leaf litter in November, snow and sap buckets in winter, trilliums and wood frogs in spring, bees and thrushes in summer, and a harvest of acorns, berries and amber in the fall.

**Kindness.** Very kind, as the earlier writeup proposed. You start with 2 tiles and only 2 fallen logs, the logs are cheap to clear and reveal a trader, and one of the three forecast events is a gift.

**The idea.** The reef is about where a tile sits. The forest is about *when*. Tiles have their own calendars: trees leaf out and drop their leaves, sap runs for two months, wildflowers bloom before the canopy closes, frogs freeze and thaw, birds come and go. Their output also flows from one season into the next. Fall leaves become winter food for the understory, acorns buried in fall sprout into oaks by summer, and spring pollination pays off in the late blooms.

### The year

Twelve rounds are twelve months. The run opens in fall and closes at harvest.

| Month | Nov | Dec | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| Season | 🍂 Fall | ❄️ Winter | ❄️ | ❄️ | 🌸 Spring | 🌸 | 🌸 | ☀️ Summer | ☀️ | ☀️ | 🍂 Harvest | 🍂 |
| Trees | Leaf fall | Bare | Bare | Bare | Bare | Bare | Leafed | Leafed | Leafed | Leafed | Leaf fall | Leaf fall |
| Beat | 2 starters | | | **Goal: winter stores** | Event revealed, invasive arrives, Heirlooms | Caches sprout | Heirlooms | **Goal: midsummer** | Heirlooms | Event strikes | | Final count |

Each season gets three months, so fall is November plus September and October. The goals, Heirloom markets and event stay on the same rounds as the reef: goals after rounds 4 and 8, markets at 5, 7 and 9, and the event revealed at 5 and striking after 10. That way the reef's pacing carries over.

### How the forest works

- **Peak season.** Most tiles have one, shown as a badge (🍂 ❄️ 🌸 ☀️). By default a tile makes ×2 in its peak season. Most forest tiles do something of their own in their peak instead, and the tile table spells it out.
- **The canopy.** Trees are bare from December to April and make nothing then, except the Sugar Maple's sap and the Beech, which holds its dead leaves all winter. They leaf out from May to August, and drop their leaves from September to November.
- **Leaf litter.** In each leaf-fall month, every tree drops 1 litter on its own cell and on each touching cell, up to 3 per cell. The Beech drops its leaves in April instead, 2 litter, when new buds push them off. Any tile that leaves the board, whether sold, eaten, felled or blown down, leaves litter equal to its level. Wild Ginger and Trillium feed on litter, and the Jumping Worm eats it.
- **Caches.** Squirrels bury your seeds in touching empty cells. A cache still buried at the start of April sprouts into a Seedling.
- **Seedlings.** A seedling is a free tile that makes nothing. After 3 leafed months it grows into its tree at ★1: an Oak from a cache, a Maple from samaras, or a Birch from a log. An acorn buried in November is an Oak by August, in time to mast at harvest. Deer browse seedlings.
- **Fallen logs.** There are 2 at the start, cleared with amber at a cheaper ladder than the reef's rocks. Clearing one reveals a **Forager's Stash** trader: 10 seeds for 5 amber, or 10 amber for 5 seeds, once a month. The Derecho and the Beaver make new logs, and a Birch can turn one touching log into a Birch Seedling in May, so a log isn't just dead space. A log cleared that way still reveals its trader.

**Readability.** A year strip across the top shows the current month, the season colors, the two goal months and the event month. Litter shows as 1 to 3 leaf pips on a cell, a cache as a small acorn, and a seedling as a sprout with "2 months to grow". Tiles in their peak glow, and dormant tiles (bare, frozen, hibernating, underground) are drawn faded. Shop cards say "Peaks now" or "Peaks in 3 months". The next-month yield on each tile already includes all of this. The board tint follows the year: brown litter, then snow, then fresh green, then deep green, then gold.

### Tiles

Fifteen tiles in three kinds: 4 trees, 4 understory and 7 critters. The numbers are starting points for sims; L is the tile's level.

**Trees**

| Tile | Peak | Cost | Through the year |
|---|---|---|---|
| 🌳 White Oak | 🍂 | 3, common | **Fall:** mast. +2L seeds (acorns), +L more for each touching Oak, since oaks mast together. **Leafed:** +L amber. Bare in winter. |
| 🍁 Sugar Maple | ❄️ | 3, common | **Feb to Mar:** the sap run, +3L amber. It's the one tree that earns in winter. **May:** drops samaras, planting a Seedling on one empty touching cell. **Leafed:** +L seed. |
| 🪵 Birch | ☀️ | 3, uncommon | The pioneer, a fast grower that loves light. It grows each leafed month (2 if it touches 2 or fewer tiles, else 1) and makes +L amber per month grown. It doesn't grow while bare. **October:** turns one touching log into a Birch Seedling. |
| 🍃 Beech | 🍂 | 4, uncommon | Keeps its dead leaves all winter instead of going bare. **Dec to Mar:** +L amber a month. **April:** new buds push the old leaves off (2 litter). **May to Aug:** +L seed. **Sep to Oct:** beechnuts, +L amber for each touching critter. |

**Understory**

| Tile | Peak | Cost | Through the year |
|---|---|---|---|
| 🌷 Trillium | 🌸 | 2, common | A spring ephemeral that blooms before the canopy closes. **Mar to Apr only:** +2L amber, +L more per litter on its cell. Underground the rest of the year: it makes nothing, but nothing can eat it. |
| 🌺 Mountain Laurel | ☀️ | 3, common | Evergreen: +L amber every month. **Dec to Mar:** +L more for each touching bare tree, because light reaches the floor. **June:** blooms, +3L amber (×2 if pollinated). Poisonous, so deer never browse it and touching tiles are safe from browsing. |
| 🌼 Witch Hazel | 🍂 | 2, common | The last flower of the year. **Oct to Dec:** blooms, +2L amber (×2 if pollinated). **Sep to Oct:** its pods burst, flinging +L seeds for each touching empty cell (up to 3L). Otherwise +L seed. |
| 🌿 Wild Ginger | Year-round | 3, common | A groundcover that carpets the litter. Each month it eats up to 2L litter from its own and touching cells, for 2 amber each. It eats only L in December to February, when the ground is frozen. |

**Critters**

| Tile | Peak | Cost | Through the year |
|---|---|---|---|
| 🐿️ Gray Squirrel | 🍂 | 3, common | **Fall:** buries L caches of 3 of your seeds on touching empty cells. **Dec to Feb:** digs up one cache a month for 6 amber. Caches it never dug up sprout into Oak Seedlings in April. **Spring and summer:** +L seed. |
| 🐻 Black Bear | 🍂 | 5, rare | **Fall:** eats up to 4L seeds for 2 amber each. **Dec to Mar:** hibernates, making nothing, and nothing can harm it. **Apr to Aug:** +L amber for each touching tile. |
| 🦌 White-tailed Deer | Year-round | 6, rare | +2L amber every month. **Each spring month** it browses one level off a touching Seedling, Trillium, Witch Hazel or Wild Ginger, smallest first. It never eats Mountain Laurel or Garlic Mustard. |
| 🐸 Wood Frog | 🌸 | 5, uncommon | **Dec to Feb:** freezes solid, so it makes nothing and can't be harmed. **Mar to Apr:** chorus from the vernal pool, echoing every touching tile once per level. **Rest of the year:** +L seed. |
| 🐝 Bumblebee | ☀️ | 4, uncommon | Active from April to September; the queen hibernates the rest of the year. A booster: the next tile to fire makes ×(1+L). **Apr to May:** it also pollinates every touching Mountain Laurel and Witch Hazel, which keep a ✿ mark for the rest of the run and bloom ×2. |
| 🐦 Wood Thrush | ☀️ | 3, uncommon | A migrant, in the shop only from April to August. It flies south at the end of August, freeing its cell for fall. While it's here, +L amber for each touching leafed tree, and touching trees are safe from the Spongy Moth. |
| 🦫 Beaver | 🍂 ❄️ | 6, rare | In the shop from September to February. Place it beside a tree: it fells the tree into a log, pays you every seed you spent on that tree, then leaves. Use it to open space, make a nurse log for a Birch, or save a tree's value before the Derecho. |

**Starters.** A White Oak, plus a Wild Ginger, Mountain Laurel or Witch Hazel, on random spots. In November the Oak drops the first litter, and the second tile turns that litter, the bare winter light or the late bloom into amber for the February goal.

**Shop.** Through February, every shop has at least one affordable winter earner: Mountain Laurel, Wild Ginger, Witch Hazel or Sugar Maple. The Wood Thrush and Beaver appear only in their months. Everything else is in the shop all year, so you can buy ahead of a tile's peak.

### Heirlooms (the forest's bonuses)

Heirlooms are bought with amber at markets in March, May and July (the reef calls its bonuses Treasures). Half are forest-only and half are the reef's economy effects under forest names.

| Heirloom | Effect |
|---|---|
| Deep Litter | Trees drop 2 litter instead of 1 |
| Good Mast | White Oaks count each touching Oak twice |
| Early Thaw | The sap run, Trillium and Wood Frog all start in February |
| Old Growth | Seedlings grow into trees a month sooner |
| Rich Soil | Understory tiles make +1 amber when they fire |
| Thicket | Critters touching 2+ critters make +1 amber |
| Harvest Moon | The first tile in the forest fires twice |
| Seed Rain | +3 seeds each month |
| Clearing | The shop shows 4 tiles |
| Tailwind | The first reroll each month is free |

### Forecast events

Each event is revealed in March and strikes after August, the same rounds as the reef. Because the forest is kind, one of the three is a gift.

| Event | Kind | Effect |
|---|---|---|
| 🌪️ Derecho | Hazard | A summer windstorm knocks down the 2 trees you spent the most seeds on. Each leaves a log and its litter. |
| 🏜️ Drought | Hazard | In September and October, understory tiles make nothing unless they touch 2+ trees for shade, and litter doesn't rot, so Wild Ginger goes hungry. |
| 🌰 Mast Year | Gift | In September and October, White Oaks make ×2 and Squirrels bury twice as many caches. |

### Invasives (if the predator proposal ships)

Each invasive arrives in March (round 5, like tide 5 on the reef) and is telegraphed the same way as in `notes/predator.md`. Each one has its own pattern, though, not the reef's walk-and-bite, and each has a counter you can build toward.

| Invasive | What it does | Counter |
|---|---|---|
| 🐛 Spongy Moth | An egg mass appears on a random tree in March. The caterpillars hatch in May and spread to one touching tree each leafed month. A defoliated tree makes nothing until September and drops no litter that fall. The moths die off in September. | A Wood Thrush keeps the trees it touches safe. Selling or felling the infested tree stops the spread. |
| 🌱 Garlic Mustard | Sprouts on an empty cell in March and spreads to one touching empty cell each spring month. Its cells are blocked, and understory tiles touching it make nothing, because it poisons the soil they grow in. Deer leave it alone. | Pull a patch for a few seeds, like clearing a cheap log. Filling empty cells before March gives it nowhere to go. |
| 🪱 Jumping Worm | Arrives on the cell with the most litter. Each month from March to November it eats all the litter on its cell, then moves to the litter-richest cell within 2 spaces. | Race it: keep Wild Ginger eating, so litter doesn't pile up where the worm can reach it. |

The moth hits trees in summer, the mustard hits the understory and empty space in spring, and the worm hits the litter economy. Each one pressures a different part of the year.

### What to watch in sims

- **The winter goal.** The early earners are Mountain Laurel, Witch Hazel's November and December bloom, Wild Ginger on the starter Oak's litter, Squirrel digs, and the Maple's sap in February. Check fail rates by starter.
- **Fall at the end.** Oak mast, Beechnuts and the Bear all peak in the last two months, when engines are biggest. Spring tiles have short, strong windows (Trillium, the Wood Frog's echo). Compare amber per seed spent by peak season.
- **The Wood Frog.** Echoing up to 8 neighbors per level is the biggest swing in the set. It may need a cap of one echo per tile.
- **Delayed payoffs.** Greedy will undervalue caches, seedlings and pollination. The planner plays the frozen board out to the end, so it should see them, but this needs checking.
- **Stars.** Calibrate on the planner bot to the same 30/35/25/10% split as the reef. The forest's kindness then shows up as a higher finish rate rather than easier stars.
- **Phone readability.** Litter, caches, seedlings and dormant tiles are four new board states. Test them on the Pixel before tuning numbers.

## 4. Build order

1. **Ecosystem refactor.** Reef only, with no behavior change. Pass: same seeds, same numbers.
2. **Picker and per-ecosystem saves.** Includes the save migration and the theme tokens.
3. **Forest engine hooks.** The calendar, the litter and cache layers, per-month tile hooks, tile flags, and spawning and transforming tiles. Serengeti and Tundra can reuse the calendar later.
4. **Forest data and art.** 15 tiles plus the Seedling, logs, litter, caches, the seed and amber icons, and the season tints, all in the sticker style.
5. **Sims and tuning.** Planner and greedy on `--eco forest`, drop-one tests and star calibration, logged in README.md like the reef. Invasives come after the base forest is tuned, as on the reef.

## Open questions

- **Season split.** Is fall as November, September and October right, or should the run start in October and end in September?
- **Mast Year as a gift.** Keep one gift in the event pool, or use three hazards like the reef?
- **Bonus terms.** Are Treasures (sea) and Heirlooms (land) right? Other options: Boons, Keepsakes, Blessings.
- **Third understory plant.** Wild Ginger takes over the litter-eating job. Alternatives: Mayapple, Spicebush, Bloodroot.
- **App name.** Keep Tidepool for now?

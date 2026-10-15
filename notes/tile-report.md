# Tidepool tile report (v13, 2026-10-15)

Names here are from when the report was written. Since then: Kelp is Sargassum, Coral is Staghorn, Starfish is Sea Star, Sea Otter is Mantis Shrimp, Shrimp is Giant Clam, Jellyfish is Seagrass, Urn is Shipwreck, Whale is Manta Ray, and plants are Flora.

Built on main after v12 (random starts, tide-10 events, level-up pricing), with this round's changes: flat-price Kelp, the new planner bot and new star cutoffs. Every number is a bot average over 1,000 to 5,000 runs. Runs are cheap, so the batches are big. Rerun with `node tune.js <bot> <runs> [variant.js] [seed0]`.

## What changed this round

- **Kelp is the flat linear stacker.** It always costs 2 shells, however many you place, and each level gives exactly +1 shell and +1 pearl a tide (★5 Kelp = +5 / +5). It no longer gets pearls from touching Kelp, so a forest doesn't grow quadratically. Shrimp still counts a ★5 Kelp as 5 plants.
  Kelp variants, 1,000 runs each on the same seeds (planner / greedy average pearls): old Kelp with stack pricing 825 / 524; old Kelp at a flat price 854 / 548; **+1 shell +1 pearl, 2 shells: 881 / 543 (chosen)**; +1 pearl only: 666 / 384 (too weak); +1 shell +1 pearl at 3 shells: 735 / 457; +1 pearl per touching Kelp tile: 807 / 516.
  The chosen Kelp makes fewer pearls itself (39 a run, was 91) but raises scores and finish rate (planner 89.5% → 92.9%). It stacks a little higher (planner's final Kelp p50 ★4, p90 ★8, max ★16).
- **New planner bot** (`sim.js`). It uses the same buy search as greedy, but judges each buy by playing the frozen reef out to tide 12. Later tides are discounted (×0.6 per tide) and shells weigh more. This lets it see Coral growth, Otter drain and the forecast event once it is announced. When the reef is off pace for a goal within 3 tides, it switches to chasing pearls. It is now the best bot.
- **Stars 350 / 650 / 1300 → 550 / 1000 / 1550**, calibrated on the planner.

## Bot spread (5,000 planner and 3,000 greedy/random runs on fresh seeds; failed runs count as 0 stars)

| Bot | Finish | Avg pearls | 0★ | 1★ | 2★ | 3★ |
|---|---|---|---|---|---|---|
| Target for best bot | | | 30% | 35% | 25% | 10% |
| **Planner** | 92.5% | 865 | 31.3% | 33.9% | 24.1% | **10.7%** |
| Greedy | 89.4% | 537 | 63.6% | 26.5% | 7.9% | 2.0% |
| Random | 10.3% | 69 | 100% | 0% | 0% | 0% |

The 3★ cutoff sits at the planner's 90th percentile (1,577 on these seeds). A player who plays like the greedy bot gets 3★ about 1 run in 50.

## Tile effectiveness

Planner, 2,000 runs (greedy in brackets). "Pearls/shell" counts only pearls the tile makes itself, so echo, boost and shell tiles show about 0. Their value shows up in the drop-one column instead. Drop-one: 1,000 runs with that tile removed from the shop, compared with the full game on the same seeds (planner 875, greedy 539). A **negative** change means the game is worse without the tile, so the tile is strong. A **positive** change means the bots do better without it, so it is weaker than the shop slot it takes up.

| Tile | Cost / stacking | Effect at ★1 | Shells spent/run | Pearls/run | Pearls per shell | Drop-one: planner (greedy) | Verdict |
|---|---|---|---|---|---|---|---|
| Conch | 2, +1 per 2 placed, no cap | +2 shells | 13.2 | 1.5 | ~0 | **−29%** (−34%) | Backbone of the economy |
| Hermit Crab | 3, ★3 cap | +1 shell per touching tile | 12.8 | 1.8 | ~0 | **−16%** (−9%) | Strong; second economy tile |
| Kelp | 2 flat, no cap | +1 shell, +1 pearl | 9.5 | 38.8 | 4.1 | **−6%** (−8%) | Healthy after the change |
| Sea Turtle | 9, ★3 | Echo left and right | 14.2 | (echo) | – | −6% (+2%) | Fine for the planner; greedy can't use it |
| Starfish | 5, ★3 | Echo above | 12.6 | (echo) | – | −3% (+4%) | About neutral |
| Pufferfish | 5, ★3 | Next tile ×2 | 12.5 | (boost) | – | 0% (+8%) | Neutral to weak |
| Dolphin | 7 | Move a tile | 1.5 | – | – | +2% (+2%) | Rarely worth it to bots |
| Sunken Urn | 3, ★3 | +1 shell per 4 held | 6.5 | 0 | – | +3% (+4%) | Slightly weak |
| Oyster | 3, ★3 | +1 pearl, +1 per touching shellfish | 18.1 | 314.5 | **17.3** | +5% (+6%) | Top pearl engine; positive drop is shop dilution (see below) |
| Whale | 8, ★3 | +1 pearl per 2 tiles | 13.0 | 70.2 | 5.4 | +6% (+7%) | Slightly weak |
| Coral | 4, ★3 | +1 pearl per tide grown | 11.7 | 178.2 | 15.2 | +9% (+10%) | Efficient but slow; a bit weak |
| Octopus | 5, ★3 | +1 pearl per touching kind | 8.3 | 54.3 | 6.5 | +9% (+6%) | Weak |
| Jellyfish | 3, ★3 | +1 pearl per Jelly level on the reef | 6.2 | 29.3 | 4.8 | +11% (+15%) | Weak; needs 2+ to do anything |
| Sea Otter | 6, ★3 | Trade up to 6 shells, 3 pearls per 2 | 10.0 | 85.8 | 8.6 | **+13% (+27%)** | Trap: it eats the shells that build the reef |
| Shrimp | 3, ★3 | +1 pearl per touching plant | 11.3 | 117.6 | 10.4 | **+23% (+19%)** | Trap: fast early pearls, poor long-term value |

**How to read the positive drops.** Shells are the bottleneck, not pearls. When any pearl tile leaves the shop, its slots go more often to Conch, Hermit Crab and Oyster, so the bots get richer. That is why even the Oyster shows +5%. Buffing a pearl tile's numbers moves its own row only a little, so the tiles worth acting on are the ones that are clearly worse than the rest: Otter and Shrimp, then Jellyfish, Octopus and Coral.

## Proposed tile changes (simulated; see the v14 update below for what was applied)

Average pearls vs. the current game on the same seeds (planner 875, greedy 539), 1,000 runs per bot:

| Change | Planner | Greedy | Notes |
|---|---|---|---|
| **Sea Otter rework: +1 pearl per 3 shells you hold (up to +6), keeps the shells** | 907 (+4%) | 646 (**+20%**) | Removes the trap for both bots. Overlaps the Urn's theme (Urn = shells, Otter = pearls). |
| Sea Otter: 2 pearls per shell (was 1.5) | 858 (−2%) | 556 (+3%) | Doesn't fix the drain |
| Sea Otter cost 6 → 4 | 851 (−3%) | 538 (0%) | Doesn't help |
| **Shrimp: +1 pearl, +1 more per touching plant** (like Oyster) | 903 (+3%) | 538 (0%) | Planner finish 92.5% → 97.0%; fewer early losses |
| Shrimp cost 3 → 2 | 925 (+6%) | 578 (+7%) | Bigger boost, cheaper early pearls |
| **Coral cost 4 → 3** | 918 (+5%) | 569 (+6%) | Simple; Coral is efficient but slow to pay back |
| Jellyfish cost 3 → 2 | 896 (+2%) | 563 (+4%) | Small |
| Jellyfish +1 base pearl | 875 (0%) | 532 (−1%) | No effect |
| Octopus cost 5 → 4 | 866 (−1%) | 552 (+2%) | Noise |
| Whale cost 8 → 6 | 865 (−1%) | 551 (+2%) | Noise |
| Urn: per 3 shells held (was 4) | 892 (+2%) | 567 (+5%) | Small |
| Package: Shrimp base + Coral 3 + Jelly 2 + Otter 2:1 | 992 (+13%) | 568 (+5%) | 2,000 runs. Drop-one spread stays about the same (Shrimp still +21%) |
| Package: Shrimp base + Coral 3 | 967 (+11%) | 556 (+3%) | 2,000 runs. At today's cutoffs the planner gets 3★ 14%, so the cutoffs would move to about 625 / 1100 / 1700 |

**Recommendation:** rework the Sea Otter (keeps your shells, +1 pearl per 3 held), give Shrimp a base pearl, and drop Coral to 3 shells, then recalibrate the stars on the planner. Leave Conch, Hermit Crab and Kelp alone. They are meant to be the economy, and Kelp now works the way you asked for.

## Caveats

- The bots don't reposition tiles before the event, and they rarely use the Dolphin, so tiles that need set-up (Turtle, Starfish, Dolphin) may be better in human hands than these numbers say.
- Drop-one results move by about ±3% from run-to-run noise at 1,000 runs. Differences under 5% are not meaningful.

## v14 update: applied changes

Rob picked: Coral 4 → 3, Sea Otter 6 → 4 shells at 2 pearls per shell, Shrimp base pearl, Whale 8 → 7, Octopus 5 → 4, stars 500/1000/1500.

| Bot | Finish | Avg pearls | 0★ | 1★ | 2★ | 3★ |
|---|---|---|---|---|---|---|
| Planner (5,000 runs) | 97.2% | 971 | 19.8% | 39.3% | 24.7% | 16.2% |
| Greedy (3,000) | 93.7% | 547 | 56.7% | 33.8% | 7.0% | 2.5% |
| Random (3,000) | 22.4% | 116 | 99.5% | 0.5% | 0% | 0% |

Scores rose, so at the new cutoffs the planner gets 3★ in 16% of runs. Its 30th/65th/90th percentiles are 605/1105/1714, so cutoffs near 600/1100/1700 would put it back at 30/35/25/10. Sea Otter is now the most efficient pearl tile per shell (22 pearls per shell spent, bought in 81% of planner runs).

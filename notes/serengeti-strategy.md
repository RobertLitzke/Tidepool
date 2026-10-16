# Serengeti: what the planner bot builds (v21)

600 planner runs, seeds 40000+, after v21 (Dry turns start Grazed, Waterhole waters the 3 cells above). Average 1576 amber; top quarter 2124+ (avg 2981), bottom quarter 815 or less (avg 532). Raw output and scripts: `notes/serengeti-sims/` in the project's shared folder (`node run.js 600 40000 4 && node an.js`).
Echo and multiplier tiles (Cheetah, Oxpecker, Crocodile) earn nothing themselves: their amber is credited to the tile they fire again.

## The winning shape
1. **Seeds first (turns 1-3):** Red Oat Grass and Zebra on turn 1-2 (97% and 93% of runs), Meerkat by turn 3.
2. **First goals (turns 2-4):** Gazelle and Giraffe beside the grass make the early amber. Baobab goes down by turn 4 (89% of runs) so its age piles up.
3. **Amplifiers (turns 6-7):** Cheetah, Oxpecker and Dung Beetle around turn 6; Lion, Spotted Hyena and Crocodile around turn 7.
4. **Cash out on Dry turns.** 73% of all amber comes in turns 10-12, and Dry turns make twice what Wet turns do (turns 10 and 12: 340 and 514 a run; turn 11: 297). Lion (Dry: every grazer level on the board), Baobab (Dry: amber per age) and Hyena (every Grazed flora, which Dry turns now supply) are the scalers.

## Top quarter vs bottom quarter (final boards)
| | top 25% | bottom 25% |
|---|---|---|
| Crocodile on board | 90% | 31% |
| Cheetah levels per run | 3.3 | 0.9 |
| Oxpecker levels per run | 3.3 | 1.0 |
| Lion levels / amber | 2.2 / 695 | 0.5 / 42 |
| Hyena levels / amber | 2.1 / 570 | 0.5 / 21 |
| Baobab amber | 777 | 71 |
| Kopjes cleared | 3.1 | 0.9 |
| Savanna Echo bought | 32% | 6% |

Bottom runs lean on Dung Beetle (34% of their amber, mostly trading seeds) and many small grazers, and never build the echo chain.

Amber share in the top quarter: Baobab 26%, Lion 23%, Hyena 19%, Dung Beetle 11%, Wildebeest 11%; Gazelle, Giraffe, Acacia, Waterhole and Red Oat Grass 1-3% each. Grazers matter mostly as levels for the Lion to count, not for their own grazing amber.

## Placement patterns (top quarter)
- **Baobab in the top row** (78 of 184 Baobabs), with an Oxpecker under it or a Crocodile beside it: the most echoed tile (23% of Oxpecker echoes, 24% of Crocodile echoes).
- **Oxpeckers in rows 2-3** (196 of 243), right under the tile they repeat: Baobab, Cheetah, Hyena, Lion.
- **Cheetah directly before an echo tile:** the tile after a Cheetah is an Oxpecker 25% of the time, a Crocodile 16%. The boost lands on the first repeated fire.
- **Crocodiles in rows 1-2**, flanked by Baobab, Lion, Cheetah or Hyena.
- **Lion** often in the bottom row; it only needs grazers on the board in Dry turns, not touching.
- **Wildebeest** beside Red Oat Grass, Acacia or Baobab (several flora at once); Gazelle and Giraffe sit wherever.
- **Waterhole** is on under half the boards and makes 2% of the amber; it waters a mix of flora and other tiles.

## Treasures
Ruminant Herd 37%, Savanna Echo 32%, Second Rains 29%, Fresh Sprouts 21%, Vulture Kettle 17% of top runs. The bots never value Migration Trail, Flash Flood, Deep Taproot, Oasis Mirage or Termite Symbiosis (they only score next turn's yield), so those are untested.

## Example top board (7070 amber, Endless Drought; Savanna Echo, Ruminant Herd)
```
Baobab★3         Crocodile★2      Zebra★9          Giraffe★3
Wildebeest★3     Cheetah★3        Crocodile★3      Lion★3
Oxpecker★2       Waterhole★2      Giraffe★2        Gazelle★3
Spotted Hyena★2  Wildebeest       Gazelle★3        [kopje]
```

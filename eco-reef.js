// Reef: the sea ecosystem Tidepool started with. Pure data plus the reef's own rules,
// handed to the engine as def(E); E carries the engine helpers (count, neighbors, kindNames, has, ...).
(function (root) {
  function def(E) {
    const { count, kindNames, has } = E;
    const CONFIG = {
      cols: 4,
      rows: 4,
      tides: 12,
      startShells: 4,
      // The reef starts with one random tile from this list (all cost 2-3), on a random open spot. Giant Clam, Seagrass and Shipwreck
      // are left out: alone they make little, and bot runs that started with one finished 51-70% of the time (Conch 91%).
      startKinds: ['scallop', 'kelp', 'oyster', 'crab'],
      tideIncome: 2,          // shells the tide brings each round, after the reef fires
      shopSize: 3,
      rerollBase: 2,          // first reroll cost in a tide
      rerollStep: 2,          // each further reroll in the same tide costs this much more
      // Tile kinds kept out of the shop. Clownfish is parked: it overlapped Anemone. Anemone made way for the Dolphin:
      // it was one of four look-alike "count your neighbors" tiles, and as a "flora" tile that is really an animal it blurred the kinds.
      disabled: ['clown', 'anemone'],
      // Rock layouts (cells that start as rock), always resting on the bottom: flat about half the time, else a shelf piled left or right.
      rockLayouts: [
        { cells: [12, 13, 14, 15], weight: 2 },   // flat across the bottom
        { cells: [12, 13, 14, 8], weight: 1 },    // shelf piled on the left
        { cells: [13, 14, 15, 11], weight: 1 },   // shelf piled on the right
      ],
      rockCosts: [5, 10, 16, 24],   // pearls to break the 1st, 2nd, ... rock
      charmTides: [5, 7, 9],        // a Tide Charm market opens at the start of these tides (after the tide 4 goal)
      charmOffers: 3,
      charmPriceStep: 6,            // charm price = base + step * (market number - 1)
      maxLevel: 3,            // level cap for most tiles; tiles marked stack: true have no cap
      levelUpStep: 2,         // capped tiles: each level-up costs this much more than the last (Sea Star 5, then 7, then 9)
      stackPriceEvery: 2,     // stacking tiles (Conch) cost 1 more for every this many of that kind you have placed; flat ones (Sargassum) don't
      sellRate: 0.5,          // refund = floor(cost * level * sellRate)
      // Pearls you must be holding at the end of a tide, or the run ends. Pearls are also spent, so this is a real tension.
      checkpoints: { 4: 12, 8: 110 },
      // Pearls held at the end for 1, 2, 3 stars. The planner bot gets 0/1/2/3 stars about 20/39/25/16% of runs (fails count as 0).
      stars: [500, 1000, 1500],
      // Shop weights by rarity; rare weight ramps up as tides pass.
      rarityWeight: (rarity, tide) => rarity === 'common' ? 10
        : rarity === 'uncommon' ? (tide < 2 ? 2 : 6)
        : tide < CONFIG.rareFromTide ? 0 : 1 + tide * 0.5,
      rareFromTide: 3,        // no rares in the shop before this tide
      affordableOffers: 2,    // at least this many offers cost no more than your shells
      earlyPearlTiles: ['oyster', 'shrimp', 'jelly', 'coral'], // tiles that make pearls on their own early on
      pearlOfferUntil: 4,     // through this tide, every shop has at least one affordable early pearl tile
      // Forecast: each run has one event, shown from eventRevealTide (with the first charm market) and striking
      // at the end of eventTide, after the reef fires, so it reshapes the last tides.
      events: ['surge', 'shark', 'undertow'],
      eventRevealTide: 5,
      eventTide: 10,
      surgeAnchorKelp: 2,     // a center tile touching this many Sargassum tiles survives the Storm Surge
      sharkBites: 2,          // tiles the Hungry Shark eats
    };

    // Tile kinds. Effects that count "flora", "shellfish" or "critters" mean exactly the tiles tagged with that kind.
    const KINDS = {
      plant: { name: 'Flora', emoji: '🌱' },
      shellfish: { name: 'Shellfish', emoji: '🐚' },
      critter: { name: 'Critter', emoji: '🐾' },
      object: { name: 'Object', emoji: '📦' },
      mover: { name: 'Mover', emoji: '↔️' },
    };


    // Effects return {s, p} (shells, pearls) for one activation at level 1..3.
    // fire(c, L) and text(L) take the tile's level. Most tiles cap at ★3; a few cheap tiles
    // (stack: true) level up forever at a steady rate, so they stay useful and can snowball late.
    // Neighbor counts weight by level: a ★2 Sargassum counts as two Sargassum.
    // ctx: { grid, i, t, state, nb (8-touching indices), filled }.
    const TILES = {
      scallop: { name: 'Conch', emoji: '🐚', cost: 2, rarity: 'common', tag: 'shellfish', stack: true,
        text: (L) => `+${2 * L} shells.`,
        fire: (c, L) => ({ s: 2 * L, p: 0 }) },
      oyster: { name: 'Oyster', emoji: '🦪', cost: 3, rarity: 'common', tag: 'shellfish',
        text: (L) => `+${L} pearl, +${L} more for each touching shellfish (${kindNames('shellfish')}).`,
        reads: (c) => c.nb.filter(j => c.grid[j] && TILES[c.grid[j].kind].tag === 'shellfish'),
        fire: (c, L) => ({ s: 0, p: L * (1 + count(c, n => TILES[n.kind].tag === 'shellfish')) }) },
      // Sargassum is the plain stacker: always 2 shells (flat), and each level adds exactly +1 shell and +1 pearl.
      kelp: { name: 'Sargassum', emoji: '🌿', cost: 2, rarity: 'common', tag: 'plant', stack: true, flat: true,
        text: (L) => `+${L} shell and +${L} pearl.`,
        fire: (c, L) => ({ s: L, p: L }) },
      crab: { name: 'Hermit Crab', emoji: '🦀', cost: 3, rarity: 'common', tag: 'critter',
        text: (L) => `+${L} shell for each touching tile (levels don't add).`,
        reads: (c) => c.nb.filter(j => c.grid[j]),
        fire: (c, L) => ({ s: L * c.nb.filter(j => c.grid[j]).length, p: 0 }) },
      shrimp: { name: 'Giant Clam', emoji: '🫧', cost: 3, rarity: 'common', tag: 'shellfish',
        text: (L) => `+${L} pearl, +${L} more for each touching flora (${kindNames('plant')}).`,
        reads: (c) => c.nb.filter(j => c.grid[j] && (n => TILES[n.kind].tag === 'plant')(c.grid[j])),
        fire: (c, L) => ({ s: 0, p: L * (1 + count(c, n => TILES[n.kind].tag === 'plant')) }) },
      anemone: { name: 'Anemone', emoji: '🪻', cost: 4, rarity: 'uncommon', tag: 'plant',
        text: (L) => `+${L} pearl for each touching critter (any animal that isn't shellfish).`,
        reads: (c) => c.nb.filter(j => c.grid[j] && (n => TILES[n.kind].tag === 'critter')(c.grid[j])),
        fire: (c, L) => ({ s: 0, p: L * count(c, n => TILES[n.kind].tag === 'critter') }) },
      clown: { name: 'Clownfish', emoji: '🐠', cost: 4, rarity: 'uncommon', tag: 'critter',
        text: (L) => `+${2 * L} pearls, +${2 * L} more for each touching Anemone.`,
        reads: (c) => c.nb.filter(j => c.grid[j] && c.grid[j].kind === 'anemone'),
        fire: (c, L) => ({ s: 0, p: 2 * L * (1 + count(c, n => n.kind === 'anemone')) }) },
      jelly: { name: 'Seagrass', emoji: '🌾', cost: 3, rarity: 'uncommon', tag: 'plant',
        text: (L) => `+${L} pearl for each Seagrass level on the reef.`,
        reads: (c) => c.grid.map((t, j) => t && t.kind === 'jelly' && j !== c.i ? j : -1).filter(j => j >= 0),
        fire: (c, L) => ({ s: 0, p: L * c.grid.reduce((n, t) => n + (t && t.kind === 'jelly' ? t.lvl : 0), 0) }) },
      coral: { name: 'Staghorn', emoji: '🪸', cost: 3, rarity: 'uncommon', tag: 'plant', showAge: true,
        text: (L) => `Grows each tide. +${L} pearl for each tide it has grown.`,
        fire: (c, L) => ({ s: 0, p: L * c.t.age }) },
      urn: { name: 'Shipwreck', emoji: '⚓', cost: 3, rarity: 'uncommon', tag: 'object',
        text: (L) => `+${L} shell for every 4 shells you hold (up to +${6 * L}).`,
        fire: (c, L) => ({ s: L * Math.min(6, Math.floor(c.state.shells / 4)), p: 0 }) },
      puffer: { name: 'Pufferfish', emoji: '🐡', cost: 5, rarity: 'uncommon', tag: 'critter', booster: true, cheer: 'puff!',
        text: (L) => `The next tile to fire makes ×${1 + L}.`,
        boosts: (c) => { for (let j = c.i + 1; j < c.grid.length; j++) if (c.grid[j]) return [j]; return []; },
        fire: (c, L) => { c.state._mult = Math.max(c.state._mult, 1 + L); return { s: 0, p: 0 }; } },
      star: { name: 'Sea Star', emoji: '⭐', cost: 5, rarity: 'uncommon', tag: 'critter', echo: true,
        text: (L) => `Echo: fires the tile above it again${L > 1 ? `, ${L} times` : ''}.`,
        targets: (i) => [i - CONFIG.cols].filter(j => j >= 0) },
      otter: { name: 'Mantis Shrimp', emoji: '🦐', cost: 4, rarity: 'rare', tag: 'critter',
        text: (L) => `Trades up to ${6 * L} shells for pearls: 2 pearls for every shell.`,
        fire: (c, L) => { const n = Math.min(c.state.shells, 6 * L); return { s: -n, p: 2 * n, conv: true }; } },
      octo: { name: 'Octopus', emoji: '🐙', cost: 4, rarity: 'rare', tag: 'critter',
        text: (L) => `+${L} pearl for each different kind of tile touching it.`,
        reads: (c) => c.nb.filter(j => c.grid[j] && (() => true)(c.grid[j])),
        fire: (c, L) => ({ s: 0, p: L * new Set(c.nb.map(j => c.grid[j]).filter(Boolean).map(t => t.kind)).size }) },
      whale: { name: 'Manta Ray', emoji: '🪁', cost: 7, rarity: 'rare', tag: 'critter',
        text: (L) => `+${L} pearl for every 2 tiles on the reef.`,
        reads: (c) => c.grid.map((t, j) => t && j !== c.i ? j : -1).filter(j => j >= 0),
        fire: (c, L) => ({ s: 0, p: L * Math.floor(c.filled / 2) }) },
      // Mover: never sits on the reef. Placed on an empty spot beside a tile, it moves that tile
      // one space up, down, left or right (swapping if that spot is filled), then swims away.
      dolphin: { name: 'Dolphin', emoji: '🐬', cost: 7, rarity: 'rare', tag: 'mover', mover: true, afterFirstGoal: true,
        text: () => 'Place it beside a tile, then move that tile one space. A filled spot swaps. Swims away after: no pearls or shells.' },
      turtle: { name: 'Sea Turtle', emoji: '🐢', cost: 9, rarity: 'rare', tag: 'critter', echo: true,
        text: (L) => `Echo: fires the tiles to its left and right again${L > 1 ? `, ${L} times` : ''}.`,
        targets: (i) => {
          const col = i % CONFIG.cols, out = [];
          if (col > 0) out.push(i - 1);
          if (col < CONFIG.cols - 1) out.push(i + 1);
          return out;
        } },
    };

    // Forecast events. Each strikes once, at the end of CONFIG.eventTide. threat(state) lists the cells it
    // would take if it struck now; after(state) does anything else (Undertow moves the whole reef).
    const kelpAnchors = (state, i) => E.neighbors(i).filter(j => state.grid[j] && state.grid[j].kind === 'kelp').length;
    const EVENTS = {
      surge: { name: 'Storm Surge', emoji: '🌊',
        text: () => `After tide ${CONFIG.eventTide}, a storm washes away every tile in the four center spots. A center tile touching ${CONFIG.surgeAnchorKelp} or more Sargassum tiles is anchored and stays (a stacked Sargassum counts once).`,
        threat: (state) => E.centerCells().filter(i => state.grid[i] && kelpAnchors(state, i) < CONFIG.surgeAnchorKelp) },
      shark: { name: 'Hungry Shark', emoji: '🦈',
        text: () => `After tide ${CONFIG.eventTide}, a shark eats the ${CONFIG.sharkBites} tiles you spent the most shells on, counting level-ups.`,
        threat: (state) => state.grid.map((t, i) => t ? i : -1).filter(i => i >= 0)
          .sort((a, b) => E.invested(state.grid[b]) - E.invested(state.grid[a]) || state.grid[b].lvl - state.grid[a].lvl || a - b)
          .slice(0, CONFIG.sharkBites) },
      undertow: { name: 'Undertow', emoji: '🌀', moves: true,
        text: () => `After tide ${CONFIG.eventTide}, the whole reef shifts one space left and one row down. The left column wraps to the right side and the bottom row wraps to the top, rocks included.`,
        after: (state) => {
          const { cols, rows } = CONFIG, g = state.grid.slice(), rk = state.rock.slice();
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const from = ((r - 1 + rows) % rows) * cols + (c + 1) % cols;
            state.grid[r * cols + c] = g[from]; state.rock[r * cols + c] = rk[from];
          }
        } },
    };

    // Treasures: permanent rule changes bought with pearls at markets (internally "charms").
    // Hooks: bonus(def, ctx) extra pearls per fire, income, costDelta, shopBonus, freeRerolls, echoExtra,
    // firstTwice, ageBonus(tile), onBuy(state).
    const tagOf = (t) => TILES[t.kind].tag;
    const CHARMS = {
      current: { name: 'Warm Current', emoji: '🌊', base: 6, text: 'Flora make +1 pearl each time they fire.', bonus: (d) => d.tag === 'plant' ? 1 : 0 },
      pearlbed: { name: 'Pearl Bed', emoji: '🫧', base: 6, text: 'Shellfish make +1 pearl each time they fire.', bonus: (d) => d.tag === 'shellfish' ? 1 : 0 },
      school: { name: 'Big School', emoji: '🐟', base: 7, text: 'Critters touching 2 or more critters make +1 pearl when they fire.',
        bonus: (d, c) => d.tag === 'critter' && c.nb.reduce((n, j) => n + (c.grid[j] && tagOf(c.grid[j]) === 'critter' ? c.grid[j].lvl : 0), 0) >= 2 ? 1 : 0 },
      moon: { name: 'Moon Tide', emoji: '🌙', base: 8, text: 'The first tile on the reef fires twice.', firstTwice: true },
      deep: { name: 'Deep Echo', emoji: '🔔', base: 7, text: 'Echo tiles echo one extra time.', echoExtra: 1 },
      heart: { name: 'Coral Heart', emoji: '💗', base: 5, text: 'Staghorn grows twice as fast.', ageBonus: (t) => t.kind === 'coral' ? 1 : 0 },
      bloom: { name: 'Plankton Bloom', emoji: '✨', base: 5, text: 'The tide brings 3 more shells.', income: 3 },
      map: { name: 'Treasure Map', emoji: '🗺️', base: 6, text: 'Tiles cost 1 shell less (minimum 1).', costDelta: -1 },
      sandbar: { name: 'Sandbar', emoji: '🏝️', base: 4, text: 'The shop shows 4 tiles.', shopBonus: 1, onBuy: (state) => E.addOffer(state) },
      riptide: { name: 'Riptide', emoji: '🌀', base: 4, text: 'Your first New tiles each tide is free.', freeRerolls: 1 },
    };

    return { CONFIG, KINDS, TILES, EVENTS, CHARMS };
  }

  const eco = {
    id: 'reef', name: 'Reef', region: 'Tropical shallows', kindness: 'Moderate', realm: 'sea',
    blurb: 'Place tiles by kind and firing order, and weigh stacking against new spots.',
    terms: { board: 'reef', Board: 'Reef', round: 'tide', Round: 'Tide', rock: 'rock', Rock: 'Rock', clear: 'Break', go: 'Let the tide in', bonus: 'Treasures', bonusOne: 'Treasure', boardMakes: 'Reef makes',
      title: 'Grow a reef that pays you back', zeroStar: 'The tide goes out', incomeWord: 'the tide brings',
      failHint: 'Oysters beside Conches and Giant Clams beside Sargassum make pearls early.' },
    icon: 'scallop',
    def,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = eco;
  else (root.TidepoolEcos || (root.TidepoolEcos = {})).reef = eco;
})(typeof window !== 'undefined' ? window : globalThis);

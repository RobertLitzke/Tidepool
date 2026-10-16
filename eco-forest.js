// Deciduous Forest: an Eastern US hardwood forest over one year, November to the October harvest.
// Two ideas only. Seasons: every tile makes ×2 in its season (the Bumblebee is instead on in its
// seasons and off the rest). Leaves: in fall each tree drops a leaf on every touching understory
// plant, and every 2 leaves grow that plant a level for free. Design notes: notes/forest-simple.md.
(function (root) {
  // Month indexes: 0 = January. The run starts in November (round 1) and ends in October (round 12).
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SEASON_OF = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
  const SEASONS = {
    fall: { name: 'Fall', emoji: '🍂' }, winter: { name: 'Winter', emoji: '❄️' },
    spring: { name: 'Spring', emoji: '🌸' }, summer: { name: 'Summer', emoji: '☀️' },
  };
  const LEAF_FALL = [8, 9, 10];   // September to November
  const BEECH_DROP = [2, 3];      // March and April: the Beech lets go of last year's leaves
  const DRY = [8, 9];             // Drought months: September and October

  function def(E) {
    const { count, neighbors, has } = E;

    const CONFIG = {
      cols: 4,
      rows: 4,
      tides: 12,
      startShells: 4,
      // Two starters side by side: a White Oak and an understory plant it drops leaves on.
      starters: [['oak'], ['ginger', 'laurel', 'hazel', 'trillium']],
      startersTouch: true,
      tideIncome: 3,
      shopSize: 3,
      rerollBase: 2,
      rerollStep: 2,
      disabled: [],
      rockCount: 2,                          // fallen logs scattered at the start
      rockCosts: [5, 8, 12, 18, 24, 30],     // amber to clear the 1st, 2nd, ... log
      rockSeedCosts: [10, 16, 24, 36, 48, 60], // or seeds instead
      charmTides: [5, 7, 9],                 // Heirloom markets in March, May and July
      charmOffers: 3,
      charmPriceStep: 6,
      maxLevel: 3,
      levelUpStep: 2,
      stackPriceEvery: 2,
      sellRate: 0.5,
      checkpoints: { 4: 40, 8: 300 },        // amber held at the end of February and June
      // Amber held at the end for 1, 2, 3 stars, calibrated like the reef: the planner bot gets 0/1/2/3 about 30/35/25/10%.
      stars: [1115, 1280, 1450],
      rarityWeight: (rarity, tide) => rarity === 'common' ? 10
        : rarity === 'uncommon' ? (tide < 2 ? 2 : 6)
        : tide < CONFIG.rareFromTide ? 0 : 1 + tide * 0.5,
      rareFromTide: 3,
      affordableOffers: 2,
      earlyPearlTiles: ['maple', 'ginger', 'laurel', 'trillium'], // amber makers for the first goal
      pearlOfferUntil: 4,
      events: ['derecho', 'drought', 'mast'],
      eventRevealTide: 5,
      eventTide: 10,
      calendar: { firstMonth: 10, seasons: SEASON_OF, names: MONTHS },
      seasonMult: 2,      // every tile makes ×2 in its season
      leavesToGrow: 2,    // leaves a plant needs to grow a level (Wild Ginger: 1)
      leafMax: 4,         // leaves an empty spot can hold
      leafSeeds: 2,       // seeds per leaf when a critter moves onto a leafy spot
      // Tile numbers, kept here so tuning variants can change them (TP.CONFIG.k).
      k: { oak: 2, maple: 3, beech: 1, birch: 1, trillium: 3, laurel: 1, hazelSeeds: 2, hazel: 2, ginger: 3, squirrel: 1, bear: 1, deer: 4, chipmunk: 2 },
    };

    const KINDS = {
      tree: { name: 'Tree', emoji: '🌳' },
      understory: { name: 'Understory', emoji: '🌿' },
      critter: { name: 'Critter', emoji: '🐾' },
    };

    const tagOf = (t) => TILES[t.kind].tag;
    const isTree = (t) => !!t && tagOf(t) === 'tree';
    const isPlant = (t) => !!t && tagOf(t) === 'understory';
    const emptyAt = (state, j) => !state.grid[j] && !state.rock[j];
    const monthOf = (state) => E.month(state);
    // Is a tile in season this month? Long Summer stretches summer into September.
    const seasonsOf = (d) => [].concat(d.peak || []);
    const inSeason = (state, d) => {
      const m = monthOf(state), s = SEASON_OF[m];
      return seasonsOf(d).includes(s) || (m === 8 && seasonsOf(d).includes('summer') && has(state, 'longsummer'));
    };
    const beeOn = (state) => has(state, 'busybees') || ['spring', 'summer'].includes(SEASON_OF[monthOf(state)]);
    // A plant touching any awake Bumblebee makes ×2 (more bees don't stack).
    const beeMult = (state, i) => beeOn(state) && neighbors(i).some(j => state.grid[j] && state.grid[j].kind === 'bee') ? 2 : 1;
    const need = (t) => t.kind === 'ginger' ? 1 : CONFIG.leavesToGrow;

    const K = CONFIG.k;
    const TILES = {
      // ---------- Trees: drop leaves on touching understory plants in fall ----------
      oak: { name: 'White Oak', emoji: '🌳', cost: 3, rarity: 'common', tag: 'tree', peak: 'fall',
        text: (L) => `+${K.oak * L} seeds, +${L} more for each touching White Oak.`,
        reads: (c) => c.nb.filter(j => c.grid[j] && c.grid[j].kind === 'oak'),
        fire: (c, L) => ({ s: K.oak * L + L * count(c, n => n.kind === 'oak'), p: 0 }) },
      maple: { name: 'Sugar Maple', emoji: '🍁', cost: 3, rarity: 'common', tag: 'tree', peak: 'winter',
        text: (L) => `+${K.maple * L} amber.`,
        fire: (c, L) => ({ s: 0, p: K.maple * L }) },
      beech: { name: 'Beech', emoji: '🍃', cost: 4, rarity: 'uncommon', tag: 'tree', peak: 'fall', lateLeaves: true,
        text: (L) => `+${K.beech * L} amber, +${L} more for each touching critter. Holds its leaves all winter and drops them in March and April instead of fall.`,
        reads: (c) => c.nb.filter(j => c.grid[j] && tagOf(c.grid[j]) === 'critter'),
        fire: (c, L) => ({ s: 0, p: K.beech * L + L * count(c, n => tagOf(n) === 'critter') }) },
      birch: { name: 'Birch', emoji: '🪵', cost: 3, rarity: 'common', tag: 'tree', peak: 'summer',
        text: (L) => `+${K.birch * L} seed, +${L} more for each touching empty spot.`,
        fire: (c, L) => ({ s: K.birch * L + L * c.nb.filter(j => emptyAt(c.state, j)).length, p: 0 }) },

      // ---------- Understory: grows a level from leaves ----------
      trillium: { name: 'Trillium', emoji: '🌷', cost: 2, rarity: 'common', tag: 'understory', peak: 'spring',
        text: (L) => `+${K.trillium * L} amber.`,
        fire: (c, L) => ({ s: 0, p: K.trillium * L }) },
      laurel: { name: 'Mountain Laurel', emoji: '🌺', cost: 5, rarity: 'uncommon', tag: 'understory', peak: 'summer',
        text: (L) => `+${K.laurel * L} amber, +1 more for each touching tree.`,
        reads: (c) => c.nb.filter(j => isTree(c.grid[j])),
        fire: (c, L) => ({ s: 0, p: K.laurel * L + count(c, isTree) }) },
      hazel: { name: 'Witch Hazel', emoji: '🌼', cost: 2, rarity: 'common', tag: 'understory', peak: 'fall',
        text: (L) => `+${K.hazelSeeds * L} seeds and +${K.hazel * L} amber.`,
        fire: (c, L) => ({ s: K.hazelSeeds * L, p: K.hazel * L }) },
      ginger: { name: 'Wild Ginger', emoji: '🌿', cost: 3, rarity: 'common', tag: 'understory', peak: 'winter',
        text: (L) => `+${K.ginger * L} amber. Grows a level from every leaf, not every 2.`,
        fire: (c, L) => ({ s: 0, p: K.ginger * L }) },

      // ---------- Critters ----------
      squirrel: { name: 'Gray Squirrel', emoji: '🐿️', cost: 2, rarity: 'common', tag: 'critter', peak: 'fall',
        text: (L) => `+${K.squirrel * L} seed, +${K.squirrel * L} more for each touching tree.`,
        reads: (c) => c.nb.filter(j => isTree(c.grid[j])),
        fire: (c, L) => ({ s: K.squirrel * L * (1 + count(c, isTree)), p: 0 }) },
      chipmunk: { name: 'Chipmunk', emoji: '🐿️', cost: 2, rarity: 'common', tag: 'critter', peak: 'spring',
        text: (L) => `+${K.chipmunk * L} seeds.`,
        fire: (c, L) => ({ s: K.chipmunk * L, p: 0 }) },
      bear: { name: 'Black Bear', emoji: '🐻', cost: 5, rarity: 'rare', tag: 'critter', peak: 'summer',
        text: (L) => `+${K.bear * L} amber for each touching tile.`,
        reads: (c) => c.nb.filter(j => c.grid[j]),
        fire: (c, L) => ({ s: 0, p: K.bear * L * c.nb.filter(j => c.grid[j]).length }) },
      deer: { name: 'White-tailed Deer', emoji: '🦌', cost: 5, rarity: 'rare', tag: 'critter', peak: 'spring',
        text: (L) => `+${K.deer * L} amber.`,
        fire: (c, L) => ({ s: 0, p: K.deer * L }) },
      bee: { name: 'Bumblebee', emoji: '🐝', cost: 4, rarity: 'uncommon', tag: 'critter', peak: ['spring', 'summer'], helper: true, maxLevel: 1, cheer: 'bzz!',
        text: () => 'On in spring and summer: touching understory plants make ×2. Off the rest of the year. Stays at ★1.',
        dormant: (state) => !beeOn(state),
        boosts: (c) => beeOn(c.state) ? c.nb.filter(j => isPlant(c.grid[j])) : [],
        fire: () => ({ s: 0, p: 0, idle: true }) },
    };

    // Seasons and bees wrap every tile's own effect: ×2 in season, ×2 more beside an awake Bumblebee.
    for (const [id, d] of Object.entries(TILES)) {
      const base = d.fire, text = d.text;
      if (!d.helper) d.text = (L) => `${text(L)} ×${CONFIG.seasonMult} in ${seasonsOf(d).map(s => SEASONS[s].name.toLowerCase()).join(' and ')}.`;
      d.fire = (c, L) => {
        const r = base(c, L);
        if (r.idle) return r;
        let m = 1;
        if (!d.helper && inSeason(c.state, d)) m *= c.state.mast && (id === 'oak' || id === 'squirrel') ? 3 : CONFIG.seasonMult;
        if (d.tag === 'understory') {
          if (c.state.drought && DRY.includes(monthOf(c.state))) return { s: 0, p: 0, idle: true };
          m *= beeMult(c.state, c.i);
        }
        return { ...r, s: r.s * m, p: r.p * m };
      };
    }

    const EVENTS = {
      derecho: { name: 'Derecho', emoji: '🌪️',
        text: () => `After August, a windstorm knocks down the 2 trees you spent the most seeds on. Each leaves a fallen log in its spot.`,
        threat: (state) => state.grid.map((t, i) => isTree(t) ? i : -1).filter(i => i >= 0)
          .sort((a, b) => E.invested(state.grid[b]) - E.invested(state.grid[a]) || state.grid[b].lvl - state.grid[a].lvl || a - b).slice(0, 2),
        take: (state, i) => { E.removeTile(state, i, 'event'); state.rock[i] = true; } },
      drought: { name: 'Drought', emoji: '🏜️', spares: true,
        text: () => `In September and October, understory plants make nothing.`,
        threat: (state) => state.grid.map((t, i) => isPlant(t) ? i : -1).filter(i => i >= 0),
        after: (state) => { state.drought = true; } },
      mast: { name: 'Mast Year', emoji: '🌰', spares: true,
        text: () => `A gift: in September and October, White Oaks and Gray Squirrels make ×3 instead of ×2.`,
        after: (state) => { state.mast = true; } },
    };

    // Heirlooms: permanent rule changes bought with amber at markets (internally "charms").
    const CHARMS = {
      deeplitter: { name: 'Deep Litter', emoji: '🍂', base: 5, text: 'Trees drop 2 leaves instead of 1.' },
      longsummer: { name: 'Long Summer', emoji: '🌞', base: 6, text: 'Summer tiles are in season in September too.' },
      busybees: { name: 'Busy Bees', emoji: '🐝', base: 5, text: 'Bumblebees are on all year.' },
      richsoil: { name: 'Rich Soil', emoji: '🪨', base: 6, text: 'Understory plants make +1 amber each time they fire.', bonus: (d) => d.tag === 'understory' ? 1 : 0 },
      thicket: { name: 'Thicket', emoji: '🌿', base: 7, text: 'Critters touching 2 or more critters make +1 amber when they fire.',
        bonus: (d, c) => d.tag === 'critter' && count(c, n => tagOf(n) === 'critter') >= 2 ? 1 : 0 },
      seedrain: { name: 'Seed Rain', emoji: '🌧️', base: 5, text: 'Each month brings 3 more seeds.', income: 3 },
      clearing: { name: 'Clearing', emoji: '☀️', base: 4, text: 'The shop shows 4 tiles.', shopBonus: 1, onBuy: (state) => E.addOffer(state) },
      tailwind: { name: 'Tailwind', emoji: '💨', base: 4, text: 'Your first New tiles each month is free.', freeRerolls: 1 },
    };

    // Leaves fall from each tree onto every touching understory plant and empty spot.
    // Returns how many each cell gets this month.
    function leafDrop(state) {
      const m = monthOf(state), g = state.grid, per = has(state, 'deeplitter') ? 2 : 1, got = {};
      g.forEach((t, i) => {
        if (!isTree(t)) return;
        const drops = TILES[t.kind].lateLeaves ? BEECH_DROP.includes(m) : LEAF_FALL.includes(m);
        if (drops) for (const j of neighbors(i)) if (isPlant(g[j]) || emptyAt(state, j)) got[j] = (got[j] || 0) + per;
      });
      return got;
    }
    const leavesOf = (state) => state.leaves || (state.leaves = Array(CONFIG.cols * CONFIG.rows).fill(0));
    // Feed n leaves to the tile on cell j: every `need` leaves grow it a level, up to ★3. Leftovers stay on the tile.
    function feed(state, j, n) {
      const t = state.grid[j];
      if (t.lvl >= CONFIG.maxLevel) return 0;
      t.leaves = (t.leaves || 0) + n;
      let up = 0;
      while (t.leaves >= need(t) && t.lvl < CONFIG.maxLevel) { t.leaves -= need(t); t.lvl++; up++; }
      if (t.lvl >= CONFIG.maxLevel) t.leaves = 0;
      return up;
    }

    const hooks = {
      init(state) { state.leaves = Array(CONFIG.cols * CONFIG.rows).fill(0); },
      // After the board fires: leaves land. Plants with enough leaves grow a level; empty spots keep them (up to leafMax).
      afterFire(state) {
        const got = leafDrop(state), lv = leavesOf(state), grew = [];
        for (const [k, n] of Object.entries(got)) {
          const j = +k;
          if (state.grid[j]) { if (feed(state, j, n)) grew.push(j); }
          else lv[j] = Math.min(CONFIG.leafMax, lv[j] + n);
        }
        state.grew = { tide: state.tide, cells: grew };
      },
      // Placing a tile on a leafy spot: a critter is paid seeds for the leaves, a plant grows from them.
      onPlace(state, cell) {
        const lv = leavesOf(state), n = lv[cell], t = state.grid[cell];
        if (!n) return;
        lv[cell] = 0;
        if (tagOf(t) === 'critter') state.shells += CONFIG.leafSeeds * n;
        else feed(state, cell, n);
      },
      // A log that falls (Derecho) or a cleared spot starts bare.
      onClear(state, cell) { leavesOf(state)[cell] = 0; },
    };

    return { CONFIG, KINDS, TILES, EVENTS, CHARMS, hooks, leafDrop };
  }

  const eco = {
    id: 'forest', name: 'Forest', region: 'Eastern US hardwoods', kindness: 'Kind', realm: 'land',
    blurb: 'One year from November to harvest. Every tile has a season, and fall leaves grow the plants beneath the trees.',
    terms: { board: 'forest', Board: 'Forest', round: 'month', Round: 'Month', rock: 'log', Rock: 'Fallen log', clear: 'Clear', go: 'Next month', bonus: 'Heirlooms', bonusOne: 'Heirloom', boardMakes: 'Forest makes',
      title: 'Grow a forest through the year', zeroStar: 'A quiet year', incomeWord: 'the month brings',
      failHint: 'Sugar Maples and Wild Ginger make ×2 amber in winter, and plants beside trees grow from fall leaves.' },
    icon: 'oak',
    seasons: SEASONS, months: MONTHS,
    def,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = eco;
  else (root.TidepoolEcos || (root.TidepoolEcos = {})).forest = eco;
})(typeof window !== 'undefined' ? window : globalThis);

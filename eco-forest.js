// Deciduous Forest: an Eastern US hardwood forest over one year, November to the October harvest.
// Rounds are months. Tiles keep their own calendars (bare, leafed, blooming, frozen, asleep), and output
// flows between seasons: fall leaves become litter the understory eats, squirrels' caches sprout into
// oaks, spring pollination doubles later blooms. Design notes: notes/forest.md in the project files.
(function (root) {
  // Month indexes: 0 = January. The run starts in November (round 1) and ends in October (round 12).
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SEASON_OF = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
  const SEASONS = {
    fall: { name: 'Fall', emoji: '🍂' }, winter: { name: 'Winter', emoji: '❄️' },
    spring: { name: 'Spring', emoji: '🌸' }, summer: { name: 'Summer', emoji: '☀️' }, any: { name: 'All year', emoji: '🔁' },
  };
  const LEAFED = [4, 5, 6, 7];          // May to August: trees in full leaf
  const BARE = [11, 0, 1, 2, 3];        // December to April: trees bare
  const LEAF_FALL = [8, 9, 10];         // September to November: leaves drop as litter
  const FROZEN = [11, 0, 1];            // December to February
  const DEAD_WINTER = [11, 0, 1, 2];    // December to March
  const in_ = (list, m) => list.includes(m);

  function def(E) {
    const { count, neighbors, has } = E;

    const CONFIG = {
      cols: 4,
      rows: 4,
      tides: 12,
      startShells: 4,
      // Two starters: a White Oak, plus one understory plant that earns through the first winter.
      starters: [['oak'], ['ginger', 'laurel', 'hazel']],
      tideIncome: 3,
      shopSize: 3,
      rerollBase: 2,
      rerollStep: 2,
      disabled: [],
      rockCount: 2,                     // fallen logs scattered at the start
      rockCosts: [4, 8, 12, 18, 24, 30],  // amber to clear the 1st, 2nd, ... log
      charmTides: [5, 7, 9],            // Heirloom markets in March, May and July
      charmOffers: 3,
      charmPriceStep: 6,
      maxLevel: 3,
      levelUpStep: 2,
      stackPriceEvery: 2,
      sellRate: 0.5,
      checkpoints: { 4: 14, 8: 100 },   // amber held at the end of February and June
      // Amber held at the end for 1, 2, 3 stars, calibrated like the reef: the planner bot gets 0/1/2/3 about 30/35/25/10%.
      stars: [500, 650, 850],
      rarityWeight: (rarity, tide) => rarity === 'common' ? 10
        : rarity === 'uncommon' ? (tide < 2 ? 2 : 6)
        : tide < CONFIG.rareFromTide ? 0 : 1 + tide * 0.5,
      rareFromTide: 3,
      affordableOffers: 2,
      earlyPearlTiles: ['laurel', 'ginger', 'hazel', 'maple', 'trillium'], // winter earners
      pearlOfferUntil: 4,
      events: ['derecho', 'drought', 'mast'],
      eventRevealTide: 5,
      eventTide: 10,
      calendar: { firstMonth: 10, seasons: SEASON_OF, names: MONTHS },
      cacheSeeds: 3,          // seeds a squirrel buries in one cache
      digAmber: 4,            // amber for digging up a cache yourself
      litterMax: 3,
      stashTrade: [10, 5],    // Forager's Stash: 10 of one currency for 5 of the other
      // Tile numbers, kept here so tuning variants can change them (TP.CONFIG.k).
      k: { oakMast: 4, oakLeaf: 2, sap: 6, mapleSeeds: 3, beechWinter: 2, beechNuts: 6, beechLeaf: 2, birch: 3, trillium: 6, laurelBare: 4, laurelBloom: 4,
        hazelBloom: 5, squirrelTree: 1, gingerEat: 2, gingerAmber: 3, squirrelCache: 1, bearEat: 6, bearForage: 3, deer: 4, thrush: 4, litter: 2 },
    };

    const KINDS = {
      tree: { name: 'Tree', emoji: '🌳' },
      understory: { name: 'Understory', emoji: '🌿' },
      critter: { name: 'Critter', emoji: '🐾' },
      object: { name: 'Object', emoji: '📦' },
      mover: { name: 'Beaver', emoji: '🦫' },
    };

    const M = (c) => c.month;
    const tagOf = (t) => TILES[t.kind].tag;
    const isTree = (t) => !!t && tagOf(t) === 'tree' && t.kind !== 'seedling';
    const bareTree = (t, m) => isTree(t) && t.kind !== 'beech' && in_(BARE, m);
    const leafedTree = (t, m) => isTree(t) && in_(LEAFED, m);
    const litterOf = (state) => state.litter || (state.litter = Array(CONFIG.cols * CONFIG.rows).fill(0));
    const cacheOf = (state) => state.cache || (state.cache = Array(CONFIG.cols * CONFIG.rows).fill(0));
    const addLitter = (state, i, n) => { if (!state.rock[i]) litterOf(state)[i] = Math.min(CONFIG.litterMax, litterOf(state)[i] + n); };
    const emptyAt = (state, j) => !state.grid[j] && !state.rock[j];
    const idle = { s: 0, p: 0, idle: true };
    // Drought (after August): understory with fewer than 2 touching trees for shade makes nothing.
    const treesTouching = (state, i) => neighbors(i).filter(j => isTree(state.grid[j])).length;
    const dry = (c) => c.state.drought && treesTouching(c.state, c.i) < 2;
    const seedling = (into) => ({ kind: 'seedling', into, lvl: 1, age: 1, paid: 0, grown: 0 });
    const TREE_NAMES = { oak: 'White Oak', maple: 'Sugar Maple', birch: 'Birch' };

    const K = CONFIG.k;
    const TILES = {
      // ---------- Trees ----------
      oak: { name: 'White Oak', emoji: '🌳', cost: 3, rarity: 'common', tag: 'tree', peak: 'fall',
        text: (L) => `Fall: drops acorns, +${K.oakMast * L} seeds and +${L} more for each touching White Oak. May to August: +${L} amber and +${K.oakLeaf * L} seeds. Bare from December to April.`,
        reads: (c) => c.nb.filter(j => c.grid[j] && c.grid[j].kind === 'oak'),
        dormant: (state) => in_(BARE, E.month(state)),
        fire: (c, L) => {
          const m = M(c);
          if (in_(LEAF_FALL, m)) {
            let s = K.oakMast * L + L * count(c, n => n.kind === 'oak') * (has(c.state, 'goodmast') ? 2 : 1);
            if (c.state.mast && m !== 10) s *= 2;
            return { s, p: 0 };
          }
          if (in_(LEAFED, m)) return { s: K.oakLeaf * L, p: L };
          return idle;
        } },
      maple: { name: 'Sugar Maple', emoji: '🍁', cost: 3, rarity: 'common', tag: 'tree', peak: 'winter',
        text: (L) => `February and March: the sap run, +${K.sap * L} amber. May: its seeds plant a Seedling on an empty touching spot. May to August: +${K.mapleSeeds * L} seeds.`,
        dormant: (state) => { const m = E.month(state); return !in_([1, 2], m) && !in_(LEAFED, m); },
        fire: (c, L) => {
          const m = M(c);
          if (in_([1, 2], m)) return { s: 0, p: K.sap * L };
          if (m === 4) {
            const j = c.nb.find(j => emptyAt(c.state, j) && !cacheOf(c.state)[j]);
            if (j != null) c.state.grid[j] = seedling('maple');
          }
          if (in_(LEAFED, m)) return { s: K.mapleSeeds * L, p: 0 };
          return idle;
        } },
      beech: { name: 'Beech', emoji: '🍃', cost: 4, rarity: 'uncommon', tag: 'tree', peak: 'fall',
        text: (L) => `Keeps its dead leaves all winter. December to March: +${K.beechWinter * L} amber. April: drops its old leaves as litter. May to August: +${K.beechLeaf * L} seeds. Fall: beechnuts, +${K.beechNuts * L} amber for each touching critter.`,
        reads: (c) => in_(LEAF_FALL, c.month) ? c.nb.filter(j => c.grid[j] && tagOf(c.grid[j]) === 'critter') : [],
        fire: (c, L) => {
          const m = M(c);
          if (in_(DEAD_WINTER, m)) return { s: 0, p: K.beechWinter * L };
          if (in_(LEAFED, m)) return { s: K.beechLeaf * L, p: 0 };
          if (in_(LEAF_FALL, m)) return { s: 0, p: K.beechNuts * L * count(c, n => tagOf(n) === 'critter') };
          return idle;
        } },
      birch: { name: 'Birch', emoji: '🪵', cost: 3, rarity: 'uncommon', tag: 'tree', peak: 'summer', showGrown: true,
        text: (L) => `Grows each month from May to August: 2 if it touches 2 or fewer tiles, else 1. +${K.birch * L} amber for each growth, every month from May to November. May: seeds one touching log into a Seedling.`,
        dormant: (state) => in_(BARE, E.month(state)),
        fire: (c, L) => {
          const m = M(c);
          if (in_(BARE, m)) return idle;
          if (m === 4) {
            const j = c.nb.find(j => c.state.rock[j]);
            if (j != null) { c.state.rock[j] = false; c.state.grid[j] = seedling('birch'); }
          }
          return { s: 0, p: K.birch * L * (c.t.grown || 0) };
        } },
      seedling: { name: 'Seedling', emoji: '🌱', cost: 0, rarity: 'common', tag: 'tree', noShop: true,
        text: () => 'A young tree. After 3 months of May to August (2 with Old Growth) it grows into the tree it came from, at ★1.',
        dormant: () => true,
        fire: () => idle },

      // ---------- Understory ----------
      trillium: { name: 'Trillium', emoji: '🌷', cost: 2, rarity: 'common', tag: 'understory', peak: 'spring',
        text: (L) => `Blooms in March and April only: +${K.trillium * L} amber, +${L} more for each litter on its spot. Underground the rest of the year.`,
        dormant: (state) => !in_([2, 3], E.month(state)),
        fire: (c, L) => in_([2, 3], M(c)) && !dry(c) ? { s: 0, p: K.trillium * L + L * litterOf(c.state)[c.i] } : idle },
      laurel: { name: 'Mountain Laurel', emoji: '🌺', cost: 3, rarity: 'common', tag: 'understory', peak: 'summer',
        text: (L) => `Evergreen: +${L} amber every month. December to March: +${K.laurelBare * L} more for each touching bare tree. June: blooms for +${K.laurelBloom * L} amber (×2 if pollinated). Deer won't browse it or the tiles it touches.`,
        reads: (c) => in_(DEAD_WINTER, c.month) ? c.nb.filter(j => bareTree(c.grid[j], c.month)) : [],
        fire: (c, L) => {
          if (dry(c)) return idle;
          const m = M(c);
          let p = L;
          if (in_(DEAD_WINTER, m)) p += K.laurelBare * L * count(c, n => bareTree(n, m));
          if (m === 5) p += K.laurelBloom * L * (c.t.poll ? 2 : 1);
          return { s: 0, p };
        } },
      hazel: { name: 'Witch Hazel', emoji: '🌼', cost: 2, rarity: 'common', tag: 'understory', peak: 'fall',
        text: (L) => `The last flower of the year: October to December, +${K.hazelBloom * L} amber (×2 if pollinated). September and October: its pods burst, +${L} seed for each touching empty spot. Otherwise +${L} seed.`,
        fire: (c, L) => {
          if (dry(c)) return idle;
          const m = M(c), bloom = in_([9, 10, 11], m), pods = in_([8, 9], m);
          const p = bloom ? K.hazelBloom * L * (c.t.poll ? 2 : 1) : 0;
          const s = pods ? Math.min(3 * L, L * c.nb.filter(j => emptyAt(c.state, j)).length) : bloom ? 0 : L;
          return { s, p };
        } },
      ginger: { name: 'Wild Ginger', emoji: '🌿', cost: 3, rarity: 'common', tag: 'understory', peak: 'any',
        text: (L) => `Eats up to ${K.gingerEat * L} litter a month from its spot and touching spots, +${K.gingerAmber} amber each. Only half as much from December to February, when the ground is frozen.`,
        reads: (c) => c.nb.filter(j => litterOf(c.state)[j] > 0),
        fire: (c, L) => {
          if (c.state.drought) return idle;
          const lit = litterOf(c.state);
          let room = in_(FROZEN, M(c)) ? Math.ceil(K.gingerEat * L / 2) : K.gingerEat * L, eaten = 0;
          for (const j of [c.i, ...c.nb]) {
            const n = Math.min(room, lit[j]);
            lit[j] -= n; room -= n; eaten += n;
            if (!room) break;
          }
          return { s: 0, p: K.gingerAmber * eaten };
        } },

      // ---------- Critters ----------
      squirrel: { name: 'Gray Squirrel', emoji: '🐿️', cost: 3, rarity: 'common', tag: 'critter', peak: 'fall',
        text: (L) => `Fall: buries up to ${L} cache${L > 1 ? 's' : ''} of ${CONFIG.cacheSeeds} seeds on empty touching spots. December to March: +${K.squirrelCache * L} amber for each touching cache. Caches left in April sprout into White Oak Seedlings. April to August: +${K.squirrelTree * L} seeds for each touching tree.`,
        reads: (c) => c.nb.filter(j => cacheOf(c.state)[j] > 0),
        fire: (c, L) => {
          const m = M(c), cache = cacheOf(c.state);
          if (in_(LEAF_FALL, m)) {
            let n = 0;
            const want = L * (c.state.mast && m !== 10 ? 2 : 1);
            for (const j of c.nb) {
              if (n >= want || c.state.shells < CONFIG.cacheSeeds * (n + 1)) break;
              if (emptyAt(c.state, j) && !cache[j]) { cache[j] = 1; n++; }
            }
            return { s: -CONFIG.cacheSeeds * n, p: 0, conv: true };
          }
          if (in_(DEAD_WINTER, m)) return { s: 0, p: K.squirrelCache * L * c.nb.filter(j => cache[j] > 0).length };
          return { s: K.squirrelTree * L * count(c, n => isTree(n)), p: 0 };
        } },
      bear: { name: 'Black Bear', emoji: '🐻', cost: 5, rarity: 'rare', tag: 'critter', peak: 'fall',
        text: (L) => `Fall: eats up to ${K.bearEat * L} seeds, 2 amber for each. Hibernates from December to March. April to August: +${K.bearForage * L} amber for each touching tile.`,
        dormant: (state) => in_(DEAD_WINTER, E.month(state)),
        reads: (c) => in_([3, 4, 5, 6, 7], c.month) ? c.nb.filter(j => c.grid[j]) : [],
        fire: (c, L) => {
          const m = M(c);
          if (in_(LEAF_FALL, m)) { const n = Math.min(c.state.shells, K.bearEat * L); return { s: -n, p: 2 * n, conv: true }; }
          if (in_(DEAD_WINTER, m)) return idle;
          return { s: 0, p: K.bearForage * L * c.nb.filter(j => c.grid[j]).length };
        } },
      deer: { name: 'White-tailed Deer', emoji: '🦌', cost: 6, rarity: 'rare', tag: 'critter', peak: 'any',
        text: (L) => `+${K.deer * L} amber every month. Each spring month it browses one level off a touching Seedling, Trillium, Witch Hazel or Wild Ginger, smallest first.`,
        fire: (c, L) => ({ s: 0, p: K.deer * L }) },
      frog: { name: 'Wood Frog', emoji: '🐸', cost: 5, rarity: 'uncommon', tag: 'critter', peak: 'spring', echo: true,
        text: (L) => `Frozen solid from December to February. March and April: its chorus fires every touching tile again${L > 1 ? `, ${L} times` : ''}. Otherwise +${L} seed.`,
        targets: (i, state) => state && in_([2, 3], E.month(state)) ? neighbors(i) : null,
        dormant: (state) => in_(FROZEN, E.month(state)),
        fire: (c, L) => in_(FROZEN, M(c)) ? idle : { s: L, p: 0 } },
      bee: { name: 'Bumblebee', emoji: '🐝', cost: 4, rarity: 'uncommon', tag: 'critter', peak: 'summer', booster: true, cheer: 'bzz!',
        text: (L) => `Awake from April to September: the next tile to fire makes ×${1 + L}. April and May: pollinates touching Mountain Laurel and Witch Hazel, doubling their blooms.`,
        dormant: (state) => !in_([3, 4, 5, 6, 7, 8], E.month(state)),
        boosts: (c) => { if (!in_([3, 4, 5, 6, 7, 8], c.month)) return []; for (let j = c.i + 1; j < c.grid.length; j++) if (c.grid[j]) return [j]; return []; },
        fire: (c, L) => {
          const m = M(c);
          if (!in_([3, 4, 5, 6, 7, 8], m)) return idle;
          c.state._mult = Math.max(c.state._mult, 1 + L);
          if (in_([3, 4], m) || has(c.state, 'busybees')) for (const j of c.nb) {
            const t = c.grid[j];
            if (t && (t.kind === 'laurel' || t.kind === 'hazel')) t.poll = true;
          }
          return { s: 0, p: 0 };
        } },
      thrush: { name: 'Wood Thrush', emoji: '🐦', cost: 3, rarity: 'uncommon', tag: 'critter', peak: 'summer', months: [3, 4, 5, 6, 7],
        text: (L) => `A migrant: in the shop from April to August, and flies south at the end of August. +${K.thrush * L} amber for each touching tree in leaf.`,
        reads: (c) => c.nb.filter(j => leafedTree(c.grid[j], c.month)),
        fire: (c, L) => ({ s: 0, p: K.thrush * L * count(c, n => leafedTree(n, M(c))) }) },
      beaver: { name: 'Beaver', emoji: '🦫', cost: 6, rarity: 'rare', tag: 'mover', feller: true, months: [8, 9, 10, 11, 0, 1],
        text: () => 'In the shop from September to February. Tap a tree: the beaver fells it into a log and pays you back every seed you spent on it, then leaves.',
        fells: (state, i) => isTree(state.grid[i]),
        fell: (state, i) => {
          state.shells += E.invested(state.grid[i]);
          E.removeTile(state, i, 'felled');
          state.rock[i] = true;
        } },

      // ---------- Objects ----------
      stash: { name: "Forager's Stash", emoji: '🧺', cost: 0, rarity: 'common', tag: 'object', noShop: true,
        text: () => `Once a month, trade ${CONFIG.stashTrade[0]} seeds for ${CONFIG.stashTrade[1]} amber, or ${CONFIG.stashTrade[0]} amber for ${CONFIG.stashTrade[1]} seeds. Tap it to trade.`,
        dormant: () => true,
        fire: () => idle },
    };

    const EVENTS = {
      derecho: { name: 'Derecho', emoji: '🌪️',
        text: () => `After August, a windstorm knocks down the 2 trees you spent the most seeds on. Each leaves a fallen log in its spot.`,
        threat: (state) => state.grid.map((t, i) => isTree(t) ? i : -1).filter(i => i >= 0)
          .sort((a, b) => E.invested(state.grid[b]) - E.invested(state.grid[a]) || state.grid[b].lvl - state.grid[a].lvl || a - b).slice(0, 2),
        take: (state, i) => { E.removeTile(state, i, 'event'); state.rock[i] = true; } },
      drought: { name: 'Drought', emoji: '🏜️', spares: true,
        text: () => `In September and October, understory tiles make nothing unless they touch 2 or more trees for shade, and litter doesn't rot, so Wild Ginger goes hungry.`,
        threat: (state) => state.grid.map((t, i) => t && tagOf(t) === 'understory' && (t.kind === 'ginger' || treesTouching(state, i) < 2) ? i : -1).filter(i => i >= 0),
        after: (state) => { state.drought = true; } },
      mast: { name: 'Mast Year', emoji: '🌰', spares: true,
        text: () => `A gift: in September and October, White Oaks make twice the seeds and Gray Squirrels bury twice as many caches.`,
        after: (state) => { state.mast = true; } },
    };

    // Heirlooms: permanent rule changes bought with amber at markets (internally "charms").
    const CHARMS = {
      deeplitter: { name: 'Deep Litter', emoji: '🍂', base: 5, text: 'Trees drop 1 more litter on each spot.' },
      goodmast: { name: 'Good Mast', emoji: '🌰', base: 6, text: 'White Oaks count each touching White Oak twice.' },
      busybees: { name: 'Busy Bees', emoji: '🐝', base: 5, text: 'Bumblebees pollinate in every month they are awake.' },
      oldgrowth: { name: 'Old Growth', emoji: '🌱', base: 5, text: 'Seedlings grow into trees after 2 months of May to August, not 3.' },
      richsoil: { name: 'Rich Soil', emoji: '🪨', base: 6, text: 'Understory tiles make +1 amber each time they fire.', bonus: (d) => d.tag === 'understory' ? 1 : 0 },
      thicket: { name: 'Thicket', emoji: '🌿', base: 7, text: 'Critters touching 2 or more critters make +1 amber when they fire.',
        bonus: (d, c) => d.tag === 'critter' && c.nb.reduce((n, j) => n + (c.grid[j] && tagOf(c.grid[j]) === 'critter' ? c.grid[j].lvl : 0), 0) >= 2 ? 1 : 0 },
      harvestmoon: { name: 'Harvest Moon', emoji: '🌕', base: 8, text: 'The first tile in the forest fires twice.', firstTwice: true },
      seedrain: { name: 'Seed Rain', emoji: '🌧️', base: 5, text: 'Each month brings 3 more seeds.', income: 3 },
      clearing: { name: 'Clearing', emoji: '☀️', base: 4, text: 'The shop shows 4 tiles.', shopBonus: 1, onBuy: (state) => E.addOffer(state) },
      tailwind: { name: 'Tailwind', emoji: '💨', base: 4, text: 'Your first New tiles each month is free.', freeRerolls: 1 },
    };

    const hooks = {
      init(state) {
        state.litter = Array(CONFIG.cols * CONFIG.rows).fill(0);
        state.cache = Array(CONFIG.cols * CONFIG.rows).fill(0);
      },
      // After the board fires: deer browse, leaves fall, seedlings and birches grow, caches sprout, the thrush leaves.
      afterFire(state) {
        const m = E.month(state), g = state.grid;
        if (in_([2, 3, 4], m)) {
          g.forEach((t, i) => {
            if (!t || t.kind !== 'deer') return;
            const food = neighbors(i).filter(j => g[j] && ['seedling', 'trillium', 'hazel', 'ginger'].includes(g[j].kind)
              && !neighbors(j).some(k => g[k] && g[k].kind === 'laurel') && !(g[j].kind === 'trillium' && !in_([2, 3], m)))
              .sort((a, b) => g[a].lvl - g[b].lvl || a - b);
            if (!food.length) return;
            const j = food[0];
            if (g[j].lvl > 1) g[j].lvl--; else E.removeTile(state, j, 'browsed');
            (state.browsed || (state.browsed = [])).push({ tide: state.tide, cell: j });
          });
        }
        const drop = CONFIG.k.litter + (has(state, 'deeplitter') ? 1 : 0);
        g.forEach((t, i) => {
          if (!isTree(t)) return;
          const n = (in_(LEAF_FALL, m) && t.kind !== 'beech') ? drop : (m === 3 && t.kind === 'beech') ? 2 * drop : 0;
          if (n) for (const j of [i, ...neighbors(i)]) addLitter(state, j, n);
        });
        if (in_(LEAFED, m)) {
          const need = has(state, 'oldgrowth') ? 2 : 3;
          g.forEach((t, i) => {
            if (!t) return;
            if (t.kind === 'birch') t.grown = (t.grown || 0) + (neighbors(i).filter(j => g[j]).length <= 2 ? 2 : 1);
            if (t.kind === 'seedling' && ++t.grown >= need) g[i] = { kind: t.into, lvl: 1, age: 1, paid: 0 };
          });
        }
        if (m === 2) {
          const cache = cacheOf(state);
          cache.forEach((n, i) => { if (n && emptyAt(state, i)) g[i] = seedling('oak'); cache[i] = 0; });
        }
        if (m === 7) g.forEach((t, i) => { if (t && t.kind === 'thrush') E.removeTile(state, i, 'migrated'); });
      },
      // Anything that leaves the forest (sold, browsed, felled) leaves its leaves behind, except a migrating bird.
      onRemove(state, i, t, why) { if (why !== 'migrated') addLitter(state, i, t.lvl); },
      // The first log you clear reveals a Forager's Stash.
      onClear(state, cell) { if (!state.stashFound) { state.stashFound = true; state.grid[cell] = { kind: 'stash', lvl: 1, age: 1, paid: 0 }; } },
      // Placing a tile on a cache digs it up: you get its seeds back.
      onPlace(state, cell) { const cache = cacheOf(state); if (cache[cell]) { state.shells += CONFIG.cacheSeeds * cache[cell]; cache[cell] = 0; } },
      actions(state) {
        const out = [];
        cacheOf(state).forEach((n, i) => { if (n) out.push({ type: 'dig', cell: i }); });
        state.grid.forEach((t, i) => {
          if (!t || t.kind !== 'stash' || t.traded === state.tide) return;
          const [give] = CONFIG.stashTrade;
          if (state.shells >= give) out.push({ type: 'trade', cell: i, dir: 'up' });
          if (state.pearls >= give) out.push({ type: 'trade', cell: i, dir: 'down' });
        });
        return out;
      },
      act(state, a) {
        if (a.type === 'dig') {
          const cache = cacheOf(state);
          if (!cache[a.cell]) return false;
          state.pearls += CONFIG.digAmber * cache[a.cell]; cache[a.cell] = 0;
          return true;
        }
        if (a.type === 'trade') {
          const t = state.grid[a.cell], [give, get] = CONFIG.stashTrade;
          if (!t || t.kind !== 'stash' || t.traded === state.tide) return false;
          if (a.dir === 'up') { if (state.shells < give) return false; state.shells -= give; state.pearls += get; }
          else { if (state.pearls < give) return false; state.pearls -= give; state.shells += get; }
          t.traded = state.tide;
          return true;
        }
        return false;
      },
    };

    return { CONFIG, KINDS, TILES, EVENTS, CHARMS, hooks };
  }

  const eco = {
    id: 'forest', name: 'Forest', region: 'Eastern US hardwoods', kindness: 'Kind', realm: 'land',
    blurb: 'One year from November to harvest. Every tile keeps its own calendar, and fall leaves feed the winter.',
    terms: { board: 'forest', Board: 'Forest', round: 'month', Round: 'Month', rock: 'log', Rock: 'Fallen log', clear: 'Clear', go: 'Next month', bonus: 'Heirlooms', bonusOne: 'Heirloom', boardMakes: 'Forest makes',
      title: 'Grow a forest through the year', zeroStar: 'A quiet year', incomeWord: 'the month brings',
      failHint: 'Mountain Laurel beside bare trees and Wild Ginger on fallen leaves make amber through the winter.' },
    icon: 'oak',
    seasons: SEASONS, months: MONTHS,
    def,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = eco;
  else (root.TidepoolEcos || (root.TidepoolEcos = {})).forest = eco;
})(typeof window !== 'undefined' ? window : globalThis);

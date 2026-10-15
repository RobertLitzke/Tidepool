// Tidepool rules engine. Pure logic, no DOM: shared by the game page and the bot simulator.
// All tunable numbers live in CONFIG and TILES so balance passes only touch data.
(function (root) {
  const CONFIG = {
    cols: 4,
    rows: 4,
    tides: 12,
    startShells: 4,
    startTiles: [{ cell: 9, kind: 'scallop' }],
    tideIncome: 2,          // shells the tide brings each round, after the reef fires
    shopSize: 3,
    rerollBase: 2,          // first reroll cost in a tide
    rerollStep: 2,          // each further reroll in the same tide costs this much more
    // Tile kinds kept out of the shop. Clownfish is parked: it overlapped Anemone. Anemone made way for the Dolphin:
    // it was one of four look-alike "count your neighbors" tiles, and as a "plant" that is really an animal it blurred the kinds.
    disabled: ['clown', 'anemone'],
    rocks: [12, 13, 14, 15],      // cells that start as rock
    rockCosts: [5, 10, 16, 24],   // pearls to break the 1st, 2nd, ... rock
    charmTides: [5, 7, 9],        // a Tide Charm market opens at the start of these tides (after the tide 4 goal)
    charmOffers: 3,
    charmPriceStep: 6,            // charm price = base + step * (market number - 1)
    maxLevel: 3,            // level cap for most tiles; tiles marked stack: true have no cap
    levelUpStep: 2,         // capped tiles: each level-up costs this much more than the last (Starfish 5, then 7, then 9)
    stackPriceEvery: 2,     // stacking tiles (Conch, Kelp) cost 1 more for every this many of that kind you have placed
    sellRate: 0.5,          // refund = floor(cost * level * sellRate)
    // Pearls you must be holding at the end of a tide, or the run ends. Pearls are also spent, so this is a real tension.
    checkpoints: { 4: 12, 8: 110 },
    stars: [350, 650, 1300],  // pearls held at the end for 1, 2, 3 stars
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
    surgeAnchorKelp: 2,     // a center tile touching this many Kelp tiles survives the Storm Surge
    sharkBites: 2,          // tiles the Hungry Shark eats
  };

  // Tile kinds. Effects that count "plants", "shellfish" or "critters" mean exactly the tiles tagged with that kind.
  const KINDS = {
    plant: { name: 'Plant', emoji: '🌱' },
    shellfish: { name: 'Shellfish', emoji: '🐚' },
    critter: { name: 'Critter', emoji: '🐾' },
    object: { name: 'Object', emoji: '📦' },
    mover: { name: 'Mover', emoji: '↔️' },
  };
  // Names of the shop tiles of one kind, for rules text: "Kelp, Coral".
  const kindNames = (tag) => Object.keys(TILES).filter(k => TILES[k].tag === tag && !CONFIG.disabled.includes(k)).map(k => TILES[k].name).join(', ');

  // Effects return {s, p} (shells, pearls) for one activation at level 1..3.
  // fire(c, L) and text(L) take the tile's level. Most tiles cap at ★3; a few cheap tiles
  // (stack: true) level up forever at a steady rate, so they stay useful and can snowball late.
  // Neighbor counts weight by level: a ★2 Kelp counts as two Kelp.
  // ctx: { grid, i, t, state, nb (8-touching indices), filled }.
  const TILES = {
    scallop: { name: 'Conch', emoji: '🐚', cost: 2, rarity: 'common', tag: 'shellfish', stack: true,
      text: (L) => `+${2 * L} shells.`,
      fire: (c, L) => ({ s: 2 * L, p: 0 }) },
    oyster: { name: 'Oyster', emoji: '🦪', cost: 3, rarity: 'common', tag: 'shellfish',
      text: (L) => `+${L} pearl, +${L} more for each touching shellfish (${kindNames('shellfish')}).`,
      reads: (c) => c.nb.filter(j => c.grid[j] && TILES[c.grid[j].kind].tag === 'shellfish'),
      fire: (c, L) => ({ s: 0, p: L * (1 + count(c, n => TILES[n.kind].tag === 'shellfish')) }) },
    kelp: { name: 'Kelp', emoji: '🌿', cost: 2, rarity: 'common', tag: 'plant', stack: true,
      text: (L) => `+${L} shell. +${L} pearl for each touching Kelp.`,
      reads: (c) => c.nb.filter(j => c.grid[j] && (n => n.kind === 'kelp')(c.grid[j])),
      fire: (c, L) => ({ s: L, p: L * count(c, n => n.kind === 'kelp') }) },
    crab: { name: 'Hermit Crab', emoji: '🦀', cost: 3, rarity: 'common', tag: 'critter',
      text: (L) => `+${L} shell for each touching tile (levels don't add).`,
      reads: (c) => c.nb.filter(j => c.grid[j]),
      fire: (c, L) => ({ s: L * c.nb.filter(j => c.grid[j]).length, p: 0 }) },
    shrimp: { name: 'Shrimp', emoji: '🦐', cost: 3, rarity: 'common', tag: 'critter',
      text: (L) => `+${L} pearl for each touching plant (${kindNames('plant')}).`,
      reads: (c) => c.nb.filter(j => c.grid[j] && (n => TILES[n.kind].tag === 'plant')(c.grid[j])),
      fire: (c, L) => ({ s: 0, p: L * count(c, n => TILES[n.kind].tag === 'plant') }) },
    anemone: { name: 'Anemone', emoji: '🪻', cost: 4, rarity: 'uncommon', tag: 'plant',
      text: (L) => `+${L} pearl for each touching critter (any animal that isn't shellfish).`,
      reads: (c) => c.nb.filter(j => c.grid[j] && (n => TILES[n.kind].tag === 'critter')(c.grid[j])),
      fire: (c, L) => ({ s: 0, p: L * count(c, n => TILES[n.kind].tag === 'critter') }) },
    clown: { name: 'Clownfish', emoji: '🐠', cost: 4, rarity: 'uncommon', tag: 'critter',
      text: (L) => `+${2 * L} pearls, +${2 * L} more for each touching Anemone.`,
      reads: (c) => c.nb.filter(j => c.grid[j] && c.grid[j].kind === 'anemone'),
      fire: (c, L) => ({ s: 0, p: 2 * L * (1 + count(c, n => n.kind === 'anemone')) }) },
    jelly: { name: 'Jellyfish', emoji: '🪼', cost: 3, rarity: 'uncommon', tag: 'critter',
      text: (L) => `+${L} pearl for each Jellyfish level on the reef.`,
      reads: (c) => c.grid.map((t, j) => t && t.kind === 'jelly' && j !== c.i ? j : -1).filter(j => j >= 0),
      fire: (c, L) => ({ s: 0, p: L * c.grid.reduce((n, t) => n + (t && t.kind === 'jelly' ? t.lvl : 0), 0) }) },
    coral: { name: 'Coral', emoji: '🪸', cost: 4, rarity: 'uncommon', tag: 'plant',
      text: (L) => `Grows each tide. +${L} pearl for each tide it has grown.`,
      fire: (c, L) => ({ s: 0, p: L * c.t.age }) },
    urn: { name: 'Sunken Urn', emoji: '🏺', cost: 3, rarity: 'uncommon', tag: 'object',
      text: (L) => `+${L} shell for every 4 shells you hold (up to +${6 * L}).`,
      fire: (c, L) => ({ s: L * Math.min(6, Math.floor(c.state.shells / 4)), p: 0 }) },
    puffer: { name: 'Pufferfish', emoji: '🐡', cost: 5, rarity: 'uncommon', tag: 'critter',
      text: (L) => `The next tile to fire makes ×${1 + L}.`,
      boosts: (c) => { for (let j = c.i + 1; j < c.grid.length; j++) if (c.grid[j]) return [j]; return []; },
      fire: (c, L) => { c.state._mult = Math.max(c.state._mult, 1 + L); return { s: 0, p: 0 }; } },
    star: { name: 'Starfish', emoji: '⭐', cost: 5, rarity: 'uncommon', tag: 'critter', echo: true,
      text: (L) => `Echo: fires the tile above it again${L > 1 ? `, ${L} times` : ''}.`,
      targets: (i) => [i - CONFIG.cols].filter(j => j >= 0) },
    otter: { name: 'Sea Otter', emoji: '🦦', cost: 6, rarity: 'rare', tag: 'critter',
      text: (L) => `Trades up to ${6 * L} shells for pearls: 3 pearls for every 2 shells.`,
      fire: (c, L) => { const n = Math.min(c.state.shells, 6 * L) & ~1; return { s: -n, p: n / 2 * 3, conv: true }; } },
    octo: { name: 'Octopus', emoji: '🐙', cost: 5, rarity: 'rare', tag: 'critter',
      text: (L) => `+${L} pearl for each different kind of tile touching it.`,
      reads: (c) => c.nb.filter(j => c.grid[j] && (() => true)(c.grid[j])),
      fire: (c, L) => ({ s: 0, p: L * new Set(c.nb.map(j => c.grid[j]).filter(Boolean).map(t => t.kind)).size }) },
    whale: { name: 'Whale', emoji: '🐋', cost: 8, rarity: 'rare', tag: 'critter',
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

  // Forecast events. Each strikes once, at the end of CONFIG.eventTide.
  const EVENTS = {
    surge: { name: 'Storm Surge', emoji: '🌊',
      text: () => `After tide ${CONFIG.eventTide}, a storm washes away every tile in the four center spots. A center tile touching ${CONFIG.surgeAnchorKelp} or more Kelp tiles is anchored and stays (a stacked Kelp counts once).` },
    shark: { name: 'Hungry Shark', emoji: '🦈',
      text: () => `After tide ${CONFIG.eventTide}, a shark eats the ${CONFIG.sharkBites} tiles you spent the most shells on, counting level-ups.` },
    undertow: { name: 'Undertow', emoji: '🌀',
      text: () => `After tide ${CONFIG.eventTide}, the whole reef shifts one space left and one row down. The left column wraps to the right side and the bottom row wraps to the top, rocks included.` },
  };

  // Tide Charms: permanent rule changes bought with pearls at charm markets.
  const CHARMS = {
    current: { name: 'Warm Current', emoji: '🌊', base: 6, text: 'Plants make +1 pearl each time they fire.' },
    pearlbed: { name: 'Pearl Bed', emoji: '🫧', base: 6, text: 'Shellfish make +1 pearl each time they fire.' },
    school: { name: 'Big School', emoji: '🐟', base: 7, text: 'Critters touching 2 or more critters make +1 pearl when they fire.' },
    moon: { name: 'Moon Tide', emoji: '🌙', base: 8, text: 'The first tile on the reef fires twice.' },
    deep: { name: 'Deep Echo', emoji: '🔔', base: 7, text: 'Echo tiles echo one extra time.' },
    heart: { name: 'Coral Heart', emoji: '💗', base: 5, text: 'Coral grows twice as fast.' },
    bloom: { name: 'Plankton Bloom', emoji: '✨', base: 5, text: 'The tide brings 3 more shells.' },
    map: { name: 'Treasure Map', emoji: '🗺️', base: 6, text: 'Tiles cost 1 shell less (minimum 1).' },
    sandbar: { name: 'Sandbar', emoji: '🏝️', base: 4, text: 'The shop shows 4 tiles.' },
    riptide: { name: 'Riptide', emoji: '🌀', base: 4, text: 'Your first New tiles each tide is free.' },
  };
  const has = (state, id) => state.charms.includes(id);

  // Tiles marked afterFirstGoal stay out of the shop until the first pearl goal is behind you.
  const firstGoalTide = () => Math.min(...Object.keys(CONFIG.checkpoints).map(Number));
  const inShop = (state, k) => !CONFIG.disabled.includes(k) && !(TILES[k].afterFirstGoal && state.tide <= firstGoalTide());

  // The run's event, picked from the seed so it doesn't disturb the shop's random stream.
  const eventOf = (state) => state.event || (state.event = CONFIG.events[(state.seed >>> 0) % CONFIG.events.length]);
  const eventKnown = (state) => state.tide >= CONFIG.eventRevealTide;

  // Shells spent on a tile, level-ups and stacking prices included (older saves fall back to list price).
  const invested = (t) => t.paid != null ? t.paid : TILES[t.kind].cost * t.lvl;
  const centerCells = () => {
    const out = [];
    for (let r = 1; r < CONFIG.rows - 1; r++) for (let c = 1; c < CONFIG.cols - 1; c++) out.push(r * CONFIG.cols + c);
    return out;
  };
  const kelpAnchors = (state, i) => neighbors(i).filter(j => state.grid[j] && state.grid[j].kind === 'kelp').length;

  // Cells the event would take if it struck now (Undertow takes nothing; it moves everything).
  function eventThreat(state) {
    const ev = eventOf(state);
    if (ev === 'surge') return centerCells().filter(i => state.grid[i] && kelpAnchors(state, i) < CONFIG.surgeAnchorKelp);
    if (ev === 'shark') return state.grid.map((t, i) => t ? i : -1).filter(i => i >= 0)
      .sort((a, b) => invested(state.grid[b]) - invested(state.grid[a]) || state.grid[b].lvl - state.grid[a].lvl || a - b)
      .slice(0, CONFIG.sharkBites);
    return [];
  }

  function strikeEvent(state) {
    const ev = eventOf(state), lost = eventThreat(state).map(i => ({ cell: i, kind: state.grid[i].kind, lvl: state.grid[i].lvl }));
    for (const l of lost) state.grid[l.cell] = null;
    if (ev === 'undertow') {
      const { cols, rows } = CONFIG, g = state.grid.slice(), rk = state.rock.slice();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const from = ((r - 1 + rows) % rows) * cols + (c + 1) % cols;
        state.grid[r * cols + c] = g[from]; state.rock[r * cols + c] = rk[from];
      }
    }
    state.struck = { event: ev, tide: state.tide, lost };
    return state.struck;
  }

  const maxLevel = (kind) => TILES[kind].stack ? Infinity : CONFIG.maxLevel;

  // Counts touching tiles that match, weighted by level: a ★2 Kelp counts as two Kelp.
  function count(c, pred) {
    let n = 0;
    for (const j of c.nb) { const t = c.grid[j]; if (t && pred(t)) n += t.lvl; }
    return n;
  }

  function neighbors(i) {
    const { cols, rows } = CONFIG, r = Math.floor(i / cols), col = i % cols, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = col + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
    return out;
  }

  // mulberry32
  function rand(state) {
    let t = (state.rng = (state.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function newGame(seed) {
    const state = {
      seed, rng: seed | 0, tide: 1, shells: CONFIG.startShells, pearls: 0,
      grid: Array(CONFIG.cols * CONFIG.rows).fill(null),
      offers: [], rerolls: 0, over: false, won: false, lastTide: null, history: [],
      rock: Array(CONFIG.cols * CONFIG.rows).fill(false), rocksBroken: 0,
      charms: [], charmOffers: [], charmMarkets: 0, earned: 0, moves: [], placed: {},
    };
    for (const r of CONFIG.rocks) state.rock[r] = true;
    for (const st of CONFIG.startTiles) state.grid[st.cell] = { kind: st.kind, lvl: 1, age: 1, paid: 0 };
    eventOf(state);
    startTide(state);
    return state;
  }

  function startTide(state) {
    state.rerolls = 0;
    rollOffers(state);
    state.charmOffers = [];
    if (CONFIG.charmTides.includes(state.tide)) {
      state.charmMarkets++;
      const pool = Object.keys(CHARMS).filter(id => !has(state, id));
      for (let n = 0; n < CONFIG.charmOffers && pool.length; n++) state.charmOffers.push(pool.splice(Math.floor(rand(state) * pool.length), 1)[0]);
    }
  }

  const charmPrice = (state, id) => CHARMS[id].base + CONFIG.charmPriceStep * (Math.max(1, state.charmMarkets) - 1);

  function buyCharm(state, id) {
    if (state.over || !state.charmOffers.includes(id)) return false;
    const price = charmPrice(state, id);
    if (state.pearls < price) return false;
    state.pearls -= price;
    state.charms.push(id);
    state.charmOffers = [];
    if (id === 'sandbar') { const o = state.offers; rollOffers(state); state.offers = o.concat(state.offers[0]).slice(0, shopSize(state)); }
    return true;
  }

  const rockCost = (state) => CONFIG.rockCosts[Math.min(state.rocksBroken, CONFIG.rockCosts.length - 1)];

  function breakRock(state, cell) {
    if (state.over || !state.rock[cell] || state.pearls < rockCost(state)) return false;
    state.pearls -= rockCost(state);
    state.rocksBroken++;
    state.rock[cell] = false;
    return true;
  }

  const shopSize = (state) => CONFIG.shopSize + (has(state, 'sandbar') ? 1 : 0);
  // Stacking tiles get pricier as you place them (new tiles and level-ups both count), so the endless stack has a price.
  const placedCount = (state, kind) => (state.placed && state.placed[kind]) || 0;
  // Price to place `kind` on `cell`: leveling up a capped tile costs levelUpStep more per level it already has.
  const placeCost = (state, kind, cell) => {
    const t = state.grid[cell];
    const up = t && t.kind === kind && !TILES[kind].stack ? CONFIG.levelUpStep * t.lvl : 0;
    return tileCost(state, kind) + up;
  };
  const tileCost = (state, kind) => Math.max(1, TILES[kind].cost - (has(state, 'map') ? 1 : 0)
    + (TILES[kind].stack ? Math.floor(placedCount(state, kind) / CONFIG.stackPriceEvery) : 0));

  function rollOffers(state) {
    const kinds = Object.keys(TILES);
    const pick = (ok) => {
      const pool = kinds.filter(k => ok(k) && inShop(state, k));
      const weights = pool.map(k => CONFIG.rarityWeight(TILES[k].rarity, state.tide));
      let r = rand(state) * weights.reduce((a, b) => a + b, 0), k = 0;
      while (k < pool.length - 1 && r >= weights[k]) r -= weights[k++];
      return pool[k];
    };
    state.offers = [];
    for (let n = 0; n < shopSize(state); n++) state.offers.push(pick(() => true));
    // Guarantee some buys: swap unaffordable offers for affordable ones until enough are affordable.
    const budget = Math.max(state.shells, Math.min(...kinds.map(k => tileCost(state, k))));
    const affordable = (k) => tileCost(state, k) <= budget && CONFIG.rarityWeight(TILES[k].rarity, state.tide) > 0 && inShop(state, k);
    let have = state.offers.filter(affordable).length;
    for (let n = 0; n < state.offers.length && have < CONFIG.affordableOffers; n++) {
      if (affordable(state.offers[n])) continue;
      state.offers[n] = pick(affordable); have++;
    }
    // Early on, make sure a pearl maker is always on offer so the tide 4 goal is reachable.
    const pearly = (k) => affordable(k) && CONFIG.earlyPearlTiles.includes(k);
    if (state.tide <= CONFIG.pearlOfferUntil && !state.offers.some(pearly) && kinds.some(pearly)) {
      // Replace the last offer that isn't the only affordable one.
      let n = state.offers.length - 1;
      while (n > 0 && affordable(state.offers[n]) && state.offers.filter(affordable).length <= CONFIG.affordableOffers) n--;
      state.offers[n] = pick(pearly);
    }
  }

  const rerollCost = (state) => {
    const n = state.rerolls - (has(state, 'riptide') ? 1 : 0);
    return n < 0 ? 0 : CONFIG.rerollBase + CONFIG.rerollStep * n;
  };

  function reroll(state) {
    const cost = rerollCost(state);
    if (state.over || state.shells < cost) return false;
    state.shells -= cost; state.rerolls++;
    rollOffers(state);
    return true;
  }

  // A tile can go on an empty cell, or onto the same kind below max level to level it up.
  function canPlace(state, kind, cell) {
    const t = state.grid[cell];
    if (state.rock[cell] || TILES[kind].mover) return false;
    return !t || (t.kind === kind && t.lvl < maxLevel(kind));
  }

  function buy(state, offerIdx, cell) {
    const kind = state.offers[offerIdx];
    if (state.over || !kind) return false;
    const cost = placeCost(state, kind, cell);
    if (state.shells < cost || !canPlace(state, kind, cell)) return false;
    state.shells -= cost;
    const t = state.grid[cell];
    if (t) { t.paid = invested(t) + cost; t.lvl++; } else state.grid[cell] = { kind, lvl: 1, age: 1, paid: cost };
    (state.placed || (state.placed = {}))[kind] = placedCount(state, kind) + 1;
    state.offers[offerIdx] = null;
    return true;
  }

  // Mover tiles: which spots can take the mover, which tiles it can move, and where to.
  const moverSpots = (state) => state.grid.map((t, i) => !t && !state.rock[i] && moverTargets(state, i).length ? i : -1).filter(i => i >= 0);
  const moverTargets = (state, cell) => neighbors(cell).filter(j => state.grid[j] && moverDests(state, j).length);
  function moverDests(state, from) {
    const { cols } = CONFIG, col = from % cols, out = [];
    if (from - cols >= 0) out.push(from - cols);
    if (from + cols < state.grid.length) out.push(from + cols);
    if (col > 0) out.push(from - 1);
    if (col < cols - 1) out.push(from + 1);
    return out.filter(j => !state.rock[j]);
  }

  // Buy a mover, place it on an empty cell touching tile `from`, and move that tile to `to`.
  // The mover leaves the reef right away; every play is logged in state.moves for playtesting.
  function useMover(state, offerIdx, cell, from, to) {
    const kind = state.offers[offerIdx];
    if (state.over || !kind || !TILES[kind].mover) return false;
    const cost = tileCost(state, kind);
    if (state.shells < cost || state.grid[cell] || state.rock[cell]) return false;
    if (!neighbors(cell).includes(from) || !state.grid[from] || !moverDests(state, from).includes(to)) return false;
    state.shells -= cost;
    const moved = state.grid[from], other = state.grid[to];
    state.grid[to] = moved; state.grid[from] = other;
    state.offers[offerIdx] = null;
    (state.moves || (state.moves = [])).push({ tide: state.tide, mover: kind, at: cell, kind: moved.kind, from, to, swapped: other ? other.kind : null });
    return true;
  }

  const sellValue = (t) => Math.floor(TILES[t.kind].cost * t.lvl * CONFIG.sellRate);

  function sell(state, cell) {
    const t = state.grid[cell];
    if (state.over || !t) return false;
    state.shells += sellValue(t);
    state.grid[cell] = null;
    return true;
  }

  // Fire the whole reef in reading order. Returns the event list for animation.
  function runTide(state) {
    if (state.over) return [];
    const events = [];
    state._mult = 1;
    const filled = state.grid.filter(Boolean).length;

    const activate = (i, depth, from) => {
      const t = state.grid[i];
      if (!t) return;
      const def = TILES[t.kind];
      if (def.echo) {
        events.push({ cell: i, type: 'echo', targets: def.targets(i).filter(j => state.grid[j]), from, depth, shells: state.shells, pearls: state.pearls, s: 0, p: 0 });
        if (depth > 0) return; // echoes of echoes do nothing, which keeps chains finite
        for (let k = 0; k < t.lvl + (has(state, 'deep') ? 1 : 0); k++) for (const j of def.targets(i)) {
          if (state.grid[j] && !TILES[state.grid[j].kind].echo) activate(j, depth + 1, i);
        }
        return;
      }
      const isPuffer = t.kind === 'puffer';
      const mult = isPuffer ? 1 : state._mult;
      if (!isPuffer) state._mult = 1;
      const nb = neighbors(i);
      const r = def.fire({ grid: state.grid, i, t, state, nb, filled }, t.lvl);
      let bonus = 0;
      if (has(state, 'current') && def.tag === 'plant') bonus++;
      if (has(state, 'pearlbed') && def.tag === 'shellfish') bonus++;
      if (has(state, 'school') && def.tag === 'critter' && nb.reduce((n, j) => n + (state.grid[j] && TILES[state.grid[j].kind].tag === 'critter' ? state.grid[j].lvl : 0), 0) >= 2) bonus++;
      const s = r.conv ? r.s : r.s * mult, p = (r.p + bonus) * mult;
      state.shells += s; state.pearls += p; state.earned += Math.max(0, p);
      events.push({ cell: i, kind: t.kind, type: 'fire', s, p, mult, from, depth, shells: state.shells, pearls: state.pearls });
    };

    const first = state.grid.findIndex(Boolean);
    for (let i = 0; i < state.grid.length; i++) {
      activate(i, 0, null);
      if (i === first && has(state, 'moon')) activate(i, 0, null);
    }
    delete state._mult;

    for (const t of state.grid) if (t) t.age += t.kind === 'coral' && has(state, 'heart') ? 2 : 1;
    const income = CONFIG.tideIncome + (has(state, 'bloom') ? 3 : 0);
    state.shells += income;
    const earned = events.reduce((a, e) => a + e.p, 0);
    state.history.push({ tide: state.tide, earned, pearls: state.pearls, shells: state.shells });
    state.lastTide = { tide: state.tide, earned, income };
    state.charmOffers = [];
    if (state.tide === CONFIG.eventTide) state.lastTide.struck = strikeEvent(state);

    const need = CONFIG.checkpoints[state.tide];
    if (need != null && state.pearls < need) { state.over = true; state.won = false; state.failedAt = state.tide; }
    else if (state.tide >= CONFIG.tides) { state.over = true; state.won = true; }
    else { state.tide++; startTide(state); }
    return events;
  }

  // Hint overlay data: which cells a tile counts (reads) and which it powers up (boosts).
  function links(state, i) {
    const t = state.grid[i];
    if (!t) return { reads: [], boosts: [] };
    const def = TILES[t.kind];
    const c = { grid: state.grid, i, t, state, nb: neighbors(i) };
    return {
      reads: def.reads ? def.reads(c) : [],
      boosts: def.echo ? def.targets(i).filter(j => state.grid[j]) : def.boosts ? def.boosts(c) : [],
    };
  }

  // What each cell would make next tide if the reef stayed as it is.
  function forecast(state) {
    const c = clone(state); c.over = false;
    const s0 = c.shells, p0 = c.pearls;
    const per = {};
    for (const e of runTide(c)) {
      if (e.type !== 'fire') continue;
      const o = per[e.cell] || (per[e.cell] = { s: 0, p: 0 });
      o.s += e.s; o.p += e.p;
    }
    return { p: c.pearls - p0, s: c.shells - s0 - c.lastTide.income, per };
  }

  function starsFor(pearls) { return CONFIG.stars.filter(x => pearls >= x).length; }

  function nextCheckpoint(state) {
    const ts = Object.keys(CONFIG.checkpoints).map(Number).filter(t => t >= state.tide).sort((a, b) => a - b);
    return ts.length ? { tide: ts[0], need: CONFIG.checkpoints[ts[0]] } : null;
  }

  const clone = (s) => JSON.parse(JSON.stringify(s));

  const api = { CONFIG, TILES, CHARMS, EVENTS, eventOf, eventKnown, eventThreat, invested, KINDS, kindNames, newGame, rollOffers, reroll, rerollCost, canPlace, buy, sell, sellValue, runTide, starsFor, nextCheckpoint, neighbors, clone,
    maxLevel, tileCost, placeCost, shopSize, charmPrice, buyCharm, rockCost, breakRock, links, forecast, has,
    inShop, moverSpots, moverTargets, moverDests, useMover };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tidepool = api;
})(typeof window !== 'undefined' ? window : globalThis);

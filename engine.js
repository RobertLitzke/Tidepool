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
    disabled: ['clown'],          // tile kinds kept out of the shop. Clownfish is parked: it overlapped Anemone.
    rocks: [12, 13, 14, 15],      // cells that start as rock
    rockCosts: [5, 10, 16, 24],   // pearls to break the 1st, 2nd, ... rock
    charmTides: [5, 7, 9],        // a Tide Charm market opens at the start of these tides (after the tide 4 goal)
    charmOffers: 3,
    charmPriceStep: 6,            // charm price = base + step * (market number - 1)
    maxLevel: 3,            // level cap for most tiles; tiles marked stack: true have no cap
    sellRate: 0.5,          // refund = floor(cost * level * sellRate)
    // Pearls you must be holding at the end of a tide, or the run ends. Pearls are also spent, so this is a real tension.
    checkpoints: { 4: 12, 8: 120 },
    stars: [500, 1000, 2000],  // pearls held at the end for 1, 2, 3 stars
    // Shop weights by rarity; rare weight ramps up as tides pass.
    rarityWeight: (rarity, tide) => rarity === 'common' ? 10
      : rarity === 'uncommon' ? (tide < 2 ? 2 : 6)
      : tide < CONFIG.rareFromTide ? 0 : 1 + tide * 0.5,
    rareFromTide: 3,        // no rares in the shop before this tide
    affordableOffers: 2,    // at least this many offers cost no more than your shells
    earlyPearlTiles: ['oyster', 'shrimp', 'jelly', 'coral'], // tiles that make pearls on their own early on
    pearlOfferUntil: 4,     // through this tide, every shop has at least one affordable early pearl tile
  };

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
      text: (L) => `+${L} pearl, +${L} more for each touching shellfish.`,
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
      text: (L) => `+${L} pearl for each touching plant.`,
      reads: (c) => c.nb.filter(j => c.grid[j] && (n => TILES[n.kind].tag === 'plant')(c.grid[j])),
      fire: (c, L) => ({ s: 0, p: L * count(c, n => TILES[n.kind].tag === 'plant') }) },
    anemone: { name: 'Anemone', emoji: '🪻', cost: 4, rarity: 'uncommon', tag: 'plant',
      text: (L) => `+${L} pearl for each touching critter.`,
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
    turtle: { name: 'Sea Turtle', emoji: '🐢', cost: 9, rarity: 'rare', tag: 'critter', echo: true,
      text: (L) => `Echo: fires the tiles to its left and right again${L > 1 ? `, ${L} times` : ''}.`,
      targets: (i) => {
        const col = i % CONFIG.cols, out = [];
        if (col > 0) out.push(i - 1);
        if (col < CONFIG.cols - 1) out.push(i + 1);
        return out;
      } },
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
      charms: [], charmOffers: [], charmMarkets: 0, earned: 0,
    };
    for (const r of CONFIG.rocks) state.rock[r] = true;
    for (const st of CONFIG.startTiles) state.grid[st.cell] = { kind: st.kind, lvl: 1, age: 1 };
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
  const tileCost = (state, kind) => Math.max(1, TILES[kind].cost - (has(state, 'map') ? 1 : 0));

  function rollOffers(state) {
    const kinds = Object.keys(TILES);
    const pick = (ok) => {
      const pool = kinds.filter(k => ok(k) && !CONFIG.disabled.includes(k));
      const weights = pool.map(k => CONFIG.rarityWeight(TILES[k].rarity, state.tide));
      let r = rand(state) * weights.reduce((a, b) => a + b, 0), k = 0;
      while (k < pool.length - 1 && r >= weights[k]) r -= weights[k++];
      return pool[k];
    };
    state.offers = [];
    for (let n = 0; n < shopSize(state); n++) state.offers.push(pick(() => true));
    // Guarantee some buys: swap unaffordable offers for affordable ones until enough are affordable.
    const budget = Math.max(state.shells, Math.min(...kinds.map(k => tileCost(state, k))));
    const affordable = (k) => tileCost(state, k) <= budget && CONFIG.rarityWeight(TILES[k].rarity, state.tide) > 0;
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
    if (state.rock[cell]) return false;
    return !t || (t.kind === kind && t.lvl < maxLevel(kind));
  }

  function buy(state, offerIdx, cell) {
    const kind = state.offers[offerIdx];
    if (state.over || !kind) return false;
    const cost = tileCost(state, kind);
    if (state.shells < cost || !canPlace(state, kind, cell)) return false;
    state.shells -= cost;
    const t = state.grid[cell];
    if (t) t.lvl++; else state.grid[cell] = { kind, lvl: 1, age: 1 };
    state.offers[offerIdx] = null;
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
      events.push({ cell: i, type: 'fire', s, p, mult, from, depth, shells: state.shells, pearls: state.pearls });
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

  const api = { CONFIG, TILES, CHARMS, newGame, rollOffers, reroll, rerollCost, canPlace, buy, sell, sellValue, runTide, starsFor, nextCheckpoint, neighbors, clone,
    maxLevel, tileCost, shopSize, charmPrice, buyCharm, rockCost, breakRock, links, forecast, has };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tidepool = api;
})(typeof window !== 'undefined' ? window : globalThis);

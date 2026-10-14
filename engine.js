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
    rerollBase: 1,          // first reroll cost, +1 each reroll in the same tide
    maxLevel: 3,
    sellRate: 0.5,          // refund = floor(cost * level * sellRate)
    // Cumulative pearls needed by the end of a tide, or the run ends.
    checkpoints: { 4: 8, 8: 80 },
    stars: [300, 600, 1000],  // final pearl thresholds for 1, 2, 3 stars
    // Shop weights by rarity; rare weight ramps up as tides pass.
    rarityWeight: (rarity, tide) => rarity === 'common' ? 10
      : rarity === 'uncommon' ? (tide < 2 ? 2 : 6)
      : tide < CONFIG.rareFromTide ? 0 : 1 + tide * 0.5,
    rareFromTide: 3,        // no rares in the shop before this tide
    affordableOffers: 2,    // at least this many offers cost no more than your shells
  };

  // Effects return {s, p} (shells, pearls) for one activation at level 1..3.
  // text(L) describes the tile at level L, so the UI can show exactly what a level-up adds.
  // ctx: { grid, i, t, state, nb (8-touching indices), filled }.
  const TILES = {
    scallop: { name: 'Conch', emoji: '🐚', cost: 2, rarity: 'common', tag: 'shellfish',
      text: (L) => `+${2 * L} shells.`,
      fire: (c, L) => ({ s: 2 * L, p: 0 }) },
    oyster: { name: 'Oyster', emoji: '🦪', cost: 3, rarity: 'common', tag: 'shellfish',
      text: (L) => `+${L} ${L > 1 ? 'pearls' : 'pearl'}.`,
      fire: (c, L) => ({ s: 0, p: 1 * L }) },
    kelp: { name: 'Kelp', emoji: '🌿', cost: 2, rarity: 'common', tag: 'plant',
      text: (L) => `+${L} shell, +${L} more for each touching Kelp.`,
      fire: (c, L) => ({ s: L * (1 + count(c, n => n.kind === 'kelp')), p: 0 }) },
    crab: { name: 'Hermit Crab', emoji: '🦀', cost: 3, rarity: 'common', tag: 'critter',
      text: (L) => `+${L} shell for each touching tile.`,
      fire: (c, L) => ({ s: L * count(c, () => true), p: 0 }) },
    shrimp: { name: 'Shrimp', emoji: '🦐', cost: 3, rarity: 'common', tag: 'critter',
      text: (L) => `+${L} pearl for each touching plant.`,
      fire: (c, L) => ({ s: 0, p: L * count(c, n => TILES[n.kind].tag === 'plant') }) },
    anemone: { name: 'Anemone', emoji: '🪻', cost: 4, rarity: 'uncommon', tag: 'plant',
      text: (L) => `+${L} pearl for each touching critter.`,
      fire: (c, L) => ({ s: 0, p: L * count(c, n => TILES[n.kind].tag === 'critter') }) },
    clown: { name: 'Clownfish', emoji: '🐠', cost: 3, rarity: 'uncommon', tag: 'critter',
      text: (L) => `+${3 * L} pearls if touching an Anemone, otherwise +${L} shell.`,
      fire: (c, L) => count(c, n => n.kind === 'anemone') ? { s: 0, p: 3 * L } : { s: L, p: 0 } },
    jelly: { name: 'Jellyfish', emoji: '🪼', cost: 3, rarity: 'uncommon', tag: 'critter',
      text: (L) => `+${L} pearl for each Jellyfish on the reef.`,
      fire: (c, L) => ({ s: 0, p: L * c.grid.filter(t => t && t.kind === 'jelly').length }) },
    coral: { name: 'Coral', emoji: '🪸', cost: 4, rarity: 'uncommon', tag: 'plant',
      text: (L) => `Grows each tide. +${L} pearl for each tide it has grown.`,
      fire: (c, L) => ({ s: 0, p: L * c.t.age }) },
    urn: { name: 'Sunken Urn', emoji: '🏺', cost: 3, rarity: 'uncommon', tag: 'object',
      text: (L) => `+${L} shell for every 4 shells you hold (up to +${6 * L}).`,
      fire: (c, L) => ({ s: L * Math.min(6, Math.floor(c.state.shells / 4)), p: 0 }) },
    puffer: { name: 'Pufferfish', emoji: '🐡', cost: 5, rarity: 'uncommon', tag: 'critter',
      text: (L) => `The next tile to fire makes ×${1 + L}.`,
      fire: (c, L) => { c.state._mult = Math.max(c.state._mult, 1 + L); return { s: 0, p: 0 }; } },
    star: { name: 'Starfish', emoji: '⭐', cost: 5, rarity: 'uncommon', tag: 'critter', echo: true,
      text: (L) => `Echo: fires the tile above it again${L > 1 ? `, ${L} times` : ''}.`,
      targets: (i) => [i - CONFIG.cols].filter(j => j >= 0) },
    otter: { name: 'Sea Otter', emoji: '🦦', cost: 6, rarity: 'rare', tag: 'critter',
      text: (L) => `Trades up to ${5 * L} shells for pearls, one for one.`,
      fire: (c, L) => { const n = Math.min(c.state.shells, 5 * L); return { s: -n, p: n, conv: true }; } },
    octo: { name: 'Octopus', emoji: '🐙', cost: 7, rarity: 'rare', tag: 'critter',
      text: (L) => `+${L} pearl for each different kind of tile touching it.`,
      fire: (c, L) => ({ s: 0, p: L * new Set(c.nb.map(j => c.grid[j]).filter(Boolean).map(t => t.kind)).size }) },
    whale: { name: 'Whale', emoji: '🐋', cost: 8, rarity: 'rare', tag: 'critter',
      text: (L) => `+${L} pearl for every 2 tiles on the reef.`,
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

  function count(c, pred) {
    let n = 0;
    for (const j of c.nb) { const t = c.grid[j]; if (t && pred(t)) n++; }
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
    };
    for (const st of CONFIG.startTiles) state.grid[st.cell] = { kind: st.kind, lvl: 1, age: 1 };
    rollOffers(state);
    return state;
  }

  function rollOffers(state) {
    const kinds = Object.keys(TILES);
    const pick = (ok) => {
      const pool = kinds.filter(ok);
      const weights = pool.map(k => CONFIG.rarityWeight(TILES[k].rarity, state.tide));
      let r = rand(state) * weights.reduce((a, b) => a + b, 0), k = 0;
      while (k < pool.length - 1 && r >= weights[k]) r -= weights[k++];
      return pool[k];
    };
    state.offers = [];
    for (let n = 0; n < CONFIG.shopSize; n++) state.offers.push(pick(() => true));
    // Guarantee some buys: swap unaffordable offers for affordable ones until enough are affordable.
    const budget = Math.max(state.shells, Math.min(...kinds.map(k => TILES[k].cost)));
    const affordable = (k) => TILES[k].cost <= budget && CONFIG.rarityWeight(TILES[k].rarity, state.tide) > 0;
    let have = state.offers.filter(affordable).length;
    for (let n = 0; n < state.offers.length && have < CONFIG.affordableOffers; n++) {
      if (affordable(state.offers[n])) continue;
      state.offers[n] = pick(affordable); have++;
    }
  }

  const rerollCost = (state) => CONFIG.rerollBase + state.rerolls;

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
    return !t || (t.kind === kind && t.lvl < CONFIG.maxLevel);
  }

  function buy(state, offerIdx, cell) {
    const kind = state.offers[offerIdx];
    if (state.over || !kind) return false;
    const cost = TILES[kind].cost;
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
        for (let k = 0; k < t.lvl; k++) for (const j of def.targets(i)) {
          if (state.grid[j] && !TILES[state.grid[j].kind].echo) activate(j, depth + 1, i);
        }
        return;
      }
      const isPuffer = t.kind === 'puffer';
      const mult = isPuffer ? 1 : state._mult;
      if (!isPuffer) state._mult = 1;
      const r = def.fire({ grid: state.grid, i, t, state, nb: neighbors(i), filled }, t.lvl);
      const s = r.conv ? r.s : r.s * mult, p = r.p * mult;
      state.shells += s; state.pearls += p;
      events.push({ cell: i, type: 'fire', s, p, mult, from, depth, shells: state.shells, pearls: state.pearls });
    };

    for (let i = 0; i < state.grid.length; i++) activate(i, 0, null);
    delete state._mult;

    for (const t of state.grid) if (t) t.age++;
    state.shells += CONFIG.tideIncome;
    const earned = events.reduce((a, e) => a + e.p, 0);
    state.history.push({ tide: state.tide, earned, pearls: state.pearls, shells: state.shells });
    state.lastTide = { tide: state.tide, earned, income: CONFIG.tideIncome };

    const need = CONFIG.checkpoints[state.tide];
    if (need != null && state.pearls < need) { state.over = true; state.won = false; state.failedAt = state.tide; }
    else if (state.tide >= CONFIG.tides) { state.over = true; state.won = true; }
    else { state.tide++; state.rerolls = 0; rollOffers(state); }
    return events;
  }

  function starsFor(pearls) { return CONFIG.stars.filter(x => pearls >= x).length; }

  function nextCheckpoint(state) {
    const ts = Object.keys(CONFIG.checkpoints).map(Number).filter(t => t >= state.tide).sort((a, b) => a - b);
    return ts.length ? { tide: ts[0], need: CONFIG.checkpoints[ts[0]] } : null;
  }

  const clone = (s) => JSON.parse(JSON.stringify(s));

  const api = { CONFIG, TILES, newGame, rollOffers, reroll, rerollCost, canPlace, buy, sell, sellValue, runTide, starsFor, nextCheckpoint, neighbors, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tidepool = api;
})(typeof window !== 'undefined' ? window : globalThis);

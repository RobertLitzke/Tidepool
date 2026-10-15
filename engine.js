// Tidepool rules engine. Pure logic, no DOM: shared by the game page and the bot simulator.
// The rules are generic; each ecosystem (eco-reef.js, eco-forest.js) brings its own tiles, numbers,
// events, bonuses ("charms" in code) and any house rules as hooks. forEco(id) builds one engine per ecosystem.
(function (root) {
  const ECOS = root.TidepoolEcos || {};
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    ECOS.reef = ECOS.reef || require('./eco-reef.js');
    ECOS.forest = ECOS.forest || require('./eco-forest.js');
  }

  function make(eco) {
    let CONFIG, KINDS, TILES, EVENTS, CHARMS, HOOKS;
    const has = (state, id) => state.charms.includes(id);
    // Sum of one numeric hook over the charms you own.
    const charmSum = (state, key, ...a) => state.charms.reduce((n, id) => {
      const v = CHARMS[id][key];
      return n + (typeof v === 'function' ? v(...a) : v || 0);
    }, 0);
    const charmAny = (state, key) => state.charms.some(id => CHARMS[id][key]);

    // Names of the shop tiles of one kind, for rules text: "Sargassum, Staghorn".
    const kindNames = (tag) => Object.keys(TILES).filter(k => TILES[k].tag === tag && !TILES[k].noShop && !CONFIG.disabled.includes(k)).map(k => TILES[k].name).join(', ');

    // Counts touching tiles that match, weighted by level: a ★2 Sargassum counts as two Sargassum.
    function count(c, pred) {
      let n = 0;
      for (const j of c.nb) { const t = c.grid[j]; if (t && pred(t, j)) n += t.lvl; }
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

    // Calendar (ecosystems that have one): the month index 0-11 (0 = January) and season of a round.
    const month = (state, tide = state.tide) => CONFIG.calendar ? (CONFIG.calendar.firstMonth + tide - 1) % 12 : null;
    const season = (state, tide) => CONFIG.calendar ? CONFIG.calendar.seasons[month(state, tide)] : null;

    // Shells spent on a tile, level-ups and stacking prices included (older saves fall back to list price).
    const invested = (t) => t.paid != null ? t.paid : TILES[t.kind].cost * t.lvl;
    const centerCells = () => {
      const out = [];
      for (let r = 1; r < CONFIG.rows - 1; r++) for (let c = 1; c < CONFIG.cols - 1; c++) out.push(r * CONFIG.cols + c);
      return out;
    };

    // Every way a tile leaves the board goes through here, so ecosystems can react (the forest drops litter).
    function removeTile(state, i, why) {
      const t = state.grid[i];
      state.grid[i] = null;
      if (t && HOOKS.onRemove) HOOKS.onRemove(state, i, t, why);
      return t;
    }

    // The engine helpers an ecosystem's rules may use.
    const E = {
      count, neighbors, has, invested, centerCells, month, season, removeTile, rand,
      kindNames: (tag) => kindNames(tag),
      addOffer: (state) => { const o = state.offers; rollOffers(state); state.offers = o.concat(state.offers[0]).slice(0, shopSize(state)); },
      get CONFIG() { return CONFIG; }, get TILES() { return TILES; },
    };
    ({ CONFIG, KINDS, TILES, EVENTS, CHARMS, hooks: HOOKS = {} } = eco.def(E));

    // Tiles marked afterFirstGoal stay out of the shop until the first goal is behind you;
    // tiles with `months` are only in the shop in those months; noShop tiles never are.
    const firstGoalTide = () => Math.min(...Object.keys(CONFIG.checkpoints).map(Number));
    const inShop = (state, k) => !CONFIG.disabled.includes(k) && !TILES[k].noShop && !(TILES[k].afterFirstGoal && state.tide <= firstGoalTide())
      && !(TILES[k].months && !TILES[k].months.includes(month(state)));

    // The run's event, picked from the seed so it doesn't disturb the shop's random stream.
    const eventOf = (state) => state.event || (state.event = CONFIG.events[(state.seed >>> 0) % CONFIG.events.length]);
    const eventKnown = (state) => state.tide >= CONFIG.eventRevealTide;

    // Cells the event would take if it struck now (an event that moves things takes nothing).
    function eventThreat(state) {
      const ev = EVENTS[eventOf(state)];
      return ev && ev.threat ? ev.threat(state) : [];
    }

    function strikeEvent(state) {
      const id = eventOf(state), ev = EVENTS[id];
      const lost = (ev && ev.spares ? [] : eventThreat(state)).map(i => ({ cell: i, kind: state.grid[i].kind, lvl: state.grid[i].lvl }));
      for (const l of lost) ev.take ? ev.take(state, l.cell) : removeTile(state, l.cell, 'event');
      if (ev && ev.after) ev.after(state, lost);
      state.struck = { event: id, tide: state.tide, lost };
      return state.struck;
    }

    const maxLevel = (kind) => TILES[kind].stack ? Infinity : CONFIG.maxLevel;

    // mulberry32
    function rand(state) {
      let t = (state.rng = (state.rng + 0x6D2B79F5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function newGame(seed) {
      const state = {
        eco: eco.id, seed, rng: seed | 0, tide: 1, shells: CONFIG.startShells, pearls: 0,
        grid: Array(CONFIG.cols * CONFIG.rows).fill(null),
        offers: [], rerolls: 0, over: false, won: false, lastTide: null, history: [],
        rock: Array(CONFIG.cols * CONFIG.rows).fill(false), rocksBroken: 0,
        charms: [], charmOffers: [], charmMarkets: 0, earned: 0, moves: [], placed: {},
      };
      if (HOOKS.init) HOOKS.init(state);
      let rocks;
      if (CONFIG.rockLayouts) {
        const layouts = CONFIG.rockLayouts;
        let roll = rand(state) * layouts.reduce((a, l) => a + l.weight, 0), layout = layouts[0];
        for (const l of layouts) { if (roll < l.weight) { layout = l; break; } roll -= l.weight; }
        rocks = layout.cells;
      } else {
        // Blocked cells scattered at random.
        const pool = state.grid.map((_, i) => i);
        rocks = [];
        for (let n = 0; n < CONFIG.rockCount; n++) rocks.push(pool.splice(Math.floor(rand(state) * pool.length), 1)[0]);
      }
      for (const r of rocks) state.rock[r] = true;
      // One starter from each list, each on a random open spot.
      const kinds = [], cells = [];
      for (const list of CONFIG.starters || [CONFIG.startKinds]) {
        const open = state.grid.map((_, i) => i).filter(i => !state.rock[i] && !state.grid[i]);
        const kind = list[Math.floor(rand(state) * list.length)], cell = open[Math.floor(rand(state) * open.length)];
        state.grid[cell] = { kind, lvl: 1, age: 1, paid: 0 };
        kinds.push(kind); cells.push(cell);
      }
      state.start = kinds.length === 1 ? { kind: kinds[0], cell: cells[0], rocks } : { kind: kinds[0], kinds, cells, rocks };
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
      if (CHARMS[id].onBuy) CHARMS[id].onBuy(state);
      return true;
    }

    const rockCost = (state) => CONFIG.rockCosts[Math.min(state.rocksBroken, CONFIG.rockCosts.length - 1)];

    function breakRock(state, cell) {
      if (state.over || !state.rock[cell] || state.pearls < rockCost(state)) return false;
      state.pearls -= rockCost(state);
      state.rocksBroken++;
      state.rock[cell] = false;
      if (HOOKS.onClear) HOOKS.onClear(state, cell);
      return true;
    }

    const shopSize = (state) => CONFIG.shopSize + charmSum(state, 'shopBonus');
    // Stacking tiles get pricier as you place them (new tiles and level-ups both count), so the endless stack has a price.
    const placedCount = (state, kind) => (state.placed && state.placed[kind]) || 0;
    // Price to place `kind` on `cell`: leveling up a capped tile costs levelUpStep more per level it already has.
    const placeCost = (state, kind, cell) => {
      const t = state.grid[cell];
      const up = t && t.kind === kind && !TILES[kind].stack ? CONFIG.levelUpStep * t.lvl : 0;
      return tileCost(state, kind) + up;
    };
    // Stacking tiles marked flat (Sargassum) keep their list price however many you place.
    const stackPriced = (kind) => TILES[kind].stack && !TILES[kind].flat;
    const tileCost = (state, kind) => Math.max(1, TILES[kind].cost + charmSum(state, 'costDelta')
      + (stackPriced(kind) ? Math.floor(placedCount(state, kind) / CONFIG.stackPriceEvery) : 0));

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
      const budget = Math.max(state.shells, Math.min(...kinds.filter(k => inShop(state, k)).map(k => tileCost(state, k))));
      const affordable = (k) => tileCost(state, k) <= budget && CONFIG.rarityWeight(TILES[k].rarity, state.tide) > 0 && inShop(state, k);
      let have = state.offers.filter(affordable).length;
      for (let n = 0; n < state.offers.length && have < CONFIG.affordableOffers; n++) {
        if (affordable(state.offers[n])) continue;
        state.offers[n] = pick(affordable); have++;
      }
      // Early on, make sure a score maker is always on offer so the first goal is reachable.
      const pearly = (k) => affordable(k) && CONFIG.earlyPearlTiles.includes(k);
      if (state.tide <= CONFIG.pearlOfferUntil && !state.offers.some(pearly) && kinds.some(pearly)) {
        // Replace the last offer that isn't the only affordable one.
        let n = state.offers.length - 1;
        while (n > 0 && affordable(state.offers[n]) && state.offers.filter(affordable).length <= CONFIG.affordableOffers) n--;
        state.offers[n] = pick(pearly);
      }
    }

    const rerollCost = (state) => {
      const n = state.rerolls - charmSum(state, 'freeRerolls');
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
      if (state.rock[cell] || TILES[kind].mover || TILES[kind].feller) return false;
      return !t || (t.kind === kind && t.lvl < maxLevel(kind));
    }

    function buy(state, offerIdx, cell) {
      const kind = state.offers[offerIdx];
      if (state.over || !kind) return false;
      const cost = placeCost(state, kind, cell);
      if (state.shells < cost || !canPlace(state, kind, cell)) return false;
      state.shells -= cost;
      const t = state.grid[cell];
      if (t) { t.paid = invested(t) + cost; t.lvl++; } else {
        state.grid[cell] = { kind, lvl: 1, age: 1, paid: cost };
        if (HOOKS.onPlace) HOOKS.onPlace(state, cell);
      }
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
    // The mover leaves the board right away; every play is logged in state.moves for playtesting.
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

    // Feller tiles (the Beaver): buy it and use it on one tile it can take, then it leaves.
    const fellTargets = (state, kind) => state.grid.map((t, i) => t && TILES[kind].fells(state, i) ? i : -1).filter(i => i >= 0);
    function useFeller(state, offerIdx, cell) {
      const kind = state.offers[offerIdx];
      if (state.over || !kind || !TILES[kind].feller) return false;
      const cost = tileCost(state, kind);
      if (state.shells < cost || !fellTargets(state, kind).includes(cell)) return false;
      state.shells -= cost;
      const felled = state.grid[cell];
      TILES[kind].fell(state, cell);
      state.offers[offerIdx] = null;
      (state.moves || (state.moves = [])).push({ tide: state.tide, mover: kind, at: cell, kind: felled.kind });
      return true;
    }

    const sellValue = (t) => Math.floor(TILES[t.kind].cost * t.lvl * CONFIG.sellRate);

    function sell(state, cell) {
      const t = state.grid[cell];
      if (state.over || !t) return false;
      state.shells += sellValue(t);
      removeTile(state, cell, 'sold');
      return true;
    }

    // Extra things a player can do on the board (dig up a cache, trade at a stash). Ecosystem-defined.
    const actions = (state) => !state.over && HOOKS.actions ? HOOKS.actions(state) : [];
    const act = (state, a) => !state.over && HOOKS.act ? HOOKS.act(state, a) : false;

    // Is this tile resting this round (bare, frozen, asleep, underground)? Display only.
    const dormant = (state, i) => {
      const t = state.grid[i], d = t && TILES[t.kind];
      return !!(d && d.dormant && d.dormant(state, t, i));
    };

    const ctxOf = (state, i, filled) => ({ grid: state.grid, i, t: state.grid[i], state, nb: neighbors(i), filled, month: month(state), season: season(state) });

    // Fire the whole board in reading order. Returns the event list for animation.
    function runTide(state) {
      if (state.over) return [];
      const events = [];
      state._mult = 1;
      const filled = state.grid.filter(Boolean).length;
      const echoExtra = charmSum(state, 'echoExtra');

      const activate = (i, depth, from) => {
        const t = state.grid[i];
        if (!t) return;
        const def = TILES[t.kind];
        // Echo tiles fire other tiles again. An echo tile whose targets() is null this round fires like any tile.
        const tg = def.echo ? def.targets(i, state, t) : null;
        if (tg) {
          events.push({ cell: i, type: 'echo', targets: tg.filter(j => state.grid[j]), from, depth, shells: state.shells, pearls: state.pearls, s: 0, p: 0 });
          if (depth > 0) return; // echoes of echoes do nothing, which keeps chains finite
          for (let k = 0; k < t.lvl + echoExtra; k++) for (const j of tg) {
            if (state.grid[j] && !TILES[state.grid[j].kind].echo) activate(j, depth + 1, i);
          }
          return;
        }
        const mult = def.booster ? 1 : state._mult;
        if (!def.booster) state._mult = 1;
        const c = ctxOf(state, i, filled);
        const r = def.fire(c, t.lvl);
        const bonus = r.idle ? 0 : charmSum(state, 'bonus', def, c);
        const s = r.conv ? r.s : r.s * mult, p = (r.p + bonus) * mult;
        state.shells += s; state.pearls += p; state.earned += Math.max(0, p);
        events.push({ cell: i, kind: t.kind, type: 'fire', s, p, mult, from, depth, shells: state.shells, pearls: state.pearls, idle: !!r.idle, note: r.note });
      };

      const first = state.grid.findIndex(Boolean);
      const twice = charmAny(state, 'firstTwice');
      for (let i = 0; i < state.grid.length; i++) {
        activate(i, 0, null);
        if (i === first && twice) activate(i, 0, null);
      }
      delete state._mult;

      for (const t of state.grid) if (t) t.age += 1 + charmSum(state, 'ageBonus', t);
      if (HOOKS.afterFire) HOOKS.afterFire(state, events);
      const income = CONFIG.tideIncome + charmSum(state, 'income');
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
      const c = ctxOf(state, i, state.grid.filter(Boolean).length);
      const tg = def.echo ? def.targets(i, state, t) : null;
      return {
        reads: def.reads ? def.reads(c) : [],
        boosts: tg ? tg.filter(j => state.grid[j]) : def.boosts ? def.boosts(c) : [],
      };
    }

    // What each cell would make next round if the board stayed as it is.
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

    return { eco, CONFIG, TILES, CHARMS, EVENTS, KINDS, eventOf, eventKnown, eventThreat, invested, kindNames, newGame, rollOffers, reroll, rerollCost, canPlace, buy, sell, sellValue, runTide, starsFor, nextCheckpoint, neighbors, clone,
      maxLevel, stackPriced, tileCost, placeCost, shopSize, charmPrice, buyCharm, rockCost, breakRock, links, forecast, has,
      inShop, moverSpots, moverTargets, moverDests, useMover, fellTargets, useFeller, actions, act, dormant, month, season };
  }

  const built = {};
  const forEco = (id) => built[id] || (built[id] = make(ECOS[id]));
  const list = () => Object.keys(ECOS).map(id => ECOS[id]);

  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign(forEco('reef'), { forEco, list });
  else root.Tidepool = { forEco, list };
})(typeof window !== 'undefined' ? window : globalThis);

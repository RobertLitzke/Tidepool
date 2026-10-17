// Tidepool rules engine. Pure logic, no DOM: shared by the game page and the bot simulator.
// The rules are generic; each ecosystem (eco-reef.js, eco-forest.js) brings its own tiles, numbers,
// events, bonuses ("charms" in code) and any house rules as hooks. forEco(id) builds one engine per ecosystem.
(function (root) {
  const ECOS = root.TidepoolEcos || {};
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    ECOS.reef = ECOS.reef || require('./eco-reef.js');
    ECOS.forest = ECOS.forest || require('./eco-forest.js');
    ECOS.serengeti = ECOS.serengeti || require('./eco-serengeti.js');
  }

  function make(eco) {
    let CONFIG, KINDS, TILES, EVENTS, CHARMS, INVASIVES, HOOKS;
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

    // Phases: ecosystems whose rounds alternate between states (forest seasons, Serengeti wet and dry).
    // CONFIG.calendar maps rounds to months and months to seasons; CONFIG.cycle is a plain repeating list
    // of phase ids, one per round. state.phaseAt[tide] overrides either (an event can make a round dry).
    // Each ecosystem module names its phases in eco.seasons ({ id: { name, emoji } }).
    const month = (state, tide = state.tide) => CONFIG.calendar ? (CONFIG.calendar.firstMonth + tide - 1) % 12 : null;
    function phase(state, tide = state.tide) {
      if (state && state.phaseAt && state.phaseAt[tide]) return state.phaseAt[tide];
      if (CONFIG.calendar) return CONFIG.calendar.seasons[month(state, tide)];
      if (CONFIG.cycle) return CONFIG.cycle[(tide - 1) % CONFIG.cycle.length];
      return null;
    }
    const season = phase;

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
      count, neighbors, has, invested, centerCells, month, season, phase, removeTile, rand,
      kindNames: (tag) => kindNames(tag),
      addOffer: (state) => { const o = state.offers; rollOffers(state); state.offers = o.concat(state.offers[0]).slice(0, shopSize(state)); },
      get CONFIG() { return CONFIG; }, get TILES() { return TILES; },
    };
    ({ CONFIG, KINDS, TILES, EVENTS, CHARMS, INVASIVES = {}, hooks: HOOKS = {} } = eco.def(E));

    // Modifiers, picked when a run starts: each one takes something out of the run. A run with any modifier
    // on gets no stars (rated() is false). state.mods lists their ids; saves from before v23 have none.
    const MODIFIERS = {
      noEvent: { name: 'No forecast event', emoji: '🌈', text: () => `Nothing strikes after ${eco.terms.round} ${CONFIG.eventTide}.` },
      noInvasive: { name: 'No invasives', emoji: '🛡️', text: () => `No invasive species arrives in ${eco.terms.round} ${invasiveTide()}.` },
    };
    const modOn = (state, id) => !!(state.mods && state.mods.includes(id));
    const rated = (state) => !(state.mods && state.mods.length);

    // Tiles marked afterFirstGoal stay out of the shop until the first goal is behind you;
    // tiles with `months` are only in the shop in those months; noShop tiles never are.
    const firstGoalTide = () => Math.min(...Object.keys(CONFIG.checkpoints).map(Number));
    const inShop = (state, k) => !CONFIG.disabled.includes(k) && !TILES[k].noShop && !(TILES[k].afterFirstGoal && state.tide <= firstGoalTide())
      && !(TILES[k].months && !TILES[k].months.includes(month(state)));

    // The run's event, picked from the seed so it doesn't disturb the shop's random stream.
    const eventOf = (state) => state.event !== undefined ? state.event
      : (state.event = modOn(state, 'noEvent') ? null : CONFIG.events[(state.seed >>> 0) % CONFIG.events.length]);
    const eventKnown = (state) => !!eventOf(state) && state.tide >= CONFIG.eventRevealTide;

    // Invasives: one per run (unless the noInvasive modifier is on) arrives on a center cell at the start of
    // invasiveTide, picked from the seed. After each round fires it bites the tile it sits on if that tile is
    // its kind (one level; a ★1 tile is gone), then crawls one cell (diagonals too, over anything) toward the
    // cheapest other tile of its kind by shells spent, nearest first on ties. The target stays locked until it
    // arrives or the tile is gone. On the last tile of its kind it stays and bites every other round.
    const invasiveTide = () => CONFIG.invasiveTide || CONFIG.eventRevealTide;
    const dist = (a, b) => { const c = CONFIG.cols; return Math.max(Math.abs(a % c - b % c), Math.abs(Math.floor(a / c) - Math.floor(b / c))); };
    const edible = (state, i) => { const t = state.grid[i]; return !!t && TILES[t.kind].tag === INVASIVES[state.inv.id].eats; };
    function invasiveGoal(state) {
      const v = state.inv;
      if (!v) return null;
      if (v.goal != null && v.goal !== v.at && edible(state, v.goal)) return v.goal;
      const c = state.grid.map((_, i) => i).filter(i => i !== v.at && edible(state, i));
      c.sort((a, b) => invested(state.grid[a]) - invested(state.grid[b]) || dist(v.at, a) - dist(v.at, b) || a - b);
      return c.length ? c[0] : null;
    }
    // What the invasive does at the end of this round: the cell it bites (or null) and where it heads.
    function invasivePlan(state) {
      const v = state.inv;
      if (!v) return null;
      const bite = !v.full && edible(state, v.at) ? v.at : null;
      return { id: v.id, at: v.at, bite, goal: invasiveGoal(state), resting: !!v.full };
    }
    function arriveInvasive(state) {
      const ids = Object.keys(INVASIVES);
      if (!ids.length || modOn(state, 'noInvasive') || state.inv || !state.mods) return;
      const h = Math.imul(state.seed >>> 0, 2654435761) >>> 0, centers = centerCells();
      state.inv = { id: ids[(h >>> 8) % ids.length], at: centers[(h >>> 16) % centers.length], goal: null, full: false, bites: 0, eaten: 0 };
    }
    function invasiveTurn(state) {
      const v = state.inv;
      if (!v) return null;
      const out = { id: v.id, from: v.at, bit: null };
      if (v.full) v.full = false;
      else if (edible(state, v.at)) {
        const t = state.grid[v.at];
        out.bit = { cell: v.at, kind: t.kind, lvl: t.lvl };
        v.bites++;
        if (t.lvl <= 1) { removeTile(state, v.at, 'invasive'); v.eaten++; }
        else { const before = invested(t); t.lvl--; t.paid = Math.floor(before * t.lvl / (t.lvl + 1)); }
      }
      const goal = invasiveGoal(state);
      v.goal = goal;
      if (goal == null) { if (out.bit && edible(state, v.at)) v.full = true; }
      else {
        const c = CONFIG.cols, r = Math.floor(v.at / c), col = v.at % c, gr = Math.floor(goal / c), gc = goal % c;
        v.at = (r + Math.sign(gr - r)) * c + col + Math.sign(gc - col);
        if (v.at === goal) v.goal = null;
      }
      out.to = v.at;
      return out;
    }

    // Cells the event would take if it struck now (an event that moves things takes nothing).
    function eventThreat(state) {
      const ev = EVENTS[eventOf(state)];
      return ev && ev.threat ? ev.threat(state) : [];
    }

    function strikeEvent(state) {
      const id = eventOf(state), ev = EVENTS[id];
      // An event with strike(state) does it all itself and returns { lost, note }.
      if (ev && ev.strike) { const r = ev.strike(state); state.struck = { event: id, tide: state.tide, lost: r.lost || [], note: r.note }; return state.struck; }
      const lost = (ev && ev.spares ? [] : eventThreat(state)).map(i => ({ cell: i, kind: state.grid[i].kind, lvl: state.grid[i].lvl }));
      for (const l of lost) ev.take ? ev.take(state, l.cell) : removeTile(state, l.cell, 'event');
      if (ev && ev.after) ev.after(state, lost);
      state.struck = { event: id, tide: state.tide, lost };
      return state.struck;
    }

    const maxLevel = (kind) => TILES[kind].stack ? Infinity : TILES[kind].maxLevel || CONFIG.maxLevel;

    // mulberry32
    function rand(state) {
      let t = (state.rng = (state.rng + 0x6D2B79F5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function newGame(seed, mods = []) {
      const state = {
        eco: eco.id, seed, mods: mods.filter(id => MODIFIERS[id]), inv: null, rng: seed | 0, tide: 1, shells: CONFIG.startShells, pearls: 0,
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
        let open = state.grid.map((_, i) => i).filter(i => !state.rock[i] && !state.grid[i]);
        // startersTouch: later starters go next to the first one when there's room (the forest's oak drops leaves on its plant).
        if (CONFIG.startersTouch && cells.length) { const nb = open.filter(i => neighbors(cells[0]).includes(i)); if (nb.length) open = nb; }
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
      if (state.tide === invasiveTide()) arriveInvasive(state);
      if (HOOKS.startTide) HOOKS.startTide(state);
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

    // A rock costs pearls; an ecosystem with rockSeedCosts also lets you pay shells instead (pay = 'shell').
    const rockCost = (state, pay = 'pearl') => {
      const list = pay === 'shell' ? CONFIG.rockSeedCosts : CONFIG.rockCosts;
      return list ? list[Math.min(state.rocksBroken, list.length - 1)] : Infinity;
    };

    function breakRock(state, cell, pay = 'pearl') {
      const cost = rockCost(state, pay), have = pay === 'shell' ? 'shells' : 'pearls';
      if (state.over || !state.rock[cell] || state[have] < cost) return false;
      state[have] -= cost;
      state.rocksBroken++;
      state.rock[cell] = false;
      if (HOOKS.onClear) HOOKS.onClear(state, cell);
      return true;
    }

    const shopSize = (state) => CONFIG.shopSize + charmSum(state, 'shopBonus', state);
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
    const tileCost = (state, kind) => Math.max(1, TILES[kind].cost + charmSum(state, 'costDelta', kind, state)
      + (stackPriced(kind) ? Math.floor(placedCount(state, kind) / CONFIG.stackPriceEvery) : 0));

    // Rolls the shop, and rolls again (up to a cap) while every offer is the same kind, if the shop could hold more than one kind.
    function rollOffers(state) {
      const kinds = Object.keys(TILES);
      const tags = new Set(kinds.filter(k => inShop(state, k) && CONFIG.rarityWeight(TILES[k].rarity, state.tide) > 0).map(k => TILES[k].tag));
      for (let n = 0; n < 50; n++) {
        rollOnce(state, kinds);
        if (tags.size < 2 || state.offers.length < 2 || new Set(state.offers.map(k => TILES[k].tag)).size > 1) return;
      }
    }

    function rollOnce(state, kinds) {
      const pick = (ok) => {
        const pool = kinds.filter(k => ok(k) && inShop(state, k));
        const weights = pool.map(k => CONFIG.rarityWeight(TILES[k].rarity, state.tide) * ((CONFIG.kindWeight || {})[TILES[k].tag] || 1));
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
      const n = state.rerolls - charmSum(state, 'freeRerolls', state);
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
      if (t) {
        t.paid = invested(t) + cost; t.lvl++;
        if (HOOKS.onLevelUp) HOOKS.onLevelUp(state, cell);
      } else {
        state.grid[cell] = { kind, lvl: 1, age: 1, paid: cost };
        if (HOOKS.onPlace) HOOKS.onPlace(state, cell);
      }
      (state.placed || (state.placed = {}))[kind] = placedCount(state, kind) + 1;
      state.offers[offerIdx] = null;
      return true;
    }

    // Mover tiles: which spots can take the mover, which tiles it can move, and where to.
    // A `direct` mover (the Elephant) needs no spot: it picks any tile, so its spot is the tile itself.
    const direct = (kind) => !!(kind && TILES[kind] && TILES[kind].direct);
    const moverSpots = (state, kind) => state.grid.map((t, i) =>
      (direct(kind) ? t && moverDests(state, i).length : !t && !state.rock[i] && moverTargets(state, i).length) ? i : -1).filter(i => i >= 0);
    const moverTargets = (state, cell, kind) => direct(kind) ? (state.grid[cell] && moverDests(state, cell).length ? [cell] : [])
      : neighbors(cell).filter(j => state.grid[j] && moverDests(state, j).length);
    function moverDests(state, from) {
      const { cols } = CONFIG, col = from % cols, out = [];
      if (from - cols >= 0) out.push(from - cols);
      if (from + cols < state.grid.length) out.push(from + cols);
      if (col > 0) out.push(from - 1);
      if (col < cols - 1) out.push(from + 1);
      return out.filter(j => !state.rock[j]);
    }

    // Buy a mover, place it on an empty cell touching tile `from` (a direct mover: cell === from), and move that tile to `to`.
    // The mover leaves the board right away; every play is logged in state.moves for playtesting.
    function useMover(state, offerIdx, cell, from, to) {
      const kind = state.offers[offerIdx];
      if (state.over || !kind || !TILES[kind].mover) return false;
      const cost = tileCost(state, kind);
      if (state.shells < cost) return false;
      if (direct(kind) ? cell !== from : state.grid[cell] || state.rock[cell] || !neighbors(cell).includes(from)) return false;
      if ( !state.grid[from] || !moverDests(state, from).includes(to)) return false;
      state.shells -= cost;
      const moved = state.grid[from], other = state.grid[to];
      state.grid[to] = moved; state.grid[from] = other;
      state.offers[offerIdx] = null;
      if (TILES[kind].onMove) TILES[kind].onMove(state, to, from);
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

    // A tile's extra state to show on the board (the Serengeti's grazed flora): { cls, label } or null.
    const tileState = (state, i) => state.grid[i] && HOOKS.tileState ? HOOKS.tileState(state, i) : null;

    const ctxOf = (state, i, filled) => { const ph = phase(state); return { grid: state.grid, i, t: state.grid[i], state, nb: neighbors(i), filled, month: month(state), season: ph, phase: ph }; };

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
          // beforeEcho(state, i, t) can act first (the Oxpecker restores a pasture) and returns {s, p} it made.
          const pre = depth === 0 && def.beforeEcho ? def.beforeEcho(state, i, t) || {} : {};
          state.shells += pre.s || 0; state.pearls += pre.p || 0; state.earned += Math.max(0, pre.p || 0);
          events.push({ cell: i, type: 'echo', targets: tg.filter(j => state.grid[j]), from, depth, shells: state.shells, pearls: state.pearls, s: pre.s || 0, p: pre.p || 0 });
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
        // A tile with repeats(state, t) fires that many extra times in a row (Oasis Mirage's dry-season Waterholes).
        const t = state.grid[i], reps = t && TILES[t.kind].repeats ? TILES[t.kind].repeats(state, t) : 0;
        for (let k = 0; k <= reps; k++) activate(i, 0, null);
        if (i === first && twice) activate(i, 0, null);
      }

      for (const t of state.grid) if (t) t.age += 1 + charmSum(state, 'ageBonus', t);
      // afterFire may fire tiles again (fire(i), animated like the rest) after the board's pass.
      if (HOOKS.afterFire) HOOKS.afterFire(state, events, (i) => { state._mult = 1; activate(i, 0, 'bonus'); });
      delete state._mult;
      const inv = state.tide >= invasiveTide() && state.tide < CONFIG.tides ? invasiveTurn(state) : null;
      // Income per round, or per phase (CONFIG.phaseIncome: the Serengeti's wet rounds pay more than dry ones).
      const ph = phase(state), base = CONFIG.phaseIncome && CONFIG.phaseIncome[ph] != null ? CONFIG.phaseIncome[ph] : CONFIG.tideIncome;
      const income = base + charmSum(state, 'income', state);
      state.shells += income;
      const earned = events.reduce((a, e) => a + e.p, 0);
      state.history.push({ tide: state.tide, earned, pearls: state.pearls, shells: state.shells });
      state.lastTide = { tide: state.tide, earned, income, inv };
      state.charmOffers = [];
      if (state.tide === CONFIG.eventTide && eventOf(state)) state.lastTide.struck = strikeEvent(state);

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

    return { eco, CONFIG, TILES, CHARMS, EVENTS, KINDS, INVASIVES, MODIFIERS, rated, modOn, invasiveTide, invasivePlan, eventOf, eventKnown, eventThreat, invested, kindNames, newGame, rollOffers, reroll, rerollCost, canPlace, buy, sell, sellValue, runTide, starsFor, nextCheckpoint, neighbors, clone,
      maxLevel, stackPriced, tileCost, placeCost, shopSize, charmPrice, buyCharm, rockCost, breakRock, links, forecast, has,
      inShop, moverSpots, moverTargets, moverDests, useMover, fellTargets, useFeller, actions, act, dormant, month, season, phase, tileState,
      phased: !!(CONFIG.calendar || CONFIG.cycle) };
  }

  const built = {};
  const forEco = (id) => built[id] || (built[id] = make(ECOS[id]));
  const list = () => Object.keys(ECOS).map(id => ECOS[id]);

  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign(forEco('reef'), { forEco, list });
  else root.Tidepool = { forEco, list };
})(typeof window !== 'undefined' ? window : globalThis);

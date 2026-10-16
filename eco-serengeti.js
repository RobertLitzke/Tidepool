// Serengeti: an East African savanna. Two ideas. Seasons: rounds alternate Wet (odd) and Dry (even);
// every Wet round starts with the rain turning all flora Lush, Dry rounds don't. Grazing: Gazelles and
// Wildebeest graze touching Lush flora for amber and leave it Grazed until something restores it
// (the next rain, a Waterhole, a Dung Beetle, an Elephant).
// Tile ids are the spec's (zebra, red_oat_grass, ...); flora carry `grazed` (false = Lush).
(function (root) {
  const SEASONS = {
    wet: { name: 'Wet', emoji: '🌧️' },
    dry: { name: 'Dry', emoji: '☀️' },
  };

  function def(E) {
    const { count, neighbors, has } = E;

    const CONFIG = {
      cols: 4,
      rows: 4,
      tides: 12,
      startShells: 4,
      startKinds: ['zebra', 'red_oat_grass', 'gazelle', 'meerkat'],
      cycle: ['wet', 'dry'],          // odd rounds Wet, even rounds Dry
      phaseIncome: { wet: 3, dry: 1 },
      tideIncome: 2,
      shopSize: 3,
      rerollBase: 2,
      rerollStep: 2,
      disabled: ['crocodile'], // v22: Crocodile parked (kept for saved runs)
      // Kopjes (rock outcrops) rest on the bottom, like the reef's rocks.
      rockLayouts: [
        { cells: [12, 13, 14, 15], weight: 2 },
        { cells: [12, 13, 14, 8], weight: 1 },
        { cells: [13, 14, 15, 11], weight: 1 },
      ],
      rockCosts: [5, 10, 16, 24],
      charmTides: [5, 7, 9],
      charmOffers: 3,
      charmPriceStep: 6,
      maxLevel: 3,
      levelUpStep: 2,
      stackPriceEvery: 2,
      sellRate: 0.5,
      checkpoints: { 4: 12, 8: 110 },   // goals fall on Dry rounds
      // Amber held at the end for 1, 2, 3 stars. The spec said 500/1000/1500; calibrated like the other ecosystems so the planner bot gets 0/1/2/3 about 30/35/25/10%.
      stars: [710, 1200, 1760],
      rarityWeight: (rarity, tide) => rarity === 'common' ? 10
        : rarity === 'uncommon' ? (tide < 2 ? 2 : 6)
        : tide < CONFIG.rareFromTide ? 0 : 1 + tide * 0.5,
      rareFromTide: 3,
      affordableOffers: 2,
      earlyPearlTiles: ['gazelle', 'giraffe', 'red_oat_grass', 'acacia', 'baobab'],
      pearlOfferUntil: 4,
      events: ['drought', 'brushfire', 'migration'],
      eventRevealTide: 5,
      eventTide: 10,
      migrationBonus: 5,   // amber per grazer that grazes after the Great Migration
      sproutAmber: 3,      // Fresh Sprouts: amber per flora restored mid-round or at round end
      vultureAmber: 3,     // Vulture Kettle: amber per Grazed flora after the board fires
      // v21 (Rob: Grazed was too easy to avoid): Dry turns start with every flora a Waterhole doesn't water Grazed
      // (dryWilt), and a Waterhole waters only the three cells above it (waterUp).
      // Grazing tuning knobs: how many Grazed flora a restore can turn Lush (per level of the restoring tile),
      // and whether Zebras graze. Infinity = every touching flora, the spec's rule.
      graze: { waterhole: Infinity, dung: Infinity, zebra: false, waterUp: true, dryWilt: true, herdRain: false },
    };

    const KINDS = {
      flora: { name: 'Flora', emoji: '🌾' },
      grazer: { name: 'Grazer', emoji: '🦓' },
      predator: { name: 'Predator', emoji: '🐾' },
      object: { name: 'Object', emoji: '💧' },
      mover: { name: 'Mover', emoji: '↔️' },
    };

    const tagOf = (t) => TILES[t.kind].tag;
    const isFlora = (t) => !!t && tagOf(t) === 'flora';
    const isGrazer = (t) => !!t && tagOf(t) === 'grazer';
    const isPredator = (t) => !!t && tagOf(t) === 'predator';
    const lush = (t) => isFlora(t) && !t.grazed;
    const grazed = (t) => isFlora(t) && !!t.grazed;
    const wet = (state) => E.phase(state) === 'wet';
    const dry = (state) => E.phase(state) === 'dry';
    const cells = (state, pred) => state.grid.map((t, i) => pred(t, i) ? i : -1).filter(i => i >= 0);
    // Touching Lush flora, best first: highest level, then reading order.
    const lushNear = (state, i) => neighbors(i).filter(j => lush(state.grid[j])).sort((a, b) => state.grid[b].lvl - state.grid[a].lvl || a - b);

    // A grazer eats the flora on cell j: it turns Grazed. Returns what the bite adds:
    // an Acacia's thorns pay 2 seeds a level, Ruminant Herd pays 2 amber a level.
    function graze(state, j) {
      const f = state.grid[j], out = { s: 0, p: 0 };
      f.grazed = true;
      if (f.kind === 'acacia') out.s += 2 * f.lvl;
      if (f.kind === 'star_grass') out.p += 2 * f.lvl;
      if (has(state, 'ruminant')) out.p += 2 * f.lvl;
      return out;
    }
    // Restore the flora on cell j to Lush. Returns Fresh Sprouts amber (0 if it was already Lush).
    function restore(state, j) {
      const f = state.grid[j];
      if (!grazed(f)) return 0;
      f.grazed = false;
      return has(state, 'sprouts') ? CONFIG.sproutAmber : 0;
    }
    const restoreAll = (state, list) => list.reduce((n, j) => n + restore(state, j), 0);
    // Restore at most n of the Grazed flora in list, highest level first.
    const restoreSome = (state, list, n) => restoreAll(state, list.filter(j => grazed(state.grid[j])).sort((a, b) => state.grid[b].lvl - state.grid[a].lvl || a - b).slice(0, n));
    // The cells a Waterhole waters at the end of a turn: the three touching it from the row above (CONFIG.graze.waterUp),
    // or all eight touching cells.
    const waterCells = (i) => CONFIG.graze.waterUp ? neighbors(i).filter(j => j < i - 1 && Math.floor(j / CONFIG.cols) === Math.floor(i / CONFIG.cols) - 1) : neighbors(i);
    const oasis = (state, t) => dry(state) && has(state, 'oasis') ? 1 : 0;

    const TILES = {
      // ---------- Stackers ----------
      zebra: { name: 'Zebra', emoji: '🦓', cost: 2, rarity: 'common', tag: 'grazer', stack: true,
        text: (L) => `+${2 * L} seeds.`,
        fire: (c, L) => {
          if (CONFIG.graze.zebra) { const j = lushNear(c.state, c.i)[0]; if (j != null) { const x = graze(c.state, j); return { s: 2 * L + x.s, p: x.p }; } }
          return { s: 2 * L, p: 0 };
        } },
      red_oat_grass: { name: 'Red Oat Grass', emoji: '🌾', cost: 2, rarity: 'common', tag: 'flora', stack: true, flat: true,
        text: (L) => `+${L} seed and +${L} amber.`,
        fire: (c, L) => ({ s: L, p: L }) },
      star_grass: { name: 'Star Grass', emoji: '🌱', cost: 3, rarity: 'common', tag: 'flora',
        text: (L) => `+${L} amber. Sweet: a grazer that grazes it makes +${2 * L} amber more.`,
        fire: (c, L) => ({ s: 0, p: L }) },

      // ---------- Grazers ----------
      gazelle: { name: 'Gazelle', emoji: '🦌', cost: 3, rarity: 'common', tag: 'grazer',
        text: (L) => `Grazes 1 touching Lush flora (the highest level) for +${L} amber, +${L} more per level of that flora. With none Lush, +${L} amber.`,
        reads: (c) => lushNear(c.state, c.i).slice(0, 1),
        fire: (c, L) => {
          const j = lushNear(c.state, c.i)[0];
          if (j == null) return { s: 0, p: L };
          const lv = c.grid[j].lvl, x = graze(c.state, j);
          return { s: x.s, p: L + L * lv + x.p };
        } },
      giraffe: { name: 'Giraffe', emoji: '🦒', cost: 3, rarity: 'common', tag: 'grazer',
        text: (L) => `Browses the treetops, never grazes. +${L} amber, +${L} more per level of touching Lush flora.`,
        reads: (c) => c.nb.filter(j => lush(c.grid[j])),
        fire: (c, L) => ({ s: 0, p: L + L * count(c, lush) }) },
      wildebeest: { name: 'Wildebeest', emoji: '🐃', cost: 4, rarity: 'uncommon', tag: 'grazer',
        text: (L) => `Grazes ALL touching Lush flora: +${2 * L} amber per level grazed. With none Lush, +${L} amber.`,
        reads: (c) => c.nb.filter(j => lush(c.grid[j])),
        fire: (c, L) => {
          const list = lushNear(c.state, c.i);
          if (!list.length) return { s: 0, p: L };
          let s = 0, p = 0;
          for (const j of list) { p += 2 * L * c.grid[j].lvl; const x = graze(c.state, j); s += x.s; p += x.p; }
          return { s, p };
        } },

      // ---------- Flora ----------
      acacia: { name: 'Acacia', emoji: '🌳', cost: 3, rarity: 'uncommon', tag: 'flora',
        text: (L) => `+${L} amber per Acacia level on the savanna. Thorny: each time it is grazed, +${2 * L} seeds.`,
        reads: (c) => cells(c.state, (t, j) => t && t.kind === 'acacia' && j !== c.i),
        fire: (c, L) => ({ s: 0, p: L * c.grid.reduce((n, t) => n + (t && t.kind === 'acacia' ? t.lvl : 0), 0) }) },
      baobab: { name: 'Baobab', emoji: '🌴', cost: 3, rarity: 'uncommon', tag: 'flora', showAge: true,
        text: (L) => `Wet: stores water (+1 age) and makes +${2 * L} seeds. Dry: +${L} amber per age.`,
        repeats: oasis,
        fire: (c, L) => {
          if (wet(c.state)) { c.t.age++; return { s: 2 * L, p: 0 }; }
          return { s: 0, p: L * c.t.age };   // the spec said 2L; at 2L the Baobab made half of all amber (README v20)
        } },

      // ---------- Predators ----------
      meerkat: { name: 'Meerkat', emoji: '🐿️', cost: 3, rarity: 'common', tag: 'predator',
        text: (L) => `+${L} seed per touching tile (levels don't add), +${L} more per touching Grazed flora.`,
        reads: (c) => c.nb.filter(j => c.grid[j]),
        fire: (c, L) => ({ s: L * (c.nb.filter(j => c.grid[j]).length + c.nb.filter(j => grazed(c.grid[j])).length), p: 0 }) },
      cheetah: { name: 'Cheetah', emoji: '🐆', cost: 5, rarity: 'uncommon', tag: 'predator', booster: true, cheer: 'dash!',
        text: (L) => `The next tile to fire makes ×${1 + L}.`,
        boosts: (c) => { for (let j = c.i + 1; j < c.grid.length; j++) if (c.grid[j]) return [j]; return []; },
        fire: (c, L) => { c.state._mult = Math.max(c.state._mult, 1 + L); return { s: 0, p: 0 }; } },
      oxpecker: { name: 'Oxpecker', emoji: '🐦', cost: 5, rarity: 'uncommon', tag: 'predator', echo: true,
        text: (L) => `If the tile above it is a grazer, fires that grazer again${L > 1 ? `, ${L} times` : ''}.`,
        targets: (i, state) => [i - CONFIG.cols].filter(j => j >= 0 && isGrazer(state.grid[j])) },
      dung_beetle: { name: 'Dung Beetle', emoji: '🪲', cost: 4, rarity: 'rare', tag: 'predator',
        text: (L) => `Restores all touching Grazed flora to Lush for +${2 * L} amber each, then trades up to ${6 * L} seeds for 2 amber each.`,
        reads: (c) => c.nb.filter(j => grazed(c.grid[j])),
        fire: (c, L) => {
          const list = c.nb.filter(j => grazed(c.grid[j])).sort((a, b) => c.grid[b].lvl - c.grid[a].lvl || a - b).slice(0, CONFIG.graze.dung * L);
          const p = 2 * L * list.length + restoreAll(c.state, list);
          const n = Math.min(c.state.shells, 6 * L);
          return { s: -n, p: p + 2 * n, conv: true };
        } },
      hyena: { name: 'Spotted Hyena', emoji: '🐕', cost: 5, rarity: 'rare', tag: 'predator',
        text: (L) => `+${2 * L} amber per Grazed flora on the savanna, +${L} more per level of touching predators.`,
        reads: (c) => cells(c.state, (t) => grazed(t)).concat(c.nb.filter(j => isPredator(c.grid[j]))),
        fire: (c, L) => ({ s: 0, p: 2 * L * c.grid.filter(grazed).length + L * count(c, isPredator) }) },
      lion: { name: 'Lion', emoji: '🦁', cost: 7, rarity: 'rare', tag: 'predator',
        text: (L) => `Wet: +${L} amber per level of touching grazers. Dry: +${2 * L} amber per grazer level on the whole savanna.`,
        reads: (c) => wet(c.state) ? c.nb.filter(j => isGrazer(c.grid[j])) : cells(c.state, (t, j) => isGrazer(t) && j !== c.i),
        fire: (c, L) => wet(c.state) ? { s: 0, p: L * count(c, isGrazer) }
          : { s: 0, p: 2 * L * c.grid.reduce((n, t) => n + (isGrazer(t) ? t.lvl : 0), 0) } },
      crocodile: { name: 'Crocodile', emoji: '🐊', cost: 9, rarity: 'rare', tag: 'predator', echo: true,
        text: (L) => `Fires the tiles to its left and right again${L > 1 ? `, ${L} times` : ''}. Wet: first restores touching flora to Lush.`,
        targets: (i) => {
          const col = i % CONFIG.cols, out = [];
          if (col > 0) out.push(i - 1);
          if (col < CONFIG.cols - 1) out.push(i + 1);
          return out;
        },
        beforeEcho: (state, i, t) => wet(state) ? { p: restoreSome(state, neighbors(i), Infinity) } : {} },

      // ---------- Object ----------
      waterhole: { name: 'Waterhole', emoji: '💧', cost: 3, rarity: 'uncommon', tag: 'object',
        text: (L) => `Wet: +${L} seed for every 4 seeds you hold (up to +${6 * L}). Dry: +${L} amber per level of touching grazers. End of each turn: the three cells above it turn Lush, and they stay Lush when a Dry turn starts.`,
        reads: (c) => wet(c.state) ? [] : c.nb.filter(j => isGrazer(c.grid[j])),
        boosts: (c) => waterCells(c.i).filter(j => isFlora(c.grid[j])),
        repeats: oasis,
        fire: (c, L) => wet(c.state) ? { s: L * Math.min(6, Math.floor(c.state.shells / 4)), p: 0 } : { s: 0, p: L * count(c, isGrazer) } },

      // ---------- Mover ----------
      elephant: { name: 'Elephant', emoji: '🐘', cost: 7, rarity: 'rare', tag: 'mover', mover: true, afterFirstGoal: true,
        text: () => 'Place it beside a tile, then move that tile one space (a filled spot swaps). Flora touching where it lands turn Lush. Walks on after.',
        onMove: (state, to) => { const p = restoreAll(state, neighbors(to)); state.pearls += p; state.earned += p; } },
    };

    // Forecast events: revealed at the start of round 5, strike once at the end of round 10.
    const anchored = (state, i) => neighbors(i).some(j => state.grid[j] && (state.grid[j].kind === 'waterhole' || state.grid[j].kind === 'baobab'));
    // Brushfire: the two rows with the most flora (ties go to the higher row).
    const fireRows = (state) => {
      const { cols, rows } = CONFIG, n = [];
      for (let r = 0; r < rows; r++) n.push({ r, k: state.grid.slice(r * cols, r * cols + cols).filter(isFlora).length });
      return n.filter(x => x.k).sort((a, b) => b.k - a.k || a.r - b.r).slice(0, 2).map(x => x.r);
    };
    const inRows = (rs, i) => rs.includes(Math.floor(i / CONFIG.cols));
    const EVENTS = {
      drought: { name: 'Endless Drought', emoji: '🏜️', spares: true,
        text: () => `After turn ${CONFIG.eventTide}, the rains fail: turn ${CONFIG.eventTide + 1} is Dry, so turns ${CONFIG.eventTide}-${CONFIG.tides} are all Dry. Flora not touching a Waterhole or Baobab turn Grazed at once.`,
        threat: (state) => cells(state, (t, i) => isFlora(t) && !anchored(state, i)),
        strike: (state) => {
          state.phaseAt = Object.assign(state.phaseAt || {}, { [CONFIG.eventTide + 1]: 'dry' });
          const hit = cells(state, (t, i) => isFlora(t) && !anchored(state, i));
          for (const i of hit) state.grid[i].grazed = true;
          return { lost: [], note: `The rains failed. ${hit.length} flora turned Grazed, and turn ${CONFIG.eventTide + 1} is Dry.` };
        } },
      brushfire: { name: 'Brushfire', emoji: '🔥',
        text: () => `After turn ${CONFIG.eventTide}, fire sweeps the two rows with the most flora. Grazed flora there burn away; Lush flora survive and grow a level from the ash.`,
        threat: (state) => { const rs = fireRows(state); return cells(state, (t, i) => grazed(t) && inRows(rs, i)); },
        strike: (state) => {
          const rs = fireRows(state), lost = [];
          let grew = 0;
          state.grid.forEach((t, i) => {
            if (!isFlora(t) || !inRows(rs, i)) return;
            if (t.grazed) { lost.push({ cell: i, kind: t.kind, lvl: t.lvl }); E.removeTile(state, i, 'event'); }
            else if (t.lvl < (TILES[t.kind].stack ? Infinity : CONFIG.maxLevel)) { t.lvl++; grew++; }
          });
          const names = lost.map(l => TILES[l.kind].name + (l.lvl > 1 ? ' ★' + l.lvl : '')).join(', ');
          return { lost, note: `${lost.length ? `Burned: ${names}.` : 'Nothing burned.'} ${grew} Lush flora grew a level from the ash.` };
        } },
      migration: { name: 'Great Migration', emoji: '🐾', moves: true,
        text: () => `After turn ${CONFIG.eventTide}, every grazer marches one row down (the bottom row wraps to the top, swapping places) and grazes one touching Lush flora for +${CONFIG.migrationBonus} amber.`,
        strike: (state) => {
          const { cols, rows } = CONFIG, g = state.grid, rk = state.rock, herd = [];
          for (let c = 0; c < cols; c++) {
            const at = (r) => ((r % rows) + rows) % rows * cols + c;
            const isG = [...Array(rows)].map((_, r) => isGrazer(g[at(r)]));
            const ng = Array(rows), nr = Array(rows);
            for (let r = 0; r < rows; r++) if (isG[r]) { ng[(r + 1) % rows] = g[at(r)]; nr[(r + 1) % rows] = false; herd.push(g[at(r)]); }
            // Whatever a grazer steps onto (a tile, a kopje, an empty spot) takes the place it left.
            for (let r = 0; r < rows; r++) {
              if (isG[r]) continue;
              let q = r;
              if (isG[(r - 1 + rows) % rows]) { q = (r - 1 + rows) % rows; while (isG[(q - 1 + rows) % rows]) q = (q - 1 + rows) % rows; }
              ng[q] = g[at(r)]; nr[q] = rk[at(r)];
            }
            for (let r = 0; r < rows; r++) { g[at(r)] = ng[r] || null; rk[at(r)] = !!nr[r]; }
          }
          let made = 0;
          g.forEach((t, i) => {
            if (!herd.includes(t)) return;
            const j = lushNear(state, i)[0];
            if (j == null) return;
            const x = graze(state, j);
            state.shells += x.s; made += CONFIG.migrationBonus + x.p;
          });
          state.pearls += made; state.earned += made;
          return { lost: [], note: `${herd.length} grazers marched one row down and grazed for +${made} amber.` };
        } },
    };

    // Treasures: permanent rule changes bought with amber at markets (internally "charms").
    const CHARMS = {
      trail: { name: 'Migration Trail', emoji: '🧭', base: 4, text: 'Wet turns show 4 shop tiles; Dry turns give 1 free New tiles.',
        shopBonus: (state) => wet(state) ? 1 : 0, freeRerolls: (state) => dry(state) ? 1 : 0,
        onBuy: (state) => { if (wet(state)) E.addOffer(state); } },
      flood: { name: 'Flash Flood', emoji: '🌊', base: 4, text: 'Dry turns bring 3 seeds, like Wet turns.', income: (state) => dry(state) ? 2 : 0 },
      taproot: { name: 'Deep Taproot', emoji: '🌱', base: 5, text: 'Flora at ★3 or more turn Lush at the start of every turn, Dry ones too.' },
      sprouts: { name: 'Fresh Sprouts', emoji: '🌿', base: 5, text: `Each time a Waterhole, Dung Beetle or Elephant turns Grazed flora Lush, +${CONFIG.sproutAmber} amber.` },
      oasis: { name: 'Oasis Mirage', emoji: '🏝️', base: 6, text: 'Waterholes and Baobabs fire twice in Dry turns.' },
      ruminant: { name: 'Ruminant Herd', emoji: '🐄', base: 6, text: 'Grazing a Lush flora makes +2 amber more per level of that flora.' },
      vulture: { name: 'Vulture Kettle', emoji: '🦅', base: 6, text: `After the savanna fires, +${CONFIG.vultureAmber} amber for each Grazed flora.` },
      termite: { name: 'Termite Symbiosis', emoji: '🐜', base: 7, text: 'Flora and objects cost 1 seed less (minimum 1), and buying or leveling one makes +2 amber.',
        costDelta: (kind) => ['flora', 'object'].includes(TILES[kind].tag) ? -1 : 0 },
      echo: { name: 'Savanna Echo', emoji: '🔔', base: 7, text: 'Oxpeckers echo one extra time.', echoExtra: 1 },
      rains: { name: 'Second Rains', emoji: '🌦️', base: 8, text: 'After each Wet turn fires, the first Grazed flora turns Lush and the grazers touching it fire again.' },
    };

    // Placing or leveling a tile: flora start Lush; Termite Symbiosis pays for flora and objects.
    function bought(state, cell) {
      const t = state.grid[cell];
      if (isFlora(t)) t.grazed = false;
      if (has(state, 'termite') && ['flora', 'object'].includes(tagOf(t))) { state.pearls += 2; state.earned += 2; }
    }

    const hooks = {
      // Start of a round: the rain turns every flora Lush in Wet rounds. Deep Taproot keeps ★3 flora Lush in Dry ones.
      startTide(state) {
        const w = wet(state), deep = has(state, 'taproot');
        state.grid.forEach((t, i) => {
          if (!isFlora(t)) return;
          // herdRain: the rain can't regrow flora a grazer is standing beside.
          if (w && !(CONFIG.graze.herdRain && neighbors(i).some(j => isGrazer(state.grid[j])))) t.grazed = false;
          else if (deep && t.lvl >= 3) t.grazed = false;
          // dryWilt: Dry turns start with every flora a Waterhole doesn't water turning Grazed.
          else if (!w && CONFIG.graze.dryWilt && !state.grid.some((u, k) => u && u.kind === 'waterhole' && waterCells(k).includes(i))) t.grazed = true;
        });
      },
      onPlace: bought,
      onLevelUp: bought,
      // After the board fires: Vulture Kettle, Second Rains, then the grow step (Waterholes water touching flora).
      afterFire(state, events, fire) {
        if (has(state, 'vulture')) { const p = CONFIG.vultureAmber * state.grid.filter(grazed).length; state.pearls += p; state.earned += p; }
        if (has(state, 'rains') && wet(state)) {
          const j = state.grid.findIndex(grazed);
          if (j >= 0) {
            const p = restore(state, j); state.pearls += p; state.earned += p;
            for (const k of neighbors(j)) if (isGrazer(state.grid[k])) fire(k);
          }
        }
        state.grid.forEach((t, i) => {
          if (!t || t.kind !== 'waterhole') return;
          const p = restoreSome(state, waterCells(i), CONFIG.graze.waterhole * t.lvl); state.pearls += p; state.earned += p;
        });
      },
      tileState: (state, i) => grazed(state.grid[i]) ? { cls: 'grazed', label: 'Grazed' } : isFlora(state.grid[i]) ? { cls: 'lush', label: 'Lush' } : null,
    };

    return { CONFIG, KINDS, TILES, EVENTS, CHARMS, hooks };
  }

  const eco = {
    id: 'serengeti', name: 'Serengeti', region: 'East African savanna', kindness: 'Moderate', realm: 'land',
    blurb: 'Wet and dry seasons trade turns. Herds graze the grass bare, and the rains bring it back.',
    terms: { board: 'savanna', Board: 'Savanna', round: 'turn', Round: 'Turn', rock: 'kopje', Rock: 'Kopje', clear: 'Clear', go: 'Next turn', bonus: 'Treasures', bonusOne: 'Treasure', boardMakes: 'Savanna makes',
      title: 'Raise a savanna through the seasons', zeroStar: 'A quiet season', incomeWord: 'the season brings',
      failHint: 'Gazelles grazing Lush grass and Giraffes beside it make amber early.' },
    icon: 'zebra', rockArt: 'kopje',
    seasons: SEASONS,
    def,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = eco;
  else (root.TidepoolEcos || (root.TidepoolEcos = {})).serengeti = eco;
})(typeof window !== 'undefined' ? window : globalThis);

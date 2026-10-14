// Bot simulator for balance tuning. Usage: node sim.js [runs=500] [bot=greedy|random|all]
const TP = require('./engine.js');
const { CONFIG, TILES } = TP;

// Value of one tide's output if this board were frozen, measured on a clone.
function tideYield(state) {
  const c = TP.clone(state);
  c.over = false;
  const s0 = c.shells, p0 = c.pearls;
  TP.runTide(c);
  return { p: c.pearls - p0, s: c.shells - s0 - CONFIG.tideIncome };
}

const bots = {
  random(state) {
    for (let tries = 0; tries < 6; tries++) {
      const opts = [];
      state.offers.forEach((k, oi) => {
        if (!k || TILES[k].cost > state.shells) return;
        state.grid.forEach((_, cell) => { if (TP.canPlace(state, k, cell)) opts.push([oi, cell]); });
      });
      if (!opts.length) return;
      const [oi, cell] = opts[Math.floor(Math.random() * opts.length)];
      TP.buy(state, oi, cell);
    }
  },

  // One-tide lookahead, valuing steady output over the tides that remain.
  greedy(state) {
    const left = CONFIG.tides - state.tide + 1;
    let shellW = Math.max(0.15, 0.7 * (left - 1) / CONFIG.tides);
    const cp = TP.nextCheckpoint(state);
    if (cp && cp.tide - state.tide <= 1 && state.pearls < cp.need) shellW = 0.05; // behind pace: chase pearls
    const score = (y) => (y.p + shellW * y.s) * left;
    let rerolled = 0;
    for (let guard = 0; guard < 12; guard++) {
      const base = score(tideYield(state));
      let best = null;
      state.offers.forEach((k, oi) => {
        if (!k || TILES[k].cost > state.shells) return;
        for (let cell = 0; cell < state.grid.length; cell++) {
          const cur = state.grid[cell];
          const variants = [];
          if (TP.canPlace(state, k, cell)) variants.push(null);
          else if (cur && left > 2) variants.push('replace'); // sell then place
          for (const v of variants) {
            const c = TP.clone(state);
            let refund = 0;
            if (v === 'replace') { refund = TP.sellValue(c.grid[cell]); TP.sell(c, cell); }
            if (!TP.buy(c, oi, cell)) continue;
            const gain = score(tideYield(c)) - base - shellW * (TILES[k].cost - refund);
            if (!best || gain > best.gain) best = { gain, oi, cell, v };
          }
        }
      });
      if (best && best.gain > 0) {
        if (best.v === 'replace') TP.sell(state, best.cell);
        TP.buy(state, best.oi, best.cell);
        continue;
      }
      if (rerolled < 2 && state.shells >= TP.rerollCost(state) + 4) { TP.reroll(state); rerolled++; continue; }
      return;
    }
  },
};

function play(botName, seed) {
  const state = TP.newGame(seed);
  const picks = {}, pearlsBy = {};
  while (!state.over) {
    const before = state.grid.map(t => t && `${t.kind}:${t.lvl}`);
    bots[botName](state);
    state.grid.forEach((t, i) => { if (t && before[i] !== `${t.kind}:${t.lvl}`) picks[t.kind] = (picks[t.kind] || 0) + 1; });
    for (const e of TP.runTide(state)) {
      if (e.type !== 'fire') continue;
      const k = state.grid[e.cell].kind;
      pearlsBy[k] = (pearlsBy[k] || 0) + e.p;
    }
  }
  return { state, picks, pearlsBy };
}

function pct(arr, q) { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; }

function report(botName, runs) {
  const results = [];
  const picks = {}, pearlsBy = {};
  for (let r = 0; r < runs; r++) {
    const res = play(botName, 1000 + r);
    results.push(res.state);
    for (const k in res.picks) picks[k] = (picks[k] || 0) + res.picks[k];
    for (const k in res.pearlsBy) pearlsBy[k] = (pearlsBy[k] || 0) + res.pearlsBy[k];
  }
  const won = results.filter(s => s.won);
  const fails = {};
  results.filter(s => !s.won).forEach(s => fails[s.failedAt] = (fails[s.failedAt] || 0) + 1);
  const scores = won.map(s => s.pearls);
  const stars = [0, 0, 0, 0];
  won.forEach(s => stars[TP.starsFor(s.pearls)]++);
  const curve = [];
  for (let t = 1; t <= CONFIG.tides; t++) {
    const at = results.map(s => s.history[t - 1]).filter(Boolean);
    if (at.length) curve.push(`${t}:${Math.round(at.reduce((a, h) => a + h.pearls, 0) / at.length)}`);
  }
  console.log(`\n== ${botName} bot, ${runs} runs ==`);
  console.log(`finished: ${(100 * won.length / runs).toFixed(0)}%   failed at tide: ${JSON.stringify(fails)}`);
  if (scores.length) console.log(`final pearls p10/p50/p90: ${pct(scores, .1)} / ${pct(scores, .5)} / ${pct(scores, .9)}   max ${Math.max(...scores)}`);
  console.log(`stars 0/1/2/3 among finishers: ${stars.join(' / ')}`);
  console.log(`avg cumulative pearls by tide: ${curve.join(' ')}`);
  const totalPicks = Object.values(picks).reduce((a, b) => a + b, 0);
  const rows = Object.keys(TILES).map(k => ({ k, pick: picks[k] || 0, pearls: pearlsBy[k] || 0 }))
    .sort((a, b) => b.pick - a.pick);
  console.log('tile          picks%  pearls/run');
  for (const r of rows) console.log(`${TILES[r.k].name.padEnd(13)} ${(100 * r.pick / totalPicks).toFixed(1).padStart(5)}  ${(r.pearls / runs).toFixed(1).padStart(8)}`);
}

const runs = +process.argv[2] || 500;
const which = process.argv[3] || 'all';
for (const b of which === 'all' ? Object.keys(bots) : [which]) report(b, runs);

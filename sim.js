// Bot simulator for balance tuning. Usage: node sim.js [runs=500] [bot=greedy|random|all]
const TP = require('./engine.js');
const { CONFIG, TILES } = TP;

// Value of one tide's output if this board were frozen, measured on a clone.
const tideYield = (state) => TP.forecast(state);

// Pearls the bot can spend now and still expect to clear the next checkpoint.
function spare(state) {
  const cp = TP.nextCheckpoint(state);
  if (!cp) return state.pearls;
  const tidesTo = cp.tide - state.tide + 1;
  return state.pearls + tideYield(state).p * tidesTo * 0.8 - cp.need;
}

// Spend pearls on charms and rocks when the expected return beats the price.
function spendPearls(state, left, shellW) {
  const score = (y) => (y.p + shellW * y.s) * left;
  const econ = { map: 2 * shellW, sandbar: 1.5 * shellW, riptide: 2 * shellW, bloom: 3 * shellW };
  let best = null;
  const base = score(tideYield(state));
  for (const id of state.charmOffers) {
    const price = TP.charmPrice(state, id);
    if (price > spare(state)) continue;
    const c = TP.clone(state);
    if (!TP.buyCharm(c, id)) continue;
    const gain = score(tideYield(c)) - base + (econ[id] || 0) * left - price;
    if (!best || gain > best.gain) best = { gain, id };
  }
  if (best && best.gain > 0) TP.buyCharm(state, best.id);
  const empties = state.grid.filter((t, i) => !t && !state.rock[i]).length;
  const rock = state.rock.indexOf(true);
  if (rock >= 0 && empties <= 1 && left >= 4 && TP.rockCost(state) <= spare(state)) TP.breakRock(state, rock);
}

const bots = {
  random(state) {
    for (let tries = 0; tries < 6; tries++) {
      const opts = [];
      state.offers.forEach((k, oi) => {
        if (!k || TP.tileCost(state, k) > state.shells) return;
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
    spendPearls(state, left, shellW);
    let rerolled = 0;
    for (let guard = 0; guard < 12; guard++) {
      const base = score(tideYield(state));
      let best = null;
      state.offers.forEach((k, oi) => {
        if (!k || TP.tileCost(state, k) > state.shells) return;
        if (TILES[k].mover) {
          // Try every spot, touching tile and direction; the mover leaves, so only the move matters.
          for (const cell of TP.moverSpots(state)) for (const from of TP.moverTargets(state, cell)) for (const to of TP.moverDests(state, from)) {
            const c = TP.clone(state);
            if (!TP.useMover(c, oi, cell, from, to)) continue;
            const gain = score(tideYield(c)) - base - shellW * TP.tileCost(state, k);
            if (!best || gain > best.gain) best = { gain, oi, cell, v: 'move', from, to };
          }
          return;
        }
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
            const gain = score(tideYield(c)) - base - shellW * (state.shells - c.shells);
            if (!best || gain > best.gain) best = { gain, oi, cell, v };
          }
        }
      });
      if (best && best.gain > 0) {
        if (best.v === 'move') { TP.useMover(state, best.oi, best.cell, best.from, best.to); continue; }
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
    // Picks = new levels of each kind on the reef (moves and swaps don't count), plus mover plays.
    const levels = () => { const o = {}; for (const t of state.grid) if (t) o[t.kind] = (o[t.kind] || 0) + t.lvl; return o; };
    const before = levels(), movesBefore = state.moves.length;
    bots[botName](state);
    const after = levels();
    for (const k in after) if (after[k] > (before[k] || 0)) picks[k] = (picks[k] || 0) + after[k] - (before[k] || 0);
    for (const m of state.moves.slice(movesBefore)) picks[m.mover] = (picks[m.mover] || 0) + 1;
    for (const e of TP.runTide(state)) {
      if (e.type !== 'fire') continue;
      const k = e.kind;
      pearlsBy[k] = (pearlsBy[k] || 0) + e.p;
    }
  }
  // Late-game efficiency: what each kind on the final board makes per tide, per level.
  const late = {};
  const c = TP.clone(state); c.over = false;
  const f = TP.forecast(c).per;
  state.grid.forEach((t, i) => {
    if (!t) return;
    const o = late[t.kind] || (late[t.kind] = { v: 0, lv: 0 });
    o.v += (f[i] ? f[i].p + 0.3 * f[i].s : 0); o.lv += t.lvl;
  });
  return { state, picks, pearlsBy, late };
}

function pct(arr, q) { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; }

function report(botName, runs) {
  const results = [];
  const picks = {}, pearlsBy = {}, late = {}, charms = {};
  let rocks = 0, moves = 0, movedRuns = 0;
  for (let r = 0; r < runs; r++) {
    const res = play(botName, 1000 + r);
    results.push(res.state);
    for (const k in res.picks) picks[k] = (picks[k] || 0) + res.picks[k];
    for (const k in res.pearlsBy) pearlsBy[k] = (pearlsBy[k] || 0) + res.pearlsBy[k];
    for (const k in res.late) { const o = late[k] || (late[k] = { v: 0, lv: 0 }); o.v += res.late[k].v; o.lv += res.late[k].lv; }
    for (const id of res.state.charms) charms[id] = (charms[id] || 0) + 1;
    rocks += res.state.rocksBroken;
    moves += res.state.moves.length; if (res.state.moves.length) movedRuns++;
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
  console.log(`rocks broken per run: ${(rocks / runs).toFixed(2)}   charms bought: ${Object.entries(charms).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${TP.CHARMS[id].name} ${(100 * n / runs).toFixed(0)}%`).join(', ') || 'none'}`);
  console.log(`mover plays per run: ${(moves / runs).toFixed(2)} (in ${(100 * movedRuns / runs).toFixed(0)}% of runs)`);
  console.log('tile          picks%  pearls/run  late value per level per tide');
  for (const r of rows) console.log(`${TILES[r.k].name.padEnd(13)} ${(100 * r.pick / totalPicks).toFixed(1).padStart(5)}  ${(r.pearls / runs).toFixed(1).padStart(8)}  ${late[r.k] ? (late[r.k].v / late[r.k].lv).toFixed(1).padStart(8) : '       -'}`);
}

module.exports = { bots, play };

if (require.main === module) {
  const runs = +process.argv[2] || 500;
  const which = process.argv[3] || 'all';
  for (const b of which === 'all' ? Object.keys(bots) : [which]) report(b, runs);
}

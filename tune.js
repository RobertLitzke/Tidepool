// Parallel bot runner for big batches. Usage: node tune.js [bot=greedy] [runs=500] [variant.js|-] [seed0=1000] [workers=4]
// A variant file exports (TP) => { ...change TP.CONFIG or TP.TILES... }, e.g. TP.CONFIG.disabled.push('otter') for a drop-one test.
// DUMP=out.json writes one row per run (pearls, stars, shells spent and pearls made by tile).

const path = require('path');
const { fork } = require('child_process');
const REPO = __dirname;
if (process.argv[2] === '__worker') {
  const [, , , bot, from, to, variant] = process.argv;
  const TP = require(REPO + '/engine.js');
  if (variant && variant !== '-') require(path.resolve(variant))(TP);
  const { play } = require(REPO + '/sim.js');
  const spent = {}; // shells spent per kind on the real state
  const realBuy = TP.buy;
  TP.buy = (state, oi, cell) => { const k = state.offers[oi], s0 = state.shells; const ok = realBuy(state, oi, cell); if (ok && !state._sim) state._spent = state._spent || {}, state._spent[k] = (state._spent[k] || 0) + s0 - state.shells; return ok; };
  const realMover = TP.useMover;
  TP.useMover = (state, ...a) => { const k = state.offers[a[0]], s0 = state.shells; const ok = realMover(state, ...a); if (ok && !state._sim) state._spent = state._spent || {}, state._spent[k] = (state._spent[k] || 0) + s0 - state.shells; return ok; };
  const realClone = TP.clone;
  TP.clone = (s) => { const c = realClone(s); c._sim = true; delete c._spent; return c; };
  const out = [];
  for (let seed = +from; seed < +to; seed++) {
    const { state, pearlsBy, picks } = play(bot, seed);
    const finalLv = {};
    for (const t of state.grid) if (t) finalLv[t.kind] = (finalLv[t.kind] || 0) + t.lvl;
    out.push({ seed, won: state.won, pearls: state.pearls, failedAt: state.failedAt || 0, event: state.event, start: state.start.kind,
      stars: state.won ? TP.starsFor(state.pearls) : 0, pearlsBy, picks, spent: state._spent || {}, finalLv, charms: state.charms, rocks: state.rocksBroken });
  }
  process.send(out);
  return;
}
const [bot = 'greedy', runs = '500', variant = '-', seed0 = '1000', W = '4'] = process.argv.slice(2);
const n = +runs, w = +W, per = Math.ceil(n / w);
let done = 0; const all = [];
for (let i = 0; i < w; i++) {
  const from = +seed0 + i * per, to = Math.min(+seed0 + n, from + per);
  if (from >= to) { done++; continue; }
  const ch = fork(__filename, ['__worker', bot, from, to, variant]);
  ch.on('message', (m) => { all.push(...m); if (++done === w) finish(); });
}
function pct(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
function finish() {
  const st = [0, 0, 0, 0]; all.forEach(r => st[r.stars]++);
  const fin = all.filter(r => r.won).length, fails = {};
  all.filter(r => !r.won).forEach(r => fails[r.failedAt] = (fails[r.failedAt] || 0) + 1);
  const P = all.map(r => r.won ? r.pearls : 0);
  const avg = all.reduce((a, r) => a + r.pearls, 0) / all.length;
  const sum = { bot, n: all.length, finish: fin / all.length, fails, avg, p30: pct(P, .3), p50: pct(P, .5), p65: pct(P, .65), p90: pct(P, .9), starsPct: st.map(x => +(100 * x / all.length).toFixed(1)) };
  if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, JSON.stringify(all));
  console.log(`${bot} ${variant} n=${all.length} finish ${(100 * sum.finish).toFixed(1)}% fails ${JSON.stringify(fails)} avg ${avg.toFixed(0)} | all-run pearls p30/p50/p65/p90 ${sum.p30}/${sum.p50}/${sum.p65}/${sum.p90} | stars 0/1/2/3 % ${sum.starsPct.join('/')}`);
}

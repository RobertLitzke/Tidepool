// Rules-engine checks for CI and for refactors. Usage: node test.js [--update]
//   Golden seeds: the greedy and planner bots play fixed seeds in every ecosystem and the final states are
//   hashed against tests/golden.json. A rule or balance change updates the file on purpose (--update, same
//   commit); a refactor must leave it alone.
//   Save fixtures: every saved run in tests/saves/ must still load (TP.validSave) and play to the end, with
//   the fields older versions lacked stripped off, so renaming a tile id or removing a state field fails here.
//   Data checks: tile text, kinds, starters, events and early-pearl lists all point at things that exist.
const fs = require('fs');
const path = require('path');
const { forEco, list } = require('./engine.js');
const { makeSim } = require('./sim.js');
const update = process.argv.includes('--update');
const GOLDEN = path.join(__dirname, 'tests', 'golden.json');
const SAVES = path.join(__dirname, 'tests', 'saves');
const SEEDS = { greedy: 40, planner: 12 };
let failed = 0;
const fail = (msg) => { failed++; console.log('FAIL ' + msg); };

const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const summary = (s) => JSON.stringify({ won: s.won, failedAt: s.failedAt || 0, pearls: s.pearls, shells: s.shells, charms: s.charms, rocks: s.rocksBroken,
  grid: s.grid.map(t => t ? t.kind + t.lvl : '.').join(''), inv: s.inv ? s.inv.bites : 0 });

// 1. Golden seeds.
const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN)) : {};
const fresh = {};
for (const eco of list()) {
  const TP = forEco(eco.id), sim = makeSim(TP);
  for (const bot of Object.keys(SEEDS)) {
    const rows = [];
    for (let seed = 1; seed <= SEEDS[bot]; seed++) rows.push(summary(sim.play(bot, seed).state));
    const h = hash(rows.join('\n'));
    fresh[`${eco.id}.${bot}`] = h;
    const was = golden[`${eco.id}.${bot}`];
    if (!update && was && was !== h) fail(`golden ${eco.id} ${bot}: ${was} -> ${h} (a rule changed; if that was the point, run node test.js --update)`);
    if (!update && !was) fail(`golden ${eco.id} ${bot}: no entry yet (run node test.js --update)`);
  }
}
if (update) { fs.writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + '\n'); console.log('wrote ' + path.relative(__dirname, GOLDEN)); }

// 2. Save fixtures: one mid-run save per ecosystem per version that changed the state. --update writes this version's.
for (const eco of list()) {
  const TP = forEco(eco.id), sim = makeSim(TP);
  if (update) {
    const s = TP.newGame(777);
    while (s.tide < 6 && !s.over) { sim.bots.planner(s); TP.runTide(s); }
    fs.writeFileSync(path.join(SAVES, `${eco.id}-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(s));
  }
}
for (const f of fs.readdirSync(SAVES).filter(f => f.endsWith('.json'))) {
  const g = JSON.parse(fs.readFileSync(path.join(SAVES, f)));
  const TP = forEco(g.eco || 'reef'), sim = makeSim(TP);
  if (!TP.validSave(g)) { fail(`save ${f} no longer loads`); continue; }
  // Older saves lack fields added later: strip the optional ones and the run must still finish.
  for (const k of ['placed', 'moves', 'mods', 'inv', 'leaves', 'phaseAt', 'start', 'earned', 'charmMarkets', 'history']) delete g[k];
  for (const t of g.grid) if (t) delete t.paid;
  try {
    const s = TP.clone(g);
    while (!s.over) { sim.bots.greedy(s); TP.runTide(s); }
    if (!(s.won || s.failedAt)) fail(`save ${f} ended without a result`);
  } catch (e) { fail(`save ${f} threw while playing on: ${e.message}`); }
}

// 3. Data checks.
for (const eco of list()) {
  const TP = forEco(eco.id), { CONFIG, TILES, KINDS, EVENTS, CHARMS } = TP;
  const s = TP.newGame(1);
  for (const [k, d] of Object.entries(TILES)) {
    if (!KINDS[d.tag]) fail(`${eco.id} ${k}: unknown kind ${d.tag}`);
    for (let L = 1; L <= 3; L++) {
      const txt = d.text(L);
      if (typeof txt !== 'string' || /undefined|NaN|\[object/.test(txt)) fail(`${eco.id} ${k}: text(${L}) is "${txt}"`);
    }
    if (d.fire && !d.echo) {
      const c = TP.clone(s); c.grid.fill(null); c.grid[5] = { kind: k, lvl: 1, age: 2, paid: d.cost };
      const y = TP.forecast(c);
      if (!Number.isFinite(y.p) || !Number.isFinite(y.s)) fail(`${eco.id} ${k}: fire() alone gives ${JSON.stringify(y)}`);
    }
  }
  for (const id of CONFIG.events) if (!EVENTS[id]) fail(`${eco.id}: event ${id} missing`);
  for (const k of (CONFIG.starters || [CONFIG.startKinds]).flat()) if (!TILES[k]) fail(`${eco.id}: starter ${k} missing`);
  for (const k of CONFIG.earlyPearlTiles) if (!TILES[k]) fail(`${eco.id}: earlyPearlTiles ${k} missing`);
  for (const k of CONFIG.disabled) if (!TILES[k]) fail(`${eco.id}: disabled ${k} missing (keep parked tiles in TILES for saved runs)`);
  for (const [id, c] of Object.entries(CHARMS)) if (!c.name || c.base == null || !c.text) fail(`${eco.id}: charm ${id} incomplete`);
  if (CONFIG.stars.length !== 3 || CONFIG.stars.some((x, i) => i && x <= CONFIG.stars[i - 1])) fail(`${eco.id}: stars must be 3 rising cutoffs`);
}

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);

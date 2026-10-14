// Tile strength experiment: tally tiles bought over N games, then remove each tile
// from the shop for M games and compare average score with the full game.
// Usage: node ablate.js [tallyGames=100] [dropGames=50] [bot=greedy|random|all]
const TP = require('./engine.js');
const { play } = require('./sim.js');
const { CONFIG, TILES } = TP;

const tallyGames = +process.argv[2] || 100;
const dropGames = +process.argv[3] || 50;
const which = process.argv[4] || 'all';

// Count every purchase (new tile or level-up) by kind.
let bought = null;
const realBuy = TP.buy;
TP.buy = (state, oi, cell) => {
  const kind = state.offers[oi];
  const ok = realBuy(state, oi, cell);
  if (ok && bought && !state._sim) bought[kind] = (bought[kind] || 0) + 1;
  return ok;
};
// Bots buy on clones while searching; only count buys on the real game state.
const realClone = TP.clone;
TP.clone = (s) => { const c = realClone(s); c._sim = true; return c; };

function batch(bot, n, seed0) {
  let score = 0, wins = 0;
  for (let r = 0; r < n; r++) {
    const { state } = play(bot, seed0 + r);
    score += state.pearls; if (state.won) wins++;
  }
  return { avg: score / n, win: wins / n };
}

for (const bot of which === 'all' ? ['greedy', 'random'] : [which]) {
  bought = {};
  const finals = {};
  let boardTiles = 0;
  for (let r = 0; r < tallyGames; r++) {
    const { state } = play(bot, 5000 + r);
    for (const t of state.grid) if (t) { finals[t.kind] = (finals[t.kind] || 0) + t.lvl; boardTiles += t.lvl; }
  }
  const totalBought = Object.values(bought).reduce((a, b) => a + b, 0);
  const tally = bought; bought = null;

  const base = batch(bot, dropGames, 9000);
  console.log(`\n== ${bot} bot: ${tallyGames}-game tally, ${dropGames}-game drop-one test ==`);
  console.log(`baseline (all tiles) over the drop seeds: avg score ${base.avg.toFixed(0)}, finish ${(100 * base.win).toFixed(0)}%`);
  console.log(`total tiles bought: ${totalBought} (${(totalBought / tallyGames).toFixed(1)} per game)`);
  console.log('tile           cost  bought  per game  on final board  avg w/o tile  change  finish w/o');
  const rows = [];
  for (const k of Object.keys(TILES)) {
    CONFIG.disabled = [k];
    const d = batch(bot, dropGames, 9000);
    CONFIG.disabled = [];
    rows.push({ k, n: tally[k] || 0, fin: finals[k] || 0, d });
  }
  rows.sort((a, b) => a.d.avg - b.d.avg); // biggest drop first = strongest tile
  for (const r of rows) {
    const ch = 100 * (r.d.avg - base.avg) / base.avg;
    console.log(`${TILES[r.k].name.padEnd(14)} ${String(TILES[r.k].cost).padStart(4)}  ${String(r.n).padStart(6)}  ${(r.n / tallyGames).toFixed(2).padStart(8)}  ${String(r.fin).padStart(14)}  ${r.d.avg.toFixed(0).padStart(12)}  ${((ch >= 0 ? '+' : '') + ch.toFixed(0) + '%').padStart(6)}  ${(100 * r.d.win).toFixed(0).padStart(9)}%`);
  }
}

// Drop-one tile test for any ecosystem, in parallel worker processes.
// Usage: [ECO=forest] node ablate.js [runs=200] [seed0=9000] [bot=planner] [workers=4]
// Plays the same seeds with the full shop, then once per tile with that tile removed from the shop
// (CONFIG.disabled). A negative change means the game is worse without the tile, so the tile is strong;
// a positive change means the bot does better without it, so it is weaker than the shop slot it takes.
// Noise at 200 runs is about ±5%.
const { fork } = require('child_process');
const eco = process.env.ECO || 'reef';
if (process.argv[2] === '__worker') {
  const [, , , drop, from, to, bot] = process.argv;
  const TP = require('./engine.js').forEco(eco);
  if (drop !== '-') TP.CONFIG.disabled.push(drop);
  const { play } = require('./sim.js').makeSim(TP);
  let sum = 0, won = 0; const fails = {};
  for (let s = +from; s < +to; s++) {
    const { state } = play(bot, s);
    if (state.won) { won++; sum += state.pearls; } else fails[state.failedAt] = (fails[state.failedAt] || 0) + 1;
  }
  process.send({ drop, avg: sum / (to - from), win: won / (to - from), fails });
  return;
}
const [runs = '200', seed0 = '9000', bot = 'planner', W = '4'] = process.argv.slice(2);
const TP = require('./engine.js').forEco(eco);
const tiles = ['-'].concat(Object.keys(TP.TILES).filter(k => !TP.CONFIG.disabled.includes(k) && !TP.TILES[k].noShop));
const results = {};
let running = 0, next = 0;
function launch() {
  while (running < +W && next < tiles.length) {
    const drop = tiles[next++]; running++;
    const ch = fork(__filename, ['__worker', drop, seed0, String(+seed0 + +runs), bot]);
    ch.on('message', (m) => { results[m.drop] = m; running--; if (next >= tiles.length && !running) finish(); else launch(); });
  }
}
function finish() {
  const base = results['-'];
  console.log(`== ${eco} ${bot} drop-one, ${runs} runs, seeds ${seed0}+ ==`);
  console.log(`baseline (all tiles): avg ${base.avg.toFixed(0)}, finish ${(100 * base.win).toFixed(1)}%, fails ${JSON.stringify(base.fails)}`);
  console.log('tile                avg w/o   change   finish w/o');
  const rows = tiles.filter(t => t !== '-').map(t => results[t]).sort((a, b) => a.avg - b.avg);
  for (const r of rows) {
    const ch = 100 * (r.avg - base.avg) / base.avg;
    console.log(`${TP.TILES[r.drop].name.padEnd(18)} ${r.avg.toFixed(0).padStart(8)}  ${((ch >= 0 ? '+' : '') + ch.toFixed(1) + '%').padStart(7)}  ${(100 * r.win).toFixed(1).padStart(9)}%`);
  }
}
launch();

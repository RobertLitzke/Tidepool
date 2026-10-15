// Tile art: every tile is drawn here once, in the "sticker" style
// (bright fills, dark outline, little faces on critters).
// `node art.js` prints the <symbol> block that build.sh injects into ui.html.
// `node art.js --preview out.html` writes a page with every icon on a reef tile.

const INK = '#1E2A36';
const SW = 1.6;               // outline weight in a 48-unit viewBox

const PAL = {
  scallop: { body: '#F7B79C', dark: '#D27C66', lip: '#F2718A', knob: '#FFE1D3' },
  oyster: { lid: '#8E8496', body: '#B4A9BA', nacre: '#EEE8F5', dark: '#6D6475', pearl: '#FFFFFF' },
  kelp: { stem: '#9A7B2C', leaf: '#D4B24A', bladder: '#EFCB5E' },
  crab: { body: '#E8584D', dark: '#A93A35', shell: '#F5B565', shellDark: '#B97A2E' },
  shrimp: { shell: '#EBDDC3', shellDark: '#B8A27C', mantle: '#5B6CF0', light: '#A9DBFF' },
  anemone: { base: '#F6A15F', disc: '#8E5ACC', arm: '#B884F0', tip: '#F0DEFF' },
  clown: { body: '#F7802F', white: '#FFFFFF', dark: '#B4531A' },
  jelly: { blade: '#4FB35E', light: '#8BD97E', sand: '#E4C98F' },
  coral: { body: '#F07C8A', light: '#FFD1D6', rock: '#8C9AA3' },
  urn: { mast: '#7A5236', sail: '#EFE3C8', hull: '#9A6A44', dark: '#5C3B24', sand: '#E4C98F' },
  puffer: { body: '#F7CE4A', belly: '#FFF0B8', spike: '#E3A92E', fin: '#F29A3A' },
  star: { body: '#F59E3D', light: '#FFD69A' },
  otter: { body: '#3FBF8A', dark: '#23855E', head: '#2FA7C0', tail: '#F5743A', leg: '#F5743A' },
  octo: { body: '#E2739B', light: '#F7B3CA', dark: '#B9527A' },
  whale: { body: '#5585BC', light: '#E6EEF5' },
  dolphin: { body: '#6FA3CF', belly: '#E3F0FA' },
  turtle: { shell: '#4FA06A', scute: '#7CC48A', skin: '#A9D89A', dark: '#2F7048' },
  rock: { body: '#97A3AB', light: '#C5CED3', dark: '#6C7980' },
};

const f = n => +n.toFixed(2);
function ell(cx, cy, rx, ry, rot = 0) {
  // ellipse as a path, rotated by rot degrees
  const a = rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const pt = (x, y) => `${f(cx + x * c - y * s)} ${f(cy + x * s + y * c)}`;
  return `M${pt(-rx, 0)} A${rx} ${ry} ${rot} 1 1 ${pt(rx, 0)} A${rx} ${ry} ${rot} 1 1 ${pt(-rx, 0)}Z`;
}
function starPath(cx, cy, R, r, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + f(cx + rr * Math.cos(a)) + ' ' + f(cy + rr * Math.sin(a));
  }
  return d + 'Z';
}
// a scalloped elliptical arc from angle a0 to a1 (radians), n bumps
function scallops(cx, cy, rx, ry, a0, a1, n, bulge, start) {
  let d = '';
  const P = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, [x, y] = P(a);
    if (i === 0) { d += (start ? 'M' : 'L') + f(x) + ' ' + f(y); continue; }
    const am = a0 + (a1 - a0) * (i - .5) / n;
    const cxm = cx + rx * bulge * Math.cos(am), cym = cy + ry * bulge * Math.sin(am);
    d += `Q${f(cxm)} ${f(cym)} ${f(x)} ${f(y)}`;
  }
  return d;
}

const DRAW = {
  scallop(p) { // Conch
    p.shape('M8 37 C6 29 10 21 18 18 C22 13 28 8.5 36 6 C40.5 5 42.5 7.5 41.5 11.5 C40 17 36.5 21 32.5 24 C32.5 32 26.5 40 18.5 41.5 C13.5 42.5 9 40.5 8 37Z', 'body');
    p.detail('M18 18 C24 18.5 29.5 20.5 32.5 24 M24 12.5 C29 13 33.5 15 36 18.5 M30 8.5 C33.5 9 37 10.5 39.5 13', 'dark');
    p.shape('M10 36 C9 30 13 25 19 24 C23 27 24 32.5 21 37.5 C17 40 12 39.5 10 36Z', 'lip');
    p.dots([[22, 16, 1.4], [28.5, 11.5, 1.3], [34.5, 8.2, 1.1]], 'knob');
    p.shine('M14 23 C16 20.5 19 19.5 21 19.5 C18.5 21 16.5 22.5 15.2 24.5Z');
  },
  oyster(p) {
    p.shape('M9 23 C9.5 13 17 6.5 25.5 6.5 C34.5 6.5 40.5 13 40 23Z', 'lid');
    p.detail('M15 20 C15.5 15 19 11 23 10 M23 20 C23.5 15 26 11.5 29.5 10.5 M31 21 C31.5 17 33.5 14 36 13', 'dark');
    p.shape('M5 25.5 C5 22 43 20 43 24.5 C43 35 34.5 42 24 42 C13.5 42 5 36 5 25.5Z', 'body');
    p.shape('M9.5 26 C12.5 24 36.5 23 38.5 25.5 C37.5 32.5 31.5 37.5 24 37.5 C16.5 37.5 10.5 32.5 9.5 26Z', 'nacre');
    p.shape(ell(24, 29.5, 5.2, 5.2), 'pearl');
    p.shine('M20.8 28 C21 26 22.5 25 24 25 C23 26 22.3 27 22.2 28.8Z', 1);
  },
  kelp(p) { // Sargassum
    p.limbs(['M24 44 C24 34 22 26 24 16 C25 11 23 7.5 21 4.5', 'M24 31 C28 27 33 25 36 18', 'M23.5 24 C19 21 14 20 12 14'], 'stem', 2.2);
    for (const [cx, cy, rot] of [[32.5, 26.5, -32], [15, 25, 32], [28.5, 13, -58], [16.5, 34, 22], [31, 35, -22], [18, 13.5, 48]])
      p.shape(ell(cx, cy, 6, 2.5, rot), 'leaf');
    p.dots([[36.5, 16.5, 2.3], [11.5, 12.5, 2.3], [20.5, 4.5, 2.3], [25.5, 21, 2]], 'bladder', { outline: true });
  },
  crab(p) { // Hermit Crab
    p.limbs(['M12 38 L9 43', 'M17 39 L16 44', 'M22 39 L23 44'], 'dark', 2.6);
    p.limbs(['M13 31 L11 23', 'M18 31 L19 23'], 'body', 2.2);
    p.shape('M7 36 C7 29 25 29 27 35 C27 40 9 41 7 36Z', 'body');
    p.shape('M2.5 31 C2.5 25.5 11 25 12 29.5 L8 31 L12 33 C11 37 2.5 36.5 2.5 31Z', 'body');
    p.shape('M17 30 C14 16 26 6 37 10 C46 14 45 30 37 35 C30 39 19 38 17 30Z', 'shell');
    p.detail('M31 22 a3 3 0 1 1 -3 -3 a6 6 0 0 1 6 6 a9 9 0 0 1 -9 9', 'shellDark');
    p.shine('M22 17 C24 12 29 10 33 10.5 C28 12.5 25 15 23 19Z');
    p.eye(11, 22, 2.6); p.eye(19, 22, 2.6);
  },
  shrimp(p) { // Giant Clam: wide fluted shell, wavy blue mantle in the gap
    const top = scallops(24, 27, 21, 18, Math.PI, 2 * Math.PI, 5, 1.13, true) + 'Z';
    const bot = scallops(24, 25, 21, 15, 0, Math.PI, 5, 1.12, true) + 'Z';
    p.shape(top, 'shell');
    p.shape(bot, 'shell');
    p.detail('M11 21 L8.5 15 M17.5 19.5 L16.5 11 M24 19 V9.5 M30.5 19.5 L31.5 11 M37 21 L39.5 15', 'shellDark');
    p.detail('M11 32.5 L9 36 M17.5 34 L16.5 38.5 M24 34.5 V40 M30.5 34 L31.5 38.5 M37 32.5 L39 36', 'shellDark');
    let up = 'M4.5 26.5', dn = '';
    const xs = [4.5, 10, 15.5, 21, 27, 32.5, 38, 43.5];
    for (let i = 1; i < xs.length; i++) up += ` Q${(xs[i - 1] + xs[i]) / 2} ${i % 2 ? 20.5 : 32.5} ${xs[i]} 26.5`;
    for (let i = xs.length - 1; i > 0; i--) dn += ` Q${(xs[i - 1] + xs[i]) / 2} ${i % 2 ? 26.5 : 38.5} ${xs[i - 1]} 32.5`;
    p.shape(up + ' L43.5 32.5' + dn + 'Z', 'mantle');
    p.dots([[7.3, 28.5, 1.1], [12.8, 26, 1.3], [18.3, 31, 1.1], [24, 26, 1.3], [29.8, 31, 1.1], [35.3, 26, 1.3], [40.8, 31, 1.1]], 'light');
  },
  anemone(p) {
    const tips = [[7, 15], [10.5, 8.5], [16.5, 4.5], [24, 3.5], [31.5, 4.5], [37.5, 8.5], [41, 15]];
    p.limbs(tips.map(([x, y]) => `M24 27 Q${f(24 + (x - 24) * .35)} ${f(y + 10)} ${x} ${y}`), 'arm', 4.2);
    p.dots(tips.map(([x, y]) => [x, y, 1.6]), 'tip');
    p.shape('M15.5 44 C15.5 37 17 32 18 28.5 L30 28.5 C31 32 32.5 37 32.5 44Z', 'base');
    p.detail('M20 32 L19.5 42 M24 32 V42 M28 32 L28.5 42', 'disc');
    p.shape(ell(24, 28.5, 8.5, 2.8), 'disc');
  },
  clown(p) {
    p.shape('M36 24 L45 15 C47 21 47 27 45 33 Z', 'body');
    p.shape('M17 14 C20 7 29 7 32 15 Z', 'body');
    p.shape('M6 24 C6 16 14 13 22 13 C31 13 38 18 38 24 C38 30 31 35 22 35 C14 35 6 32 6 24Z', 'body');
    p.shape('M13 14.9 C16.5 20 16.5 28 13 33.1 L17.5 34.6 C21 28 21 20 17.5 13.4 Z', 'white');
    p.shape('M27 13.6 C30 20 30 28 27 34.4 L31 33.4 C33.5 28 33.5 20 31 14.6 Z', 'white');
    p.detail('M21 27 C23 30.5 26 30.5 25.5 27', 'dark');
    p.eye(10.5, 22, 2.4);
    p.mouth('M6.8 27 q1.6 1.1 3.2 0');
  },
  jelly(p) { // Seagrass
    p.limbs(['M14 44 C13 34 9 26 8 14', 'M24 44 C25 32 28 22 26 5', 'M34 44 C35 38 40 32 42 24'], 'blade', 3.8);
    p.limbs(['M19 44 C19 32 17 20 19 8', 'M29 44 C30 34 35 26 36 12'], 'light', 3.8);
    p.shape('M6 46 C8 40 40 40 42 46Z', 'sand');
  },
  coral(p) { // Staghorn
    p.limbs(['M24 41 L24 26', 'M24 34 L15 25 L13 13', 'M15 25 L8 21', 'M24 30 L33 21 L35 9', 'M33 21 L41 18', 'M24 26 L23 15'], 'body', 4.6);
    p.dots([[13, 12.5, 2], [8, 20.6, 1.8], [35, 8.5, 2], [41.4, 17.8, 1.8], [23, 14.5, 2]], 'light');
    p.shape('M10 44 C10 38.5 38 38.5 38 44 Z', 'rock');
  },
  urn(p) { // Shipwreck
    p.limbs(['M22 33 L19 6'], 'mast', 2.4);
    p.shape('M20 9 L33 12.5 L31.5 21 C29 19.5 27.5 22 25 21.5 C24 23.5 22.5 23.5 21.5 23 Z', 'sail');
    p.shape('M4 32 L42 26 C42 31 38 36 33 38 L13 41 C9 40 6 37 4 32Z', 'hull');
    p.detail('M8.5 35 L40.5 30', 'dark');
    p.dots([[16, 37.2, 1.5], [24, 36, 1.5], [32, 34.8, 1.5]], 'dark');
    p.shape('M2 44 C10 40.5 38 40.5 46 44 L46 46 L2 46 Z', 'sand');
  },
  puffer(p) {
    const spikes = [];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + .2, c = Math.cos(a), s = Math.sin(a);
      if (c > .8) continue; // leave room for the tail
      const bx = 22 + 13 * c, by = 25 + 13 * s, w = .2;
      spikes.push(`M${f(22 + 13.5 * Math.cos(a - w))} ${f(25 + 13.5 * Math.sin(a - w))} L${f(22 + 18.5 * c)} ${f(25 + 18.5 * s)} L${f(22 + 13.5 * Math.cos(a + w))} ${f(25 + 13.5 * Math.sin(a + w))}Z`);
      void bx; void by;
    }
    spikes.forEach(d => p.shape(d, 'spike'));
    p.shape('M34 25 L44.5 18.5 C46 23 46 27 44.5 31.5Z', 'fin');
    p.shape(ell(22, 25, 14, 14), 'body');
    p.shape('M10 30 C14 37 30 37 34 30 C29 33 15 33 10 30Z', 'belly', { flat: true });
    p.shine('M12 18 C13.5 14 17 12 20 12 C17 14 15 16 13.8 19.5Z');
    p.eye(15, 22, 2.6); p.eye(23, 21.5, 2.6);
    p.cheek(12.5, 27); p.cheek(26, 26.5);
    p.shape(ell(18.5, 28.2, 1.6, 1.3), 'fin');
  },
  star(p) { // Sea Star
    p.shape(starPath(24, 25.5, 21, 9.5), 'body', { round: 3 });
    p.dots([[24, 9.5, 1.3], [38, 20.5, 1.3], [10, 20.5, 1.3], [33, 36, 1.3], [15, 36, 1.3], [24, 14, 1], [33.5, 22.5, 1], [14.5, 22.5, 1]], 'light');
    p.eye(20.5, 25, 2.3); p.eye(27.5, 25, 2.3);
    p.cheek(17.5, 29); p.cheek(30.5, 29);
    p.mouth('M22.5 29 q1.5 1.5 3 0');
  },
  otter(p) { // Mantis Shrimp
    p.shape('M37 29 L46 24.5 L45.5 33 L44 40.5 L36.5 36Z', 'tail');
    p.detail('M40 31 L45.5 28.5 M39.5 33.5 L44.5 36.5', 'tail');
    p.limbs(['M20 27 L19 33', 'M25 28.5 L25 34', 'M30 30 L31.5 35'], 'leg', 1.8);
    p.limbs(['M14 22 C22 20 30 22 35 27 C37 29 38 31 39 33'], 'body', 10);
    p.detail('M20 16.5 L19.5 26.5 M25.5 17.5 L24.5 27.5 M30.5 20 L28.5 29.5 M34.5 23.5 L31.5 31.5', 'dark');
    p.limbs(['M10.5 18 L8 11.5', 'M14 17.5 L14.5 11'], 'head', 2);
    p.shape(ell(11.5, 22.5, 6, 5), 'head');
    p.detail('M7 20 C3.5 17 2.5 13 3.5 9.5', 'dark');
    p.limbs(['M10.5 26.5 L7.5 32.5 L13 34.5'], 'leg', 2.6);
    p.eye(8, 11, 2.6); p.eye(14.5, 10.2, 2.6);
  },
  octo(p) { // Octopus: round head, curling arms
    p.limbs([
      'M12.5 28.5 C9 32 6 33.5 5 37.5 C4.3 41 8.3 41.7 8.8 39',
      'M17.5 30.5 C16.3 35.5 14 38.5 15 42 C16 44.6 19.3 43.6 18.7 41.3',
      'M30.5 30.5 C31.7 35.5 34 38.5 33 42 C32 44.6 28.7 43.6 29.3 41.3',
      'M35.5 28.5 C39 32 42 33.5 43 37.5 C43.7 41 39.7 41.7 39.2 39',
      'M24 31 C24 36 23 39.5 24 43.5'], 'body', 4.8);
    p.shape('M24 4.5 C34 4.5 39.5 11.5 39.5 20.5 C39.5 27 36 31.5 30 32 L18 32 C12 31.5 8.5 27 8.5 20.5 C8.5 11.5 14 4.5 24 4.5Z', 'body');
    p.dots([[30.5, 9.5, 1.8], [34.5, 13.5, 1.3], [27, 7.6, 1.1]], 'light');
    p.shine('M13 15 C13.5 10.5 17 7.5 21 7 C17.5 9.5 15.5 12 15 16Z');
    p.eye(19, 21, 2.9); p.eye(29, 21, 2.9);
    p.cheek(14.5, 26); p.cheek(33.5, 26);
    p.mouth('M22 26 q2 2 4 0');
  },
  whale(p) { // Manta Ray
    p.limbs(['M24 33 C24 38 25 42 28 45'], 'body', 2);
    p.shape('M19.5 14 C17 10 17.5 6.5 20 6.5 C21 9 21.5 11 23 12.5Z', 'body');
    p.shape('M28.5 14 C31 10 30.5 6.5 28 6.5 C27 9 26.5 11 25 12.5Z', 'body');
    p.shape('M24 12 C28 12 32 16 36 19 C40 21 44 22 46 23 C41 27 33 32 26 33 L22 33 C15 32 7 27 2 23 C4 22 8 21 12 19 C16 16 20 12 24 12Z', 'body');
    p.shape('M15 20.5 C18 19.5 20 21.5 19 24.5 C16 24.5 13 23.5 11.5 22.5Z', 'light');
    p.shape('M33 20.5 C30 19.5 28 21.5 29 24.5 C32 24.5 35 23.5 36.5 22.5Z', 'light');
    p.eye(20.5, 16.5, 1.8); p.eye(27.5, 16.5, 1.8);
    p.mouth('M22.5 20.5 q1.5 1 3 0');
  },
  dolphin(p) {
    p.shape('M10 30 L2.5 24.5 C3 28 3.5 30.5 5 32 C3.5 34 3 36.5 3 39.5Z', 'body');
    p.shape('M23 14.5 C24 9.5 27 7 30.5 7 C28.5 10 28.5 12 29.5 14.5Z', 'body');
    p.shape('M7 31 C11 21 22 14 33 14 C37.5 14 40.5 15 42.5 16.8 L46 17.6 C45 19 43.5 19.6 41.5 19.8 C40 25 35.5 30.5 29.5 32.3 C22 34.5 14 34 7 31Z', 'body');
    p.shape('M13 31.5 C22 31.5 32 28 38.5 21 C37 26.5 33 30.5 28.5 32 C22.5 33.8 17 33.5 13 31.5Z', 'belly', { flat: true });
    p.shape('M24 30.5 C24 35.5 21 37.5 18.5 37.5 C19.5 34.5 19.8 32.5 20.5 31.2Z', 'body');
    p.eye(37, 18, 2);
    p.mouth('M41 20.2 q-1.6 1.6 -3.6 1.4');
  },
  turtle(p) { // Sea Turtle, from above
    p.shape('M14.5 19 C9 14.5 3.5 15 2 18.5 C5.5 21.5 10.5 23 15.5 23Z', 'skin');
    p.shape('M33.5 19 C39 14.5 44.5 15 46 18.5 C42.5 21.5 37.5 23 32.5 23Z', 'skin');
    p.shape('M16 34 C12 35.5 9.5 38.5 10 41 C13 40.5 16 38.8 18.5 37Z', 'skin');
    p.shape('M32 34 C36 35.5 38.5 38.5 38 41 C35 40.5 32 38.8 29.5 37Z', 'skin');
    p.shape('M22.5 38 L24 43.5 L25.5 38Z', 'skin');
    p.shape(ell(24, 9.5, 5, 5.5), 'skin');
    p.shape(ell(24, 26, 12.5, 13.5), 'shell');
    p.shape('M24 18.5 L29 21.5 L29 28 L24 31 L19 28 L19 21.5Z', 'scute', { flat: true });
    p.detail('M24 18.5 V13 M29 21.5 L34.5 18 M29 28 L34.5 32 M24 31 V39 M19 28 L13.5 32 M19 21.5 L13.5 18', 'dark');
    p.eye(21.8, 8.5, 1.5); p.eye(26.2, 8.5, 1.5);
    p.mouth('M23 11.5 q1 .8 2 0');
  },
  rock(p) {
    p.shape('M5 39 C4 31 9 23.5 17 21.5 C21 15 31 14.5 35.5 20.5 C41.5 22.5 44.5 30 43 39 Z', 'body');
    p.shape('M12 25 C15 22.5 19 21.5 21 22 C24 17.5 31 17 34 21.5 C29 20 25 21.5 22.5 25.5 C19 24.5 15 25 12 25Z', 'light', { flat: true });
    p.detail('M26 30 L29 34 L27.5 38.5 M15 32 L18 34.5', 'dark');
  },
};

function painter(pal) {
  const out = [];
  const col = k => pal[k] || '#888';
  const add = s => out.push(s);
  return {
    out,
    shape(d, k, o = {}) {
      if (o.flat) add(`<path d="${d}" fill="${col(k)}"/>`);
      else add(`<path d="${d}" fill="${col(k)}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`);
    },
    limbs(ds, k, w) {
      const path = (d, c, sw) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      ds.forEach(d => add(path(d, INK, w + SW * 2)));
      ds.forEach(d => add(path(d, col(k), w)));
    },
    detail(d) { add(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`); },
    dots(list, k, o = {}) {
      list.forEach(([x, y, r]) => add(`<circle cx="${x}" cy="${y}" r="${r}" fill="${col(k)}"${o.outline ? ` stroke="${INK}" stroke-width="${SW}"` : ''}/>`));
    },
    shine(d, op = .55) { add(`<path d="${d}" fill="#fff" opacity="${op}"/>`); },
    eye(x, y, r) { add(`<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${f(x - r * .35)}" cy="${f(y - r * .4)}" r="${f(r * .38)}" fill="#fff"/>`); },
    cheek(x, y) { add(`<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.4" fill="#FF8FA3" opacity=".85"/>`); },
    mouth(d) { add(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`); },
  };
}

function art(id) {
  const p = painter(PAL[id]);
  DRAW[id](p);
  return p.out.join('');
}

// Currency icons (24-unit viewBox), sticker style, coloured from the theme.
const CURRENCY = `<symbol id="i-shell" viewBox="0 0 24 24">
      <path d="M12 2.8C6.6 2.8 2.4 7.4 3.1 12.6c.3 2.2 1.6 4.3 3.4 5.4l1.3 2.4c.3.6.9.9 1.5.9h5.4c.6 0 1.2-.3 1.5-.9l1.3-2.4c1.8-1.1 3.1-3.2 3.4-5.4C21.6 7.4 17.4 2.8 12 2.8z" fill="var(--shell)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 6v12.5M8.6 6.8l2 11.5M15.4 6.8l-2 11.5M5.6 10l3.4 8.2M18.4 10L15 18.2" stroke="${INK}" stroke-opacity=".45" stroke-width="1.1" stroke-linecap="round" fill="none"/>
      <path d="M5.5 8.2C7 5.6 9.5 4.4 12 4.4" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    </symbol>
    <symbol id="i-pearl" viewBox="0 0 24 24">
      <circle cx="12" cy="12.4" r="8.6" fill="color-mix(in srgb, var(--pearl) 75%, #fff)" stroke="${INK}" stroke-width="1.5"/>
      <ellipse cx="9.2" cy="9.2" rx="2.9" ry="2.3" transform="rotate(-35 9.2 9.2)" fill="#fff" opacity=".8"/>
      <circle cx="15.6" cy="16.4" r="1.3" fill="#fff" opacity=".45"/>
    </symbol>`;

function symbols() {
  const tiles = Object.keys(DRAW).map(id => `<symbol id="t-${id}" viewBox="0 0 48 48">${art(id)}</symbol>`).join('\n    ');
  return CURRENCY + '\n    ' + tiles;
}

module.exports = { symbols, ids: Object.keys(DRAW) };

if (require.main === module) {
  const i = process.argv.indexOf('--preview');
  if (i < 0) { process.stdout.write(symbols()); }
  else {
    const fs = require('fs');
    const names = { scallop: 'Conch', oyster: 'Oyster', kelp: 'Sargassum', crab: 'Hermit Crab', shrimp: 'Giant Clam', anemone: 'Anemone', clown: 'Clownfish', jelly: 'Seagrass', coral: 'Staghorn', urn: 'Shipwreck', puffer: 'Pufferfish', star: 'Sea Star', otter: 'Mantis Shrimp', octo: 'Octopus', whale: 'Manta Ray', dolphin: 'Dolphin', turtle: 'Sea Turtle', rock: 'Rock' };
    const cells = Object.keys(DRAW).map(id => `<figure><div class="c"><svg viewBox="0 0 48 48">${art(id)}</svg></div><figcaption>${names[id]}</figcaption></figure>`).join('');
    fs.writeFileSync(process.argv[i + 1], `<style>:root{--shell:#F2B85C;--pearl:#B7AAF5}body{background:#0F2C38;color:#9DBEC6;font:13px system-ui;margin:0;padding:16px}.g{display:grid;grid-template-columns:repeat(6,80px);gap:10px}.c{width:80px;height:80px;border-radius:14px;background:#2a4757;display:grid;place-items:center}.c svg{width:58px;height:58px}figure{margin:0;text-align:center}.cur svg{width:40px;height:40px}.sm svg{width:11px;height:11px}</style><svg width="0" height="0" style="position:absolute"><defs>${CURRENCY}</defs></svg><div class="g">${cells}</div><p class="cur"><svg><use href="#i-shell"/></svg><svg><use href="#i-pearl"/></svg> <span class="sm"><svg><use href="#i-shell"/></svg>3 <svg><use href="#i-pearl"/></svg>2</span></p>`);
  }
}

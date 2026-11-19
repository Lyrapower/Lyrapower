/* ====================== v3 · 像素世界 + 实时光照合成 ======================
   三张低清画布(远景 / 世界 / 自发光)每帧画好,交给一段 WebGL 着色器合成:
   天空、星、日月、体积光、雾、逐像素点光源、辉光、暗角。像素保持锐利,光是平滑的。 */
const FX = (() => {
  const PS = 0.8, MAXL = 16, DH = 200, RW = 960;
  const glc = $('#gl'), ovc = $('#ov');
  const F = { ok: false, sq: 0, hurt: 0, flash: 0, focus: 0, pulse: 0, pulseC: [1, .85, .5], tt: 0, dl: [], flames: [], amb: [], stat: { lights: 0 } };
  let gl = null, prog = null, U = {}, texs = [], LW = 640, LH = 360, camPx = 0, focusL = null;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
  const bgC = mk(2, 2), wC = mk(2, 2), gC = mk(2, 2); let bx, wx, gx, ox, dx;
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const css = c => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)] / 16 - .5;
  const hsh = (x, y, s) => { let n = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 974711, 1274126177); n ^= n >>> 13; n = Math.imul(n, 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y, s) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = hsh(x0, y0, s), b = hsh(x0 + 1, y0, s), c = hsh(x0, y0 + 1, s), d = hsh(x0 + 1, y0 + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  let shY = 0; const X = wxv => Math.round(wxv * PS) - camPx, Y = wyv => Math.round((wyv + OY) * PS) + shY;
  const R2 = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const G2 = (x, y, r, col, a) => { const g = gx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); gx.fillStyle = g; gx.fillRect(x - r, y - r, r * 2, r * 2); };

  /* ---- 每个主题的材质色(偏亮:进场后会被环境光压暗,再被灯照亮) ---- */
  const MAT = {
    dusk:  { g: ['#3d6b4a', '#5c9a58', '#8fc46a', '#d6e58a'], d: ['#33243a', '#553a48', '#7a5456', '#a37a66'], s: ['#413a52', '#655a76', '#8f869e', '#c2bccb'], leaf: ['#274a3a', '#3f7a52', '#6fb06a'], acc: '#ffcf8a', amb: [.50, .44, .58], set: [['bamboo', 3], ['pine', 2], ['toro', 1.3], ['rock', 1.5], ['shrub', 3]] },
    cave:  { g: ['#1f5a55', '#2f8a7a', '#52c0a4', '#a8f0d0'], d: ['#142834', '#22404c', '#34586a', '#4e7e8a'], s: ['#26404a', '#3c626c', '#5e8c94', '#96c0c4'], leaf: ['#16433f', '#237068', '#3fb09a'], acc: '#7ff5dc', amb: [.30, .42, .46], set: [['stalag', 3], ['mushroom', 3], ['crystal', 2], ['rock', 2]] },
    frost: { g: ['#8ea4d8', '#bccdf2', '#e2ebff', '#ffffff'], d: ['#232e62', '#37468a', '#5466ac', '#7c90cc'], s: ['#3e4c88', '#6272b2', '#94a4d8', '#ccd8f8'], leaf: ['#24406a', '#3c6490', '#dfe9ff'], acc: '#cfe0ff', amb: [.40, .46, .66], set: [['pine', 3], ['rock', 2], ['crystal', 1], ['toro', 1], ['deadtree', 1.5]] },
    ember: { g: ['#5a2420', '#8a3a28', '#c0603a', '#f0a060'], d: ['#2c0c10', '#48161a', '#6c2426', '#963c36'], s: ['#44282a', '#6a4240', '#96665c', '#c49686'], leaf: ['#3a1414', '#6a2a20', '#a84a30'], acc: '#ffb070', amb: [.56, .36, .34], set: [['pillar', 2.5], ['brazier', 1.6], ['deadtree', 2], ['rock', 2]] },
    dune:  { g: ['#a8804a', '#d0a868', '#ecd08c', '#fff0c0'], d: ['#563626', '#825234', '#ae7848', '#d4a468'], s: ['#765442', '#a0785a', '#c8a07a', '#ecd2aa'], leaf: ['#5c5030', '#8a7c44', '#bcae68'], acc: '#ffe6a8', amb: [.62, .52, .46], set: [['deadtree', 2], ['pillar', 1.5], ['rock', 3], ['shrub', 2]] },
    abyss: { g: ['#3a2466', '#5c3a9c', '#8c62d6', '#c8a8ff'], d: ['#140e28', '#221840', '#34245c', '#4c3680'], s: ['#261e46', '#3e326c', '#60509a', '#927ecc'], leaf: ['#22163e', '#3c2870', '#6a48b8'], acc: '#b58cff', amb: [.36, .30, .54], set: [['crystal', 3], ['stalag', 2.5], ['mushroom', 1.5], ['pillar', 1]] }
  };
  let M = MAT.dusk, TK = 'dusk', RIM = [1, .8, .5];

  /* ---- 3×5 像素字 ---- */
  const FONT = { a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111', f: '111100110100100', g: '011100101101011', h: '101101111101101', i: '111010010010111', j: '001001001101010', k: '101101110101101', l: '100100100100111', m: '101111111101101', n: '110101101101101', o: '010101101101010', p: '110101110100100', q: '010101101110011', r: '110101110101101', s: '011100010001110', t: '111010010010010', u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101', y: '101101010010010', z: '111001010100111', '?': '110001010000010' };
  function glyph(c, ch, x, y, col, sc) { const g = FONT[ch]; if (!g) return; c.fillStyle = col; for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(x + (i % 3) * sc, y + ((i / 3) | 0) * sc, sc, sc); }

  /* ---- 程序生成的像素精灵 ---- */
  const cache = new Map();
  function blob(w, h, pal, belly) {
    w = Math.max(2, w | 0); h = Math.max(2, h | 0); const key = w + '_' + h + pal.k + (belly ? 'b' : ''); let c = cache.get(key); if (c) return c;
    c = mk(w, h); const x2 = c.getContext('2d'), id = x2.createImageData(w, h), d = id.data, rx = w / 2, ry = h / 2;
    const ins = (x, y) => { const nx = (x + .5 - rx) / rx, ny = (y + .5 - ry) / ry; return nx * nx + ny * ny <= 1; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!ins(x, y)) continue; const nx = (x + .5 - rx) / rx, ny = (y + .5 - ry) / ry; let col;
      if (!ins(x - 1, y) || !ins(x + 1, y) || !ins(x, y - 1) || !ins(x, y + 1)) col = pal.o;
      else if (belly && ny > .40) col = pal.b;
      else { const s = -nx * .45 - ny * .75 + bay(x, y) * .22; col = s > .62 ? pal.h : s > .22 ? pal.l : s > -.3 ? pal.m : pal.d; }
      const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    x2.putImageData(id, 0, 0); cache.set(key, c); return c;
  }
  const P_SN = { k: 'a', o: [14, 44, 36], d: [38, 128, 96], m: [72, 176, 134], l: [122, 214, 170], h: [206, 248, 224], b: [243, 227, 189] };
  const P_SN2 = { k: 'b', o: [14, 44, 36], d: [30, 104, 80], m: [56, 150, 112], l: [96, 190, 148], h: [170, 232, 200], b: [226, 208, 168] };
  const EP = {
    walker: { k: 'w', o: [34, 8, 14], d: [104, 34, 44], m: [164, 58, 62], l: [224, 104, 88], h: [255, 178, 146] },
    hopper: { k: 'h', o: [30, 26, 6], d: [104, 92, 32], m: [158, 142, 56], l: [214, 196, 94], h: [252, 240, 156] },
    flyer:  { k: 'f', o: [24, 12, 34], d: [86, 56, 118], m: [130, 92, 168], l: [184, 144, 220], h: [232, 206, 255] },
    boss:   { k: 'B', o: [30, 4, 12], d: [108, 26, 46], m: [168, 44, 62], l: [236, 96, 84], h: [255, 168, 126] }
  };
  function stoneTex(w, h, sd, round) {
    const c = mk(w, h), x2 = c.getContext('2d'), id = x2.createImageData(w, h), d = id.data, sp = M.s.map(rgb);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cut = round && y < round ? round - y : 0; if (x < cut || x >= w - cut) continue;
      let v = vn(x * .22, y * .18, sd) * .6 + vn(x * .6, y * .5, sd + 3) * .4 + (x < 2 ? .28 : x > w - 3 ? -.3 : 0) + (y < 2 ? .2 : 0);
      let col = sp[clamp(Math.floor(v * 4 + bay(x, y) * .8), 0, 3)];
      if (x === 0 || x === w - 1 || y === h - 1 || (y === 0)) col = mix(col, [0, 0, 0], .45);
      const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    x2.putImageData(id, 0, 0); return c;
  }
  function steleSpr(s) {
    const w = Math.round(s.w * PS), h = Math.round(s.h * PS), key = 'st' + TK + w + '_' + h + s.label; let c = cache.get(key); if (c) return c;
    c = stoneTex(w, h, w * 31 + h, 5); const x2 = c.getContext('2d'), lab = String(s.label || '').toLowerCase().slice(0, Math.floor((h - 12) / 6));
    let y = Math.round((h - lab.length * 6) / 2) + 1; for (const ch of lab) { glyph(x2, ch, (w >> 1) - 1 + 1, y + 1, M.s[3], 1); glyph(x2, ch, (w >> 1) - 1, y, '#120e16', 1); y += 6; }
    for (let x = 1; x < w - 1; x++) if (hsh(x, 5, h) < .5) R2(x2, x, h - 1 - (hsh(x, 6, h) * 3 | 0), 1, 3, M.g[1]);
    cache.set(key, c); return c;
  }
  function floatSpr(w) {
    const key = 'fl' + TK + w; let c = cache.get(key); if (c) return c;
    c = mk(w, 20); const x2 = c.getContext('2d'); x2.drawImage(stoneTex(w, 9, w * 7, 0), 0, 2);
    R2(x2, 1, 0, w - 2, 1, M.g[3]); R2(x2, 0, 1, w, 1, M.g[2]); R2(x2, 0, 2, w, 1, M.g[1]);
    for (let x = 0; x < w; x++) { if (hsh(x, 1, w) < .35) R2(x2, x, 3, 1, 1 + (hsh(x, 2, w) * 2 | 0), M.g[1]); if (hsh(x, 3, w) < .22) R2(x2, x, 11, 1, 1 + (hsh(x, 4, w) * 7 | 0), M.d[1]); }
    cache.set(key, c); return c;
  }
  function crisp(c) { const x2 = c.getContext('2d'), id = x2.getImageData(0, 0, c.width, c.height), d = id.data; for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 120 ? 255 : 0; x2.putImageData(id, 0, 0); }

  /* ---- 地面:整关预渲染成一条 ---- */
  function buildGround() {
    const W = Math.ceil((G.W + 800) * PS), H = 64, c = mk(W, H), x2 = c.getContext('2d'), id = x2.createImageData(W, H), d = id.data, sd = L.day * 977 + 3;
    const gaps = G.gaps.map(([a, b]) => [Math.round((a + 400) * PS), Math.round((b + 400) * PS)]), gp = M.g.map(rgb), dp = M.d.map(rgb), sp = M.s.map(rgb);
    for (let x = 0; x < W; x++) {
      let edge = 99, inGap = false; for (const [a, b] of gaps) { if (x >= a && x < b) inGap = true; edge = Math.min(edge, Math.abs(x - a + .5), Math.abs(x - b + .5)); }
      if (inGap) continue;
      const gh = 2 + Math.floor(vn(x * .35, 0, sd) * 3 + hsh(x, 1, sd) * 1.6), turf = 3 + (hsh(x >> 1, 3, sd) * 3 | 0) + (vn(x * .12, 2, sd) * 3 | 0);
      for (let y = 0; y < H; y++) {
        const yy = y - 6; let col;
        if (yy < -gh) continue;
        if (yy < 0) { if (hsh(x, 2, sd) < .62 + yy * .1) col = gp[yy <= -gh + 1 ? 3 : 2]; else continue; }
        else if (yy < turf) col = gp[yy === 0 ? 3 : yy === 1 ? 2 : (hsh(x, y, sd) < .5 ? 1 : 0)];
        else {
          const v = (vn(x * .11, y * .16, sd) * .7 + vn(x * .31, y * .33, sd + 5) * .3) * .95 + .3 - yy / 70, st = vn(x * .09 + 40, y * .14, sd + 9);
          if (st > .68 && yy > 7) col = mix(sp[clamp(Math.floor((st - .68) * 16 + bay(x, y) + 1), 0, 3)], [0, 0, 0], clamp(yy / 90, 0, .6));
          else col = dp[clamp(Math.floor(v * 4 + bay(x, y) * .9), 0, 3)];
          if (yy === turf && hsh(x, 7, sd) < .5) col = gp[0];
        }
        if (edge < 1.5 && yy >= 0) col = mix(col, [0, 0, 0], .5); else if (edge < 3.5 && yy >= turf) col = mix(col, [0, 0, 0], .2);
        const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    x2.putImageData(id, 0, 0); return c;
  }

  /* ---- 远山三层 + 云 ---- */
  function buildRidge(k) {
    const W = RW, H = 210, c = mk(W, H), x2 = c.getContext('2d'), id = x2.createImageData(W, H), d = id.data, pts = G.ridges[k], sd = L.day * 31 + k * 7;
    const base = rgb(TH.layers[k]), hi = mix(base, rgb(TH.sky[2]), .34), lo = mix(base, [0, 0, 0], .28), mist = TH.mist.split(',').map(Number), sgn = TH.orb[1] > .5 ? 1 : -1;
    const amp = [150, 112, 78][k], top = [14, 58, 100][k], TAU = 6.2832;
    const hgt = x => { const u = ((x % W) + W) % W / W * 40, i0 = Math.floor(u), f = u - i0, a = pts[i0 % 40], b = pts[(i0 + 1) % 40], s = f * f * (3 - 2 * f); return top + (1 - (a + (b - a) * s)) * amp + Math.sin(x / W * TAU * 13 + k) * 3 + Math.sin(x / W * TAU * 31 + k * 2) * 1.6; };
    for (let x = 0; x < W; x++) {
      const h0 = hgt(x), slope = (hgt(x + 3) - hgt(x - 3)) * sgn;
      let tree = 0; if (k === 2 && TK !== 'dune') { const cell = x >> 3, r = hsh(cell, 4, sd); if (r < .6) { const th = 7 + r * 30; tree = Math.max(0, th - Math.abs(x - cell * 8 - 4) * (th / 4)); } }
      if (k === 1) { const cell = Math.floor(x / 160), r = hsh(cell, 9, sd), cxp = cell * 160 + 80; if (r < .5) { const dxp = Math.abs(x - cxp); let ph = 0; for (let tier = 0; tier < 4; tier++) { const wv = 13 - tier * 2.6, y0 = tier * 9; if (dxp < wv) ph = Math.max(ph, y0 + 9); if (dxp < wv + 3) ph = Math.max(ph, y0 + 2 + (dxp > wv ? 1 : 0)); } if (dxp < 1) ph = Math.max(ph, 44); tree = Math.max(tree, ph); } }
      for (let y = Math.max(0, Math.floor(h0 - tree)); y < H; y++) {
        const dep = y - h0; let col;
        if (dep < 0) col = lo;
        else { col = slope > .7 && dep < 24 + bay(x, y) * 12 ? hi : slope < -.9 && dep < 44 + bay(x, y) * 10 ? lo : base; if (TK === 'frost' && k < 2 && h0 < top + amp * .5 && dep < (top + amp * .5 - h0) * .35 + vn(x * .2, 3, sd) * 5) col = [226, 234, 255]; }
        col = mix(col, mist, clamp((y - (H - 78)) / 78 + bay(x, y) * .22, 0, 1) * (.6 - k * .14));
        const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    x2.putImageData(id, 0, 0); return c;
  }
  function buildCloud() {
    const c = mk(RW, 110), x2 = c.getContext('2d'), r = mulberry32(L.day * 71 + 5), hi = css(mix(rgb(TH.sky[2]), [255, 255, 255], .35)), lo = css(mix(rgb(TH.sky[1]), rgb(TH.sky[2]), .5));
    for (let n = 0; n < 9; n++) { const cx0 = r() * RW, cy = 22 + r() * 60, w = 40 + r() * 70; for (const [col, oy] of [[lo, 3], [hi, 0]]) { x2.fillStyle = col; for (let q = 0; q < 6; q++) { const ex = cx0 + (q - 2.5) * w * .2, ew = w * (.16 + hsh(n, q, 3) * .16), eh = ew * (.42 + hsh(n, q, 4) * .2); for (const off of [0, -RW, RW]) { x2.beginPath(); x2.ellipse(ex + off, cy + oy + (q % 2) * 3, ew, eh, 0, 0, 6.29); x2.fill(); } } x2.fillRect(cx0 - w * .55, cy + oy + 2, w * 1.1, 5); x2.fillRect(cx0 - w * .55 - RW, cy + oy + 2, w * 1.1, 5); x2.fillRect(cx0 - w * .55 + RW, cy + oy + 2, w * 1.1, 5); } }
    crisp(c); return c;
  }

  /* ---- 路边的东西:竹、松、石灯、蘑菇、晶簇、断柱、火盆…… ---- */
  const D = (x, y, w, h, col) => { dx.fillStyle = col; dx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); };
  const lightAt = (x, y, r, c, i, fl) => F.dl.push({ x, y, r, c, i, fl: fl || 0 });
  const DEC = {
    bamboo(x, r) { const n = 2 + (r() * 3 | 0); for (let i = 0; i < n; i++) { const b0 = x + i * 5 + (r() * 3 | 0), h = 60 + r() * 100, lean = (r() - .5) * .14, col = i % 2 ? M.leaf[1] : M.leaf[2]; for (let y = 0; y < h; y++) { const px = b0 + Math.round(lean * y); D(px, DH - y, 2, 1, y % 13 === 0 ? M.leaf[0] : col); D(px, DH - y, 1, 1, M.leaf[0]); if (y > 20 && y % 13 === 6) for (const s of [-1, 1]) { if (r() < .25) continue; const n2 = 6 + (r() * 9 | 0), drop = r() < .5; for (let q = 0; q < n2; q++) { const ly = DH - y + (drop ? (q * q / n2 * .7) : -(q >> 1)) ; D(px + s * (q + 1), ly, 2, q > 1 && q < n2 - 2 ? 2 : 1, M.leaf[q > n2 - 4 ? 2 : 1]); } } } D(b0 + Math.round(lean * h) - 3, DH - h - 2, 8, 2, M.leaf[2]); D(b0 + Math.round(lean * h) - 1, DH - h - 4, 4, 2, M.leaf[2]); } },
    pine(x, r) { const h = 46 + r() * 70; D(x - 1, DH - h * .32, 3, h * .32, M.d[0]); for (let t = 0; t < 5; t++) { const y0 = DH - h + t * h * .16, hw = 4 + t * 3.4, th = h * .25; for (let row = 0; row < th; row++) { const w = Math.max(1, hw * (row + 1) / th); D(x - w, y0 + row, w, 1, M.leaf[1]); D(x, y0 + row, w, 1, M.leaf[0]); if (row < 2 || TK === 'frost' && row < th * .45) D(x - w * .7, y0 + row, w * 1.1, 1, M.leaf[2]); } } },
    toro(x) { const s = M.s; D(x - 5, DH - 3, 11, 3, s[1]); D(x - 1, DH - 12, 3, 9, s[2]); D(x - 4, DH - 14, 9, 2, s[2]); D(x - 3, DH - 20, 7, 6, s[1]); D(x - 1, DH - 19, 3, 4, M.acc); D(x - 6, DH - 22, 13, 2, s[2]); D(x - 4, DH - 24, 9, 2, s[3]); D(x - 1, DH - 26, 3, 2, s[2]); lightAt(x, DH - 17, 84, [1, .78, .46], .95, .08); F.flames.push({ x, y: DH - 17, k: 'lamp' }); },
    rock(x, r) { const w = 5 + r() * 12, h = 4 + r() * 9; for (let row = 0; row < h; row++) { const ww = w * Math.sqrt(1 - (row / h) * (row / h)); D(x - ww, DH - row, ww * 2, 1, M.s[1]); if (row > h * .35) D(x - ww, DH - row, ww * .8, 1, M.s[2]); } D(x - w * .5, DH - h, w * .6, 1, M.s[3]); },
    shrub(x, r) { const w = 6 + r() * 9, h = 5 + r() * 7; for (let row = 0; row < h; row++) { const ww = w * Math.sqrt(1 - (row / h) * (row / h)); D(x - ww, DH - row, ww * 2, 1, M.leaf[row > h * .5 ? 1 : 0]); } for (let q = 0; q < 7; q++) D(x + (r() - .5) * w * 1.6, DH - r() * h, 1, 1, q < 3 ? M.acc : M.leaf[2]); },
    mushroom(x, r) { const n = 1 + (r() * 3 | 0); for (let i = 0; i < n; i++) { const mx = x + i * 7, h = 4 + r() * 9; D(mx, DH - h, 2, h, '#d8d2c4'); D(mx - 3, DH - h - 2, 8, 2, M.g[2]); D(mx - 2, DH - h - 4, 6, 2, M.g[3]); D(mx - 1, DH - h - 3, 1, 1, '#ffffff'); } lightAt(x + 3, DH - 10, 46, rgb(M.acc).map(v => v / 255), .7, .03); F.flames.push({ x: x + 3, y: DH - 9, k: 'spore' }); },
    crystal(x, r) { const n = 2 + (r() * 2 | 0); for (let i = 0; i < n; i++) { const cx0 = x + (i - 1) * 6, h = 10 + r() * 26, hw = h * .2 + 1; for (let row = 0; row < h; row++) { const w = Math.max(1, hw * (row < h * .75 ? 1 : (h - row) / (h * .25))); D(cx0 - w, DH - row, w, 1, M.g[3]); D(cx0, DH - row, w, 1, M.g[1]); } } lightAt(x, DH - 14, 62, rgb(M.g[3]).map(v => v / 255), .75, .05); F.flames.push({ x, y: DH - 14, k: 'gem' }); },
    stalag(x, r) { const h = 14 + r() * 40, hw = 3 + h * .14; for (let row = 0; row < h; row++) { const w = Math.max(1, hw * (1 - row / h)); D(x - w, DH - row, w, 1, M.s[2]); D(x, DH - row, w, 1, M.s[0]); } },
    pillar(x, r) { const h = 30 + r() * 60, s = M.s; D(x - 4, DH - h, 9, h, s[1]); D(x - 4, DH - h, 3, h, s[2]); D(x + 3, DH - h, 2, h, s[0]); D(x - 6, DH - 3, 13, 3, s[1]); for (let q = 0; q < 6; q++) D(x - 3 + r() * 6, DH - r() * h, 1, 2 + r() * 4, s[0]); if (r() < .5) { D(x - 6, DH - h - 3, 13, 3, s[2]); } else for (let q = 0; q < 9; q++) dx.clearRect((x - 4 + q) | 0, (DH - h) | 0, 1, (r() * 7) | 0); },
    brazier(x) { const s = M.s; D(x - 1, DH - 15, 3, 15, s[0]); D(x - 3, DH - 2, 7, 2, s[1]); D(x - 5, DH - 19, 11, 4, s[1]); D(x - 4, DH - 15, 9, 1, s[0]); D(x - 5, DH - 19, 11, 1, s[2]); lightAt(x, DH - 24, 100, [1, .62, .3], 1.1, .16); F.flames.push({ x, y: DH - 20, k: 'fire' }); },
    deadtree(x, r) { const col = M.d[1], br = (bx0, by, ang, len, w, dep) => { for (let q = 0; q < len; q++) { D(bx0 + Math.cos(ang) * q, by + Math.sin(ang) * q, w, w, col); } if (dep > 0) { const ex = bx0 + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; br(ex, ey, ang - .5 - r() * .4, len * .62, Math.max(1, w - 1), dep - 1); br(ex, ey, ang + .35 + r() * .5, len * .58, Math.max(1, w - 1), dep - 1); } }; br(x, DH, -1.57 + (r() - .5) * .3, 22 + r() * 22, 3, 3); }
  };
  function buildDecor() {
    const W = Math.ceil((G.W + 800) * PS), c = mk(W, DH), r = mulberry32(L.day * 613 + 29); dx = c.getContext('2d'); F.dl = []; F.flames = [];
    const tot = M.set.reduce((a, s) => a + s[1], 0), gate = [(G.gate.x + 400 - 40) * PS, (G.gate.x + 400 + 140) * PS], gaps = G.gaps.map(([a, b]) => [(a + 400) * PS - 8, (b + 400) * PS + 8]);
    for (let x = 14 + r() * 20; x < W - 10; x += 20 + r() * 46) {
      if (gaps.some(([a, b]) => x > a && x < b) || (x > gate[0] && x < gate[1])) continue;
      let pick = r() * tot, name = M.set[0][0]; for (const s of M.set) { pick -= s[1]; if (pick <= 0) { name = s[0]; break; } }
      DEC[name](Math.round(x), r);
    }
    crisp(c); dx.globalCompositeOperation = 'source-atop'; dx.fillStyle = 'rgba(' + rgb(TH.layers[2]).join(',') + ',.38)'; dx.fillRect(0, 0, W, DH); dx.globalCompositeOperation = 'source-over';
    for (const f of F.flames) if (f.k === 'lamp') { dx.fillStyle = M.acc; dx.fillRect(f.x - 1, f.y - 2, 3, 4); }
    return c;
  }
  function buildCanopy() {
    const c = mk(RW, 74), x2 = c.getContext('2d'), r = mulberry32(L.day * 401 + 7), dark = css(mix(rgb(TH.ground), rgb(TH.layers[2]), .25)), dark2 = css(mix(rgb(TH.ground), rgb(TH.layers[2]), .55));
    if (TK === 'dune') return c;
    for (let n = 0; n < 7; n++) {
      const cx0 = r() * RW, wv = 40 + r() * 90;
      for (const off of [0, -RW, RW]) {
        if (TK === 'cave' || TK === 'abyss') { for (let q = 0; q < 5; q++) { const sx = cx0 + off + (q - 2) * wv * .22, h = 14 + hsh(n, q, 5) * 46, hw = 3 + h * .12; x2.fillStyle = q % 2 ? dark : dark2; x2.beginPath(); x2.moveTo(sx - hw, 0); x2.lineTo(sx + hw, 0); x2.lineTo(sx + (hsh(n, q, 6) - .5) * 4, h); x2.fill(); } }
        else { x2.fillStyle = dark; x2.fillRect(cx0 + off - wv * .5, 0, wv, 3); for (let q = 0; q < 16; q++) { const lx = cx0 + off + (hsh(n, q, 7) - .5) * wv * 1.2, ly = hsh(n, q, 8) * 34, lw = 7 + hsh(n, q, 9) * 12; x2.fillStyle = q % 3 ? dark : dark2; x2.beginPath(); x2.ellipse(lx, ly, lw, lw * .34, (hsh(n, q, 10) - .5) * 1.4 + .5, 0, 6.29); x2.fill(); } }
      }
    }
    crisp(c); return c;
  }
  const AMBK = { dusk: [34, .05, -.03, 1], cave: [40, 0, -.12, 2], frost: [90, -.25, .55, 3], ember: [56, .1, -.5, 4], dune: [70, 1.5, .06, 5], abyss: [44, 0, -.2, 6] };
  F.build = function () {
    TK = MAT[L.theme] ? L.theme : 'dusk'; M = MAT[TK]; RIM = rgb(TH.rim).map(v => v / 255);
    for (const k of [...cache.keys()]) if (k.startsWith('st') || k.startsWith('fl')) cache.delete(k);
    F.gnd = buildGround(); F.decor = buildDecor(); F.ridge = [0, 1, 2].map(buildRidge); F.cloud = (TK === 'cave' || TK === 'abyss') ? null : buildCloud(); F.canopy = buildCanopy();
    const a = AMBK[TK], r = mulberry32(L.day * 17 + 1); F.amb = []; for (let i = 0; i < a[0]; i++) F.amb.push({ x: r() * 1000, y: r() * 600, ph: r() * 6.28, s: .5 + r(), vx: a[1], vy: a[2], k: a[3] });
    F.sq = F.hurt = F.flash = F.pulse = 0; focusL = null;
  };

  /* ---- 逐帧:把实体画到世界层 ---- */
  function drawGate(g, t) {
    const x = X(g.x), y = Y(g.y), w = Math.round(g.w * PS), h = Y(g.y + g.h) - y, o = g.open, s = M.s, wood = ['#3a1a16', '#74302a', '#b85044'];
    if (o > 0) { const lg = gx.createLinearGradient(0, y + 24, 0, y + h); lg.addColorStop(0, 'rgba(255,236,190,' + .8 * o + ')'); lg.addColorStop(1, 'rgba(255,190,110,' + .3 * o + ')'); gx.fillStyle = lg; gx.fillRect(x + 12, y + 26, w - 24, h - 26); G2(x + w / 2, y + h * .6, 130, '255,220,150', .38 * o); R2(wx, x + 12, y + 26, w - 24, h - 26, 'rgba(255,240,205,' + o + ')'); }
    for (const px of [x + 4, x + w - 12]) { R2(wx, px, y + 14, 8, h - 14, wood[1]); R2(wx, px, y + 14, 2, h - 14, wood[2]); R2(wx, px + 6, y + 14, 2, h - 14, wood[0]); R2(wx, px - 1, y + h - 4, 10, 4, s[1]); R2(wx, px - 1, y + h - 4, 10, 1, s[3]); }
    R2(wx, x - 3, y + 24, w + 6, 5, wood[1]); R2(wx, x - 3, y + 24, w + 6, 1, wood[2]); R2(wx, x + 6, y + 14, w - 12, 10, wood[0]);
    for (let i = 0; i < 9; i++) { const ext = Math.round(15 - i * 1.3); R2(wx, x - ext, y + 5 + i, w + ext * 2, 1, i < 2 ? s[3] : i < 6 ? s[1] : s[0]); if (i > 1 && i < 6) for (let q = x - ext + (i % 2) * 2; q < x + w + ext; q += 4) R2(wx, q, y + 5 + i, 1, 1, s[0]); }
    for (const sgn of [-1, 1]) { const ex = sgn < 0 ? x - 17 : x + w + 14; R2(wx, ex, y + 3, 3, 2, s[3]); R2(wx, ex + sgn, y + 1, 2, 2, s[3]); }
    R2(wx, x + w / 2 - 12, y + 13, 24, 11, '#1a120e'); R2(wx, x + w / 2 - 12, y + 13, 24, 1, '#c8a565'); R2(wx, x + w / 2 - 12, y + 23, 24, 1, '#8a6f3c');
  }
  function drawLantern(l, t) {
    const sway = Math.round(Math.sin(F.tt * .025 + l.x) * 1), x0 = X(l.x), x = x0 + sway, y = Y(l.y + l.bump), cx = x + 12, lit = l.state !== 'dark', b0 = x + 2, by0 = y + 3;
    wx.fillStyle = 'rgba(' + hex(TH.rim) + ',.5)'; for (let yy = y - 3; yy > -2; yy -= 3) wx.fillRect(x0 + 12, yy, 1, 2);
    const C = l.state === 'gold' ? ['#fff4cf', '#f0b85a', '#b8742a'] : l.state === 'lit' ? ['#f6e2b4', '#cf9a52', '#8a5c2a'] : l.state === 'dim' ? ['#e9a28f', '#a84a3c', '#5c241e'] : ['#5a4e44', '#3a322c', '#1c1612'];
    R2(wx, b0 + 2, by0, 16, 19, C[1]); R2(wx, b0, by0 + 3, 20, 13, C[1]); R2(wx, b0 + 1, by0 + 1, 18, 17, C[1]);
    R2(wx, b0 + 6, by0 + 2, 8, 15, C[0]); R2(wx, b0 + 4, by0 + 5, 12, 9, C[0]);
    wx.fillStyle = C[2]; for (const k of [3, 8, 11, 16]) wx.fillRect(b0 + k, by0 + 1, 1, 17); wx.fillRect(b0, by0 + 3, 1, 13); wx.fillRect(b0 + 19, by0 + 3, 1, 13); wx.fillRect(b0 + 2, by0 + 18, 16, 1);
    R2(wx, b0 + 4, y, 12, 3, lit ? '#7a5426' : '#4a3e34'); R2(wx, b0 + 4, y, 12, 1, lit ? '#d9a860' : '#6a5c4e'); R2(wx, b0 + 5, by0 + 19, 10, 2, lit ? '#7a5426' : '#4a3e34');
    wx.fillStyle = lit ? '#d9a860' : 'rgba(' + hex(TH.rim) + ',.7)'; wx.fillRect(cx - 1, by0 + 21, 1, 4); wx.fillRect(cx - 1 + sway, by0 + 25, 1, 3); wx.fillRect(cx - 2 + sway, by0 + 28, 3, 2);
    if (!lit) { const a = .65 + .35 * Math.sin(F.tt * .06 + l.x); glyph(wx, '?', cx - 3, by0 + 5, 'rgba(' + hex(TH.rim) + ',' + a + ')', 2); glyph(gx, '?', cx - 3, by0 + 5, 'rgba(' + hex(TH.rim) + ',' + a * .5 + ')', 2); G2(cx, by0 + 10, 22, hex(TH.rim), .12 + .06 * Math.sin(F.tt * .06 + l.x)); }
    else { const c = l.state === 'gold' ? '255,206,120' : l.state === 'lit' ? '230,180,110' : '200,90,70', a = (l.state === 'gold' ? .55 : l.state === 'lit' ? .36 : .22) * l.glow * (.9 + .1 * Math.sin(F.tt * .08 + l.x)); gx.fillStyle = 'rgba(' + c + ',' + a * 1.1 + ')'; gx.fillRect(b0 + 1, by0 + 1, 18, 17); G2(cx, by0 + 10, 70, c, a); G2(cx, Y(GY) - 1, 50, c, a * .3); }
  }
  function drawEnemy(e, t) {
    if (!e.alive && e.dead <= 0) return;
    const pal = EP[e.kind] || EP.walker, cx = X(e.x + e.w / 2), by = Y(e.y + e.h), dir = e.vx < 0 ? -1 : 1, w0 = Math.round(e.w * PS / 2) * 2, h0 = Math.round(e.h * PS / 2) * 2; let w = w0, h = h0;
    wx.globalAlpha = e.alive ? 1 : e.dead / 34;
    if (!e.alive) { h = Math.max(2, Math.round(h0 * .3 / 2) * 2); w = Math.round(w0 * 1.25 / 2) * 2; }
    else if (e.kind === 'hopper') h = Math.round(h0 * (1 + clamp(-e.vy * .03, -.2, .25)) / 2) * 2;
    else if (e.hurt > 0) { h = h0 - 2; w = w0 + 2; }
    if (e.alive && by >= Y(GY) - 1) { wx.fillStyle = 'rgba(0,0,0,.3)'; wx.fillRect(cx - w / 2 + 1, by, w - 2, 1); }
    if (e.kind === 'flyer') {
      const up = (F.tt >> 2) & 1, bw = Math.max(8, Math.round(w * .6 / 2) * 2); wx.fillStyle = 'rgba(' + pal.l.join(',') + ',.6)';
      for (const s of [-1, 1]) { wx.fillRect(cx + (s > 0 ? 2 : -10), by - h - (up ? 5 : 0), 8, 3); wx.fillRect(cx + (s > 0 ? 5 : -12), by - h - (up ? 7 : -2), 7, 2); }
      wx.drawImage(blob(bw, h, pal), cx - bw / 2, by - h);
    } else {
      if (e.alive) { wx.fillStyle = css(pal.l); const big = e.kind === 'boss'; for (let i = -1; i <= 1; i++) { const lx = cx + Math.round(i * w * .28), sw = Math.round(Math.sin(F.tt * .35 + i * 2) * (big ? 3 : 1.6)); wx.fillRect(lx + sw - 1, by - (big ? 7 : 3), big ? 2 : 1, big ? 7 : 3); wx.fillRect(lx + sw + 2, by - (big ? 5 : 2), big ? 2 : 1, big ? 5 : 2); }
        const ax = cx + dir * (w / 2 - 2), bob = Math.round(Math.sin(F.tt * .1)); wx.fillRect(ax, by - h - 2, 1, 3); wx.fillRect(ax + dir, by - h - 4 + bob, 1, 2); wx.fillRect(ax + dir * 2, by - h - 5 + bob, 1, 1); }
      wx.drawImage(blob(w, h, pal), cx - w / 2, by - h - (e.alive ? 1 : 0));
      if (e.alive) { R2(wx, cx - dir, by - h + 1, 1, h - 4, css(pal.o)); if (e.kind === 'boss') { wx.fillStyle = css(pal.h); for (let q = 0; q < 9; q++) wx.fillRect(cx + dir * Math.round(w * .28 + q * .9) - 1, by - h - q, 4 - (q >> 2), 1); for (let q = -2; q <= 2; q++) R2(wx, cx + q * 9 - 1, by - h + 4 + Math.abs(q) * 3, 3, 2, css(pal.d)); } }
    }
    if (e.alive) { const ey = by - Math.round(h * (e.kind === 'flyer' ? .7 : .58)), e1 = cx + dir * Math.round(w * .2), e2 = cx + dir * Math.round(w * .36), big = e.kind === 'boss' ? 4 : 2, ec = e.kind === 'boss' && e.hp <= 3 ? '255,120,80' : '255,236,200';
      R2(wx, e1 - (big >> 1), ey - 1, big, big, 'rgb(' + ec + ')'); R2(wx, e2, ey, big - 1, big - 1, 'rgb(' + ec + ')'); R2(gx, e1 - (big >> 1), ey - 1, big, big, 'rgba(' + ec + ',.9)'); G2(e1, ey, e.kind === 'boss' ? 18 : 8, ec, .5);
      if (e.kind === 'boss') { const bw = 56, b0 = cx - 28, byy = by - h - 22; R2(wx, b0 - 1, byy - 1, bw + 2, 4, '#12080a'); R2(wx, b0, byy, Math.round(bw * e.hp / e.maxHp), 2, css(pal.l)); R2(gx, b0, byy, Math.round(bw * e.hp / e.maxHp), 2, 'rgba(' + pal.l.join(',') + ',.6)'); } }
    wx.globalAlpha = 1;
  }
  function drawPlayer(t) {
    if (P.inv > 0 && P.alive && Math.floor(P.inv / 4) % 2 === 0) return;
    const T = P.tail, hx = X(P.x + 11), hy = Y(P.y + 12), gy = Y(GY);
    if (P.alive && P.y + P.h > GY - 90 && groundAt(P.x + 11)) { const sw = 9 - Math.min(6, Math.max(0, (gy - hy - 9) / 7 | 0)); wx.fillStyle = 'rgba(0,0,0,.34)'; wx.fillRect(hx - sw, gy, sw * 2, 1); wx.fillRect(hx - sw + 2, gy + 1, sw * 2 - 4, 1); }
    for (let i = T.length - 1; i >= 0; i--) { const s = T[i], r = Math.max(2, Math.round((8.2 - i * .85) * PS)); wx.drawImage(blob(r * 2, r * 2, i % 2 ? P_SN2 : P_SN, true), X(s.x) - r, Y(s.y) - r); }
    const st = clamp(1 - P.vy * .012, .86, 1.16) * (1 - F.sq * .3), w = Math.round(19 / st / 2) * 2, h = Math.round(17 * st / 2) * 2, x0 = hx - w / 2, y0 = hy + 1 - (h >> 1) + Math.round(F.sq * 4);
    wx.drawImage(blob(w, h, P_SN, true), x0, y0);
    const f = P.face, ex = hx + f * 4 - 1, ey = y0 + Math.round(h * .3);
    if ((F.tt % 210) < 6) R2(wx, ex - 1, ey + 2, 4, 1, '#13251d'); else { R2(wx, ex, ey, 3, 4, '#13251d'); R2(wx, ex + (f > 0 ? 1 : 0), ey, 2, 2, '#ffffff'); R2(wx, ex + (f > 0 ? 2 : 0), ey + 2, 1, 1, '#8ad8ff'); }
    R2(wx, hx + f * (w / 2 - 2) - (f < 0 ? 1 : 0), y0 + Math.round(h * .5), 1, 1, '#0e2c24');
    if ((F.tt % 150) < 16 && P.grounded) { const tx = hx + f * (w / 2), ty = y0 + Math.round(h * .62), fl = (F.tt % 150) < 8 ? 4 : 2; R2(wx, f > 0 ? tx : tx - fl, ty, fl, 1, '#f06a6a'); R2(wx, f > 0 ? tx + fl : tx - fl - 1, ty - 1, 1, 1, '#f06a6a'); R2(wx, f > 0 ? tx + fl : tx - fl - 1, ty + 1, 1, 1, '#f06a6a'); }
    G2(hx, hy, 30, '134,216,174', .14);
    if (P.power >= 1) { gx.fillStyle = 'rgba(242,214,150,' + (.5 + .25 * Math.sin(F.tt * .1)) + ')'; for (let q = 0; q < 26; q++) { const a = q / 26 * 6.283 + F.tt * .02; gx.fillRect(hx + Math.round(Math.cos(a) * 15), hy + 1 + Math.round(Math.sin(a) * 14), 1, 1); } }
    if (P.power >= 2) { const a = F.tt * .09, px = hx + Math.round(Math.cos(a) * 18), py = hy - 2 + Math.round(Math.sin(a) * 8); G2(px, py, 9, '255,236,180', .8); R2(gx, px - 1, py - 1, 3, 3, '#fffbe8'); R2(wx, px - 1, py - 1, 3, 3, '#fffbe8'); }
  }
  function ambient() {
    for (const a of F.amb) {
      a.x += a.vx * a.s + Math.sin(F.tt * .013 + a.ph) * .12; a.y += a.vy * a.s + Math.cos(F.tt * .011 + a.ph) * .06;
      const x = ((a.x - camPx * .6) % (LW + 20) + LW + 20) % (LW + 20) - 10, y = ((a.y % (LH + 20)) + LH + 20) % (LH + 20) - 10, tw = .5 + .5 * Math.sin(F.tt * .04 + a.ph);
      if (a.k === 3) { gx.fillStyle = 'rgba(230,238,255,' + (.35 + .3 * a.s * .5) + ')'; gx.fillRect(x, y, a.s > 1.1 ? 2 : 1, a.s > 1.1 ? 2 : 1); }
      else if (a.k === 5) { gx.fillStyle = 'rgba(255,226,170,' + .16 * tw + ')'; gx.fillRect(x, y, 5 + a.s * 6, 1); }
      else if (a.k === 4) { gx.fillStyle = 'rgba(255,' + (120 + tw * 90 | 0) + ',60,' + (.35 + .5 * tw) + ')'; gx.fillRect(x, y, 1, 1); if (a.s > 1.2) G2(x, y, 4, '255,140,70', .25 * tw); }
      else { G2(x, y, 3 + a.s * 3, TH.mote, .2 * tw); gx.fillStyle = 'rgba(' + TH.mote + ',' + .7 * tw + ')'; gx.fillRect(x, y, 1, 1); }
    }
  }

  /* ---- 着色器 ---- */
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;varying vec2 v;uniform sampler2D uB,uW,uG;uniform vec2 uRes;uniform float uScale,uT,uCam,uGround,uHurt,uFocus,uFlash,uHaze,uStars,uPulse;
uniform vec3 uSky0,uSky1,uSky2,uOrbC,uOrb,uAmb,uMist,uPulseC;uniform vec2 uFocusP;uniform vec4 uL[${MAXL}];uniform vec3 uLC[${MAXL}];
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec4 sharp(sampler2D s,vec2 uv){vec2 q=uv*uRes;vec2 f=fract(q)-.5;q=floor(q)+.5+clamp(f*uScale,-.5,.5);return texture2D(s,q/uRes);}
void main(){vec2 uv=v;uv.x+=uHaze*sin(uv.y*70.+uT*2.6)*.0016*smoothstep(.2,.9,uv.y);vec2 px=uv*uRes;
float sy=clamp(px.y/uGround,0.,1.);vec3 col=sy<.55?mix(uSky0,uSky1,sy/.55):mix(uSky1,uSky2,(sy-.55)/.45);
vec2 sp=floor(px+vec2(floor(uCam*.04),0.));float st=step(.9972,h21(sp));col+=st*uStars*(1.-sy)*(.45+.55*sin(uT*1.7+h21(sp+7.)*40.));
float od=distance(px,uOrb.xy);float disc=smoothstep(uOrb.z+.6,uOrb.z-.6,od);col=mix(col,uOrbC,disc);col+=uOrbC*(.5*exp(-od/(uOrb.z*2.4))+.16*exp(-od/(uOrb.z*7.)));
vec4 b=sharp(uB,uv);col=col*(1.-b.a)+b.rgb;vec4 w=sharp(uW,uv);
float ray=0.;vec2 dd=(uOrb.xy/uRes-uv)/12.;vec2 q=uv+dd*h21(gl_FragCoord.xy)*.9;for(int i=0;i<12;i++){ray+=1.-max(texture2D(uB,q).a,texture2D(uW,q).a);q+=dd;}
col+=uOrbC*(ray/12.)*exp(-od/(uRes.y*.85))*.3*(1.-disc);
float fg=ns(vec2(px.x*.011+uCam*.006+uT*.02,px.y*.03))*.62+ns(vec2(px.x*.03-uT*.035+uCam*.014,px.y*.07))*.38;float fb=smoothstep(uGround-120.,uGround+6.,px.y)*(1.-smoothstep(uGround+4.,uGround+30.,px.y));
col=mix(col,uMist,fb*fg*.34);
vec3 lit=uAmb;vec3 air=vec3(0.);for(int i=0;i<${MAXL};i++){vec4 L=uL[i];float a=clamp(1.-distance(px,L.xy)/L.z,0.,1.);a*=a;lit+=uLC[i]*L.w*a*1.25;air+=uLC[i]*L.w*a*a;}
lit+=uPulseC*uPulse*clamp(1.-distance(px,uFocusP)/(uRes.x*.9),0.,1.);
col=col*(1.-w.a)+w.rgb*min(lit,vec3(1.9));
col+=air*fg*fb*.10;col=mix(col,uMist,fb*fg*.07);
col+=texture2D(uG,uv).rgb*1.2;
float fd=distance(px,uFocusP)/uRes.y;col*=1.-uFocus*.5*smoothstep(.12,.7,fd);
float vg=smoothstep(.42,1.05,length((v-.5)*vec2(1.,.92))*1.22);col*=1.-.5*vg;col=mix(col,vec3(1.,.22,.18),uHurt*(vg*.9+.08));
col+=uFlash;col=col/(1.+col*.12);col=pow(col,vec3(.94));col+=(h21(gl_FragCoord.xy+fract(uT)*91.)-.5)*.022;gl_FragColor=vec4(col,1.);}`;
  function initGL() {
    try { gl = glc.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { F.err = gl.getShaderInfoLog(o); return null; } return o; };
    const a = sh(gl.VERTEX_SHADER, VS), b = sh(gl.FRAGMENT_SHADER, FS); if (!a || !b) return false;
    prog = gl.createProgram(); gl.attachShader(prog, a); gl.attachShader(prog, b); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { F.err = gl.getProgramInfoLog(prog); return false; }
    gl.useProgram(prog); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uB', 'uW', 'uG', 'uRes', 'uScale', 'uT', 'uCam', 'uGround', 'uHurt', 'uFocus', 'uFlash', 'uHaze', 'uStars', 'uPulse', 'uSky0', 'uSky1', 'uSky2', 'uOrbC', 'uOrb', 'uAmb', 'uMist', 'uPulseC', 'uFocusP', 'uL', 'uLC']) U[n] = gl.getUniformLocation(prog, n);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    texs = [0, 1, 2].map(i => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; });
    gl.uniform1i(U.uB, 0); gl.uniform1i(U.uW, 1); gl.uniform1i(U.uG, 2);
    return true;
  }
  F.init = function () {
    if (!glc || !ovc) return;
    F.ok = !/nogl/.test(location.hash) && initGL(); ox = ovc.getContext('2d');
    glc.addEventListener('webglcontextlost', e => { e.preventDefault(); F.ok = false; document.body.classList.remove('gl'); });
    glc.addEventListener('webglcontextrestored', () => { F.ok = initGL(); document.body.classList.toggle('gl', F.ok); });
    document.body.classList.toggle('gl', F.ok);
  };
  let lastT = 0, slow = 0, cssW = 0, cssH = 0; F.dprCap = 2;
  F.resize = function (cw, ch) {
    cssW = cw; cssH = ch; const dpr = Math.min(window.devicePixelRatio || 1, F.dprCap); glc.width = ovc.width = Math.round(cw * dpr); glc.height = ovc.height = Math.round(ch * dpr);
    LW = Math.max(8, Math.round(VW * PS)); LH = Math.max(8, Math.round(VH * PS));
    for (const c of [bgC, wC, gC]) { c.width = LW; c.height = LH; }
    bx = bgC.getContext('2d'); wx = wC.getContext('2d'); gx = gC.getContext('2d'); for (const c of [bx, wx, gx]) c.imageSmoothingEnabled = false;
    if (gl) gl.viewport(0, 0, glc.width, glc.height);
  };
  const strip = (c2, img, sx, dy) => { if (sx < 0) sx = 0; const sw = Math.min(LW, img.width - sx); if (sw > 0) c2.drawImage(img, sx, 0, sw, img.height, 0, dy, sw, img.height); };
  const LD = new Float32Array(MAXL * 4), LCD = new Float32Array(MAXL * 3);

  F.draw = function () {
    if (!F.ok || !bx || !F.gnd) return;
    { const now = performance.now(), dt = now - lastT; lastT = now; if (dt > 26 && dt < 200) slow++; else if (slow > 0) slow -= .25; if (slow > 70 && F.dprCap > 1) { F.dprCap = F.dprCap > 1.5 ? 1.5 : 1; slow = 0; F.resize(cssW, cssH); } }
    const t = S.t, tt = ++F.tt; camPx = Math.round(cam * PS) + (S.shake ? Math.round((Math.random() - .5) * S.shake * PS) : 0); shY = S.shake ? Math.round((Math.random() - .5) * S.shake * PS) : 0; const gy = Y(GY), g = G.gate;
    F.sq *= .8; F.hurt *= .93; F.flash *= .84; F.pulse *= .955; F.focus += ((S.sheet === 'quiz' && focusL ? 1 : 0) - F.focus) * .08;
    /* 远景 */
    bx.clearRect(0, 0, LW, LH);
    if (F.cloud) { const o = (((camPx * .05 + tt * .025) % RW) + RW) % RW | 0; bx.globalAlpha = .5; bx.drawImage(F.cloud, -o, gy - 300); bx.drawImage(F.cloud, RW - o, gy - 300); bx.globalAlpha = 1; }
    for (let k = 0; k < 3; k++) { const o = (((camPx * [.1, .22, .4][k]) % RW) + RW) % RW | 0; bx.drawImage(F.ridge[k], -o, gy - 198); bx.drawImage(F.ridge[k], RW - o, gy - 198); }
    R2(bx, 0, gy + 10, LW, LH, TH.ground);
    /* 世界与自发光 */
    wx.clearRect(0, 0, LW, LH); gx.globalCompositeOperation = 'source-over'; gx.globalAlpha = 1; gx.fillStyle = '#000'; gx.fillRect(0, 0, LW, LH); gx.globalCompositeOperation = 'lighter';
    const sx0 = Math.round(400 * PS) + camPx, dTop = gy + 1 - DH;
    strip(wx, F.decor, sx0, dTop);
    for (const f of F.flames) { const x = f.x - sx0, y = f.y + dTop; if (x < -30 || x > LW + 30) continue;
      if (f.k === 'fire') { for (let q = 0; q < 7; q++) { const hgt = 3 + ((Math.sin(tt * .5 + q * 1.7 + f.x) + 1) * 3 | 0), fx0 = x - 3 + q; R2(gx, fx0, y - hgt, 1, hgt, q % 2 ? 'rgba(255,170,60,.95)' : 'rgba(255,224,130,.95)'); R2(wx, fx0, y - hgt, 1, hgt, q % 2 ? '#ffaa3c' : '#ffe082'); } G2(x, y - 4, 26, '255,150,60', .55 + .1 * Math.sin(tt * .4 + f.x)); }
      else if (f.k === 'lamp') { R2(gx, x - 1, y - 2, 3, 4, 'rgba(255,214,150,.9)'); G2(x, y, 20, '255,196,120', .42 + .06 * Math.sin(tt * .2 + f.x)); }
      else G2(x, y, f.k === 'gem' ? 20 : 14, hex(f.k === 'gem' ? M.g[3] : M.acc), .3 + .1 * Math.sin(tt * .05 + f.x)); }
    const vis = o => o.x + (o.w || 0) > cam - 140 && o.x < cam + VW + 140;
    if (vis(g)) drawGate(g, t);
    for (const s of G.steles) if (vis(s)) wx.drawImage(steleSpr(s), X(s.x), Y(s.y + s.h) - Math.round(s.h * PS));
    for (const f of G.floats) if (vis(f)) wx.drawImage(floatSpr(Math.round(f.w * PS)), X(f.x), Y(f.y) - 2);
    strip(wx, F.gnd, sx0, gy - 6);
    for (const [a, b] of G.gaps) { const x1 = X(a), x2 = X(b); if (x2 < 0 || x1 > LW) continue; const lg = gx.createLinearGradient(0, gy + 4, 0, LH); lg.addColorStop(0, 'rgba(' + TH.mist + ',0)'); lg.addColorStop(1, 'rgba(' + TH.mist + ',.34)'); gx.fillStyle = lg; gx.fillRect(x1, gy + 4, x2 - x1, LH - gy); }
    wx.fillStyle = M.g[2]; for (const tf of G.tufts) { const x = X(tf[0]); if (x < -3 || x > LW + 3) continue; const hgt = 2 + (tf[1] * .5 | 0), sw = Math.round(Math.sin(tt * .035 + tf[0] * .05) * 1.3 + tf[2]); wx.fillRect(x, gy - hgt + 1, 1, hgt); wx.fillRect(x + sw, gy - hgt - 1, 1, 2); }
    for (const l of G.lanterns) if (vis(l)) drawLantern(l, t);
    for (const f of G.flies) if (!f.got) { const x = X(f.x), y = Y(f.y + Math.sin(tt * .06 + f.ph) * 4); if (x < -12 || x > LW + 12) continue; G2(x, y, 8, TH.mote, .5 + .2 * Math.sin(tt * .1 + f.ph)); R2(gx, x, y, 1, 1, '#fff6dc'); R2(gx, x - 1, y, 3, 1, 'rgba(255,246,220,.35)'); R2(gx, x, y - 1, 1, 3, 'rgba(255,246,220,.35)'); }
    for (const e of G.enemies) if (vis(e)) drawEnemy(e, t);
    drawPlayer(t);
    for (const b of G.pearls) { const x = X(b.x), y = Y(b.y); G2(x, y, 11, '255,236,180', .75); R2(gx, x - 1, y - 1, 3, 3, '#fffbe8'); R2(wx, x - 1, y - 1, 3, 3, '#fffbe8'); }
    for (const p of G.parts) { gx.globalAlpha = clamp(p.life / p.max, 0, 1); gx.fillStyle = p.color; const s = p.r > 2.2 ? 2 : 1; gx.fillRect(X(p.x), Y(p.y), s, s); } gx.globalAlpha = 1;
    ambient();
    if (F.canopy) { const o = (((camPx * 1.25) % RW) + RW) % RW | 0; wx.drawImage(F.canopy, -o, 0); wx.drawImage(F.canopy, RW - o, 0); }
    /* 高清文字层 */
    const k = ovc.width / LW; ox.clearRect(0, 0, ovc.width, ovc.height); ox.textAlign = 'center';
    if (vis(g)) { ox.font = '600 ' + Math.round(8.5 * k) + 'px ' + SERIF; ox.fillStyle = 'rgba(' + hex(TH.rim) + ',' + (.55 + .45 * g.open) + ')'; ox.fillText('山門', (X(g.x) + Math.round(g.w * PS) / 2) * k, (Y(g.y) + 21.4) * k); }
    if (G.boss && G.boss.alive && vis(G.boss)) { ox.font = '600 ' + Math.round(9 * k) + 'px ' + SERIF; ox.fillStyle = 'rgba(255,170,140,.95)'; ox.fillText('大 蠹', X(G.boss.x + G.boss.w / 2) * k, (Y(G.boss.y) - 27) * k); }
    ox.font = '600 ' + Math.round(10.5 * k) + 'px ' + SERIF; for (const tx of G.texts) { ox.globalAlpha = clamp(tx.life / 30, 0, 1); const x = (tx.x * PS - cam * PS) * k, y = (tx.y + OY) * PS * k; ox.fillStyle = 'rgba(0,0,0,.6)'; ox.fillText(tx.text, x + k * .6, y + k * .6); ox.fillStyle = tx.color; ox.fillText(tx.text, x, y); } ox.globalAlpha = 1;
    /* 光源 */
    const Ls = [], add = (x, y, r, c, i) => { if (i > .01 && x > -r && x < LW + r) Ls.push([x, y, r, c, i]); };
    add(X(P.x + 11), Y(P.y + 12), 76, [.5, .95, .74], P.alive ? .62 : .15);
    for (const l of G.lanterns) { const x = X(l.x + 15), y = Y(l.y + 15); if (l.state === 'dark') add(x, y, 44, RIM, .34 + .1 * Math.sin(tt * .06 + l.x)); else { const kk = l.state === 'gold' ? 1.5 : l.state === 'lit' ? 1.1 : .6; add(x, y, 120 + kk * 54, l.state === 'dim' ? [1, .45, .35] : [1, .78, .46], kk * l.glow * (.92 + .08 * Math.sin(tt * .11 + l.x))); } }
    if (g.open > 0) add(X(g.x + 46), Y(g.y + 80), 230, [1, .86, .6], 1.6 * g.open);
    for (const b of G.pearls) add(X(b.x), Y(b.y), 44, [1, .93, .7], .9);
    for (const d of F.dl) add(d.x - sx0, d.y + dTop, d.r, d.c, d.i * (1 + d.fl * Math.sin(tt * .37 + d.x) + d.fl * .6 * Math.sin(tt * .83 + d.x * 2)));
    if (Ls.length > MAXL) { Ls.sort((a, b2) => (Math.abs(a[0] - LW / 2) - a[2] - a[4] * 40) - (Math.abs(b2[0] - LW / 2) - b2[2] - b2[4] * 40)); Ls.length = MAXL; }
    LD.fill(0); LCD.fill(0); Ls.forEach((l, i) => { LD[i * 4] = l[0]; LD[i * 4 + 1] = l[1]; LD[i * 4 + 2] = l[2]; LD[i * 4 + 3] = l[4]; LCD[i * 3] = l[3][0]; LCD[i * 3 + 1] = l[3][1]; LCD[i * 3 + 2] = l[3][2]; }); F.stat.lights = Ls.length;
    /* 合成 */
    [bgC, wC, gC].forEach((c, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texs[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); });
    const c3 = (u, h) => { const c = rgb(h); gl.uniform3f(u, c[0] / 255, c[1] / 255, c[2] / 255); }, mist = TH.mist.split(',').map(Number);
    gl.uniform2f(U.uRes, LW, LH); gl.uniform1f(U.uScale, glc.width / LW); gl.uniform1f(U.uT, tt / 60); gl.uniform1f(U.uCam, camPx); gl.uniform1f(U.uGround, gy);
    c3(U.uSky0, TH.sky[0]); c3(U.uSky1, TH.sky[1]); c3(U.uSky2, TH.sky[2]); c3(U.uOrbC, TH.orb[0]);
    gl.uniform3f(U.uOrb, LW * TH.orb[1] - camPx * .03, (OY + 450 * TH.orb[2]) * PS, TH.orb[3] * PS); gl.uniform3f(U.uAmb, M.amb[0], M.amb[1], M.amb[2]); gl.uniform3f(U.uMist, mist[0] / 255, mist[1] / 255, mist[2] / 255);
    gl.uniform1f(U.uHurt, F.hurt); gl.uniform1f(U.uFlash, F.flash); gl.uniform1f(U.uFocus, F.focus); gl.uniform1f(U.uHaze, TK === 'ember' ? 1 : TK === 'dune' ? .6 : 0); gl.uniform1f(U.uStars, TH.stars * 1.6); gl.uniform1f(U.uPulse, F.pulse); gl.uniform3f(U.uPulseC, F.pulseC[0], F.pulseC[1], F.pulseC[2]);
    const fl = focusL || { x: P.x, y: P.y }; gl.uniform2f(U.uFocusP, X(fl.x + 15), Y(fl.y + 15)); gl.uniform4fv(U.uL, LD); gl.uniform3fv(U.uLC, LCD);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  F.land = v => { F.sq = Math.min(1, v / 11); };
  F.hit = () => { F.hurt = 1; };
  F.focusOn = l => { focusL = l || null; };
  F.burst = (kind) => { F.pulse = kind === 'ok' ? 1.5 : kind === 'gold' ? 2.2 : .9; F.pulseC = kind === 'no' ? [1, .3, .25] : [1, .82, .5]; if (kind !== 'no') F.flash = kind === 'gold' ? .32 : .16; };
  F.snap = () => ({ ok: F.ok, LW, LH, lights: F.stat.lights, err: F.err || null, theme: TK });
  return F;
})();

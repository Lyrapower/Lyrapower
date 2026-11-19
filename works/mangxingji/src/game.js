/* 蟒行记 v3.0 · 引擎(规则沿用 v2,呈现层重写) */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cnNum = n => n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : n < 100 ? CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '') : String(n);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Python 高亮(先分词再转义,不信任输入) ---------- */
const KW = 'def|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|class|pass|break|continue|lambda|None|True|False|is|print|len|any|all';
const HL = new RegExp('(#.*$)|((?:[rfbRFB]{0,2})(?:\'(?:\\\\.|[^\'\\\\\\n])*\'|"(?:\\\\.|[^"\\\\\\n])*"))|\\b(' + KW + ')\\b|\\b(\\d+(?:\\.\\d+)?)\\b', 'gm');
function hl(code) {
  let out = '', last = 0, m; HL.lastIndex = 0; code = String(code);
  while ((m = HL.exec(code))) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-kw' : 'c-num';
    out += '<span class="' + cls + '">' + esc(m[0]) + '</span>'; last = m.index + m[0].length;
    if (m[0].length === 0) HL.lastIndex++;
  }
  return out + esc(code.slice(last));
}

/* ---------- 存档 ---------- */
const KEY = 'mxj_v2';
const blank = () => ({ v: 2, cur: 1, fire: 0, sound: true, seenIntro: false, streak: { n: 0, last: '' }, best: {}, q: {}, custom: [] });
function loadSave() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 2) return Object.assign(blank(), s); } catch (e) {} return blank(); }
let save = loadSave();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch (e) { return false; } }

/* ---------- 课程:内置 + 导入 ---------- */
const TYPES = ['choice', 'output', 'fill', 'bugline', 'order'];
const THEME_ALIAS = { grass: 'dusk', underground: 'cave', cavern: 'frost', castle: 'ember', desert: 'dune', volcano: 'abyss' };
const str = (v, max) => (v == null ? '' : String(v)).slice(0, max || 4000);
function normLesson(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('需要一个课程对象');
  const day = Number(d.day);
  if (!Number.isInteger(day) || day < 1 || day > 999) throw new Error('day 需为 1–999 的整数');
  const title = str(d.title, 120).trim(); if (!title) throw new Error('缺少 title');
  if (!Array.isArray(d.quizzes) || !d.quizzes.length) throw new Error('quizzes 不能为空');
  if (d.quizzes.length > 12) throw new Error('一课最多 12 题');
  const quizzes = d.quizzes.map((q, i) => {
    const at = '第 ' + (i + 1) + ' 题:';
    if (!q || typeof q !== 'object') throw new Error(at + '格式不对');
    const type = TYPES.includes(q.type) ? q.type : 'choice';
    const o = { id: 'x' + day + '_' + str(q.id || ('q' + (i + 1)), 40), type, concept: str(q.concept, 60) || '练习', q: str(q.q || q.question, 600), code: str(q.code || q.codePre, 2000), hint: str(q.hint, 600), explain: str(q.explain || q.explanation, 900) };
    if (!o.q) throw new Error(at + '缺少题干 question');
    if (type === 'choice' || type === 'output') {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw new Error(at + 'options 需 2–6 项');
      o.options = q.options.map(x => str(x, 300));
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= o.options.length) throw new Error(at + 'correct 越界');
      o.correct = q.correct;
    } else if (type === 'fill') {
      if ((o.code.match(/____/g) || []).length !== 1) throw new Error(at + 'fill 题的 code 需恰好含一个 ____');
      if (!Array.isArray(q.answers) || !q.answers.length) throw new Error(at + '缺少 answers');
      o.answers = q.answers.map(x => str(x, 80));
    } else if (type === 'bugline') {
      const n = o.code.split('\n').length;
      if (n < 2 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= n) throw new Error(at + 'bugline 的 correct 需为有效行号(从 0 起)');
      o.correct = q.correct;
    } else {
      if (!Array.isArray(q.lines) || q.lines.length < 2 || q.lines.length > 8) throw new Error(at + 'order 题 lines 需 2–8 行');
      o.lines = q.lines.map(x => str(x, 200)); o.pre = str(q.pre, 600);
    }
    return o;
  });
  const theme = THEME_ALIAS[d.theme] || (THEMES[d.theme] ? d.theme : THEME_ORDER[(day - 1) % THEME_ORDER.length]);
  return { day, title, en: str(d.en || d.subtitle, 80), theme, badge: str(d.badge, 24) || '行者', intro: str(d.intro, 400), cheatsheet: str(d.cheatsheet, 6000), boss: !!d.boss, bugs: Array.isArray(d.bugs) ? d.bugs.slice(0, 6).map(x => str(x, 24)) : null, quizzes, custom: true };
}
let lessons = [];
function rebuildLessons() {
  const map = new Map(); LESSONS.forEach(l => map.set(l.day, l));
  const ok = [];
  (save.custom || []).forEach(raw => { try { const l = normLesson(raw); map.set(l.day, l); ok.push(raw); } catch (e) {} });
  save.custom = ok; lessons = [...map.values()].sort((a, b) => a.day - b.day);
}
const lessonOf = day => lessons.find(l => l.day === day) || lessons[0];

/* ---------- 主题 ---------- */
const THEME_ORDER = ['dusk', 'cave', 'frost', 'ember', 'dune', 'abyss'];
const THEMES = {
  dusk:  { name: '暮野', sky: ['#252745', '#7c5068', '#e2a06c'], orb: ['#ffe3b0', 0.74, 0.60, 30], stars: .35, layers: ['#6b4f69', '#48384f', '#2c2436'], ground: '#17121a', rim: '#e7b678', mist: '238,170,120', mote: '255,214,150' },
  cave:  { name: '岩窟', sky: ['#081013', '#0f2a32', '#1c4a4e'], orb: ['#c8f2e6', 0.24, 0.26, 20], stars: .25, layers: ['#18383e', '#10272d', '#0b1a1f'], ground: '#060d10', rim: '#6fd0c0', mist: '90,190,180', mote: '150,240,220' },
  frost: { name: '霜夜', sky: ['#0a102c', '#24356a', '#7388c0'], orb: ['#eef3ff', 0.7, 0.2, 24], stars: .9, layers: ['#47598f', '#2c3a6b', '#1a2346'], ground: '#0b0f22', rim: '#bcd0ff', mist: '170,190,255', mote: '220,230,255' },
  ember: { name: '赤城', sky: ['#190b10', '#561d21', '#bd542e'], orb: ['#ffc48a', 0.3, 0.62, 34], stars: .2, layers: ['#682927', '#42191d', '#281016'], ground: '#130708', rim: '#f0a060', mist: '240,120,70', mote: '255,170,110' },
  dune:  { name: '沙海', sky: ['#35273c', '#b06a48', '#efc888'], orb: ['#fff0c8', 0.5, 0.5, 38], stars: .15, layers: ['#b68657', '#875c40', '#573a2e'], ground: '#21150e', rim: '#f4d69a', mist: '250,200,130', mote: '255,230,170' },
  abyss: { name: '深渊', sky: ['#06050c', '#180f2e', '#371b47'], orb: ['#d9c2ff', 0.78, 0.22, 22], stars: 1, layers: ['#291a3d', '#1b122f', '#110a1f'], ground: '#05040a', rim: '#b58cff', mist: '150,100,220', mote: '200,170,255' }
};

/* ---------- 声音 ---------- */
const sfx = {
  ctx: null, out: null,
  init() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = .55; this.out.connect(this.ctx.destination); } catch (e) { this.ctx = null; return; } }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    mus.start();
  },
  tone(f, d, type, vol, f2, delay) {
    if (!save.sound || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + (delay || 0), o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || .12, t + .008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  },
  jump() { this.tone(330, .16, 'sine', .09, 560); },
  land(v) { this.tone(90, .12, 'sine', Math.min(.22, .05 + v * .012), 44); },
  fly(n) { const P = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]; this.tone(P[n % P.length], .22, 'triangle', .08); },
  stomp(n) { this.tone(170 + n * 40, .14, 'sine', .2, 60); this.tone(700 + n * 120, .08, 'triangle', .05); },
  hurt() { this.tone(220, .3, 'sawtooth', .08, 70); },
  bell() { [659.25, 987.77, 1318.5].forEach((f, i) => this.tone(f, 1.3 - i * .25, 'sine', .09 - i * .02, null, i * .05)); },
  wrong() { this.tone(196, .18, 'triangle', .1); this.tone(174.6, .28, 'triangle', .1, null, .16); },
  pearl() { this.tone(880, .12, 'sine', .07, 440); },
  clear() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, .5, 'triangle', .09, null, i * .11)); }
};

/* ---------- 状态 ---------- */
const GY = 380, GRAV = .55;
const keys = { left: false, right: false, jump: false, fire: false };
const S = { day: 1, paused: true, over: false, clear: false, t: 0, score: 0, bugs: 0, deaths: 0, sheet: null, quiz: null, shake: 0, hitstop: 0 };
const P = { x: 80, y: GY - 26, w: 22, h: 26, vx: 0, vy: 0, face: 1, grounded: false, coyote: 0, jbuf: 0, jumpHeld: false, power: 0, hearts: 3, inv: 0, combo: 0, alive: true, tail: [], cp: { x: 80 } };
let G = null, TH = THEMES.dusk, L = null;
let cam = 0, VW = 800, VH = 450, OY = 0, scale = 1;

function buildLevel(day) {
  L = lessonOf(day); S.day = L.day; TH = THEMES[L.theme] || THEMES.dusk;
  const n = L.quizzes.length, SEG = 720, START = 380;
  const g = { floats: [], steles: [], lanterns: [], enemies: [], flies: [], pearls: [], parts: [], texts: [], gaps: [], ground: [], gate: null, boss: null, W: 0 };
  const feats = ['stele', 'gap', 'steps', 'gapfloat', 'stele'];
  const labels = ['def', 'import', 'return', 'with', 'try', 'for', 'class', 'yield'];
  const bugNames = (L.bugs && L.bugs.length) ? L.bugs : ['SyntaxError', 'TypeError', 'NameError', 'IndexError'];
  let bi = 0; const bug = () => bugNames[bi++ % bugNames.length];
  const fly = (x, y) => g.flies.push({ x, y, got: false, ph: (x * 0.37) % 6.28 });
  for (let i = 0; i < 5; i++) fly(170 + i * 26, 338);
  for (let i = 0; i < n; i++) {
    const sx = START + i * SEG, f = feats[(L.day + i * 2) % feats.length];
    g.lanterns.push({ x: sx + 140, y: 250, w: 30, h: 30, q: L.quizzes[i], state: 'dark', bump: 0, cd: 0, glow: 0 });
    g.enemies.push(mkEnemy('walker', sx + 250, sx + 196, sx + 290, bug()));
    if (f === 'stele') { const h = 46 + ((L.day * 7 + i * 13) % 3) * 10; g.steles.push({ x: sx + 480, y: GY - h, w: 34, h, label: labels[(L.day + i) % labels.length] }); for (let k = 0; k < 3; k++) fly(sx + 472 + k * 22, GY - h - 58 - (k === 1 ? 14 : 0)); }
    else if (f === 'gap') { g.gaps.push([sx + 460, sx + 546]); for (let k = 0; k < 4; k++) fly(sx + 454 + k * 30, 300 - Math.sin(k / 3 * Math.PI) * 34); }
    else if (f === 'steps') { g.floats.push({ x: sx + 400, y: 314, w: 84, h: 14 }, { x: sx + 522, y: 254, w: 100, h: 14 }); for (let k = 0; k < 4; k++) fly(sx + 532 + k * 24, 224); }
    else { g.gaps.push([sx + 450, sx + 680]); g.floats.push({ x: sx + 546, y: 352, w: 80, h: 14 }); for (let k = 0; k < 3; k++) fly(sx + 562 + k * 24, 318); continue; }
    if (i % 2 === 1) g.enemies.push(mkEnemy('flyer', sx + 640, sx + 600, sx + 690, bug()));
    else if (L.day >= 2 || i > 0) g.enemies.push(mkEnemy('hopper', sx + 650, sx + 612, sx + 686, bug()));
  }
  const endX = START + n * SEG;
  let gateX = endX + 170;
  if (L.boss) { gateX = endX + 560; g.boss = mkEnemy('boss', endX + 380, endX + 130, endX + 470, '大蠹'); g.enemies.push(g.boss); }
  g.gate = { x: gateX, y: GY - 132, w: 92, h: 132, open: 0 };
  g.W = gateX + 320;
  let x0 = -400; g.gaps.sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { g.ground.push({ x: x0, y: GY, w: a - x0, h: 400 }); x0 = b; });
  g.ground.push({ x: x0, y: GY, w: g.W + 400 - x0, h: 400 });
  g.tufts = []; const r = mulberry32(L.day * 9973 + 11);
  for (let x = -100; x < g.W + 300; x += 9 + r() * 22) if (!g.gaps.some(([a, b]) => x > a - 4 && x < b + 4)) g.tufts.push([x, 3 + r() * 7, r() * 2 - 1]);
  g.ridges = [0, 1, 2].map(k => { const rr = mulberry32(L.day * 131 + k * 17 + 3), pts = []; let v = rr(); for (let i = 0; i <= 40; i++) { v = v * .55 + rr() * .45; pts.push(v); } pts[40] = pts[0]; return pts; });
  g.stars = []; const rs = mulberry32(L.day * 53 + 1); for (let i = 0; i < 90; i++) g.stars.push([rs(), rs() * .7, .4 + rs() * 1.1, rs() * 6.28]);
  g.motes = []; for (let i = 0; i < 26; i++) g.motes.push([rs() * 1200, rs() * 380 + 20, .15 + rs() * .5, rs() * 6.28, 1 + rs() * 1.6]);
  G = g; cam = 0;
  Object.assign(S, { over: false, clear: false, t: 0, score: 0, bugs: 0, deaths: 0, shake: 0, hitstop: 0, quiz: null });
  Object.assign(P, { x: 80, y: GY - P.h, vx: 0, vy: 0, face: 1, grounded: true, power: 0, hearts: 3, inv: 0, combo: 0, alive: true, cp: { x: 80 }, coyote: 0, jbuf: 0 });
  P.tail = []; for (let i = 0; i < 7; i++) P.tail.push({ x: P.x + 11 - i * 6, y: P.y + 18 });
  hud(); FX.build(); mus.retune();
}
function mkEnemy(kind, x, minX, maxX, name) {
  const e = { kind, x, minX, maxX, name, vx: -1, vy: 0, alive: true, dead: 0, t: (x * 7) % 100, hp: 1, hurt: 0 };
  if (kind === 'walker') Object.assign(e, { w: 28, h: 20, y: GY - 20, vx: -1.05 });
  else if (kind === 'hopper') Object.assign(e, { w: 24, h: 20, y: GY - 20, vx: -.6 });
  else if (kind === 'flyer') Object.assign(e, { w: 26, h: 18, y: 286, baseY: 286, vx: -.9 });
  else Object.assign(e, { w: 78, h: 60, y: GY - 60, vx: -1.3, hp: 6, maxHp: 6 });
  return e;
}
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const groundAt = x => G.ground.some(s => x >= s.x && x <= s.x + s.w);
function solids() { return G.ground.concat(G.floats, G.steles, G.lanterns); }
function spark(x, y, color, n, sp) { for (let i = 0; i < (n || 10); i++) { const a = Math.random() * 6.28, v = (sp || 3) * (.3 + Math.random()); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 26 + Math.random() * 20, max: 46, color, r: 1 + Math.random() * 2.2 }); } }
function floatText(x, y, text, color) { G.texts.push({ x, y, text, color: color || '#f2d9a0', life: 70 }); }

/* ---------- 更新(固定 60Hz 步长) ---------- */
let jumpEdge = false;
function step() {
  if (S.paused || S.over || S.clear) return;
  S.t++;
  if (P.alive) {
    if (keys.left && !keys.right) { P.vx -= .55; P.face = -1; } else if (keys.right && !keys.left) { P.vx += .55; P.face = 1; } else { P.vx *= .78; if (Math.abs(P.vx) < .1) P.vx = 0; }
    P.vx = clamp(P.vx, -3.9, 3.9);
    P.coyote = P.grounded ? 7 : P.coyote - 1;
    if (keys.jump && !P.jumpHeld) P.jbuf = 7; else P.jbuf--;
    P.jumpHeld = keys.jump;
    if (P.jbuf > 0 && P.coyote > 0) { P.vy = -12.2; P.jbuf = 0; P.coyote = 0; P.grounded = false; sfx.jump(); spark(P.x + 11, P.y + P.h, 'rgba(' + TH.mote + ',.7)', 5, 1.6); }
    if (!keys.jump && P.vy < -4.5) P.vy = -4.5;
    P.vy = Math.min(P.vy + GRAV, 13);
    if (P.inv > 0) P.inv--;
    const sol = solids();
    P.x += P.vx; if (P.x < 0) { P.x = 0; P.vx = 0; } if (P.x > G.W - P.w) { P.x = G.W - P.w; P.vx = 0; }
    for (const o of sol) if (hit(P, o)) { if (P.vx > 0) P.x = o.x - P.w; else if (P.vx < 0) P.x = o.x + o.w; P.vx = 0; }
    const wasGround = P.grounded; P.y += P.vy; P.grounded = false;
    for (const o of sol) if (hit(P, o)) {
      if (P.vy > 0) { if (!wasGround && P.vy > 5) { FX.land(P.vy); sfx.land(P.vy); spark(P.x + 4, o.y, 'rgba(' + TH.mote + ',.5)', 3, 1.2); spark(P.x + 18, o.y, 'rgba(' + TH.mote + ',.5)', 3, 1.2); } P.y = o.y - P.h; P.vy = 0; P.grounded = true; if (!wasGround) P.combo = 0; }
      else if (P.vy < 0) { P.y = o.y + o.h; P.vy = 0; if (o.q) bonk(o); }
    }
    if (P.y > VH - OY + 140 || P.y > 640) fallOut();
    if (keys.fire) { keys.fire = false; shoot(); }
  } else { P.vy += GRAV; P.y += P.vy; }
  // 尾巴:逐节跟随
  let px = P.x + 11, py = P.y + 15;
  for (let i = 0; i < P.tail.length; i++) {
    const s = P.tail[i], d = i === 0 ? 8 : 6.5;
    s.x += (px - P.face * d - s.x) * .2; s.y += (py + 2.4 - s.y) * .2;
    const dx = s.x - px, dy = s.y - py, len = Math.hypot(dx, dy) || 1; if (len > d) { s.x = px + dx / len * d; s.y = py + dy / len * d; }
    if (P.grounded && s.y > P.y + P.h - 5 + i * .5) s.y = P.y + P.h - 5 + i * .5;
    px = s.x; py = s.y;
  }
  // 灯
  for (const l of G.lanterns) { if (l.bump < 0) l.bump = Math.min(0, l.bump + 1.4); if (l.cd > 0) l.cd--; if (l.state !== 'dark' && l.glow < 1) l.glow = Math.min(1, l.glow + .03); }
  // 萤
  for (const f of G.flies) if (!f.got && Math.abs(f.x - (P.x + 11)) < 18 && Math.abs(f.y - (P.y + 13)) < 20) { f.got = true; G.flyRun = (S.t - (G.flyT || -99) < 40) ? (G.flyRun || 0) + 1 : 0; G.flyT = S.t; save.fire++; S.score += 10; sfx.fly(G.flyRun); spark(f.x, f.y, 'rgba(' + TH.mote + ',1)', 6, 1.8); hudLite(); }
  // 蠹
  for (const e of G.enemies) {
    if (!e.alive) { if (e.dead > 0) e.dead--; continue; }
    e.t++; if (e.hurt > 0) e.hurt--;
    if (e.kind === 'flyer') { e.x += e.vx; e.y = e.baseY + Math.sin(e.t * .05) * 26; if (e.x < e.minX || e.x > e.maxX) e.vx *= -1; }
    else if (e.kind === 'hopper') { if (e.y >= GY - e.h) { e.y = GY - e.h; e.vy = 0; if (e.t % 96 === 0) { e.vy = -7.6; } } else { e.x += e.vx * 2.2; } e.vy += .42; e.y = Math.min(GY - e.h, e.y + e.vy); if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); } if (e.x > e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); } }
    else if (e.kind === 'boss') { const rage = e.hp <= 3 ? 1.6 : 1; const charge = (e.t % 240) > 170; e.x += e.vx * rage * (charge ? 2.1 : 1); if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); } if (e.x > e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); } if (e.y >= GY - e.h) { e.y = GY - e.h; e.vy = 0; if (e.t % 150 === 0) { e.vy = -8.5; } } e.vy += .42; e.y = Math.min(GY - e.h, e.y + e.vy); if (e.y === GY - e.h && e.vy > 2) S.shake = 8; }
    else { e.x += e.vx; const ahead = e.vx < 0 ? e.x - 2 : e.x + e.w + 2; if (e.x < e.minX || e.x > e.maxX || !groundAt(ahead)) { e.vx *= -1; e.x += e.vx * 2; } }
    if (P.alive && hit(P, e)) {
      if (P.vy > 1 && P.y + P.h - P.vy <= e.y + e.h * .55) { P.vy = keys.jump ? -11 : -8.2; P.combo++; damage(e, 1, true); }
      else hurt(e.x + e.w / 2 < P.x + 11 ? 1 : -1);
    }
  }
  // 珠
  for (const b of G.pearls) {
    b.x += b.vx; b.vy += .32; b.y += b.vy; b.life--;
    if (b.y > GY - 8 && groundAt(b.x)) { b.y = GY - 8; b.vy = -4.6; }
    if (G.steles.some(s => hit({ x: b.x - 4, y: b.y - 4, w: 8, h: 8 }, s)) || b.y > 520) b.life = 0;
    for (const e of G.enemies) if (e.alive && hit({ x: b.x - 5, y: b.y - 5, w: 10, h: 10 }, e)) { b.life = 0; damage(e, 1, false); break; }
  }
  G.pearls = G.pearls.filter(b => b.life > 0);
  for (const p of G.parts) { p.x += p.vx; p.y += p.vy; p.vy += .06; p.life--; } G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.y -= .55; t.life--; } G.texts = G.texts.filter(t => t.life > 0);
  // 山门
  const left = G.lanterns.filter(l => l.state === 'dark').length, bossAlive = G.boss && G.boss.alive;
  const g = G.gate, ready = !left && !bossAlive; g.open = clamp(g.open + (ready ? .03 : -.05), 0, 1);
  if (P.alive && hit(P, { x: g.x + 20, y: g.y, w: g.w - 40, h: g.h })) {
    if (ready) levelClear();
    else if (S.t - (g.told || -999) > 150) { g.told = S.t; toast(left ? '还有 ' + left + ' 盏灯未亮,山门不开' : '大蠹未除,山门不开'); }
  }
  // 镜头
  const target = P.x + 11 - VW * (P.face > 0 ? .38 : .56);
  cam += (target - cam) * .08; cam = clamp(cam, 0, Math.max(0, G.W - VW));
  if (S.shake > 0) S.shake--;
}
function damage(e, n, stomp) {
  e.hp -= n; e.hurt = 12; S.hitstop = e.kind === 'boss' ? 7 : 4; sfx.stomp(stomp ? P.combo : 0); spark(e.x + e.w / 2, e.y + e.h / 2, '#f2c66d', 8, 2.6);
  if (e.hp <= 0) {
    e.alive = false; e.dead = 34; S.bugs++; const pts = e.kind === 'boss' ? 2000 : 100 * Math.max(1, stomp ? P.combo : 1); S.score += pts;
    floatText(e.x + e.w / 2, e.y - 6, e.name + ' 已除' + (stomp && P.combo > 1 ? ' ×' + P.combo : ''), '#bfe8cf'); spark(e.x + e.w / 2, e.y + e.h / 2, 'rgba(' + TH.mote + ',1)', e.kind === 'boss' ? 40 : 12, e.kind === 'boss' ? 6 : 3);
    if (e.kind === 'boss') { S.shake = 16; S.hitstop = 14; FX.burst('gold'); sfx.bell(); }
  } else if (e.kind === 'boss') floatText(e.x + e.w / 2, e.y - 10, '余 ' + e.hp, '#f0b0a0');
}
function hurt(dir) {
  if (P.inv > 0) return; P.inv = 90; S.shake = 8; S.hitstop = 6; FX.hit(); sfx.hurt(); P.vx = dir * 4.5; P.vy = -6;
  if (P.power > 0) { P.power--; floatText(P.x + 11, P.y - 8, P.power ? '吐珠已失' : '护身已破', '#f0b0a0'); }
  else { P.hearts--; if (P.hearts <= 0) die(); }
  hud();
}
function fallOut() {
  P.hearts--; S.deaths++; sfx.hurt(); FX.hit(); hud();
  if (P.hearts <= 0) { die(); return; }
  P.x = P.cp.x; P.y = GY - P.h - 60; P.vx = 0; P.vy = 0; P.inv = 100; P.tail.forEach(s => { s.x = P.x; s.y = P.y; }); toast('跌落 · 回到上一盏灯');
}
function die() { P.alive = false; P.vy = -9; S.deaths++; setTimeout(() => { S.over = true; sheetOver(); }, 900); }
function shoot() { if (P.power < 2 || G.pearls.length >= 3) return; G.pearls.push({ x: P.x + 11 + P.face * 14, y: P.y + 10, vx: P.face * 7, vy: -1, life: 110 }); sfx.pearl(); }
function bonk(l) {
  l.bump = -9;
  if (l.state !== 'dark' || l.cd > 0) return;
  l.cd = 40; spark(l.x + 15, l.y + 30, '#f2c66d', 8, 2);
  openQuiz(l.q, { lantern: l });
}

/* ---------- 绘制 ---------- */
const cv = $('#cv'), ctx = cv.getContext('2d');
let grain = null;
function mkGrain() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 16; } x.putImageData(d, 0, 0); grain = ctx.createPattern(c, 'repeat'); }
function resize() {
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (r.width < 2 || r.height < 2) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const base = FX.ok && r.width > r.height * 1.25 ? 384 : 450;   // v3:横屏镜头拉近
  let sc = r.height / base; VW = r.width / sc; VH = base;
  if (VW < 480) { sc = r.width / 480; VW = 480; VH = r.height / sc; }
  OY = VH - 450; scale = sc * dpr; mkGrain(); FX.resize(r.width, r.height);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function glow(x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function draw() {
  const t = S.t, W = VW, H = VH;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  // 天
  const sg = ctx.createLinearGradient(0, 0, 0, H - 40); sg.addColorStop(0, TH.sky[0]); sg.addColorStop(.55, TH.sky[1]); sg.addColorStop(1, TH.sky[2]); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; for (const s of G.stars) { const a = TH.stars * (.35 + .65 * Math.abs(Math.sin(t * .012 + s[3]))) * (1 - s[1]); if (a < .03) continue; ctx.globalAlpha = a; ctx.fillRect(((s[0] * 1400 - cam * .04) % W + W) % W, s[1] * H, s[2], s[2]); } ctx.globalAlpha = 1;
  const ox = W * TH.orb[1] - cam * .03, oy = OY + 450 * TH.orb[2], or = TH.orb[3];
  ctx.globalCompositeOperation = 'lighter'; glow(ox, oy, or * 5, hex(TH.orb[0]), .28); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = TH.orb[0]; ctx.beginPath(); ctx.arc(ox, oy, or, 0, 6.29); ctx.fill();
  // 远山
  const par = [.12, .26, .46], base = [300, 330, 356], amp = [120, 96, 70];
  for (let k = 0; k < 3; k++) {
    const pts = G.ridges[k], period = 1600, stepx = period / 40, off = ((cam * par[k]) % period + period) % period;
    ctx.fillStyle = TH.layers[k]; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = -stepx; x <= W + stepx; x += stepx / 2) { const u = (x + off) / stepx, i0 = Math.floor(u), f = u - i0, a = pts[((i0 % 40) + 40) % 40], b = pts[(((i0 + 1) % 40) + 40) % 40], s = f * f * (3 - 2 * f); ctx.lineTo(x, OY + base[k] - (a + (b - a) * s) * amp[k]); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    const mg = ctx.createLinearGradient(0, OY + base[k] - 30, 0, OY + base[k] + 60); mg.addColorStop(0, 'rgba(' + TH.mist + ',0)'); mg.addColorStop(1, 'rgba(' + TH.mist + ',' + (.16 - k * .04) + ')'); ctx.fillStyle = mg; ctx.fillRect(0, OY + base[k] - 30, W, 90);
  }
  // 浮尘
  ctx.globalCompositeOperation = 'lighter';
  for (const m of G.motes) { const x = ((m[0] - cam * m[2] + t * .12 * m[2]) % (W + 40) + W + 40) % (W + 40) - 20, y = OY + m[1] + Math.sin(t * .015 + m[3]) * 14; glow(x, y, m[4] * 5, TH.mote, .22 * (.5 + .5 * Math.sin(t * .03 + m[3]))); }
  ctx.globalCompositeOperation = 'source-over';
  // 世界
  const shx = S.shake ? (Math.random() - .5) * S.shake : 0, shy = S.shake ? (Math.random() - .5) * S.shake : 0;
  ctx.save(); ctx.translate(-Math.round(cam * scale) / scale + shx, OY + shy);
  const vis = o => o.x + (o.w || 0) > cam - 120 && o.x < cam + W + 120;
  drawGate(G.gate, t);
  for (const s of G.steles) if (vis(s)) drawStele(s);
  for (const f of G.floats) if (vis(f)) { ctx.fillStyle = TH.ground; rr(f.x, f.y, f.w, f.h, 4); ctx.fill(); ctx.fillStyle = TH.rim; ctx.globalAlpha = .75; ctx.fillRect(f.x + 4, f.y, f.w - 8, 1.5); ctx.globalAlpha = 1; }
  for (const s of G.ground) if (vis(s)) { ctx.fillStyle = TH.ground; ctx.fillRect(s.x, s.y, s.w, H); const eg = ctx.createLinearGradient(0, s.y, 0, s.y + 26); eg.addColorStop(0, 'rgba(' + hex(TH.rim) + ',.34)'); eg.addColorStop(1, 'rgba(' + hex(TH.rim) + ',0)'); ctx.fillStyle = eg; ctx.fillRect(s.x, s.y, s.w, 26); ctx.fillStyle = TH.rim; ctx.globalAlpha = .8; ctx.fillRect(s.x, s.y, s.w, 1.5); ctx.globalAlpha = 1; }
  ctx.strokeStyle = TH.ground; ctx.lineWidth = 1.1; ctx.beginPath(); for (const tf of G.tufts) if (tf[0] > cam - 20 && tf[0] < cam + W + 20) { const sw = Math.sin(t * .03 + tf[0] * .05) * 1.6; ctx.moveTo(tf[0], GY + 1); ctx.quadraticCurveTo(tf[0] + tf[2] * 2, GY - tf[1] * .5, tf[0] + tf[2] * 3 + sw, GY - tf[1] * .8); } ctx.stroke();
  for (const l of G.lanterns) if (vis(l)) drawLantern(l, t);
  ctx.globalCompositeOperation = 'lighter'; for (const f of G.flies) if (!f.got && f.x > cam - 20 && f.x < cam + W + 20) { const y = f.y + Math.sin(t * .06 + f.ph) * 4; glow(f.x, y, 11, TH.mote, .5); ctx.fillStyle = '#fff6dc'; ctx.fillRect(f.x - 1, y - 1, 2, 2); } ctx.globalCompositeOperation = 'source-over';
  for (const e of G.enemies) if (vis(e)) drawEnemy(e, t);
  drawPlayer(t);
  ctx.globalCompositeOperation = 'lighter'; for (const b of G.pearls) { glow(b.x, b.y, 14, '255,236,180', .7); ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, 6.29); ctx.fill(); }
  for (const p of G.parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill(); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.font = '600 13px ' + SERIF; ctx.textAlign = 'center'; for (const tx of G.texts) { ctx.globalAlpha = clamp(tx.life / 30, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(tx.text, tx.x + 1, tx.y + 1); ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y); } ctx.globalAlpha = 1;
  ctx.restore();
  // 暗角与纸纹
  const vg = ctx.createRadialGradient(W / 2, H * .52, H * .35, W / 2, H * .52, Math.max(W, H) * .78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (grain) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = grain; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; }
}
const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Noto Serif SC",Georgia,serif', MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
const hexCache = {}; function hex(h) { return hexCache[h] || (hexCache[h] = parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16)); }
function drawStele(s) {
  ctx.fillStyle = TH.layers[2]; ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h); ctx.lineTo(s.x, s.y + 12); ctx.quadraticCurveTo(s.x + s.w / 2, s.y - 8, s.x + s.w, s.y + 12); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = TH.rim; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.x + .6, s.y + s.h); ctx.lineTo(s.x + .6, s.y + 12); ctx.quadraticCurveTo(s.x + s.w / 2, s.y - 8, s.x + s.w - .6, s.y + 12); ctx.stroke();
  ctx.save(); ctx.translate(s.x + s.w / 2 + 3.5, s.y + s.h - 8); ctx.rotate(-Math.PI / 2); ctx.font = '10px ' + MONO; ctx.textAlign = 'left'; ctx.fillStyle = TH.rim; ctx.globalAlpha = .7; ctx.fillText(s.label, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
}
function drawLantern(l, t) {
  const sway = Math.sin(t * .025 + l.x) * 1.2, x = l.x + sway, y = l.y + l.bump, cx = x + 15, lit = l.state !== 'dark';
  ctx.strokeStyle = 'rgba(' + hex(TH.rim) + ',.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(l.x + 15, -OY - 10); ctx.lineTo(cx, y - 3); ctx.stroke();
  if (lit) { const c = l.state === 'gold' ? '255,206,120' : l.state === 'lit' ? '230,180,110' : '200,90,70', a = (l.state === 'gold' ? .5 : l.state === 'lit' ? .32 : .2) * l.glow * (.9 + .1 * Math.sin(t * .08 + l.x)); ctx.globalCompositeOperation = 'lighter'; glow(cx, y + 15, 96, c, a); glow(cx, GY - 2, 70, c, a * .35); ctx.globalCompositeOperation = 'source-over'; }
  else { ctx.globalCompositeOperation = 'lighter'; glow(cx, y + 15, 34, hex(TH.rim), .1 + .06 * Math.sin(t * .06 + l.x)); ctx.globalCompositeOperation = 'source-over'; }
  ctx.beginPath(); ctx.moveTo(x + 7, y + 3); ctx.bezierCurveTo(x - 3, y + 8, x - 3, y + 22, x + 7, y + 27); ctx.lineTo(x + 23, y + 27); ctx.bezierCurveTo(x + 33, y + 22, x + 33, y + 8, x + 23, y + 3); ctx.closePath();
  if (lit) { const g = ctx.createRadialGradient(cx, y + 15, 2, cx, y + 15, 18); const c = l.state === 'dim' ? ['#e9a28f', '#8a3d32'] : l.state === 'lit' ? ['#f6e2b4', '#b98a48'] : ['#fff4cf', '#e2a24a']; g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); ctx.fillStyle = g; } else ctx.fillStyle = '#231d19';
  ctx.fill(); ctx.strokeStyle = lit ? 'rgba(90,50,20,.5)' : 'rgba(' + hex(TH.rim) + ',.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); for (const k of [-6, 0, 6]) { ctx.moveTo(cx + k, y + 3); ctx.quadraticCurveTo(cx + k * 1.9, y + 15, cx + k, y + 27); } ctx.stroke();
  ctx.fillStyle = lit ? '#6b4a22' : '#3a3029'; ctx.fillRect(x + 7, y, 16, 3.5); ctx.fillRect(x + 8, y + 26.5, 14, 3.5);
  ctx.strokeStyle = lit ? '#d9a860' : 'rgba(' + hex(TH.rim) + ',.5)'; ctx.beginPath(); ctx.moveTo(cx, y + 30); ctx.lineTo(cx + sway * 1.5, y + 40); ctx.stroke();
  if (!lit) { ctx.font = '600 13px ' + SERIF; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(' + hex(TH.rim) + ',' + (.78 + .2 * Math.sin(t * .06 + l.x)) + ')'; ctx.fillText('?', cx, y + 20); }
}
function drawGate(g, t) {
  const x = g.x, y = g.y, w = g.w, h = g.h, o = g.open;
  if (o > 0) { ctx.globalCompositeOperation = 'lighter'; glow(x + w / 2, y + h * .6, 170, '255,220,150', .42 * o); const lg = ctx.createLinearGradient(0, y + 26, 0, y + h); lg.addColorStop(0, 'rgba(255,236,190,' + .85 * o + ')'); lg.addColorStop(1, 'rgba(255,190,110,' + .35 * o + ')'); ctx.fillStyle = lg; ctx.fillRect(x + 14, y + 26, w - 28, h - 26); ctx.globalCompositeOperation = 'source-over'; }
  ctx.fillStyle = TH.ground; ctx.fillRect(x + 4, y + 20, 10, h - 20); ctx.fillRect(x + w - 14, y + 20, 10, h - 20);
  ctx.beginPath(); ctx.moveTo(x - 20, y + 8); ctx.quadraticCurveTo(x + w / 2, y - 6, x + w + 20, y + 8); ctx.lineTo(x + w + 12, y + 18); ctx.lineTo(x - 12, y + 18); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 4, y + 26, w + 8, 7);
  ctx.strokeStyle = TH.rim; ctx.globalAlpha = .6; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 20, y + 8); ctx.quadraticCurveTo(x + w / 2, y - 6, x + w + 20, y + 8); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = '600 11px ' + SERIF; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(' + hex(TH.rim) + ',' + (.5 + .4 * o) + ')'; ctx.fillText('山 门', x + w / 2, y + 17);
}
function drawEnemy(e, t) {
  if (!e.alive && e.dead <= 0) return;
  const cx = e.x + e.w / 2, by = e.y + e.h, dir = e.vx < 0 ? -1 : 1;
  ctx.save(); ctx.translate(cx, by);
  if (!e.alive) { ctx.globalAlpha = e.dead / 34; ctx.scale(1.25, .3); }
  if (e.hurt > 0 && e.alive) ctx.scale(1.08, .9);
  const body = e.kind === 'boss' ? '#3b1220' : e.kind === 'hopper' ? '#2f2a12' : e.kind === 'flyer' ? '#2a1c33' : '#34141a';
  const rim = e.kind === 'boss' ? '#ff8a70' : e.kind === 'hopper' ? '#d9c36a' : e.kind === 'flyer' ? '#c9a2f0' : '#e07a6a';
  const w = e.w, h = e.h;
  if (e.kind === 'flyer') {
    const fl = Math.sin(t * .5) * .8; ctx.fillStyle = 'rgba(' + hex(rim) + ',.38)';
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(-.5 + fl * .5); ctx.beginPath(); ctx.ellipse(9, -h * .7, 12, 5.5, -.3, 0, 6.29); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -h / 2, 6, h / 2, 0, 0, 6.29); ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 1; ctx.stroke();
  } else {
    const squat = e.kind === 'hopper' ? 1 + clamp(-e.vy * .03, -.2, .25) : 1;
    ctx.strokeStyle = rim; ctx.lineWidth = e.kind === 'boss' ? 2 : 1.2; ctx.globalAlpha *= .8; ctx.beginPath();
    for (let i = -1; i <= 1; i++) { const lx = i * w * .26, sw = Math.sin(t * .35 + i * 2) * (e.kind === 'boss' ? 4 : 2.2); ctx.moveTo(lx, -h * .3); ctx.lineTo(lx + sw - 3, 0); ctx.moveTo(lx, -h * .3); ctx.lineTo(lx + sw + 3, 0); }
    ctx.moveTo(dir * w * .36, -h * .8); ctx.quadraticCurveTo(dir * w * .56, -h * 1.12, dir * w * .62, -h * .86 + Math.sin(t * .1) * 2); ctx.stroke(); ctx.globalAlpha = e.alive ? 1 : e.dead / 34;
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -h * .5 * squat - 1, w / 2, h * .5 * squat, 0, 0, 6.29); ctx.fill();
    const sg2 = ctx.createLinearGradient(0, -h, 0, -h * .3); sg2.addColorStop(0, 'rgba(' + hex(rim) + ',.75)'); sg2.addColorStop(1, 'rgba(' + hex(rim) + ',0)'); ctx.strokeStyle = sg2; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, -h * .5 * squat - 1, w / 2 - .7, h * .5 * squat - .7, 0, Math.PI, 6.29); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + hex(rim) + ',.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-dir * 2, -h * squat); ctx.lineTo(-dir * 2, -3); ctx.stroke();
    if (e.kind === 'boss') { ctx.fillStyle = rim; ctx.beginPath(); ctx.moveTo(dir * w * .3, -h * .9); ctx.lineTo(dir * w * .52, -h * 1.3); ctx.lineTo(dir * w * .42, -h * .82); ctx.closePath(); ctx.fill(); }
  }
  ctx.fillStyle = e.kind === 'boss' && e.hp <= 3 ? '#ffd0a0' : '#fff2d8'; const ey = e.kind === 'flyer' ? -h * .72 : -h * .62, er = e.kind === 'boss' ? 3 : 1.5;
  ctx.beginPath(); ctx.arc(dir * w * .24, ey, er, 0, 6.29); ctx.arc(dir * w * .4, ey + 1, er * .8, 0, 6.29); ctx.fill();
  ctx.restore();
  if (e.kind === 'boss' && e.alive) { const bw = 70, bx = cx - bw / 2, byy = e.y - 30; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx, byy, bw, 3); ctx.fillStyle = rim; ctx.fillRect(bx, byy, bw * e.hp / e.maxHp, 3); ctx.font = '11px ' + SERIF; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(' + hex(rim) + ',.9)'; ctx.fillText('大 蠹', cx, byy - 6); }
}
function drawPlayer(t) {
  if (P.inv > 0 && P.alive && Math.floor(P.inv / 4) % 2 === 0) return;
  const hx = P.x + 11, hy = P.y + 12, T = P.tail;
  ctx.globalCompositeOperation = 'lighter'; glow(hx, hy, 44, '134,216,174', .22); ctx.globalCompositeOperation = 'source-over';
  for (let i = T.length - 1; i >= 0; i--) { const s = T[i], r = 8.2 - i * .85; ctx.fillStyle = i % 2 ? '#3f9f78' : '#55b98d'; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.29); ctx.fill(); ctx.fillStyle = 'rgba(210,255,230,.28)'; ctx.beginPath(); ctx.arc(s.x - 1, s.y - r * .4, r * .45, 0, 6.29); ctx.fill(); }
  const stretch = clamp(1 - P.vy * .012, .86, 1.16);
  ctx.save(); ctx.translate(hx, hy + 1); ctx.scale(1 / stretch, stretch);
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 12.5); g.addColorStop(0, '#c9f5dc'); g.addColorStop(.55, '#6fd0a2'); g.addColorStop(1, '#2f8f69'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 11.5, 10.5, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#f3e3bd'; ctx.beginPath(); ctx.ellipse(P.face * 2, 6.2, 6, 2.6, 0, 0, 6.29); ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
  const blink = (t % 210) < 6;
  ctx.fillStyle = '#13251d'; if (blink) ctx.fillRect(P.face * 4.5 - 2.2, -2.4, 4.4, 1.2); else { ctx.beginPath(); ctx.ellipse(P.face * 4.6, -2, 2.1, 2.7, 0, 0, 6.29); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(P.face * 4.6 + .2, -3.4, 1.1, 1.1); }
  if ((t % 150) < 14 && P.grounded) { ctx.strokeStyle = '#e88f84'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(P.face * 10.5, 2.6); ctx.lineTo(P.face * 15, 2.2); ctx.lineTo(P.face * 17, .6); ctx.moveTo(P.face * 15, 2.2); ctx.lineTo(P.face * 17, 3.8); ctx.stroke(); }
  ctx.restore();
  if (P.power >= 1) { ctx.strokeStyle = 'rgba(242,214,150,' + (.55 + .2 * Math.sin(t * .1)) + ')'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(hx, hy + 1, 17, 0, 6.29); ctx.stroke(); }
  if (P.power >= 2) { const a = t * .09, px = hx + Math.cos(a) * 21, py = hy + Math.sin(a) * 9 - 2; ctx.globalCompositeOperation = 'lighter'; glow(px, py, 10, '255,236,180', .8); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 6.29); ctx.fill(); }
}

/*FX*/
/*MUS*/
/* ---------- 主循环 ---------- */
let acc = 0, lastTs = 0;
function frame(ts) { let dt = lastTs ? ts - lastTs : 16.67; lastTs = ts; if (dt > 100) dt = 100; acc += dt; let n = 0; while (acc >= 16.6667 && n < 6) { if (S.hitstop > 0) S.hitstop--; else step(); acc -= 16.6667; n++; } if (n === 6) acc = 0; }
function loop(ts) { frame(ts); if (FX.ok) { if (!RS.open) FX.draw(); } else draw(); requestAnimationFrame(loop); }   // 刷卡时世界定格,不白烧显卡

/* ---------- HUD / 提示 ---------- */
function hud() {
  $('#lessonTitle').textContent = '第' + cnNum(L.day) + '夜 · ' + L.title;
  $('#pips').innerHTML = G.lanterns.map(l => '<i class="' + (l.state === 'dark' ? '' : l.state) + '"></i>').join('');
  $('#hearts').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < P.hearts ? '' : 'off') + '"></i>').join('');
  $('#padFire').classList.toggle('ready', P.power >= 2); hudLite();
}
function hudLite() { $('#fireN').textContent = save.fire; $('#streakN').textContent = save.streak.n; }
let toastT = 0; function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }

/* ---------- 卷宗(弹层) ---------- */
const scrim = $('#scrim'), sheet = $('#sheet');
function sheetFx(c) { sheet.classList.remove('fxok', 'fxno'); void sheet.offsetWidth; sheet.classList.add(c); }
function openSheet(name, html, modal) { S.sheet = name; S.modal = !!modal; S.paused = true; sheet.className = 'k-' + name; scrim.className = 'k-' + name; sheet.innerHTML = html; scrim.hidden = false; sheet.scrollTop = 0; Object.keys(keys).forEach(k => keys[k] = false); P.jumpHeld = false; }
function closeSheet() { scrim.hidden = true; sheet.innerHTML = ''; S.sheet = null; S.quiz = null; if (!S.over && !S.clear) S.paused = false; lastTs = 0; acc = 0; }
scrim.addEventListener('pointerdown', e => { if (e.target === scrim && !S.modal) closeSheet(); });
const on = (sel, fn) => { const el = sheet.querySelector(sel); if (el) el.addEventListener('click', e => { sfx.init(); fn(e); }); };

/* ---------- 答题 ---------- */
const mastery = id => save.q[id] || (save.q[id] = { box: 0, right: 0, wrong: 0, last: '' });
function solution(q) { return q.type === 'fill' ? q.answers[0] : q.type === 'order' ? q.lines.map((_, i) => i) : q.correct; }
function grade(q, r) {
  if (q.type === 'fill') { const n = String(r == null ? '' : r).replace(/\s+/g, ''); return q.answers.some(a => a.replace(/\s+/g, '') === n); }
  if (q.type === 'order') return Array.isArray(r) && r.length === q.lines.length && r.every((v, i) => v === i);
  return r === q.correct;
}
function shuffled(n, rnd) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function openQuiz(q, ctxq) {
  const Q = S.quiz = { q, ctx: ctxq || {}, tries: 0, done: false, sel: null, order: null }; FX.focusOn(Q.ctx.lantern);
  const kind = { choice: '择 一', output: '读 码', fill: '补 全', bugline: '寻 蠹', order: '排 序' }[q.type];
  let body = '';
  if (q.type === 'choice' || q.type === 'output') {
    Q.order = shuffled(q.options.length, Math.random);
    if (q.code) body += '<pre class="code">' + hl(q.code) + '</pre>';
    const prose = q.type === 'choice' && q.options.some(o => /[一-龥]/.test(o));
    body += '<div class="opts">' + Q.order.map(i => '<button class="opt' + (prose ? ' prose' : '') + '" data-i="' + i + '">' + esc(q.options[i]) + '</button>').join('') + '</div>';
  } else if (q.type === 'fill') {
    const parts = q.code.split('____');
    body += '<pre class="code">' + hl(parts[0]) + '<input class="fillin" id="fillin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="填空">' + hl(parts[1]) + '</pre>';
  } else if (q.type === 'bugline') {
    body += '<div class="lines">' + q.code.split('\n').map((ln, i) => '<div class="ln" data-i="' + i + '"><span class="no">' + (i + 1) + '</span><span>' + (hl(ln) || ' ') + '</span></div>').join('') + '</div>';
  } else {
    do { Q.order = shuffled(q.lines.length, Math.random); } while (Q.order.every((v, i) => v === i));
    body += (q.pre ? '<pre class="code">' + hl(q.pre) + '</pre>' : '') + '<div class="lines" id="ordbox"></div><div class="note">点一行,再点另一行,两行互换。</div>';
  }
  openSheet('quiz', '<div class="concept">' + kind + ' · ' + esc(q.concept) + '</div><div class="qtext">' + fmt(q.q) + '</div>' + body + '<div id="fb"></div><div class="row"><button class="lk" id="qSkip">' + (Q.ctx.lantern ? '稍后再答' : '跳过') + '</button><button class="lk" id="qHint">提示</button><span class="sp"></span><button class="gbtn" id="qGo">落 笔</button></div>', true);
  sheet.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { if (Q.done) return; Q.sel = +b.dataset.i; sheet.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', x === b)); }));
  sheet.querySelectorAll('.ln[data-i]').forEach(b => b.addEventListener('click', () => { if (Q.done || q.type !== 'bugline') return; Q.sel = +b.dataset.i; sheet.querySelectorAll('.ln').forEach(x => x.classList.toggle('sel', x === b)); }));
  if (q.type === 'order') renderOrder();
  if (q.type === 'fill') { const inp = $('#fillin'); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitAnswer(inp.value); } }); }
  on('#qGo', () => { if (Q.done) return finishQuiz(); const r = q.type === 'fill' ? $('#fillin').value : q.type === 'order' ? Q.order.slice() : Q.sel; submitAnswer(r); });
  on('#qHint', () => { if (!Q.done) feedback('', '提 示', q.hint || '再读一遍代码,逐行在心里执行。'); });
  on('#qSkip', () => { if (Q.done) return finishQuiz(); Q.result = 'skipped'; finishQuiz(); });
}
function renderOrder() {
  const Q = S.quiz, box = $('#ordbox'); let pick = null;
  const paint = () => { box.innerHTML = Q.order.map((li, pos) => '<div class="ln' + (pos === pick ? ' sel' : '') + '" data-p="' + pos + '"><span class="no">' + (pos + 1) + '</span><span>' + hl(Q.q.lines[li]) + '</span></div>').join(''); box.querySelectorAll('.ln').forEach(el => el.addEventListener('click', () => { if (Q.done) return; const p = +el.dataset.p; if (pick === null) pick = p; else { [Q.order[pick], Q.order[p]] = [Q.order[p], Q.order[pick]]; pick = null; } paint(); })); };
  paint();
}
function feedback(cls, title, text) { $('#fb').innerHTML = '<div class="fb ' + cls + '"><span class="t">' + title + '</span>' + fmt(text) + '</div>'; const s = $('#sheet'); s.scrollTop = s.scrollHeight; }
function submitAnswer(r) {
  const Q = S.quiz; if (!Q || Q.done) return null; const q = Q.q;
  if (r === null || r === undefined || r === '') { feedback('', '未 落 笔', '先给出你的答案。'); return null; }
  const ok = grade(q, r), m = mastery(q.id); Q.tries++; m.last = today();
  if (ok) {
    Q.done = true; Q.result = Q.tries === 1 ? 'first' : 'second';
    if (Q.tries === 1) { m.box = Math.min(3, m.box + 1); m.right++; } else { m.box = Math.max(1, Math.min(m.box, 1)); }
    sfx.bell(); markAnswer(q, true); FX.burst(Q.tries === 1 ? 'gold' : 'ok'); sheetFx('fxok');
    feedback('ok', Q.tries === 1 ? '一 笔 即 中' : '二 笔 得 之', q.explain || '正确。');
  } else if (Q.tries >= 2) {
    Q.done = true; Q.result = 'revealed'; m.box = 0; m.wrong++; sfx.wrong(); markAnswer(q, false); FX.burst('no'); sheetFx('fxno');
    const ans = q.type === 'fill' ? '应填 `' + q.answers[0] + '`。' : q.type === 'bugline' ? '问题在第 ' + (q.correct + 1) + ' 行。' : q.type === 'order' ? '正确顺序已排好。' : '';
    feedback('no', '此 灯 残 明', ans + (q.explain || '') + ' 这一题已记入温书,之后会再遇到。');
  } else { m.wrong++; sfx.wrong(); FX.burst('no'); sheetFx('fxno'); feedback('no', '未 中 · 尚 可 再 试', q.hint || '再想一想。'); }
  persist();
  if (Q.done) { $('#qGo').textContent = Q.ctx.lantern ? '回 到 路 上' : '继 续'; const sk = $('#qSkip'), hi = $('#qHint'); if (sk) sk.hidden = true; if (hi) hi.hidden = true; const inp = $('#fillin'); if (inp) inp.disabled = true; }
  return Q.result || 'retry';
}
function markAnswer(q, ok) {
  if (q.type === 'choice' || q.type === 'output') sheet.querySelectorAll('.opt').forEach(b => { const i = +b.dataset.i; b.classList.remove('sel'); b.classList.add(i === q.correct ? 'ok' : 'no'); });
  else if (q.type === 'bugline') sheet.querySelectorAll('.ln').forEach(b => { const i = +b.dataset.i; b.classList.remove('sel'); if (i === q.correct) b.classList.add('ok'); else if (!ok && i === S.quiz.sel) b.classList.add('bad'); });
  else if (q.type === 'order') { S.quiz.order = q.lines.map((_, i) => i); renderOrder(); }
  else if (q.type === 'fill') { const inp = $('#fillin'); if (inp && !ok) inp.value = q.answers[0]; }
}
function finishQuiz() {
  const Q = S.quiz; if (!Q) return; const res = Q.result || 'skipped', l = Q.ctx.lantern, cb = Q.ctx.onDone;
  closeSheet();
  if (l) {
    if (res === 'skipped') { toast('灯未点亮 · 随时可以回来再顶一次'); }
    else {
      l.state = res === 'first' ? 'gold' : res === 'second' ? 'lit' : 'dim'; l.res = res; P.cp = { x: l.x + 4 };
      spark(l.x + 15, l.y + 15, '#ffd98a', res === 'revealed' ? 8 : 40, 5); if (res !== 'revealed') { FX.burst(res === 'first' ? 'gold' : 'ok'); S.shake = 5; }
      if (res === 'first') { S.score += 500; if (P.power < 2) { P.power++; floatText(P.x + 11, P.y - 12, P.power === 1 ? '得 护身' : '得 吐珠', '#f2d9a0'); if (P.power === 2) toast(matchMedia('(pointer:coarse)').matches ? '得吐珠 · 点「珠」发射' : '得吐珠 · 按 J 发射'); } else { S.score += 300; floatText(P.x + 11, P.y - 12, '+300', '#f2d9a0'); } }
      else if (res === 'second') { S.score += 200; if (P.hearts < 3) { P.hearts++; floatText(P.x + 11, P.y - 12, '回 一 命', '#bfe8cf'); } }
      hud();
    }
  }
  if (cb) cb(res);
}

/* ---------- 过关 / 失败 ---------- */
function starsOf() { const n = G.lanterns.length, first = G.lanterns.filter(l => l.res === 'first').length; return first === n ? 3 : first / n >= .6 ? 2 : 1; }
function levelClear() {
  S.clear = true; S.paused = true; sfx.clear();
  const t = today(), st = save.streak; if (st.last !== t) { st.n = (st.last && dayDiff(st.last, t) === 1) ? st.n + 1 : 1; st.last = t; }
  const stars = starsOf(), b = save.best[L.day] || { stars: 0, score: 0 }; save.best[L.day] = { stars: Math.max(b.stars, stars), score: Math.max(b.score, S.score) };
  const idx = lessons.indexOf(L), next = lessons[idx + 1]; save.cur = next ? next.day : L.day; persist(); hudLite();
  const missed = G.lanterns.filter(l => l.res !== 'first');
  setTimeout(() => {
    openSheet('clear', '<div class="concept">第' + cnNum(L.day) + '夜 · ' + esc(TH.name) + '</div><div class="big">过 山 门</div><div class="stars">' + '★'.repeat(stars) + '<span class="o">' + '★'.repeat(3 - stars) + '</span></div>'
      + '<div class="kv"><span>称号</span><span>' + esc(L.badge) + '</span><span>得分</span><span>' + S.score + '</span><span>除蠹</span><span>' + S.bugs + '</span><span>连日</span><span>' + save.streak.n + ' 天</span></div><div class="rule"></div>'
      + '<ul class="clist">' + G.lanterns.map(l => '<li><span class="mk' + (l.res === 'first' ? '' : ' x') + '">' + (l.res === 'first' ? '✓' : l.res === 'second' ? '△' : '✗') + '</span><span>' + esc(l.q.concept) + '</span></li>').join('') + '</ul>'
      + (missed.length ? '<p class="note">有 ' + missed.length + ' 处没有一笔即中,已记入温书。</p>' : '<p class="note">诸灯皆一笔点亮。</p>')
      + '<div class="row">' + (missed.length ? '<button class="lk" id="cReview">现在温书</button>' : '') + '<button class="lk" id="cAgain">再走一遍</button><span class="sp"></span><button class="gbtn" id="cNext">' + (next ? '下 一 夜' : '回 行 程') + '</button></div>', true);
    on('#cAgain', () => start(L.day)); on('#cNext', () => next ? start(next.day) : (start(L.day), sheetMap())); on('#cReview', () => { start(next ? next.day : L.day); sheetReview(); });
  }, 700);
}
function sheetOver() {
  openSheet('over', '<div class="concept">第' + cnNum(L.day) + '夜</div><div class="big">灯 灭</div><p class="note">调试往往不是一次成的。已点亮的灯记在温书里,再走一遍会更快。</p><div class="row"><button class="lk" id="oCodex">先翻宝典</button><span class="sp"></span><button class="gbtn" id="oAgain">再 走 一 遍</button></div>', true);
  on('#oAgain', () => start(L.day)); on('#oCodex', () => { start(L.day); sheetCodex(L.day); });
}
function titleCard() { const el = $('#title'); if (!el) return; el.querySelector('b').textContent = TH.name; el.querySelector('span').textContent = '第' + cnNum(L.day) + '夜 · ' + L.title; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function start(day) { closeSheet(); buildLevel(day); S.paused = false; save.cur = L.day; persist(); titleCard(); }

/* ---------- 菜单 / 行程 / 宝典 / 温书 / 同步 ---------- */
function sheetMenu() {
  openSheet('menu', '<h2>卷 宗</h2><div class="sub">第' + cnNum(L.day) + '夜 · ' + esc(L.title) + '</div><div class="menu"><button class="gbtn wide" id="mReel">刷 卡 · ' + CARDS.length + ' 张</button><button class="gbtn" id="mMap">行 程</button><button class="gbtn" id="mCodex">宝 典</button><button class="gbtn" id="mReview">温 书</button><button class="gbtn" id="mSync">同步新课</button></div><div class="rule"></div>'
    + '<div class="keys">移动 <kbd>A</kbd> <kbd>D</kbd> 或方向键 · 跳 <kbd>空格</kbd>(按得久跳得高)· 吐珠 <kbd>J</kbd> · 暂停 <kbd>P</kbd><br>从下方顶灯笼答题。一笔即中得护身,再中得吐珠。诸灯皆亮,山门才开。</div>'
    + '<div class="row"><button class="lk" id="mSound">声音:' + (save.sound ? '开' : '关') + '</button><button class="lk" id="mRestart">重走本夜</button><span class="sp"></span><button class="gbtn" id="mBack">继 续</button></div>');
  on('#mReel', openReel); on('#mMap', sheetMap); on('#mCodex', () => sheetCodex(L.day)); on('#mReview', sheetReview); on('#mSync', sheetSync);
  on('#mSound', () => { save.sound = !save.sound; persist(); mus.vol(); sheetMenu(); }); on('#mRestart', () => start(L.day)); on('#mBack', closeSheet);
}
function lessonMastery(l) { const n = l.quizzes.length, ok = l.quizzes.filter(q => (save.q[q.id] || {}).box >= 2).length; return ok + '/' + n; }
function sheetMap() {
  openSheet('map', '<h2>行 程</h2><div class="sub">一夜一课。星看一笔即中的比例,右侧是已记牢的题数。</div>' + lessons.map(l => { const b = save.best[l.day] || { stars: 0 }; return '<div class="night' + (l.day === L.day ? ' cur' : '') + '" data-d="' + l.day + '"><span class="n">' + cnNum(l.day) + '</span><span class="m"><b>' + esc(l.title) + '</b><span>' + esc(THEMES[l.theme].name) + ' · ' + esc(l.badge) + (l.custom ? ' · 外来' : '') + (l.boss ? ' · 关底有大蠹' : '') + '</span></span><span class="r"><span class="stars">' + '★'.repeat(b.stars) + '<span class="o">' + '★'.repeat(3 - b.stars) + '</span></span><br>' + lessonMastery(l) + '</span></div>'; }).join('') + '<div class="row"><button class="gbtn ghost" id="xBack">返 回</button></div>');
  sheet.querySelectorAll('.night').forEach(el => el.addEventListener('click', () => start(+el.dataset.d))); on('#xBack', sheetMenu);
}
function sheetCodex(day) {
  const l = lessonOf(day);
  openSheet('codex', '<h2>宝 典</h2><div class="tabs">' + lessons.map(x => '<button class="tab' + (x.day === l.day ? ' on' : '') + '" data-d="' + x.day + '">第' + cnNum(x.day) + '夜</button>').join('') + '</div><div class="concept">' + esc(l.badge) + (l.en ? ' · ' + esc(l.en) : '') + '</div><div class="qtext">' + esc(l.title) + '</div><p class="note">' + esc(l.intro) + '</p>'
    + (l.cheatsheet ? '<pre class="code">' + hl(l.cheatsheet) + '</pre>' : '') + '<ul class="clist">' + l.quizzes.map(q => { const m = save.q[q.id] || { box: 0 }; return '<li><span class="d">' + [1, 2, 3].map(i => '<i class="' + (m.box >= i ? 'f' : '') + '"></i>').join('') + '</span><span>' + esc(q.concept) + '</span></li>'; }).join('') + '</ul><div class="row"><button class="gbtn ghost" id="xBack">返 回</button><button class="gbtn" id="xGo">走 这 一 夜</button></div>');
  sheet.querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => sheetCodex(+el.dataset.d))); on('#xBack', sheetMenu); on('#xGo', () => start(l.day));
}
function reviewQueue() { const all = []; lessons.forEach(l => l.quizzes.forEach(q => { const m = save.q[q.id]; if (m && m.last && m.box < 3) all.push({ q, m }); })); all.sort((a, b) => a.m.box - b.m.box || (a.m.last < b.m.last ? -1 : 1)); return all.slice(0, 6).map(x => x.q); }
function sheetReview() {
  const queue = reviewQueue();
  if (!queue.length) { openSheet('review', '<h2>温 书</h2><p class="note">还没有需要温习的题。走过一夜之后,没有一笔即中的题、以及尚未记牢的题会排在这里。</p><div class="row"><button class="gbtn ghost" id="xBack">返 回</button></div>'); on('#xBack', sheetMenu); return; }
  let i = 0, good = 0; const next = () => { if (i >= queue.length) { save.fire += good * 3; persist(); hudLite(); openSheet('review', '<h2>温 书</h2><div class="big">' + good + ' / ' + queue.length + '</div><p class="note">一笔即中 ' + good + ' 题,得萤 ' + good * 3 + '。记牢三次的题会从这里退场。</p><div class="row"><button class="gbtn" id="xBack">合 卷</button></div>'); on('#xBack', closeSheet); return; } openQuiz(queue[i++], { onDone: r => { if (r === 'first') good++; next(); } }); };
  next();
}
const SPEC = '请把今天的课程按下面的 JSON 输出(只输出 JSON)。题型 type 可选:choice(概念选择)、output(读代码选输出)、fill(code 里用 ____ 留一个空,answers 给可接受答案)、bugline(code 多行,correct 为出错行号,从 0 起)、order(lines 为正确顺序的代码行,pre 为固定前置代码)。choice/output 的 correct 是正确选项下标;请把正确项放在随机位置。每课 4–6 题,题型混排,凡涉及输出的题请先实际运行确认。\n{\n  "day": 7,\n  "title": "课程标题",\n  "badge": "称号",\n  "intro": "一句话导语",\n  "cheatsheet": "# 速查代码",\n  "quizzes": [\n    {"id":"q1","type":"output","concept":"概念名","question":"题干","code":"print(1+1)","options":["2","11","3"],"correct":0,"hint":"提示","explanation":"讲解"},\n    {"id":"q2","type":"fill","concept":"概念名","question":"题干","code":"x = ____(\'3\')","answers":["int"],"hint":"提示","explanation":"讲解"}\n  ]\n}';
function sheetSync(msg, cls) {
  openSheet('sync', '<h2>同 步 新 课</h2><div class="sub">把当天课程的 JSON 贴在下面。旧格式(只有选择题)同样可用。</div><textarea class="ta" id="imp" placeholder=\'{ "day": 7, "title": "…", "quizzes": [ … ] }\' spellcheck="false" autocapitalize="off" autocorrect="off"></textarea><div id="fb">' + (msg ? '<div class="fb ' + (cls || '') + '">' + esc(msg) + '</div>' : '') + '</div>'
    + '<div class="row"><button class="lk" id="sSpec">复制给出题方的格式说明</button><span class="sp"></span><button class="gbtn ghost" id="xBack">返 回</button><button class="gbtn" id="sGo">载 入</button></div>'
    + (save.custom.length ? '<div class="rule"></div><div class="note">已载入的外来课:' + save.custom.map(c => '第' + cnNum(c.day) + '夜 <button class="lk" data-rm="' + Number(c.day) + '">移除</button>').join(' · ') + '</div>' : ''));
  on('#xBack', sheetMenu);
  on('#sSpec', () => { const done = ok => sheetSync(ok ? '格式说明已复制,发给出题方即可。' : '当前环境不允许自动复制。格式说明已填进上方文本框,可手动全选复制。', ok ? 'ok' : ''); try { navigator.clipboard.writeText(SPEC).then(() => done(true), () => { done(false); $('#imp').value = SPEC; }); } catch (e) { done(false); $('#imp').value = SPEC; } });
  on('#sGo', () => { const r = importLessons($('#imp').value); if (r.ok) { sfx.bell(); start(r.day); toast('已载入第' + cnNum(r.day) + '夜'); } else { sfx.wrong(); $('#fb').innerHTML = '<div class="fb no"><span class="t">未 能 载 入</span>' + esc(r.error) + '</div>'; } });
  sheet.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { const d = +b.dataset.rm; save.custom = save.custom.filter(c => Number(c.day) !== d); persist(); rebuildLessons(); if (!lessons.includes(L)) buildLevel(lessonOf(d).day); sheetSync('已移除。', ''); }));
}
function importLessons(text) {
  let data; try { data = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch (e) { return { ok: false, error: '不是合法的 JSON:' + e.message }; }
  const arr = Array.isArray(data) ? data : [data]; if (!arr.length) return { ok: false, error: '内容为空' };
  let last; try { arr.forEach(d => { last = normLesson(d); }); } catch (e) { return { ok: false, error: e.message }; }
  arr.forEach(d => { save.custom = save.custom.filter(c => Number(c.day) !== Number(d.day)); save.custom.push(d); });
  rebuildLessons(); if (!persist()) return { ok: true, day: last.day, warn: '本机存储不可用,刷新后需重新载入' };
  return { ok: true, day: last.day };
}
function sheetIntro() {
  openSheet('intro', '<div class="concept">Python 夜行课</div><div class="big">蟒 行 记</div><p>一条青蟒,趁夜色走一段山路。路上悬着未亮的灯,每一盏是一道 Python 题。</p><p class="note">从下方顶一下灯笼来答题。一笔即中,得护身;再中,得吐珠。答错两次,灯只残明,这一题会记入温书再来找你。所有灯都有了着落,山门才开。</p><div class="rule"></div><div class="keys">键盘:<kbd>A</kbd> <kbd>D</kbd> 移动 · <kbd>空格</kbd> 跳 · <kbd>J</kbd> 吐珠 · <kbd>P</kbd> 暂停<br>手机:屏幕下方左右与「跃」「珠」,横屏视野更宽</div><p class="note">只有一两分钟,就刷卡:一张一段代码,先看一眼,过几张它会回来问你。</p><div class="row"><button class="gbtn ghost" id="iReel">刷 一 会</button><button class="gbtn" id="iGo">启 程</button></div>', true);
  on('#iReel', () => { save.seenIntro = true; persist(); openReel(); });
  on('#iGo', () => { save.seenIntro = true; persist(); closeSheet(); titleCard(); });
}

/* ---------- 输入 ---------- */
const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
const KM = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'fire', ShiftLeft: 'fire', ShiftRight: 'fire' };
addEventListener('keydown', e => {
  if (typing(e)) return; sfx.init();
  if (RS.open) { reelKey(e); return; }
  if (e.code === 'Escape') { if (S.sheet && !S.modal) closeSheet(); else if (!S.sheet) sheetMenu(); return; }
  if (S.sheet) return;
  if (e.code === 'KeyP') { S.paused = !S.paused; toast(S.paused ? '暂停' : '继续'); lastTs = 0; return; }
  const k = KM[e.code]; if (k) { if (!(k === 'fire' && e.repeat)) keys[k] = true; e.preventDefault(); }
});
addEventListener('keyup', e => { const k = KM[e.code]; if (k && k !== 'fire') keys[k] = false; });
addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });
const padMove = $('#padMove');
function moveFrom(e) { const r = padMove.getBoundingClientRect(), leftSide = e.clientX < r.left + r.width / 2; keys.left = leftSide; keys.right = !leftSide; padMove.children[0].classList.toggle('on', leftSide); padMove.children[1].classList.toggle('on', !leftSide); }
padMove.addEventListener('pointerdown', e => { e.preventDefault(); sfx.init(); try { padMove.setPointerCapture(e.pointerId); } catch (x) {} moveFrom(e); });
padMove.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') { if (keys.left || keys.right) moveFrom(e); } });
const moveEnd = () => { keys.left = keys.right = false; padMove.children[0].classList.remove('on'); padMove.children[1].classList.remove('on'); };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => padMove.addEventListener(n, moveEnd));
const pj = $('#padJump'), pf = $('#padFire');
pj.addEventListener('pointerdown', e => { e.preventDefault(); sfx.init(); keys.jump = true; pj.classList.add('on'); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(n => pj.addEventListener(n, () => { keys.jump = false; pj.classList.remove('on'); }));
pf.addEventListener('pointerdown', e => { e.preventDefault(); sfx.init(); keys.fire = true; });
$('#pad').addEventListener('contextmenu', e => e.preventDefault());
$('#btnMenu').addEventListener('click', () => { sfx.init(); if (!S.sheet) sheetMenu(); });
addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe($('#stage'));
document.addEventListener('visibilitychange', () => { lastTs = 0; });

/* ---------- 刷卡(短卡流) ---------- */
const cardById = new Map(CARDS.map(c => [c.id, c]));
const groupName = Object.fromEntries(GROUPS);
const RS = { open: false, cur: null, last: null, busy: false, combo: 0, round: { n: 0, fresh: 0, up: 0, best: 0 }, timer: 0, map: false };
const RD = () => { if (!save.r || !save.r.c) save.r = { n: 0, day: '', today: 0, c: {} }; return save.r; };
const addDays = (d, k) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + k); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const GAP_DAYS = [0, 0, 1, 3, 8, 20];
function nextNew(rnd) {
  const r = RD(), heads = [];
  for (const [g] of GROUPS) { const c = CARDS.find(c => c.g === g && !r.c[c.id]); if (c) { heads.push(c); if (heads.length === 3) break; } }
  return heads.length ? heads[Math.floor(rnd() * heads.length)] : null;
}
function pickCard(rnd) {
  rnd = rnd || Math.random; const r = RD(), t = today(), due = [], wait = [], old = []; let learning = 0;
  for (const id in r.c) {
    const s = r.c[id]; if (!cardById.has(id) || id === RS.last) continue;
    if (s[0] <= 2) learning++;
    if (s[2] ? s[2] <= t : s[1] <= r.n) due.push([s[3] ? -1 : s[2] ? 0 : 1, s[2] || '', s[1], id]); else if (!s[2]) wait.push([s[1], id]); else old.push(id);
  }
  due.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || a[2] - b[2]);
  const late = due.filter(d => !d[1] && r.n - d[2] >= 5).sort((x, y) => x[2] - y[2])[0]; if (late) return { card: cardById.get(late[3]) };   // v3:到期的卡最多再让 5 张,不靠运气
  const fresh = nextNew(rnd);
  if (due.length && (due[0][0] < 0 || !fresh || learning >= 7 || rnd() < .72)) return { card: cardById.get(due[0][3]) };
  if (fresh) return { card: fresh };
  if (due.length) return { card: cardById.get(due[0][3]) };
  if (wait.length) { wait.sort((a, b) => a[0] - b[0]); return { card: cardById.get(wait[0][1]) }; }
  if (old.length) return { card: cardById.get(old[Math.floor(rnd() * old.length)]), extra: true };
  return { card: CARDS[Math.floor(rnd() * CARDS.length)], extra: true };
}
const showOut = a => /(Error|StopIteration)$/.test(a) ? '抛出 ' + a : a;
function buildCard(rnd) {
  rnd = rnd || Math.random; const p = pickCard(rnd), c = p.card, st = RD().c[c.id] || [0, 0, ''];
  const form = p.extra ? 'pick' : st[0] === 0 ? 'see' : st[0] === 1 ? 'tf' : 'pick';
  const cur = { card: c, form, extra: !!p.extra, stage: st[0], done: false, gold: form !== 'see' && rnd() < .125 };
  if (form === 'tf') { cur.truth = rnd() < .5; cur.claim = cur.truth ? c.a : c.d[Math.floor(rnd() * c.d.length)]; }
  if (form === 'pick') { cur.opts = [c.a].concat(c.d); for (let i = cur.opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cur.opts[i], cur.opts[j]] = [cur.opts[j], cur.opts[i]]; } }
  return cur;
}
function resolveCard(cur, ok, rnd) {
  rnd = rnd || Math.random; if (cur.done) return; cur.done = true; cur.ok = ok;
  const r = RD(), id = cur.card.id, t = today(), n = r.n, s = cur.stage; let ns;
  if (ok === 'skip') ns = [Math.max(1, s), n + 5, ''];
  else if (cur.form === 'see') { ns = [1, n + 3 + Math.floor(rnd() * 3), '']; RS.round.fresh++; }
  else if (cur.form === 'tf') ns = ok ? [2, n + 6 + Math.floor(rnd() * 4), ''] : [1, n + 3, '', 1];
  else if (cur.extra) ns = ok ? (r.c[id] || [5, 0, addDays(t, 20)]) : [2, n + 4, '', 1];
  else if (ok) { const k = Math.min(5, Math.max(3, s + 1)); ns = [k, 0, addDays(t, GAP_DAYS[k - 1] || 20)]; RS.round.up++; }
  else ns = [2, n + 4, '', 1];
  r.c[id] = ns;
  if (ok === true) { RS.combo++; RS.round.best = Math.max(RS.round.best, RS.combo); cur.gain = (cur.gold ? 5 : 1) + (RS.combo % 5 === 0 ? 2 : 0); save.fire += cur.gain; sfx.fly(RS.combo); }
  else if (ok === false) { RS.combo = 0; sfx.wrong(); }
  persist();
}
function groupStats() { const r = RD(); return GROUPS.map(([g, name]) => { const cs = CARDS.filter(c => c.g === g); return { g, name, n: cs.length, seen: cs.filter(c => r.c[c.id]).length, firm: cs.filter(c => (r.c[c.id] || [0])[0] >= 3).length }; }); }
const reel = $('#reel'), rStage = $('#rStage');
function reelHead() { $('#rFire').textContent = save.fire; const c = $('#rCombo'); c.textContent = RS.combo >= 2 ? '连对 ' + RS.combo : ''; $('#rCount').textContent = '今日 ' + RD().today + ' 张'; hudLite(); }
function paintCard(cur) {
  const c = cur.card, el = document.createElement('div'); el.className = 'rc in' + (cur.gold ? ' gold' : '');
  const label = { see: '一 瞥', tf: '判', pick: '猜' }[cur.form];
  let h = '<div class="rform">' + label + ' · ' + esc(groupName[c.g]) + (cur.gold ? '<span class="rgold">金卡 ×5</span>' : '') + '</div><pre class="code">' + hl(c.c) + '</pre>';
  if (cur.form === 'see') h += '<div class="rans wait" id="rAns"><span class="arrow">→</span><code>' + esc(showOut(c.a)) + '</code></div><div class="rwhy wait" id="rWhy">' + fmt(c.w) + '</div>';
  else if (cur.form === 'tf') h += '<div class="rq">结果是这个吗?</div><div class="rans"><span class="arrow">→</span><code>' + esc(showOut(cur.claim)) + '</code></div><div class="rwhy" id="rWhy" hidden></div><div class="ropts two"><button class="opt" data-v="1">对</button><button class="opt" data-v="0">不对</button></div>';
  else h += '<div class="rq">运行结果是?</div><div class="rwhy" id="rWhy" hidden></div><div class="ropts">' + cur.opts.map((o, i) => '<button class="opt" data-i="' + i + '">' + esc(showOut(o)) + '</button>').join('') + '</div>';
  el.innerHTML = h;
  el.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => answerCard(b)));
  return el;
}
function answerCard(b) {
  const cur = RS.cur; if (!cur || cur.done || RS.busy) return; sfx.init();
  const c = cur.card, el = rStage.querySelector('.rc:last-child'); let ok;
  if (cur.form === 'tf') { ok = (b.dataset.v === '1') === cur.truth; el.querySelectorAll('.opt').forEach(x => x.classList.add((x.dataset.v === '1') === cur.truth ? 'ok' : 'no')); }
  else { ok = cur.opts[+b.dataset.i] === c.a; el.querySelectorAll('.opt').forEach(x => x.classList.add(cur.opts[+x.dataset.i] === c.a ? 'ok' : 'no')); }
  if (!ok) b.classList.add('picked');
  resolveCard(cur, ok);
  const w = el.querySelector('#rWhy'); w.hidden = false;
  w.innerHTML = (cur.form === 'tf' && !cur.truth ? '实际:<code>' + esc(showOut(c.a)) + '</code> ' : '') + fmt(c.w) + (ok && cur.gain > 1 ? ' <span class="rgain">萤 +' + cur.gain + '</span>' : '');
  el.classList.add(ok ? 'right' : 'wrong'); reelHead();
  $('#rHint').textContent = ok ? '' : '上滑 · 继续';
  clearTimeout(RS.timer); if (ok) RS.timer = setTimeout(() => { if (RS.open && RS.cur === cur) reelNext(); }, 1350);
}
function summaryCard() {
  const el = document.createElement('div'); el.className = 'rc in sum'; const rd = RS.round, gs = groupStats(), act = gs.filter(g => g.seen && g.firm < g.n).slice(-3);
  el.innerHTML = '<div class="rform">小 结</div><div class="big">' + rd.n + ' 张</div><div class="kv"><span>新见</span><span>' + rd.fresh + '</span><span>记牢</span><span>' + rd.up + '</span><span>最长连对</span><span>' + rd.best + '</span></div>' + act.map(g => '<div class="gbar"><span>' + esc(g.name) + '</span><i><b style="width:' + Math.round(g.seen / g.n * 100) + '%"></b><em style="width:' + Math.round(g.firm / g.n * 100) + '%"></em></i><span>' + g.firm + '/' + g.n + '</span></div>').join('') + '<div class="rwhy">见过的会回来问你;答对的隔天、三天、八天再来一次,然后退场。</div>';
  RS.round = { n: 0, fresh: 0, up: 0, best: 0 }; return el;
}
function reelNext() {
  if (!RS.open || RS.busy) return; clearTimeout(RS.timer); const cur = RS.cur;
  if (cur && cur.form === 'see' && !cur.done) resolveCard(cur, null);
  if (cur && cur.form !== 'see' && cur.form !== 'sum' && !cur.done) { resolveCard(cur, 'skip'); }
  const old = rStage.querySelector('.rc'); let el;
  if (cur && cur.form !== 'sum' && RS.round.n >= 12) { RS.cur = { form: 'sum', done: true }; el = summaryCard(); }
  else { if (cur && cur.card) RS.last = cur.card.id; const r = RD(), t = today(); if (r.day !== t) { r.day = t; r.today = 0; } RS.cur = buildCard(); r.n++; r.today++; RS.round.n++; el = paintCard(RS.cur); }
  RS.busy = true; rStage.appendChild(el); if (old) old.classList.add('out');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('in')));
  setTimeout(() => { if (old) old.remove(); RS.busy = false; }, 280);
  $('#rHint').textContent = RS.cur.form === 'see' || RS.cur.form === 'sum' ? '上滑 · 下一张' : '';
  if (RS.cur.form === 'see') setTimeout(() => el.querySelectorAll('.wait').forEach(x => x.classList.remove('wait')), 650);
  reelHead();
}
function openReel() { if (S.sheet) closeSheet(); RS.open = true; RS.map = false; S.paused = true; Object.keys(keys).forEach(k => keys[k] = false); reel.hidden = false; $('#rMap').hidden = true; rStage.innerHTML = ''; RS.cur = null; RS.busy = false; RS.round = { n: 0, fresh: 0, up: 0, best: 0 }; save.seenIntro = true; reelNext(); }
function closeReel() { clearTimeout(RS.timer); const cur = RS.cur; if (cur && cur.form === 'see' && !cur.done) resolveCard(cur, null); RS.open = false; reel.hidden = true; rStage.innerHTML = ''; persist(); if (!S.sheet && !S.over && !S.clear) S.paused = false; lastTs = 0; acc = 0; hudLite(); }
function toggleMap() { RS.map = !RS.map; const m = $('#rMap'); m.hidden = !RS.map; if (RS.map) m.innerHTML = '<div class="rform">技 能 谱 · ' + CARDS.length + ' 张</div>' + groupStats().map(g => '<div class="gbar"><span>' + esc(g.name) + '</span><i><b style="width:' + Math.round(g.seen / g.n * 100) + '%"></b><em style="width:' + Math.round(g.firm / g.n * 100) + '%"></em></i><span>' + g.firm + '/' + g.n + '</span></div>').join('') + '<div class="rwhy">浅色是见过,金色是记牢。点任意处收起。</div>'; }
$('#rClose').addEventListener('click', closeReel); $('#rSkill').addEventListener('click', toggleMap); $('#rMap').addEventListener('click', toggleMap);
$('#btnReel').addEventListener('click', () => { sfx.init(); if (!RS.open) openReel(); });
let swipeY = null; rStage.addEventListener('pointerdown', e => { swipeY = e.clientY; });
rStage.addEventListener('pointerup', e => { if (swipeY !== null && swipeY - e.clientY > 46) reelNext(); swipeY = null; });
rStage.addEventListener('pointercancel', () => { swipeY = null; });
let wheelT = 0; reel.addEventListener('wheel', e => { if (RS.map) return; const now = Date.now(); if (e.deltaY > 24 && now - wheelT > 420) { wheelT = now; reelNext(); } }, { passive: true });
function reelKey(e) {
  if (e.code === 'Escape') { RS.map ? toggleMap() : closeReel(); return; }
  if (e.code === 'ArrowDown' || e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') { e.preventDefault(); reelNext(); return; }
  const m = /^(?:Digit|Numpad)([1-6])$/.exec(e.code); if (m) { const b = rStage.querySelectorAll('.rc:last-child .opt')[+m[1] - 1]; if (b) answerCard(b); }
}

/* ---------- 启动 ---------- */
$('#stage').insertBefore($('#hud'), $('#toast')); FX.init();
rebuildLessons(); buildLevel(lessonOf(save.cur).day); resize();
if (save.seenIntro) { S.paused = false; } else sheetIntro();
requestAnimationFrame(loop);
window.__mxj = { FX, mus, RS, RD, CARDS, GROUPS, openReel, closeReel, reelNext, pickCard, buildCard, resolveCard, groupStats, S, P, keys, get G() { return G; }, get L() { return L; }, get lessons() { return lessons; }, get save() { return save; }, get view() { return { VW, VH, OY, cam }; }, step, frame, start, grade, solution, submitAnswer, finishQuiz, importLessons, normLesson, openQuiz, hl, sheetReview, reviewQueue };
})();

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
    if (s[2] ? s[2] <= t : s[1] <= r.n) due.push([s[2] ? 0 : 1, s[2] || '', s[1], id]); else if (!s[2]) wait.push([s[1], id]); else old.push(id);
  }
  due.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || a[2] - b[2]);
  const fresh = nextNew(rnd);
  if (due.length && (!fresh || learning >= 7 || rnd() < .72)) return { card: cardById.get(due[0][3]) };
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
  else if (cur.form === 'tf') ns = ok ? [2, n + 6 + Math.floor(rnd() * 4), ''] : [1, n + 3, ''];
  else if (cur.extra) ns = ok ? (r.c[id] || [5, 0, addDays(t, 20)]) : [2, n + 4, ''];
  else if (ok) { const k = Math.min(5, Math.max(3, s + 1)); ns = [k, 0, addDays(t, GAP_DAYS[k - 1] || 20)]; RS.round.up++; }
  else ns = [2, n + 4, ''];
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

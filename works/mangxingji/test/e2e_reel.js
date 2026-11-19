const { chromium } = require('playwright');
const URL = 'file://' + require('path').resolve(__dirname, '../dist/index.html') + (process.env.HASH || '');
let pass = 0, fail = 0; const errs = [];
const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS', name, extra === undefined ? '' : JSON.stringify(extra)); } else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
(async () => {
  const browser = await chromium.launch();
  const mk = async (opts) => { const c = await browser.newContext(opts || { viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(URL); await p.waitForFunction(() => window.__mxj); return p; };
  const cur = p => p.evaluate(() => { const c = __mxj.RS.cur; return c && { form: c.form, id: c.card && c.card.id, done: c.done, truth: c.truth, claim: c.claim, a: c.card && c.card.a, opts: c.opts, gold: c.gold, stage: c.stage }; });
  const settle = p => p.waitForFunction(() => !__mxj.RS.busy);
  const act = async (p, right = true) => { const c = await cur(p); if (c.form === 'tf') await p.click(`.rc:last-child .opt[data-v="${(c.truth === right) ? 1 : 0}"]`); else if (c.form === 'pick') { const i = right ? c.opts.indexOf(c.a) : c.opts.findIndex(o => o !== c.a); await p.click(`.rc:last-child .opt[data-i="${i}"]`); } return c; };
  const next = async p => { await p.keyboard.press('ArrowDown'); await settle(p); };

  let p = await mk();
  const data = await p.evaluate(() => ({ n: __mxj.CARDS.length, g: __mxj.GROUPS.length, bad: __mxj.CARDS.filter(c => !c.d.length || c.d.includes(c.a) || !c.w || !c.c).length, ids: new Set(__mxj.CARDS.map(c => c.id)).size }));
  ok(data.n === 327 && data.g === 19 && data.bad === 0 && data.ids === 327, 'R1 卡库 327 张 / 19 组,id 唯一,干扰项不等于答案', data);
  await p.click('#iGo'); await p.waitForFunction(() => !__mxj.S.sheet);
  await p.click('#btnReel'); await settle(p);
  let c = await cur(p);
  ok(c.form === 'see' && await p.evaluate(() => __mxj.S.paused && __mxj.RS.open), 'R2a 真点击进入;首张是「一瞥」;游戏暂停');
  ok(await p.evaluate(() => document.querySelector('#rAns').classList.contains('wait')), 'R2b 答案先藏着'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('#rAns').classList.contains('wait') && document.querySelector('#rAns code').textContent.length > 0), 'R2c 约 0.65 秒后显出答案');
  const px = await p.evaluate(() => __mxj.P.x); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(250); await p.keyboard.up('ArrowRight');
  ok(await p.evaluate(px => __mxj.P.x === px && !__mxj.keys.right, px), 'R2d 刷卡时方向键不驱动游戏');
  // R3 见过 → 回来问
  const hist = [c]; const fire0 = await p.evaluate(() => __mxj.save.fire);
  for (let i = 0; i < 60; i++) { await next(p); c = await cur(p); if (c.form === 'sum') { hist.push(c); continue; } await act(p, true); hist.push(c); }
  const seq = {}; hist.forEach(h => { if (h.id) (seq[h.id] = seq[h.id] || []).push(h.form); });
  const full = Object.values(seq).filter(s => s.join(',').startsWith('see,tf,pick')).length;
  const gaps = []; hist.forEach((h, i) => { if (h.form === 'tf') { const j = hist.findIndex(x => x.id === h.id); if (hist[j].form === 'see') gaps.push(i - j); } });
  ok(full >= 5, 'R3a 同一张卡走完 看→判→猜', { full, cards: Object.keys(seq).length });
  ok(gaps.length > 5 && Math.min(...gaps) >= 2 && Math.max(...gaps) <= 14, 'R3b 看过之后隔 2–14 张回来问', { min: Math.min(...gaps), max: Math.max(...gaps) });
  ok(hist.every((h, i) => !i || !h.id || h.id !== hist[i - 1].id), 'R3c 不连续出现同一张');
  ok(hist.some(h => h.form === 'sum'), 'R10 每 12 张出一张小结');
  const st = await p.evaluate(() => { const r = __mxj.RD(), d = new Date(); d.setDate(d.getDate() + 1); const tm = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return { n: r.n, today: r.today, firm: Object.values(r.c).filter(s => s[0] === 3 && s[2] === tm).length, fire: __mxj.save.fire, combo: __mxj.RS.combo }; });
  ok(st.firm >= 5 && st.fire > fire0 + 20 && st.combo > 10, 'R3d 猜对的卡排到明天;萤与连对累加', st);
  // R4 答错
  let tries = 0; do { await next(p); c = await cur(p); tries++; if (c.form !== 'tf' && c.form !== 'sum') await act(p, true); } while (c.form !== 'tf' && tries < 40);
  await act(p, false); const wrongId = c.id; await p.waitForTimeout(1900);
  const after = await p.evaluate(() => ({ id: __mxj.RS.cur.card.id, combo: __mxj.RS.combo, why: document.querySelector('.rc:last-child #rWhy').textContent, hint: document.querySelector('#rHint').textContent, st: __mxj.RD().c[__mxj.RS.cur.card.id] }));
  ok(after.id === wrongId && after.combo === 0 && after.hint.includes('继续') && after.st[0] === 1 && (c.truth || after.why.includes('实际')), 'R4a 答错:不自动翻页、连对清零、显示实际结果', after);
  let back = -1; for (let i = 1; i <= 10 && back < 0; i++) { await next(p); const k = await cur(p); if (k.id === wrongId) back = i; else if (k.form !== 'sum') await act(p, true); }
  ok(back >= 3 && back <= 5, 'R4b 答错的卡第 3–5 张必回来(优先于其它到期卡)', back);
  // R5 答对自动翻
  await act(p, true); const idA = (await cur(p)).id; await p.waitForTimeout(1900); ok((await cur(p)).id !== idA, 'R5 答对约 1.35 秒后自动下一张');
  // 数字键作答
  tries = 0; do { c = await cur(p); if (c.form === 'pick' && !c.done) break; if (c.form !== 'sum' && !c.done) await act(p, true); await next(p); tries++; } while (tries < 40);
  c = await cur(p); await p.keyboard.press('Digit' + (c.opts.indexOf(c.a) + 1)); ok((await cur(p)).done && await p.evaluate(() => __mxj.RS.cur.ok === true), 'R5b 数字键可作答');
  // R8 存档
  const before = await p.evaluate(() => JSON.stringify(__mxj.RD()) + __mxj.save.fire); await p.reload(); await p.waitForFunction(() => window.__mxj);
  ok(before === await p.evaluate(() => JSON.stringify(__mxj.RD()) + __mxj.save.fire), 'R8 刷新后卡片进度与萤原样');
  await p.click('#btnReel'); await settle(p); await p.click('#rSkill'); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_32_reel_map.png' }); ok(await p.evaluate(() => document.querySelectorAll('#rMap .gbar').length === 19), 'R9c 技能谱 19 行'); await p.click('#rMap');
  await p.click('#rClose'); ok(await p.evaluate(() => !__mxj.RS.open && !__mxj.S.paused && document.querySelector('#fireN').textContent === String(__mxj.save.fire)), 'R11 合上后游戏继续,萤数同步');
  await p.context().close();

  // R6/R7 纯逻辑
  p = await mk();
  const logic = await p.evaluate(() => {
    const M = __mxj, R = M.RD(); let s = 12345; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    let tfBad = 0, pickBad = 0, pos = [0, 0, 0, 0]; const c0 = M.CARDS[0];
    for (let i = 0; i < 400; i++) { R.c = { [c0.id]: [1, 0, ''] }; M.RS.last = null; const k = M.buildCard(() => i % 2 ? rnd() * .7 : rnd()); if (k.card.id === c0.id) { if (k.form !== 'tf' || (k.claim === c0.a) !== k.truth || (!k.truth && !c0.d.includes(k.claim))) tfBad++; } }
    for (let i = 0; i < 400; i++) { R.c = { [c0.id]: [2, 0, ''] }; const k = M.buildCard(() => rnd() * .7); if (k.form !== 'pick' || k.opts.filter(o => o === c0.a).length !== 1 || k.opts.length !== c0.d.length + 1) pickBad++; else pos[k.opts.indexOf(c0.a)]++; }
    // 全程模拟:一直答对
    M.save.r = null; const r = M.RD(); M.RS.last = null; let consec = 0, forms = { see: 0, tf: 0, pick: 0 }, n = 0;
    const play = (right) => { const k = M.buildCard(rnd); if (k.card.id === M.RS.last) consec++; r.n++; n++; forms[k.form]++; M.resolveCard(k, k.form === 'see' ? null : right(k), rnd); M.RS.last = k.card.id; return k; };
    while (Object.keys(r.c).length < M.CARDS.length && n < 5000) play(() => true);
    const seenAt = n, firm = Object.values(r.c).filter(x => x[0] >= 3).length;
    // 再刷 400 张:今天没有到期的了,应该先清掉学习中的,再抽已记牢的做加练且不改排期
    for (let i = 0; i < 700; i++) play(() => true);
    const allFirm = Object.values(r.c).every(x => x[0] >= 3), snap = JSON.stringify(r.c); const ex = M.buildCard(rnd); M.resolveCard(ex, true, rnd); const extraKeeps = ex.extra && JSON.stringify(r.c) === snap;
    // 隔天:全部到期
    for (const id in r.c) r.c[id][2] = '2000-01-01'; M.RS.last = null; const k2 = M.buildCard(rnd), s0 = k2.stage; M.resolveCard(k2, true, rnd); const up = r.c[k2.card.id];
    // 到期卡答错 → 回到学习
    const k3 = M.buildCard(rnd); M.resolveCard(k3, false, rnd); const down = r.c[k3.card.id];
    // 跳过
    M.save.r = null; const r2 = M.RD(); const k4 = M.buildCard(rnd); M.resolveCard(k4, null, rnd); r2.n += 9; M.RS.last = null; let k5; do { k5 = M.buildCard(() => .1); } while (k5.card.id !== k4.card.id && (M.resolveCard(k5, null, rnd), r2.n++, true) && r2.n < 60); M.resolveCard(k5, 'skip', rnd);
    const skipped = r2.c[k4.card.id];
    M.save.r = null; M.save.fire = 0; M.RS.combo = 0; localStorage.clear();
    return { tfBad, pickBad, pos, seenAt, firm, consec, forms, allFirm, extraKeeps, due: { extra: !!k2.extra, form: k2.form, s0, up }, down, skipped, k5form: k5.form };
  });
  ok(logic.tfBad === 0, 'R6a 判断题 400 次:「对」当且仅当展示的是真实输出', logic.tfBad);
  ok(logic.pickBad === 0 && logic.pos.filter(x => x > 40).length >= 3, 'R6b 选择题 400 次:正确项恰好一个且位置分散', logic.pos);
  ok(logic.seenAt < 5000 && logic.consec === 0, 'R7a 一直答对:327 张全部出场,无连续重复', { cards: logic.seenAt, forms: logic.forms });
  ok(logic.allFirm && logic.extraKeeps, 'R7b 新卡刷完后进入加练;加练答对不改排期');
  ok(!logic.due.extra && logic.due.form === 'pick' && logic.due.up[0] === Math.min(5, logic.due.s0 + 1) && logic.due.up[2] > '2026-11-10', 'R7c 隔天到期的卡优先出、答对升一档并排得更远', logic.due);
  ok(logic.down[0] === 2 && logic.down[2] === '' && logic.down[3] === 1, 'R7d 到期卡答错:退回学习中,几张后再来', logic.down);
  ok(logic.k5form === 'tf' && logic.skipped[0] === 1 && logic.skipped[2] === '', 'R7e 跳过不算对:留在原档,稍后再问', logic.skipped);
  await p.context().close();

  // R9 手机竖屏:真触摸
  p = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_29_intro_portrait.png' }); await p.tap('#iReel'); await settle(p); await p.waitForTimeout(900); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_30_reel_see.png' });
  const cdp = await p.context().newCDPSession(p);
  const swipe = async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 560 }] }); for (let y = 520; y >= 320; y -= 40) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(p); };
  const id0 = (await cur(p)).id; await swipe(); ok((await cur(p)).id !== id0, 'R9a 真触摸上滑翻到下一张');
  let shotTf = false, shotPick = false, taps = 0;
  for (let i = 0; i < 40 && !(shotTf && shotPick); i++) { c = await cur(p); if (c.form === 'tf' && !shotTf) { await p.waitForTimeout(350); await p.screenshot({ path: "shots/31_reel_tf.png" }); await p.touchscreen.tap(195, 30); /* 截图后的第一下触摸在无头环境里不产生 click,先空点一下 */ const b = await p.locator(`.rc:last-child .opt[data-v="${c.truth ? 1 : 0}"]`).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); taps += (await cur(p)).done ? 1 : 0; await p.waitForTimeout(250); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_31_reel_tf_done.png' }); shotTf = true; } else if (c.form === 'pick' && !shotPick) { await p.waitForTimeout(350); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_33_reel_pick.png' }); await p.touchscreen.tap(195, 30); /* 截图后的第一下触摸在无头环境里不产生 click,先空点一下 */ const b = await p.locator(`.rc:last-child .opt[data-i="${c.opts.indexOf(c.a)}"]`).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); taps += (await cur(p)).done ? 1 : 0; shotPick = true; } await swipe(); }
  ok(taps === 2, 'R9b 真触摸点选作答(判、猜各一次)', taps);
  const fitAll = await p.evaluate(() => { const M = __mxj, st = document.querySelector('#rStage'); let over = [], lt = 0; M.CARDS.forEach(card => { st.innerHTML = ''; M.RS.cur = { card, form: 'pick', opts: [card.a].concat(card.d), done: false }; const html = '<div class="rc"><div class="rform">猜 · x</div><pre class="code">' + M.hl(card.c) + '</pre><div class="rq">运行结果是?</div><div class="rwhy">' + card.w + '</div><div class="ropts">' + M.RS.cur.opts.map(o => '<button class="opt">' + o.replace(/</g, '&lt;') + '</button>').join('') + '</div></div>'; st.innerHTML = html; const el = st.firstChild; if (el.scrollHeight > el.clientHeight + 1) over.push(card.id); if (st.querySelector('.opt').textContent.includes('<')) lt++; }); return { over, h: st.clientHeight, lt }; });
  ok(fitAll.over.length === 0, 'R13 390×844 上 327 张卡(含讲解与全部选项)都不需要滚动', fitAll);
  await p.context().close();

  // R12 转义:输出里带 < 的卡
  p = await mk(); const escT = await p.evaluate(() => { const M = __mxj, card = M.CARDS.find(c => c.a === '<x>'); M.save.r = { n: 0, day: '', today: 0, c: { [card.id]: [2, 0, ''] } }; let k = 0; do { M.save.r = { n: 0, day: '', today: 0, c: { [card.id]: [2, 0, ''] } }; M.RS.last = null; M.openReel(); } while (M.RS.cur.card.id !== card.id && ++k < 60); return { id: card.id, shown: M.RS.cur.card.id, texts: [...document.querySelectorAll('.rc .opt')].map(b => b.textContent), kids: document.querySelectorAll('.rc .opt *').length }; });
  ok(escT.shown === escT.id && escT.texts.includes('<x>') && escT.kids === 0, 'R12 输出含 < > 的卡按文本显示', escT);
  await p.context().close();
  ok(errs.length === 0, 'R16 全程无页面报错', errs);
  console.log(`\nTOTAL pass=${pass} fail=${fail}`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.stack); process.exit(3); });

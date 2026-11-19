const { chromium } = require('playwright');
const URL = 'file://' + require('path').resolve(__dirname, '../dist/index.html') + (process.env.HASH || '');
let pass = 0, fail = 0; const errs = [];
const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS', name, extra === undefined ? '' : extra); } else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const BOT = `(day, maxFrames) => {
  const M = __mxj; M.start(day); const P = M.P, keys = M.keys, S = M.S; let frames = 0, minHearts = 3, fireT = 0;
  const topAt = (x, feet) => { const G = M.G; return G.ground.concat(G.floats, G.steles).some(s => x >= s.x && x <= s.x + s.w && Math.abs(s.y - feet) < 2); };
  while (frames < maxFrames && !S.clear && !S.over && P.alive) {
    if (S.quiz) { M.submitAnswer(M.solution(S.quiz.q)); M.finishQuiz(); continue; }
    const G = M.G, feet = P.y + P.h, cx = P.x + 11;
    const dark = G.lanterns.filter(l => l.state === 'dark').sort((a, b) => a.x - b.x)[0];
    const boss = !dark && G.boss && G.boss.alive ? G.boss : null;
    let tx = dark ? dark.x + 4 : boss ? boss.x + boss.w / 2 - 11 : G.gate.x + G.gate.w / 2 - 11, want = false;
    keys.left = keys.right = false; const dx = tx - P.x; let far = false;
    if (dark && Math.abs(dx) < 3) { want = true; }
    else if (boss) {
      const bd = (boss.x + boss.w / 2) - cx, dist = Math.abs(bd); P.face = bd > 0 ? 1 : -1;
      if (dist > 300) far = true;
      else if (P.power >= 2 && dist > 110) { if (frames - fireT > 14) { keys.fire = true; fireT = frames; } }
      else { keys[bd > 0 ? 'right' : 'left'] = true; if (dist < 96) want = true; }
    } else far = true;
    if (far) {
      const dir = dx > 0 ? 1 : -1; keys[dir > 0 ? 'right' : 'left'] = true;
      const front = dir > 0 ? P.x + P.w : P.x;
      const gap = P.grounded && !topAt(front + dir * 12, feet);
      const wall = G.steles.some(s => { const d = dir > 0 ? s.x - front : front - (s.x + s.w); return d > -4 && d < 26 && s.y < feet - 2; });
      const en = G.enemies.some(e => { if (!e.alive || e.kind === 'boss' || e.kind === 'flyer') return false; const d = (e.x + e.w / 2 - cx) * dir; return d > 0 && d < 58 && e.y + e.h > feet - 46; });
      if (gap || wall || en) want = true;
    }
    if (P.grounded) keys.jump = want && !P.jumpHeld; else keys.jump = true;
    M.step(); frames++; if (P.hearts < minHearts) minHearts = P.hearts;
  }
  const G = M.G; return { day, frames, clear: S.clear, over: S.over, alive: P.alive, x: Math.round(P.x), W: G.W, hearts: P.hearts, minHearts, states: G.lanterns.map(l => l.state), boss: G.boss ? G.boss.alive : null, bugs: S.bugs, power: P.power };
}`;
(async () => {
  const browser = await chromium.launch();
  const mk = async (opts) => { const c = await browser.newContext(opts || { viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(URL); await p.waitForFunction(() => window.__mxj); return p; };
  const enter = async p => { await p.click('#iGo'); await p.waitForFunction(() => !__mxj.S.sheet); };
  const under = (p, i) => p.evaluate(i => { const l = __mxj.G.lanterns[i], P = __mxj.P; P.x = l.x + 4; P.y = 380 - P.h; P.vx = 0; P.vy = 0; P.grounded = true; __mxj.G.enemies.forEach(e => { if (e.kind !== 'boss') e.alive = false; }); }, i);

  // T1 内容完整性
  let p = await mk();
  ok(await p.evaluate(() => __mxj.lessons.find(l => l.day === 4).cheatsheet.includes(String.fromCharCode(92) + 'bhell' + String.fromCharCode(92) + 'b')), 'T1a 速查表反斜杠原样保留');
  ok(await p.evaluate(() => !document.documentElement.innerHTML.includes(String.fromCharCode(0x200b))), 'T1b 页面内无零宽字符');
  ok(await p.evaluate(() => __mxj.lessons.length === 6 && __mxj.lessons.every(l => l.quizzes.length === 5)), 'T1c 6 课 × 5 题');

  // T2 真键盘
  await enter(p);
  const x0 = await p.evaluate(() => __mxj.P.x); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight');
  const x1 = await p.evaluate(() => __mxj.P.x); ok(x1 > x0 + 60, 'T2a 方向键移动', Math.round(x1 - x0));
  await p.waitForTimeout(300); const y0 = await p.evaluate(() => __mxj.P.y); await p.keyboard.down('Space'); await p.waitForTimeout(180); const y1 = await p.evaluate(() => __mxj.P.y); await p.keyboard.up('Space');
  ok(y1 < y0 - 30, 'T2b 空格起跳', Math.round(y0 - y1));
  // 短按跳得低(可变跳高)
  await p.waitForTimeout(900); const apex = async ms => { await p.evaluate(() => { __mxj._min = 1e9; __mxj._iv = setInterval(() => { __mxj._min = Math.min(__mxj._min, __mxj.P.y); }, 4); }); await p.keyboard.down('Space'); await p.waitForTimeout(ms); await p.keyboard.up('Space'); await p.waitForTimeout(1100); return p.evaluate(() => { clearInterval(__mxj._iv); return 354 - __mxj._min; }); };
  const lo = await apex(40), hi = await apex(500); ok(hi > lo + 30 && hi > 110, 'T2c 长按跳得更高', { short: Math.round(lo), long: Math.round(hi) });

  // T3 顶灯 → 真点击答对
  await under(p, 0); await p.keyboard.down('Space'); await p.waitForFunction(() => __mxj.S.sheet === 'quiz', null, { timeout: 4000 }); await p.keyboard.up('Space');
  ok(await p.evaluate(() => __mxj.S.paused), 'T3a 答题时游戏暂停');
  await p.click('#qGo'); ok((await p.textContent('#fb')).includes('先给出'), 'T3b 未选就提交被拦');
  const c0 = await p.evaluate(() => __mxj.S.quiz.q.correct); await p.click(`.opt[data-i="${c0}"]`); await p.click('#qGo');
  ok(await p.$('.fb.ok') !== null, 'T3c 答对出讲解'); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_03_quiz_ok.png' });
  await p.click('#qGo');
  ok(await p.evaluate(() => __mxj.G.lanterns[0].state === 'gold' && __mxj.P.power === 1 && __mxj.save.q.d1_q1.box === 1 && !__mxj.S.paused), 'T3d 灯亮金、得护身、记入掌握度、恢复游戏');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('mxj_v2')).q.d1_q1.box === 1), 'T3e 已写入本机存储');

  // T4 反例:填空题答错两次
  await under(p, 1); await p.keyboard.down('Space'); await p.waitForFunction(() => __mxj.S.sheet === 'quiz'); await p.keyboard.up('Space');
  await p.fill('#fillin', ''); await p.type('#fillin', 'has a dw'); // 含 a/d/w/空格
  ok(await p.inputValue('#fillin') === 'has a dw', 'T4a 输入框里打 a/d/w/空格 不被游戏吞掉');
  const px = await p.evaluate(() => __mxj.P.x); await p.click('#qGo'); ok(await p.$('.fb.no') !== null && await p.evaluate(() => !__mxj.S.quiz.done), 'T4b 第一次答错:给提示,可再试');
  ok(!(await p.textContent('#fb')).includes('startswith'), 'T4c 第一次答错不泄露答案');
  await p.fill('#fillin', 'begins_with'); await p.press('#fillin', 'Enter');
  ok(await p.evaluate(() => __mxj.S.quiz.done && __mxj.S.quiz.result === 'revealed') && (await p.textContent('#fb')).includes('startswith'), 'T4d 第二次答错:揭示答案');
  await p.click('#qGo');
  ok(await p.evaluate(px => __mxj.G.lanterns[1].state === 'dim' && __mxj.P.power === 1 && __mxj.save.q.d1_q2.box === 0 && __mxj.reviewQueue()[0].id === 'd1_q2' && __mxj.P.x === px, px), 'T4e 灯残明、无奖励、排进温书首位');

  // T5 跳过:灯不消耗
  await under(p, 2); await p.keyboard.down('Space'); await p.waitForFunction(() => __mxj.S.sheet === 'quiz'); await p.keyboard.up('Space'); await p.click('#qSkip');
  ok(await p.evaluate(() => __mxj.G.lanterns[2].state === 'dark' && !__mxj.S.sheet), 'T5a 稍后再答:灯仍未亮');
  await p.waitForTimeout(900); await p.keyboard.down('Space'); let again = true; try { await p.waitForFunction(() => __mxj.S.sheet === 'quiz', null, { timeout: 3000 }); } catch (e) { again = false; } await p.keyboard.up('Space');
  ok(again, 'T5b 同一盏灯可再次触发'); await p.click('#qSkip');

  // T6 山门:灯未全亮不放行
  const gate = await p.evaluate(() => { const M = __mxj, g = M.G.gate; M.P.x = g.x + g.w / 2 - 11; M.P.y = 380 - M.P.h; for (let i = 0; i < 120; i++) M.step(); return { clear: M.S.clear, open: g.open, toast: document.querySelector('#toast').textContent }; });
  ok(!gate.clear && gate.open === 0 && gate.toast.includes('盏灯未亮'), 'T6 反例:有灯未亮,站进山门也不过关', gate.toast);

  // T15 温书:从菜单真点击进入,首题是刚才错的那题
  await p.click('#btnMenu'); await p.click('#mReview'); ok(await p.evaluate(() => __mxj.S.quiz && __mxj.S.quiz.q.id === 'd1_q2'), 'T15a 温书首题是答错的题');
  await p.fill('#fillin', 'startswith'); await p.click('#qGo'); await p.click('#qGo');
  ok(await p.evaluate(() => __mxj.save.q.d1_q2.box === 1), 'T15b 温书答对后掌握度回升'); await p.evaluate(() => { while (__mxj.S.quiz) { __mxj.S.quiz.result = 'skipped'; __mxj.finishQuiz(); } });
  await p.context().close();

  // T7 选项洗牌
  p = await mk(); await enter(p);
  const pos = await p.evaluate(() => { const M = __mxj, q = M.lessons[0].quizzes[0], c = [0, 0, 0, 0]; for (let i = 0; i < 80; i++) { M.openQuiz(q, {}); const els = [...document.querySelectorAll('.opt')]; c[els.findIndex(e => +e.dataset.i === q.correct)]++; M.S.quiz.result = 'skipped'; M.finishQuiz(); } return c; });
  ok(pos.filter(n => n > 0).length >= 3 && pos[0] < 48, 'T7 正确项位置随机(80 次分布)', pos);
  // 排序题初始不是正解;每种题型用解答走一遍
  const types = await p.evaluate(() => { const M = __mxj, out = {}; M.lessons.forEach(l => l.quizzes.forEach(q => { M.openQuiz(q, {}); const init = q.type === 'order' ? M.grade(q, M.S.quiz.order) : false; const r = M.submitAnswer(M.solution(q)); out[q.id] = r === 'first' && !init; M.finishQuiz(); })); return out; });
  ok(Object.values(types).every(Boolean) && Object.keys(types).length === 30, 'T8 30 题用标准解都判对;排序题初始乱序', Object.entries(types).filter(e => !e[1]).map(e => e[0]));
  const wrongs = await p.evaluate(() => { const M = __mxj; let n = 0, bad = []; M.lessons.forEach(l => l.quizzes.forEach(q => { const cands = q.type === 'fill' ? ['', 'x', q.answers[0] + 'x', q.answers[0].toUpperCase() === q.answers[0] ? 'zz' : q.answers[0].toUpperCase()] : q.type === 'order' ? [q.lines.map((_, i) => i).reverse(), [0]] : q.type === 'bugline' ? q.code.split('\n').map((_, i) => i).filter(i => i !== q.correct) : q.options.map((_, i) => i).filter(i => i !== q.correct); cands.forEach(c => { n++; if (M.grade(q, c)) bad.push(q.id); }); })); return { n, bad }; });
  ok(wrongs.bad.length === 0, 'T8b 反例:' + wrongs.n + ' 个错误答案无一被判对', wrongs.bad);

  // T9 通关 bot:6 课全程
  for (let d = 1; d <= 6; d++) { const r = await p.evaluate(`(${BOT})(${d}, 30000)`); ok(r.clear && r.states.every(s => s === 'gold') && (r.boss === null || r.boss === false), 'T9 第' + d + '课 bot 通关', r); await p.waitForTimeout(800); if (d === 1) await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_04_clear.png' }); }
  ok(await p.evaluate(() => __mxj.save.streak.n === 1 && Object.keys(__mxj.save.best).length === 6 && __mxj.save.best[1].stars === 3), 'T13a 同一天通关 6 次,连日仍为 1(原版每通一关 +1)');
  const st = await p.evaluate(`(() => { const M = __mxj, d = new Date(Date.now() - 864e5); M.save.streak = { n: 4, last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }; (${BOT})(1, 30000); const a = M.save.streak.n; M.save.streak = { n: 4, last: '2026-01-01' }; (${BOT})(1, 30000); return [a, M.save.streak.n]; })()`);
  ok(st[0] === 5 && st[1] === 1, 'T13b 昨天打过 → +1;断了 → 归 1', st);

  // T10 帧率无关
  const fr = await p.evaluate(() => { const M = __mxj, run = hz => { M.start(1); M.keys.right = true; let ts = 1000; M.frame(ts); const n = hz; for (let i = 0; i < n; i++) { ts += 1000 / hz; M.frame(ts); } M.keys.right = false; return Math.round(M.P.x); }; return [run(30), run(60), run(120), run(144)]; });
  ok(Math.max(...fr) - Math.min(...fr) <= 8, 'T10 30/60/120/144Hz 下一秒走的距离一致', fr);

  // T12 受伤、踩踏、跌落
  const dmg = await p.evaluate(() => { const M = __mxj; M.start(1); const P = M.P, e = M.G.enemies[0]; P.x = e.x - 10; P.y = 380 - P.h; P.vy = 0; M.step(); const a = { hearts: P.hearts, inv: P.inv > 0 }; for (let i = 0; i < 120; i++) M.step(); M.start(1); const e2 = M.G.enemies[0]; P.vx = 0; P.x = e2.x + 3; P.y = e2.y - P.h - 6; P.vy = 3; for (let i = 0; i < 4 && e2.alive; i++) M.step(); return { a, dead: !e2.alive, bugs: M.S.bugs, bounced: P.vy < 0, hearts: P.hearts }; });
  ok(dmg.a.hearts === 2 && dmg.a.inv && dmg.dead && dmg.bugs === 1 && dmg.bounced, 'T12a 侧碰掉命并无敌;从上踩灭并弹起', dmg);
  const pit = await p.evaluate(() => { const M = __mxj; M.start(1); const P = M.P, g = M.G.gaps[0], log = []; for (let k = 0; k < 3; k++) { P.x = (g[0] + g[1]) / 2 - 11; P.y = 400; P.vy = 5; P.vx = 0; for (let i = 0; i < 200 && P.alive && P.y > 300; i++) M.step(); log.push([P.hearts, Math.round(P.x), P.alive]); } return log; });
  ok(pit[0][0] === 2 && pit[0][1] === 80 && pit[2][0] === 0 && pit[2][2] === false, 'T12b 跌落掉一命回存档点;三次后失败', pit);
  await p.waitForFunction(() => __mxj.S.sheet === 'over', null, { timeout: 3000 }); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_05_over.png' }); await p.click('#oAgain');
  ok(await p.evaluate(() => __mxj.P.hearts === 3 && !__mxj.S.over && !__mxj.S.paused), 'T12c 失败后可重来');
  await p.context().close();

  // T11 导入
  p = await mk(); await enter(p);
  const legacy = { day: 7, title: '对抗样本检测与流式防御 (Adversarial Defense)', subtitle: 'Day 7', theme: 'cavern', badge: '防御先驱', intro: 'x', cheatsheet: 'def f():\n    return 1', quizzes: [0, 1, 2].map(i => ({ id: 'd7_q' + (i + 1), concept: '概念<b>' + i, question: '题干 `code` <img src=x onerror="window.__pwned=1">', codePre: '# 注释 <script>window.__pwned=1</script>', type: 'choice', options: ['对 <img src=x onerror="window.__pwned=1">', '错一', '错二', '错三'], correct: 0, hint: '提示<img src=x onerror="window.__pwned=1">', explanation: '讲解<img src=x onerror="window.__pwned=1">' })) };
  await p.click('#btnMenu'); await p.click('#mSync');
  await p.fill('#imp', '{oops'); await p.click('#sGo'); ok((await p.textContent('#fb')).includes('不是合法的 JSON'), 'T11a 坏 JSON 被拒并说明');
  await p.fill('#imp', JSON.stringify({ day: 7, title: 't', quizzes: [{ question: 'q', options: ['a', 'b'], correct: 5 }] })); await p.click('#sGo'); ok((await p.textContent('#fb')).includes('correct 越界'), 'T11b 答案下标越界被拒');
  await p.fill('#imp', JSON.stringify({ day: 7, title: 't' })); await p.click('#sGo'); ok((await p.textContent('#fb')).includes('quizzes'), 'T11c 缺题被拒');
  ok(await p.evaluate(() => __mxj.lessons.length === 6 && __mxj.save.custom.length === 0), 'T11d 被拒的导入不留残渣');
  await p.fill('#imp', '```json\n' + JSON.stringify(legacy) + '\n```'); await p.click('#sGo');
  ok(await p.evaluate(() => __mxj.L.day === 7 && __mxj.G.lanterns.length === 3 && __mxj.lessons.length === 7 && !__mxj.S.sheet), 'T11e 原版 Day7 旧格式(带 ```json 围栏)载入并直接开局');
  await under(p, 0); await p.keyboard.down('Space'); await p.waitForFunction(() => __mxj.S.sheet === 'quiz'); await p.keyboard.up('Space'); await p.click('#qHint'); await p.click('.opt[data-i="0"]'); await p.click('#qGo'); await p.waitForTimeout(100);
  const xss1 = await p.evaluate(() => ({ pwned: window.__pwned, imgs: document.querySelectorAll('#sheet img, #sheet script, #sheet b').length, code: document.querySelectorAll('#sheet .qtext code').length })); await p.click('#qGo');
  await p.click('#btnMenu'); await p.click('#mMap'); await p.click('#xBack'); await p.click('#mCodex'); await p.waitForTimeout(100);
  const xss2 = await p.evaluate(() => ({ pwned: window.__pwned, imgs: document.querySelectorAll('#sheet img, #sheet script').length }));
  ok(xss1.pwned === undefined && xss1.imgs === 0 && xss1.code === 1 && xss2.pwned === undefined && xss2.imgs === 0, 'T11f 导入内容里的 HTML 不被执行,反引号仍渲染为代码', { xss1, xss2 });
  await p.reload(); await p.waitForFunction(() => window.__mxj);
  ok(await p.evaluate(() => __mxj.lessons.length === 7 && __mxj.L.day === 7 && !__mxj.S.sheet), 'T11g 刷新后外来课仍在(原版因变量先用后定义,存了也读不回)');
  const b7 = await p.evaluate(`(${BOT})(7, 30000)`); ok(b7.clear, 'T11h 导入的第 7 课 bot 可通关', b7);
  await p.waitForTimeout(800); await p.click('#cAgain'); await p.click('#btnMenu'); await p.click('#mSync'); await p.click('[data-rm="7"]');
  ok(await p.evaluate(() => __mxj.lessons.length === 6 && __mxj.L.day !== 7), 'T11i 外来课可移除');
  await p.context().close();

  // T14 视口
  const shots = [['portrait', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }], ['landscape', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }], ['desktop', { viewport: { width: 1440, height: 900 } }]];
  for (const [name, o] of shots) {
    p = await mk(o); await p.screenshot({ path: `${process.env.SHOTS || require('os').tmpdir()}/v2suite_10_${name}_intro.png` }); await p.tap ? (o.hasTouch ? await p.tap('#iGo') : await p.click('#iGo')) : 0; await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), pad = getComputedStyle(document.querySelector('#pad')).display, st = r('#stage'), pj = r('#padJump'), cv = document.querySelector('#cv'); return { pad, stage: [Math.round(st.width), Math.round(st.height)], stageBottom: Math.round(st.bottom), jumpTop: Math.round(pj.top), jumpBottom: Math.round(pj.bottom), vh: innerHeight, cv: [cv.width, cv.height], view: __mxj.view, scroll: document.documentElement.scrollHeight > innerHeight + 1 }; });
    if (name === 'desktop') ok(m.pad === 'none' && !m.scroll, 'T14 桌面:触控键隐藏、无滚动', m);
    else {
      ok(m.pad === 'flex' && m.jumpBottom <= m.vh && !m.scroll && m.view.VW >= 480, 'T14 ' + name + ':触控键可见且在屏内', m);
      if (name === 'portrait') ok(m.jumpTop >= m.stageBottom - 2, 'T14 竖屏:按键不压画面', m);
      // 真触摸:按住右键走,点跳
      const xa = await p.evaluate(() => __mxj.P.x); const b = await p.locator('#padMove .pk[data-k="right"]').boundingBox();
      const cdp = await p.context().newCDPSession(p); const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] }); await p.waitForTimeout(450); const held = await p.evaluate(() => __mxj.keys.right); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(60);
      const xb = await p.evaluate(() => [__mxj.P.x, __mxj.keys.right]); ok(held && xb[0] > xa + 50 && xb[1] === false, 'T14 ' + name + ':真触摸按住右键移动、松开即停', [Math.round(xb[0] - xa)]);
      const jb = await p.locator('#padJump').boundingBox(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jb.x + 30, y: jb.y + 30 }] }); await p.waitForTimeout(200); const yy = await p.evaluate(() => __mxj.P.y); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      ok(yy < 330, 'T14 ' + name + ':真触摸「跃」起跳', Math.round(yy));
    }
    await p.waitForTimeout(500); await p.screenshot({ path: `${process.env.SHOTS || require('os').tmpdir()}/v2suite_11_${name}_play.png` });
    await p.evaluate(() => { const M = __mxj; M.openQuiz(M.lessons[2].quizzes[3], {}); }); await p.waitForTimeout(150); await p.screenshot({ path: `${process.env.SHOTS || require('os').tmpdir()}/v2suite_12_${name}_quiz.png` });
    const fit = await p.evaluate(() => { const s = document.querySelector('#sheet').getBoundingClientRect(); return s.left >= 0 && s.right <= innerWidth + 1 && s.bottom <= innerHeight + 1; }); ok(fit, 'T14 ' + name + ':答题卷在屏内');
    await p.context().close();
  }
  // 各主题截图
  p = await mk({ viewport: { width: 1280, height: 720 } }); await enter(p);
  for (let d = 2; d <= 6; d++) { await p.evaluate(d => { const M = __mxj; M.start(d); M.P.x = d === 6 ? M.G.boss.x - 330 : 900; M.G.lanterns[0].state = 'gold'; M.G.lanterns[0].glow = 1; if (d === 6) { M.G.lanterns.forEach(l => { l.state = 'gold'; l.glow = 1; }); M.P.power = 2; } for (let i = 0; i < 90; i++) M.step(); }, d); await p.waitForTimeout(250); await p.screenshot({ path: `${process.env.SHOTS || require('os').tmpdir()}/v2suite_20_day${d}.png` }); }
  await p.evaluate(() => document.querySelector('#btnMenu').click()); await p.click('#mMap'); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_21_map.png' }); await p.click('#xBack'); await p.click('#mCodex'); await p.click('.tab[data-d="4"]'); await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/v2suite_22_codex.png' });
  ok((await p.textContent('#sheet pre.code')).includes('\\bhell\\b'), 'T1d 宝典里渲染出的正则含反斜杠');
  await p.context().close();
  ok(errs.length === 0, 'T16 全程无页面报错', errs);
  console.log(`\nTOTAL pass=${pass} fail=${fail}`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.stack); process.exit(3); });

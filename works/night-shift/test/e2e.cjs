// Night Shift V4.0 · browser E2E. Run: npm i playwright && npx playwright install chromium && node test/e2e.cjs
const path = require('path'), fs = require('fs'); let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const { execFileSync } = require('child_process'); const ROOT = path.join(__dirname, '..'), SHOTS = path.join(ROOT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'dist', 'index.html'); let pass = 0, fail = 0; const errs = [];
const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS', name, extra === undefined ? '' : JSON.stringify(extra)); } else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const ARGS = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  let v = 1; try { execFileSync('node', [path.join(ROOT, 'verify.cjs')]); v = 0; } catch (e) {} ok(v === 0, 'A1 V2 自带的 verify.cjs 原样跑 V4 引擎:64 班全过(旧夜晚没被改坏)');
  let v4 = ''; try { v4 = execFileSync('node', [path.join(ROOT, 'verify_v4.cjs')]).toString().trim().split('\n').pop(); } catch (e) {} ok(/All invariants hold/.test(v4), 'A2 verify_v4.cjs:K17 线规则检查', v4);
  const browser = await chromium.launch({ args: ARGS });
  const mk = async (opts, init) => { const c = await browser.newContext(opts || { viewport: { width: 1280, height: 800 } }); if (init) await c.addInitScript(init); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(URL); await p.waitForFunction(() => window.__ns); const c0 = p.click.bind(p), t0 = p.tap.bind(p); p.rawClick = c0; p.click = async (...a) => { await c0(...a); await p.waitForTimeout(330); }; p.tap = async (...a) => { await t0(...a); await p.waitForTimeout(330); }; return p; };
  const seedInit = seed => `try{if(!sessionStorage.getItem('k')){localStorage.setItem('nightshift.port.v4',JSON.stringify({seed:${seed},trail:[],lang:'dual'}));sessionStorage.setItem('k','1')}}catch(e){}`;
  const state = p => p.evaluate(() => JSON.stringify(__ns.s));
  const offered = p => p.evaluate(() => ({ dom: [...document.querySelectorAll('#game [data-act]')].map(b => b.dataset.act).sort(), logic: actions(__ns.s).concat(__ns.s.open && !__ns.s.clocked ? Object.keys(rooms).filter(k => k !== __ns.s.place).map(k => '@' + k) : []).sort() }));

  // B 界面与规则等价:固定种子,真点击走完整班,与纯逻辑重放逐字节比较
  let p = await mk({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); let eqBad = [], offBad = [], shifts = 0, clicks = 0;
  for (const seed of [0, 1, 2, 3, 5, 12, 22, 31]) {
    await p.evaluate(sd => { localStorage.setItem('nightshift.port.v4', JSON.stringify({ seed: sd, trail: [], lang: 'dual' })); }, seed); await p.reload(); await p.waitForFunction(() => window.__ns); await p.click('#vmute');
    const loaded = await p.evaluate(() => firstLoaded(initial(__ns.seed)));
    const steps = seed % 2 ? ['ledger', 'driver', 'driver', 'pass', 'pass', 'bell', '@quay', 'window', '@box', loaded ? 'stub' : 'crate', '@records', 'vault', '@box', 'original', '@kitchen', 'tea', 'radio', '@quay', 'forkgossip', 'promise', 'tag'] : ['ledger', 'tube', 'hold', 'driver', 'driver', 'pass', 'pass', 'bell', 'crate', 'driver', '@quay', 'forkgossip', 'promise', 'promise'];
    for (const k of steps) { const o = await offered(p); if (JSON.stringify(o.dom) !== JSON.stringify(o.logic)) offBad.push([seed, k]); await p.click(`#game [data-act="${k}"]`); clicks++; }
    for (let i = 0; i < 40 && !(await p.evaluate(() => __ns.s.clocked)); i++) { const o = await offered(p); if (JSON.stringify(o.dom) !== JSON.stringify(o.logic)) offBad.push([seed, 'pass' + i]); const extra = await p.evaluate(() => { const a = actions(__ns.s); return ['oldkey', 'coins', 'bid7', 'livebadge', 'oldwire', 'bookcredit', 'weather'].find(k => a.includes(k)); }); await p.click(`#game [data-act="${extra || 'pass'}"]`); clicks++; }
    const r = await p.evaluate(() => { const x = initial(__ns.seed); const good = __ns.trail.every(k => apply(x, k)); return { same: good && JSON.stringify(x) === JSON.stringify(__ns.s), clocked: __ns.s.clocked, rows: document.querySelectorAll('.paper .row').length, heads: document.querySelectorAll('.paper h3').length, btn: !!document.querySelector('[data-new]'), dawn: __ns.V.dawnT, saved: JSON.parse(localStorage.getItem('nightshift.port.v4')).trail.length === __ns.trail.length }; });
    if (!(r.same && r.clocked && r.rows === 9 && r.heads === 5 && r.btn && r.dawn === 1 && r.saved)) eqBad.push([seed, r]); shifts++;
  }
  ok(eqBad.length === 0, `B1 ${shifts} 个种子真点击走完整班(${clicks} 次点击):界面状态与纯逻辑重放逐字节一致,结算单 5 组 9 行`, eqBad);
  ok(offBad.length === 0, 'B2 每一步界面给出的按钮 = actions(s) + 可去的房间,不多不少', offBad.slice(0, 4));
  await p.click('[data-new]'); ok(await p.evaluate(() => !__ns.s.open && __ns.trail.length === 0 && !!document.querySelector('[data-act="ledger"]')), 'B3 「接明天的班」开新班');
  // I 中文分词
  const zt = await p.evaluate(() => { const all = []; for (let sd = 0; sd < 32; sd++) { const x = initial(sd); ['ledger', 'tube', 'driver', 'driver', 'pass', 'pass', 'bell', 'crate', 'driver'].forEach(k => apply(x, k)); while (!x.clocked) apply(x, 'pass'); x.log.forEach(l => all.push(l[1][1])); } Object.values(verbs).forEach(v => all.push(v.split('|')[1])); let bad = 0, n = 0; for (const str of all) { const tk = __ns.zhTokens(str); n += tk.length; if (tk.join('') !== str) bad++; if (tk.some((t, i) => i && '」』）】，。！？：；、”’'.includes(t[0]))) bad++; } return { strings: all.length, tokens: n, bad }; });
  ok(zt.bad === 0, 'I1 中文逐字显影:拼回去与原文一致,没有标点落在行首的切法', zt);
  await p.context().close();

  // C/D/E 正常动效 + 声音
  p = await mk({ viewport: { width: 1280, height: 800 } });
  ok(await p.evaluate(() => __ns.V.gl === true), 'E1 WebGL 起来了');
  const shot = async () => p.screenshot({ clip: { x: 0, y: 60, width: 1280, height: 300 } });
  const a1 = await shot(); await p.waitForTimeout(700); const a2 = await shot(); ok(!a1.equals(a2), 'E2 画面在动(两帧不同)');
  ok(await p.evaluate(() => __ns.SND.ac === null), 'D0 进入前不创建音频上下文');
  await p.click('#vgo'); await p.waitForTimeout(1600);
  const snd = await p.evaluate(() => ({ state: __ns.SND.ac && __ns.SND.ac.state, on: __ns.SND.on, level: __ns.SND.level(), pressed: document.querySelector('#snd').getAttribute('aria-pressed') }));
  ok(snd.state === 'running' && snd.on && snd.level > 0.002 && snd.pressed === 'true', 'D1 开声音进入:音频在跑,输出端测到信号', snd);
  const art = await p.evaluate(() => { const a = document.querySelector('article'); return { now: a.classList.contains('now'), words: a.querySelectorAll('.w').length, text: a.querySelector('p').textContent.replace(/\s+/g, ' ').trim().slice(0, 30) }; });
  ok(!art.now && art.words > 30 && art.text.startsWith('“Wren?'), 'K1 开场白逐词显影', art);
  await p.click('article'); ok(await p.evaluate(() => document.querySelector('article').classList.contains('now')), 'K2 点正文立即显示全文');
  await p.click('[data-act="ledger"]'); await p.waitForTimeout(2600);
  const cam = await p.evaluate(() => ({ cam: __ns.V.cam.map(x => +x.toFixed(2)), want: __ns.CAMS.box, place: document.querySelector('#place').textContent }));
  ok(Math.abs(cam.cam[0] - cam.want[0]) < .02 && Math.abs(cam.cam[2] - cam.want[2]) < .03 && cam.place.includes('Signal box'), 'E3 拿起账本后镜头从电话摇到信号楼', cam);
  const txt = await p.evaluate(() => { const want = document.createElement('div'); want.innerHTML = __ns.s.last[0] + __ns.s.last[1]; const got = document.querySelector('article p').textContent; const n = x => x.replace(/\s+/g, ''); return n(got) === n(want.textContent); }); ok(txt, 'K3 显影后的文字与原文逐字一致');
  const redBefore = await p.evaluate(() => __ns.V.red); const r1 = await shot(); await p.click('[data-act="hold"]'); await p.waitForTimeout(1500); const redAfter = await p.evaluate(() => [__ns.V.redT, +__ns.V.red.toFixed(2)]);
  ok(redBefore < .01 && redAfter[0] > .6 && redAfter[1] > .4, 'E4 举红灯:信号灯转红', { redBefore, redAfter }); await p.screenshot({ path: SHOTS + '/10_red_lamp.png' });
  await p.click('[data-act="driver"]'); await p.rawClick('[data-act="pass"]'); const fl = await p.evaluate(() => __ns.V.flash > 0 && __ns.V.shake > 1); await p.waitForTimeout(350); await p.screenshot({ path: SHOTS + '/11_train_pass.png' }); ok(fl, 'E5 看货车经过:光栅扫过室内 + 镜头震动');
  await p.click('[data-act="pass"]'); await p.waitForTimeout(200);
  const beats = await p.evaluate(() => ({ n: document.querySelectorAll('article .beat').length, labels: [...document.querySelectorAll('article .beat small')].map(x => x.textContent), played: __ns.SND.played.slice(), logTail: __ns.s.log.slice(-2).map(l => l[1][0].slice(0, 22)) }));
  ok(beats.n === 2 && /MEANWHILE/.test(beats.labels[1]) && beats.played.includes('arr:train'), 'C1 同一拍里到站的事件单独成段(V2 里它会盖掉你刚做的那句)', { labels: beats.labels, logTail: beats.logTail });
  ok(['brass', 'enter', 'ledger', 'hold', 'driver', 'pass', 'arr:train'].every(n => beats.played.includes(n)), 'D2 动作与到站各自触发对应音效', beats.played.filter(x => x !== 'tick'));
  await p.click('[data-act="@kitchen"]'); await p.click('[data-act="tea"]'); await p.waitForTimeout(2600); await p.screenshot({ path: SHOTS + '/12_kitchen_tea.png' });
  ok(await p.evaluate(() => __ns.V.steam > .8 && Math.abs(__ns.V.cam[0] - __ns.CAMS.kitchen[0]) < .03 && __ns.SND.played.includes('walk') && __ns.SND.played.includes('tea')), 'E6 去茶水间:镜头推到茶壶,泡茶后水汽变浓');
  await p.click('#snd'); await p.waitForTimeout(1800); const off = await p.evaluate(() => ({ level: __ns.SND.level(), pressed: document.querySelector('#snd').getAttribute('aria-pressed'), pref: localStorage.getItem('nightshift.port.v3.pref') }));
  ok(off.level < 0.0008 && off.pressed === 'false' && off.pref.includes('false'), 'D3 关声音:输出端归零', off);
  // G 存档
  const before = await state(p), trailLen = await p.evaluate(() => __ns.trail.length); await p.reload(); await p.waitForFunction(() => window.__ns);
  ok((await p.textContent('#vgo')).includes('Back to the desk') && await state(p) === before, 'G1 刷新后回到同一拍', trailLen);
  ok(await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('nightshift.port.v4')); return Object.keys(o).sort().join() === 'lang,seed,trail'; }), 'G2 存档字段与 V2 相同(seed/trail/lang),键名换成 v4,不会误读 V2 的旧档');
  await p.click('#vmute'); ok(await p.evaluate(() => __ns.SND.ac === null && document.querySelector('article').textContent.length > 20), 'D4 静音进入:不创建音频上下文');
  // H 语言
  await p.selectOption('#language', 'zh'); const zhOnly = await p.evaluate(() => ({ t: document.querySelector('article p').textContent, lang: document.documentElement.lang, btn: document.querySelector('.hand button, nav button').textContent })); ok(!/[A-Za-z]{4,}/.test(zhOnly.t.replace(/K17|B9|Wren/g, '')) && zhOnly.lang === 'zh-CN', 'H1 切到纯中文', zhOnly.t.slice(0, 20));
  await p.selectOption('#language', 'en'); ok(await p.evaluate(() => !/[一-龥]/.test(document.querySelector('#game').textContent) && JSON.parse(localStorage.getItem('nightshift.port.v4')).lang === 'en'), 'H2 切到纯英文并记住');
  await p.evaluate(() => localStorage.setItem('nightshift.port.v4', '{"seed":1,"trail":["nope","ledger"]}')); await p.reload(); await p.waitForFunction(() => window.__ns); ok(await p.evaluate(() => __ns.trail.length === 0 && !__ns.s.open), 'G3 反例:坏存档被丢弃,开新班不崩');
  await p.context().close();

  // 减少动态效果
  p = await mk({ viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' }); await p.click('#vmute'); await p.waitForTimeout(4000); const s1 = await p.screenshot({ clip: { x: 0, y: 60, width: 900, height: 250 } }); await p.waitForTimeout(600); const s2 = await p.screenshot({ clip: { x: 0, y: 60, width: 900, height: 250 } });
  ok(s1.equals(s2) && await p.evaluate(() => document.querySelector('article').classList.contains('now')), 'E7 系统开了「减少动态效果」:画面静止、文字直接显示'); await p.context().close();

  // F 没有 WebGL
  p = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, `const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:g.call(this,t,...a)};`);
  await p.waitForTimeout(600); await p.tap('#vmute'); await p.tap('[data-act="ledger"]'); const f1 = await p.evaluate(() => ({ nogl: document.querySelector('#stage').classList.contains('nogl'), bg: getComputedStyle(document.querySelector('#stage')).backgroundImage.slice(0, 28), pos: document.querySelector('#stage').style.backgroundPosition })); await p.tap('[data-act="@quay"]'); const f2 = await p.evaluate(() => document.querySelector('#stage').style.backgroundPosition);
  ok(f1.nogl && f1.bg.includes('data:image/webp') && f1.pos !== f2, 'F1 反例:WebGL 不可用时退回静态油画,换房间仍换构图,游戏可玩', { f1, f2 }); await p.screenshot({ path: SHOTS + '/13_nogl.png' }); await p.context().close();

  // J 手机布局 + 真触摸
  p = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await p.waitForTimeout(700); await p.screenshot({ path: SHOTS + '/20_veil.png' });
  await p.tap('#vgo'); await p.waitForTimeout(900); await p.screenshot({ path: SHOTS + '/21_intro_reveal.png' }); await p.waitForTimeout(2200); await p.tap('[data-act="ledger"]'); await p.waitForTimeout(3000); await p.screenshot({ path: SHOTS + '/22_box.png' });
  const lay = await p.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(); const bt = [...document.querySelectorAll('#game button')].map(b => b.getBoundingClientRect().height); return { top: Math.round(r('#top').height), topLine: Math.round(r('#top b').height), stage: Math.round(r('#stage').height), minBtn: Math.round(Math.min(...bt)), hscroll: document.documentElement.scrollWidth > innerWidth, snd: document.querySelector('#snd').textContent }; });
  ok(lay.topLine < 30 && lay.minBtn >= 44 && !lay.hscroll && lay.stage > 300, 'J1 手机竖屏:顶栏一行、按钮不小于 44px、无横向滚动', lay);
  await p.evaluate(() => scrollTo(0, 400)); await p.waitForTimeout(300); ok(await p.evaluate(() => Math.abs(document.querySelector('#stage').getBoundingClientRect().top) < 1 && Math.abs(__ns.V.tiltT[1]) > .3), 'J2 下滑时油画钉在顶部,并随滚动改变视差');
  await p.evaluate(() => scrollTo(0, 0)); for (const k of ['@quay', '@records', '@kitchen']) { await p.tap(`[data-act="${k}"]`); await p.waitForTimeout(2600); await p.screenshot({ path: SHOTS + `/23_${k.slice(1)}.png` }); }
  for (let i = 0; i < 40 && !(await p.evaluate(() => __ns.s.clocked)); i++) await p.tap(await p.evaluate(() => document.querySelector('[data-act="dawn"]') ? '[data-act="dawn"]' : '.quiet [data-act="pass"]')); await p.waitForTimeout(3500); await p.screenshot({ path: SHOTS + '/24_dawn.png', fullPage: false }); ok(await p.evaluate(() => __ns.V.dawn > .6 && __ns.V.rain < .6 && document.querySelectorAll('.paper .row').length === 9), 'E8 交班:天色转晨、雨势收小、结算单出现');
  await p.context().close();

  // ===== N:评审第 18/19 节点名、此前没测的路径 =====
  // N1 伪造/过期/越权的点击
  p = await mk({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' }); await p.click('#vmute'); await p.click('[data-act="ledger"]');
  const forged = await p.evaluate(async () => { const g = document.querySelector('#game'), snap = () => JSON.stringify(__ns.s) + '|' + __ns.trail.join() + '|' + localStorage.getItem('nightshift.port.v4'); const before = snap(), tried = [];
    for (const k of ['dawn', 'bid7', 'coins', 'oldwire', 'livebadge', 'bookcredit', 'original', 'stub', '@moon', '@box', '@', '', '__proto__', 'constructor', 'toString', 'ledger']) { await new Promise(r => setTimeout(r, 320)); const b = document.createElement('button'); b.dataset.act = k; g.appendChild(b); b.click(); tried.push(k); }
    await new Promise(r => setTimeout(r, 320)); const n = document.createElement('button'); n.setAttribute('data-new', ''); g.appendChild(n); n.click();
    return { same: snap() === before, tried: tried.length, allowedNow: actions(__ns.s) }; });
  ok(forged.same, 'N1 反例:往页面里塞 16 个当前不允许的动作按钮(提前交班、越权出价、不存在的房间、原型链键名)和一个「新班」按钮,逐个点,状态、轨迹、存档都不变', { tried: forged.tried, allowedNow: forged.allowedNow });
  // N2 连点
  const hb = await p.locator('[data-act="hold"]').boundingBox(); await p.mouse.click(hb.x + 20, hb.y + 20); await p.mouse.click(hb.x + 20, hb.y + 20); await p.mouse.click(hb.x + 20, hb.y + 20);
  const rapid = await p.evaluate(() => ({ holds: __ns.s.holds, trail: __ns.trail.slice() })); ok(rapid.holds === 1 && rapid.trail.join() === 'ledger,hold', 'N2a 同一位置 3 连点只算一次(重绘后同一位置已是别的按钮)', rapid);
  const stale = await p.evaluate(async () => { await new Promise(r => setTimeout(r, 320)); const old = document.querySelector('[data-act="tube"]'); old.click(); const t1 = __ns.trail.length; await new Promise(r => setTimeout(r, 320)); for (let i = 0; i < 20; i++) old.click(); return [t1, __ns.trail.length, __ns.s.t]; });
  ok(stale[0] === 3 && stale[1] === 3, 'N2b 重绘前留下的旧按钮再点 20 次无效', stale);
  await p.waitForTimeout(320); await p.focus('[data-act="hold"]'); await p.keyboard.press('Enter'); ok(await p.evaluate(() => __ns.s.holds === 2), 'N2c 键盘可操作(聚焦 + 回车)');
  await p.context().close();
  // N3 正常动效 + 开声音,不等任何动画,压着 300ms 的节拍走完整班
  p = await mk({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await p.tap('#vgo');
  const lay2 = await p.evaluate(() => ({ stage: Math.round(document.querySelector('#stage').getBoundingClientRect().height), hscroll: document.documentElement.scrollWidth > innerWidth, gl: __ns.V.gl })); await p.screenshot({ path: SHOTS + '/30_ipad_landscape.png' });
  let fastClicks = 0; for (const k of ['ledger', 'tube', 'driver', 'driver', 'pass', 'pass', 'bell', 'crate', '@records', 'vault', '@box', 'original', '@quay', 'forkgossip', 'promise', 'tag', '@kitchen', 'tea']) { await p.tap(`#game [data-act="${k}"]`); fastClicks++; }
  for (let i = 0; i < 40 && !(await p.evaluate(() => __ns.s.clocked)); i++) { const k = await p.evaluate(() => { const a = actions(__ns.s); return ['brass', 'coins', 'weather', 'bid5', 'agentbook', 'livebadge', 'shorewire', 'oldwire', 'bookcredit', 'dawn'].find(x => a.includes(x) && document.querySelector('#game [data-act="' + x + '"]')) || null; }); await p.tap(k ? `#game [data-act="${k}"]` : (await p.evaluate(() => document.querySelector('.quiet [data-act="pass"]') ? '.quiet [data-act="pass"]' : '#game nav [data-act]'))); fastClicks++; }
  const fast = await p.evaluate(() => { const x = initial(__ns.seed); const good = __ns.trail.every(k => apply(x, k)); return { same: good && JSON.stringify(x) === JSON.stringify(__ns.s), clocked: __ns.s.clocked, rooms: [...new Set(__ns.trail.filter(k => k[0] === '@'))].length, audio: __ns.SND.ac && __ns.SND.ac.state, notes: discoveries(__ns.s).map(n => n[0]) }; });
  ok(fast.same && fast.clocked && fast.audio === 'running' && fast.rooms === 4 && fastClicks >= 20, 'N3 iPad 横屏、真触摸、开声音、正常动效:不等动画连续点完整班,状态与纯逻辑重放一致', { fastClicks, ...fast }); ok(lay2.gl && !lay2.hscroll && lay2.stage > 300, 'N4 iPad 横屏 1180×820 布局', lay2);
  // N5 切后台再回来
  const bg = await p.evaluate(async () => { const st = JSON.stringify(__ns.s); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 900)); const f1 = __ns.V.frames, run1 = __ns.running, lvl1 = __ns.SND.level(); await new Promise(r => setTimeout(r, 400)); const f2 = __ns.V.frames; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 1500)); return { stopped: !run1 && f2 === f1, silent: lvl1 < .001, resumed: __ns.running && __ns.V.frames > f2, lvlBack: __ns.SND.level() > .002, same: JSON.stringify(__ns.s) === st }; });
  ok(bg.stopped && bg.silent && bg.resumed && bg.lvlBack && bg.same, 'N5 切后台:渲染停、声音静;回前台:都恢复,游戏状态不变', bg); await p.context().close();
  // N6 音频不可用
  for (const [nm, init] of [['构造即抛错', 'window.AudioContext=window.webkitAudioContext=function(){throw new Error("denied")};'], ['浏览器没有 AudioContext', 'delete window.AudioContext;delete window.webkitAudioContext;window.AudioContext=undefined;window.webkitAudioContext=undefined;']]) {
    p = await mk({ viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' }, init); await p.click('#vgo'); await p.click('[data-act="ledger"]'); await p.click('[data-act="tube"]');
    ok(await p.evaluate(() => __ns.s.t === 1 && !__ns.SND.on && document.querySelector('#snd').getAttribute('aria-pressed') === 'false'), 'N6 反例:音频' + nm + ' → 点「开声音」照常进入并能玩,开关显示为关'); await p.context().close(); }
  // N7 存储不可用
  p = await mk({ viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' }, 'Storage.prototype.setItem=function(){throw new Error("quota")};Storage.prototype.getItem=function(){throw new Error("blocked")};'); await p.click('#vmute'); await p.click('[data-act="ledger"]'); await p.click('[data-act="tube"]');
  ok(await p.evaluate(() => __ns.s.t === 1 && /Device storage unavailable/.test(document.querySelector('#game').textContent)), 'N7 反例:本机存储读写都抛错 → 游戏照常进行并明说进度只保留到关页'); await p.context().close();

  // ===== V:V4 第一刀(K17 线)走界面 =====
  const fix = async (seed, o) => { const q = await mk(o || { viewport: { width: 1000, height: 820 }, reducedMotion: 'reduce' }); await q.evaluate(sd => localStorage.setItem('nightshift.port.v4', JSON.stringify({ seed: sd, trail: [], lang: 'dual' })), seed); await q.reload(); await q.waitForFunction(() => window.__ns); const c0 = q.click.bind(q); q.click = async (...a) => { await c0(...a); await q.waitForTimeout(330); }; await q.click('#vmute'); return q; };
  const art2 = q => q.evaluate(() => document.querySelector('article').textContent);
  const finish = async q => { for (let i = 0; i < 40 && !(await q.evaluate(() => __ns.s.clocked)); i++) await q.click(await q.evaluate(() => document.querySelector('[data-act="dawn"]') ? '[data-act="dawn"]' : '.quiet [data-act="pass"]')); return q.evaluate(() => ({ paper: document.querySelector('.paper').textContent, notes: discoveries(__ns.s).map(n => n[0]), k: __ns.s.k, cash: __ns.s.cash, log: __ns.s.log.map(l => l[1][0]).join(' | '), same: (() => { const x = initial(__ns.seed); return __ns.trail.every(k => apply(x, k)) && JSON.stringify(x) === JSON.stringify(__ns.s); })() })); };
  // 雾夜 + 单子在排队(种子 96):看不见秤台 → 花钱叫跑腿 → 按报告收存根
  p = await fix(96); for (const k of ['ledger', 'pass', 'pass', 'pass', 'bell']) await p.click(`#game [data-act="${k}"]`);
  const btns = await p.evaluate(() => [...document.querySelectorAll('.hand [data-act]')].map(b => b.dataset.act)); ok(['crate', 'stub', 'k17hold', 'k17wait', 'k17runner'].every(k => btns.includes(k)) && !btns.includes('k17lift'), 'V1a 接铃后出现三种新处置(写「停」、等五点、叫跑腿),与原有两种并列', btns);
  await p.click('[data-act="k17runner"]'); const c1 = await p.evaluate(() => __ns.s.cash); await p.click('.quiet [data-act="pass"]'); const rep = await p.evaluate(() => ({ text: document.querySelector('article').textContent, beats: document.querySelectorAll('article .beat').length, know: __ns.s.k.know, played: __ns.SND.played.filter(x => /k17/.test(x)), runnerBtn: !!document.querySelector('[data-act="k17runner"]') }));
  ok(c1 === 8 && rep.beats === 2 && /MEANWHILE/.test(rep.text) && rep.text.includes('slip for it on the crane’s hook') && rep.know.src === 'runner' && rep.know.queue === true && !rep.runnerBtn && rep.played.includes('k17runner') && rep.played.includes('k17:report'), 'V1c 跑腿:扣 2 枚,两分钟后回报单独成段,说出单子还在排队', { cash: c1, know: rep.know, played: rep.played });
  await p.click('[data-act="stub"]'); await p.evaluate(() => { __ns._know = JSON.stringify(__ns.s.k.know); });
  await p.click('[data-act="@quay"]'); await p.click('[data-act="window"]'); const fogT = await art2(p); await p.click('[data-act="@records"]'); await p.click('[data-act="journal"]'); const bookT = await art2(p);
  ok(fogT.includes('Fog has the scale') && bookT.includes('weighbook stops at 04:30') && await p.evaluate(() => JSON.stringify(__ns.s.k.know) === __ns._know), 'V1b 雾夜:秤台看不见,秤簿也没记到,两条免费的路都给不出新信息');
  let end = await finish(p);
  ok(end.same && end.k.done === 1 && !end.k.late && end.paper.includes('a runner’s word') && end.paper.includes('WHAT YOU WENT ON') && end.paper.includes('Nothing.') === false && end.notes.includes('In flight') && end.notes.includes('Bounded unknown') && end.log.includes('a chain runs out'), 'V1d 结局:一笔、没误船;底联写明"凭的是跑腿的一句话";手记里出现「在途」「有界的未知」;那阵没人解释的链条声在流水簿里', { notes: end.notes, cash: end.cash });
  await p.screenshot({ path: SHOTS + '/40_v4_morning_carbon.png', fullPage: true }); await p.context().close();
  // 先写「停」再重发(种子 32,晴夜、单子在排队):不会重复,但误船;「停」可擦
  p = await fix(32); for (const k of ['ledger', 'pass', 'pass', 'pass', 'bell', 'k17hold']) await p.click(`#game [data-act="${k}"]`);
  const hb2 = await p.evaluate(() => [...document.querySelectorAll('.hand [data-act]')].map(b => b.dataset.act)); await p.click('[data-act="@quay"]'); await p.click('[data-act="window"]'); const holdT = await art2(p); await p.click('[data-act="@box"]'); await p.click('[data-act="crate"]'); end = await finish(p);
  ok(hb2.includes('k17lift') && !hb2.includes('k17hold') && holdT.includes('under your chalk mark') && end.same && end.k.done === 1 && end.k.late && end.paper.includes('missed the boat') && end.log.includes('reads your chalk'), 'V2 写「停」后再重发:吊钩读到粉笔字荡开,最后只装一笔,但误了船', { late: end.k.late, demur: end.k.demur }); await p.context().close();
  // 从不回话(种子 2,货其实早走了):伊内斯自己重发 → 两笔
  p = await fix(2); await p.click('[data-act="ledger"]'); end = await finish(p);
  ok(end.same && end.k.done === 2 && end.k.fee === 2 && end.cash === 8 && end.paper.includes('Inez replayed it herself') && end.paper.includes('K17: you never said') && end.log.includes('I send it twice'), 'V3 一直不接铃:对方按规矩自己重发,重复装货 2 笔、扣 2 枚,底联列入「没合上的」'); await p.context().close();
  // 晴夜看见"还在秤台"就重发(种子 32):排队的那张也到 → 两笔;读出队列线索则一笔
  p = await fix(32); for (const k of ['ledger', 'pass', 'pass', 'pass', 'bell', '@quay', 'window']) await p.click(`#game [data-act="${k}"]`); const cue = await art2(p); await p.click('[data-act="@box"]'); await p.click('[data-act="crate"]'); end = await finish(p);
  ok(cue.includes('working its way toward it') && end.k.done === 2 && end.paper.includes('the scale as you saw it'), 'V4 看见还在秤台就另开一单:画面里其实有线索(吊车正朝它吊过来),忽略它 → 两笔', { cue: cue.slice(cue.indexOf('K17'), cue.indexOf('K17') + 90) }); await p.context().close();
  // V2 遗留缺陷:出价结算
  p = await fix(0); await p.click('[data-act="ledger"]'); await p.click('[data-act="@quay"]'); for (let i = 0; i < 12 && !(await p.$('[data-act="bid7"]')); i++) await p.click('.quiet [data-act="pass"]'); await p.click('[data-act="bid7"]'); await p.click('.quiet [data-act="pass"]'); await p.click('.quiet [data-act="pass"]');
  const bid = await p.evaluate(() => ({ cash: __ns.s.cash, line: __ns.s.log.map(l => l[1][0]).find(x => /bulletin finally/.test(x)) })); end = await finish(p);
  ok(bid.cash === 4 && bid.line.includes('Your bid was 7') && !/undefined|NaN/.test(bid.line + end.paper), 'V5 修掉 V2 遗留缺陷:出价结算不再出现 undefined / NaN,钱匣是整数', bid); await p.context().close();
  ok(errs.length === 0, 'L1 全程无页面报错', errs.slice(0, 5));
  console.log(`\nTOTAL pass=${pass} fail=${fail}`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.stack); process.exit(3); });

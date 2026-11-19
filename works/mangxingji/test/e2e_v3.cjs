// 蟒行记 v3 — checks specific to the new presentation layer (WebGL on, software-rendered in CI).
const { chromium } = require('playwright');
const URL = 'file://' + (process.argv[2] || require('path').resolve(__dirname, '../dist/index.html'));
let pass = 0, fail = 0; const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  → ' + JSON.stringify(x))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const mk = async (o, hash) => { const c = await b.newContext(o || { viewport: { width: 1280, height: 720 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(URL + (hash || '')); await p.waitForFunction(() => window.__mxj); return p; };
  // mean colour of a rectangle of the composited frame, given in low-res pixel coords around a world point
  const PROBE = `(wx, wy, half) => { const M = __mxj; M.FX.draw(); const c = document.querySelector('#gl'), gl = c.getContext('webgl'), s = M.FX.snap(), v = M.view, k = c.width / s.LW;
    const cx = (wx * .8 - Math.round(v.cam * .8)) * k, cy = c.height - (wy + v.OY) * .8 * k, n = Math.max(2, Math.round(half * k)); const buf = new Uint8Array(4 * n * 2 * n * 2); gl.readPixels(Math.round(cx - n), Math.round(cy - n), n * 2, n * 2, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let r = 0, g = 0, bl = 0; for (let i = 0; i < buf.length; i += 4) { r += buf[i]; g += buf[i + 1]; bl += buf[i + 2]; } const N = buf.length / 4; return [r / N, g / N, bl / N]; }`;
  const lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11;

  let p = await mk();
  const s0 = await p.evaluate(() => __mxj.FX.snap());
  ok(s0.ok && !s0.err, 'V1 WebGL pipeline compiled and is live', s0);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#gl')).display === 'block' && getComputedStyle(document.querySelector('#cv')).display === 'none'), 'V1b new canvas shown, legacy canvas hidden');
  await p.click('#iGo'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('#title').classList.contains('on') && document.querySelector('#title b').textContent === '暮野'), 'V2 level title card plays with the theme name');
  // lighting is real: the ground under a lantern gets brighter when that lantern is lit, and a far patch does not
  await p.evaluate(() => { const M = __mxj; M.S.paused = true; M.P.x = 420; M.P.y = 354; M.G.enemies.forEach(e => e.alive = false); M.G.flies.forEach(f => f.got = true); for (let i = 0; i < 3; i++) M.FX.draw(); });
  const L0 = await p.evaluate(() => { const l = __mxj.G.lanterns[0]; return { x: l.x + 15 }; });
  const dark = await p.evaluate(`(${PROBE})(${L0.x}, 392, 6)`), farDark = await p.evaluate(`(${PROBE})(${L0.x + 330}, 392, 6)`);
  await p.evaluate(() => { const l = __mxj.G.lanterns[0]; l.state = 'gold'; l.glow = 1; });
  const lit = await p.evaluate(`(${PROBE})(${L0.x}, 392, 6)`), farLit = await p.evaluate(`(${PROBE})(${L0.x + 330}, 392, 6)`);
  ok(lum(lit) > lum(dark) * 1.35, 'V3 lighting a lantern brightens the ground beneath it', { dark: lum(dark) | 0, lit: lum(lit) | 0 });
  ok(Math.abs(lum(farLit) - lum(farDark)) < lum(farDark) * .12 + 2, 'V3b …and leaves ground 330 units away unchanged (light is local)', { farDark: lum(farDark) | 0, farLit: lum(farLit) | 0 });
  ok(lit[0] > lit[2] * 1.15, 'V3c the lantern light is warm (red > blue)', lit.map(Math.round));
  // hurt flash
  const e0 = await p.evaluate(`(${PROBE})(${420 - 300}, 200, 5)`); await p.evaluate(() => __mxj.FX.hit()); const e1 = await p.evaluate(`(${PROBE})(${420 - 300}, 200, 5)`);
  await p.evaluate(() => { for (let i = 0; i < 90; i++) __mxj.FX.draw(); }); const e2 = await p.evaluate(`(${PROBE})(${420 - 300}, 200, 5)`);
  ok(e1[0] - e1[2] > e0[0] - e0[2] + 8 && Math.abs((e2[0] - e2[2]) - (e0[0] - e0[2])) < 6, 'V4 taking a hit tints the frame red, and it fades back', { before: e0.map(Math.round), hit: e1.map(Math.round), after: e2.map(Math.round) });
  // six themes
  const means = []; for (let d = 1; d <= 6; d++) { means.push(await p.evaluate(`(d => { const M = __mxj; M.start(d); M.S.paused = true; M.FX.draw(); return [(${PROBE})(M.P.x + 200, 120, 30), M.FX.snap()]; })(${d})`)); }
  ok(means.every(m => m[1].ok && !m[1].err), 'V5 all six themes build and render', means.map(m => m[1].theme));
  const distinct = new Set(means.map(m => m[0].map(v => Math.round(v / 24)).join(','))).size; ok(distinct >= 5, 'V5b the themes do not look alike (sky colour differs)', means.map(m => m[0].map(Math.round)));
  // quiz hooks
  await p.evaluate(() => { const M = __mxj; M.start(1); M.S.paused = false; const l = M.G.lanterns[0]; M.openQuiz(l.q, { lantern: l }); for (let i = 0; i < 40; i++) M.FX.draw(); });
  ok(await p.evaluate(() => __mxj.FX.focus > .8), 'V6 opening a lantern question pulls focus to that lantern');
  const wrong = await p.evaluate(() => { const M = __mxj, q = M.S.quiz.q, sol = M.solution(q); let w; if (q.type === 'fill') w = '__nope__'; else if (q.type === 'order') w = q.lines.map((_, i) => q.lines.length - 1 - i); else w = (sol + 1) % (q.type === 'bugline' ? q.code.split('\n').length : q.options.length); M.submitAnswer(w); return { cls: document.querySelector('#sheet').className, pulse: M.FX.pulse, c: M.FX.pulseC }; });
  ok(/fxno/.test(wrong.cls) && wrong.pulse > 0 && wrong.c[0] > wrong.c[1] * 2, 'V7 a wrong answer shakes the sheet and pulses red', wrong);
  const right = await p.evaluate(() => { const M = __mxj; M.submitAnswer(M.solution(M.S.quiz.q)); return { cls: document.querySelector('#sheet').className, pulse: M.FX.pulse, flash: M.FX.flash }; });
  ok(/fxok/.test(right.cls) && right.pulse > 1 && right.flash > .1, 'V7b the right answer flares gold', right);
  await p.evaluate(() => { __mxj.finishQuiz(); for (let i = 0; i < 60; i++) __mxj.FX.draw(); }); ok(await p.evaluate(() => __mxj.FX.focus < .2 && __mxj.G.lanterns[0].state === 'lit'), 'V7c focus releases and the lantern is lit in the world');
  // hit-stop
  const hs = await p.evaluate(() => { const M = __mxj; M.start(1); M.S.paused = false; const e = M.G.enemies[0]; M.P.x = e.x; M.P.y = e.y - 40; M.P.vy = 6; let guard = 0; while (e.alive && guard++ < 60) M.step(); const h = M.S.hitstop, t0 = M.S.t; let ts = 5000; M.frame(ts); for (let i = 0; i < 3; i++) { ts += 16.7; M.frame(ts); } const t1 = M.S.t; for (let i = 0; i < 6; i++) { ts += 16.7; M.frame(ts); } return { dead: !e.alive, h, frozen: t1 - t0, after: M.S.t - t1 }; });
  ok(hs.dead && hs.h >= 4 && hs.frozen === 0 && hs.after >= 4, 'V8 a stomp freezes the world for a few frames, then it resumes', hs);
  const hs2 = await p.evaluate(() => { const M = __mxj; M.S.hitstop = 9; M.start(2); return M.S.hitstop; }); ok(hs2 === 0, 'V8b hit-stop never leaks into the next level (regression)', hs2);
  // context loss → legacy renderer, and back
  const lost = await p.evaluate(async () => { const c = document.querySelector('#gl'), ext = c.getContext('webgl').getExtension('WEBGL_lose_context'); if (!ext) return null; ext.loseContext(); await new Promise(r => setTimeout(r, 300)); const a = { ok: __mxj.FX.ok, cv: getComputedStyle(document.querySelector('#cv')).display }; ext.restoreContext(); await new Promise(r => setTimeout(r, 500)); return { a, b: { ok: __mxj.FX.ok, cv: getComputedStyle(document.querySelector('#cv')).display } }; });
  ok(lost && lost.a.ok === false && lost.a.cv === 'block' && lost.b.ok === true && lost.b.cv === 'none', 'V9 losing the GPU context falls back to the old renderer; restoring comes back', lost);
  // audio
  const au = await p.evaluate(async () => { const M = __mxj; await new Promise(r => setTimeout(r, 1500)); const on = M.mus.on, g1 = M.mus.g ? M.mus.g.gain.value : -1; M.save.sound = false; M.mus.vol(); await new Promise(r => setTimeout(r, 4500)); const g2 = M.mus.g.gain.value; M.save.sound = true; M.mus.vol(); return { on, g1, g2 }; });
  ok(au.on && au.g1 > .05 && au.g2 < .02, 'V10 music starts after the first tap and goes silent when sound is off', au);
  await p.close();
  // no-GL switch
  p = await mk(null, '#nogl'); ok(await p.evaluate(() => !__mxj.FX.ok && getComputedStyle(document.querySelector('#cv')).display === 'block'), 'V11 #nogl forces the legacy renderer'); await p.close();
  // phone portrait layout
  p = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }); await p.tap('#iGo');
  const lay = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), st = r('#stage'), pad = r('#pad'), hud = r('#hud'), j = r('#padJump'); return { stageH: st.height, padTop: pad.top, padH: pad.height, hudIn: hud.top >= st.top && hud.bottom < st.top + 90, jumpVisible: j.bottom <= innerHeight && j.top > st.bottom - 2, sw: document.documentElement.scrollWidth }; });
  ok(lay.stageH > 650 && Math.abs(lay.padTop - lay.stageH) < 2 && lay.hudIn && lay.jumpVisible && lay.sw <= 390, 'V12 phone portrait: stage fills the screen above the pad, HUD sits inside the stage', lay); await p.close();
  ok(errs.length === 0, 'V13 no page errors', errs);
  await b.close(); console.log(`TOTAL pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e.message.slice(0, 400)); process.exit(2); });

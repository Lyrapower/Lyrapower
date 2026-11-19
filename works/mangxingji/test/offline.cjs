// The built game keeps working with no network after one visit (service worker), and still runs from file:// without one.
//   python3 build.py . && node test/offline.cjs
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.resolve(process.env.DIST || path.join(__dirname, '../dist'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let fail = 0; const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c ? '' : '  ' + JSON.stringify(x ?? ''))); if (!c) fail++; };
const srv = http.createServer((q, r) => { let f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}/`;
  const m = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
  ok(m.icons.every(i => fs.existsSync(path.join(DIST, i.src))) && m.start_url && m.display === 'standalone', 'manifest is complete and its icons exist');
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base); await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 4000))])); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller) || (await p.reload(), await p.evaluate(() => !!navigator.serviceWorker.controller)), 'service worker controls the page');
  await ctx.setOffline(true);
  const r = await p.reload().catch(e => e);
  ok(!(r instanceof Error) && await p.$('#hud') !== null && typeof await p.evaluate(() => typeof __mxj) === 'string', 'reload with no network still opens the game', r && r.message);
  await p.evaluate(() => document.querySelector('#btnReel').click()); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('#reel').hidden && document.querySelector('#rStage').textContent.length > 10), 'card reel works offline');
  await ctx.setOffline(false);
  // without http (opened as a file) the page must not try to register and must still run
  const q = await b.newPage(); const errs2 = []; q.on('pageerror', e => errs2.push(e.message));
  await q.goto('file://' + path.join(DIST, 'index.html')); await q.waitForTimeout(800);
  ok(await q.$('#hud') !== null && errs2.length === 0, 'file:// still runs, no errors', errs2);
  ok(errs.length === 0, 'no page errors', errs);
  await b.close(); srv.close(); console.log(fail ? `${fail} check(s) failed` : 'all passed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

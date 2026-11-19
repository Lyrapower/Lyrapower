// Smoke test: serve the folder, open it as a phone, and check the parts that matter.
//   npm i playwright && npx playwright install chromium && node test/smoke.cjs
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0; const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c ? '' : '  ' + JSON.stringify(x ?? ''))); if (!c) fail++; };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.mp3') ? 'audio/mpeg' : 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  // every narration file the page lists exists, and nothing extra is shipped
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const aud = JSON.parse(html.match(/<script id="aud"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const want = []; for (const b in aud) for (const l in aud[b]) for (const n in aud[b][l]) want.push(`audio/${b}/${l}/${String(n).padStart(3, '0')}.mp3`);
  const missing = want.filter(f => !fs.existsSync(path.join(ROOT, f)));
  ok(want.length === 175 && missing.length === 0, `all ${want.length} narration files listed by the page exist`, missing.slice(0, 5));
  const have = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : have.push(path.relative(ROOT, path.join(d, e.name))); })(path.join(ROOT, 'audio'));
  ok(have.length === want.length, 'no stray files in audio/', have.length);
  ok(!/https?:\/\/(?!www\.w3\.org)[^"'\s)]+\.(js|css|woff2?|png|jpe?g|mp3)/.test(html), 'page loads no third-party files');

  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const bad = []; p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await p.goto(base); await p.waitForTimeout(2000);
  ok((await p.$$('.zone')).length === 7, 'home shows seven books');
  const text = async () => (await p.innerText('#view')).replace(/\s+/g, ' ');
  await p.goto(base + '#/b/ddj/8'); await p.waitForTimeout(1200);
  const t8 = await text(); ok(t8.includes('上善若水') && t8.includes('The highest excellence is like'), 'Tao Te Ching 8 shows Chinese and Legge');
  await p.goto(base + '#/b/sunzi/1'); await p.waitForTimeout(1200); ok((await text()).includes('兵者，国之大事'), 'Art of War 1 opens');
  await p.goto(base + '#/b/sj/1'); await p.waitForTimeout(1200); ok((await text()).includes('货殖列传'), 'Shiji chapter opens');
  // asking without Claude falls back to quoted passages, each found in the book
  await p.goto(base + '#/b/ddj/ask'); await p.waitForTimeout(1200);
  await p.fill('textarea', '同事总抢功，我该争吗？'); const send = await p.$$('.askbox button'); await send[send.length - 1].click(); await p.waitForTimeout(2500);
  const ta = await text(); const m = ta.match(/引文 (\d+) 处：(\d+) 处已在原文中核到/);
  ok(m && +m[1] > 0 && m[1] === m[2], 'offline ask lists passages and every quote is found in the text', m && m[0]);
  // narration plays from the file, not the device voice
  await p.goto(base + '#/b/ddj/8'); await p.waitForTimeout(1000); await p.click('#listen'); await p.waitForTimeout(500);
  const mp3 = []; p.on('request', r => { if (r.url().endsWith('.mp3')) mp3.push(r.url().replace(base, '')); });
  await p.click('#pl-play'); await p.waitForTimeout(2000);
  ok(mp3.some(u => /^audio\/ddj\/(zh|en)\/008\.mp3$/.test(u)), 'pressing play on chapter 8 fetches audio/ddj/…/008.mp3', mp3);
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3)); ok(bad.length === 0, 'no failed requests', bad.slice(0, 3));
  await b.close(); srv.close();
  console.log(fail ? `${fail} check(s) failed` : 'all passed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// Browser smoke test: serves the site locally, opens every page on desktop and phone,
// and fails on any script error, sideways scrolling, or a missing key section.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const f = join(root, p.endsWith('/') ? p + 'index.html' : p); res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const views = ['home', 'about', 'director', 'agenda', 'strategies', 'news', 'dashboard', 'profiles', 'compare', 'compare-jam-hti-sur', 'repository', 'publications', 'policy', 'methods', 'accessibility', 'collaborate'];
const countries = JSON.parse(await readFile(join(root, 'data/countries.json'))).records.map(c => 'country-' + c.iso3.toLowerCase());
const failures = [];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [w, h, label] of [[1366, 900, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route(/^(?!http:\/\/localhost)/, r => r.abort()); // offline: no external calls in tests
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  for (const v of label === 'desktop' ? [...views, ...countries] : views) {
    await page.goto(base + '#' + v); await page.waitForTimeout(400);
    const vis = await page.evaluate(() => { const s = [...document.querySelectorAll('[data-view]')].find(x => !x.hidden); return s ? s.dataset.view : null; });
    const h1 = await page.evaluate(() => { const s = [...document.querySelectorAll('[data-view]')].find(x => !x.hidden); return s?.querySelector('h1')?.textContent.trim(); });
    if (!vis || !h1) failures.push(`${label} #${v}: no visible page or heading`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${label} #${v}: sideways scrolling`);
    if (v.startsWith('country-') && !(await page.evaluate(() => document.querySelectorAll('#cBody .src-list li, #cBody .src-gap').length))) failures.push(`${label} #${v}: no literacy sources or gaps shown`);
  }
  errs.forEach(e => failures.push(`${label}: script error: ${e}`));
  await ctx.close();
}
await browser.close(); server.close();
failures.forEach(f => console.log('FAIL', f));
console.log(`\nSmoke test: ${views.length + countries.length} desktop pages and ${views.length} phone pages — ${failures.length} failure(s).`);
process.exit(failures.length ? 1 : 0);

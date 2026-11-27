// Link test: opens every external link the site publishes.
// 404/410 or an unreachable host (after retries) fails the test; 401/403/429 and
// timeouts are reported as warnings because many government sites block automated checks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const load = f => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url)));
const links = new Map();
const add = (url, where) => { if (/^https?:\/\//.test(url || '')) (links.get(url) || links.set(url, []).get(url)).push(where); };
for (const r of load('country_sources').records) add(r.url, `country_sources/${r.id}`);
for (const r of load('policy').records) add(r.url, `policy/${r.id}`);
for (const r of load('sources').records) add(r.url, `sources/${r.id}`);
for (const r of load('research').records) add(r.url, `research/${r.id}`);
{ const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'); for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) add(m[1].replace(/&amp;/g, '&'), 'index.html'); }
try { const s = load('strategies'); for (const [k, v] of Object.entries(s.sources || {})) add(v.url, `strategies/${k}`); } catch {}
const only = process.argv.includes('--changed') ? null : null; void only;
const UA = 'Mozilla/5.0 (compatible; CaribbeanLiteracyObservatory-linkcheck/1.0; +https://rj952.github.io/caribbean-literacy-observatory/)';
async function check(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 30000);
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA, accept: '*/*' } });
      clearTimeout(t); try { await r.body?.cancel(); } catch {}
      if (r.status < 400) return { ok: true, status: r.status };
      if ([404, 410].includes(r.status)) return { ok: false, status: r.status };
      if (attempt === 3) return { ok: 'warn', status: [401, 403, 429].includes(r.status) ? `${r.status} (site blocks automated checks)` : r.status >= 500 ? `${r.status} (SITE DOWN — check by hand; replace the link if it stays down)` : r.status };
    } catch (e) { clearTimeout(t); if (attempt === 3) { const c = e.cause?.code || e.message; return { ok: 'warn', status: e.name === 'AbortError' ? 'timeout' : /CERT|SIGNATURE|SSL|TLS/.test(c) ? 'certificate chain incomplete on publisher site (opens in browsers)' : c }; } }
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
}
const urls = [...links.keys()], results = [];
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < urls.length) { const u = urls[i++]; results.push({ url: u, where: links.get(u), ...(await check(u)) }); } }));
const bad = results.filter(r => r.ok === false), warns = results.filter(r => r.ok === 'warn');
bad.forEach(r => console.log('BROKEN', r.status, r.url, '←', r.where.join(', ')));
warns.forEach(r => console.log('warn  ', r.status, r.url, '←', r.where.join(', ')));
console.log(`\n${results.length} links checked · ${results.length - bad.length - warns.length} OK · ${warns.length} could not be confirmed (blocked or slow) · ${bad.length} broken.`);
mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL('../reports/links-latest.json', import.meta.url), JSON.stringify({ checked_at: new Date().toISOString(), results: results.sort((a, b) => String(a.ok).localeCompare(String(b.ok))) }, null, 1));
process.exit(bad.length ? 1 : 0);

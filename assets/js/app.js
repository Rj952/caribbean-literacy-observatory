/* Caribbean Literacy Observatory — front end. No build step, no dependencies.
   Data rules: every number shown comes from data/*.json (the verified snapshot) or,
   when reachable, live from the World Bank API. Live values that differ from the
   snapshot are shown as "changed at source — awaiting review". Nothing is estimated. */
{
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u => /^https:\/\//.test(String(u || '')) ? esc(u) : '';
const fmt = (v, unit) => v == null ? '—' : unit === 'index' ? Number(v).toFixed(3) : Number(v).toFixed(1) + '%';
const NOW_YEAR = new Date().getFullYear();
const wbPage = (code, iso3) => `https://data.worldbank.org/indicator/${encodeURIComponent(code)}?locations=${encodeURIComponent((S.c && S.c[iso3] && S.c[iso3].iso2) || iso3)}`;
const srcLinks = o => `<a href="${esc(wbPage(o.indicator, o.country))}">World Bank page</a>`;
const WB = 'https://api.worldbank.org/v2';
const LIVE_EVERY_MS = 30 * 60 * 1000;

const S = { c: {}, live: { mode: 'snapshot', checkedAt: null, sourceUpdated: null, changed: 0, added: 0 }, prefill: null, sessionLog: [] };
const IND = { YT: 'SE.ADT.1524.LT.ZS', YF: 'SE.ADT.1524.LT.FE.ZS', YM: 'SE.ADT.1524.LT.MA.ZS', GPI: 'SE.ADT.1524.LT.FM.ZS', AD: 'SE.ADT.LITR.ZS' };

const STREAMS = [
  ['Foundational literacy', 'How are children acquiring reading and writing competencies?'],
  ['Language and identity', 'How do Caribbean languages influence literacy development?'],
  ['Literacy equity', 'What social, economic and educational factors influence literacy outcomes?'],
  ['Literacy pedagogy', 'Which teaching approaches demonstrate effectiveness in Caribbean contexts?'],
  ['Literacy policy', 'How effectively do national policies respond to literacy challenges?'],
  ['Digital and AI literacy', 'How are emerging technologies transforming literacy practices?'],
  ['Lifelong literacy', 'How does literacy develop beyond formal schooling?']];

/* ---------- status shapes (shape carries meaning, not only colour) ---------- */
const SHAPE = {
  'available': f => `<circle cx="10" cy="10" r="7" fill="${f}"/>`,
  'outdated': f => `<circle cx="10" cy="10" r="6" fill="none" stroke="${f}" stroke-width="2.6"/>`,
  'incomplete': f => `<circle cx="10" cy="10" r="6" fill="none" stroke="${f}" stroke-width="2.2"/><path d="M10 4a6 6 0 0 1 0 12z" fill="${f}"/>`,
  'unavailable': f => `<circle cx="10" cy="10" r="6" fill="none" stroke="${f}" stroke-width="2" stroke-dasharray="2.6 2.4"/>`,
  'not-comparable': f => `<path d="M5 5l10 10M15 5L5 15" stroke="${f}" stroke-width="2.6" stroke-linecap="round"/>`,
  'not-audited': f => `<circle cx="10" cy="10" r="3.2" fill="${f === '#fff' ? '#fff' : '#6b7499'}"/>`};
const LABEL = { 'available': 'Available', 'outdated': 'Outdated', 'incomplete': 'Incomplete', 'unavailable': 'Unavailable', 'not-comparable': 'Not comparable', 'not-audited': 'Not yet audited' };
const icon = (st, f = 'var(--avail)') => `<svg viewBox="0 0 20 20" role="img" aria-label="${LABEL[st]}">${SHAPE[st](f)}</svg>`;
const pill = st => `<span class="pill">${icon(st)}${LABEL[st]}</span>`;

/* ---------- data ---------- */
async function getJSON(p) { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }

async function load() {
  // Core files must load; optional ones fall back to empty so one missing file never blanks the site.
  const core = ['countries', 'indicators', 'observations', 'sources'];
  const optional = { research: { records: [] }, policy: { records: [] }, publications: { records: [] }, changelog: { records: [] },
    settings: { outdated_after_years: 10, gpi_tolerance: 0.01, public_requires_review_status: 'approved', statuses: {}, contact: {} },
    news: null, strategies: null, benchmarks: { meta: { caution: '' }, aggregates: [], records: [], pisa: null } };
  const got = await Promise.all(core.map(n => getJSON(`data/${n}.json`)));
  core.forEach((n, i) => S[n] = got[i]);
  await Promise.all(Object.entries(optional).map(async ([n, fb]) => { try { S[n] = await getJSON(`data/${n}.json`); } catch (e) { S[n] = fb; console.warn('Optional data file missing:', n); } }));
  S.gov = S.settings;
  S.snapshot = S.observations.records.map(r => ({ ...r, origin: 'snapshot' }));
  S.obs = S.snapshot.slice();
  S.countries.records.forEach(c => S.c[c.iso3] = c);
  S.indMap = Object.fromEntries(S.indicators.records.map(i => [i.code, i]));
  S.bench = S.benchmarks.records.slice();
}

const latest = (iso, code) => S.obs.filter(o => o.country === iso && o.indicator === code).sort((a, b) => b.ref_year - a.ref_year)[0];
const threshold = () => NOW_YEAR - S.gov.outdated_after_years;
const bench = (agg, code) => S.bench.filter(b => b.aggregate === agg && b.indicator === code).sort((a, b) => b.ref_year - a.ref_year)[0];
const countryOptions = () => S.countries.records.map(c => `<option value="${esc(c.iso3)}">${esc(c.name)}</option>`).join('') + '<option value="REGIONAL">Regional (several countries)</option>';
const AGG_SHORT = { WLD: 'World', OED: 'OECD', LCN: 'Latin America & Caribbean', CSS: 'Caribbean small states' };

function status(iso, code) {
  const ind = S.indMap[code], c = S.c[iso];
  if (!ind || !ind.audited || !c || !c.in_wdi) return 'not-audited';
  const o = latest(iso, code);
  if (!o) return 'unavailable';
  if (o.ref_year < threshold()) return 'outdated';
  if (code === IND.YT && (!latest(iso, IND.YF) || !latest(iso, IND.YM))) return 'incomplete';
  return 'available';
}

function gpiCheck(iso) {
  const g = latest(iso, IND.GPI); if (!g) return null;
  const f = S.obs.find(o => o.country === iso && o.indicator === IND.YF && o.ref_year === g.ref_year);
  const m = S.obs.find(o => o.country === iso && o.indicator === IND.YM && o.ref_year === g.ref_year);
  if (!f || !m || !m.value) return null;
  const ratio = f.value / m.value, diff = Math.abs(ratio - g.value);
  return { year: g.ref_year, published: g.value, ratio, mismatch: diff > S.gov.gpi_tolerance };
}

/* ---------- live layer ---------- */
async function liveDirect() {
  const iso = S.countries.records.filter(c => c.in_wdi).map(c => c.iso3).join(';');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const out = []; let updated = null;
    for (const code of Object.values(IND)) {
      const r = await fetch(`${WB}/country/${iso}/indicator/${code}?format=json&per_page=5000&date=1960:${NOW_YEAR}`, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const [meta, rows] = await r.json();
      updated = meta && meta.lastupdated || updated;
      (rows || []).forEach(x => { if (x.value != null) out.push({ country: x.countryiso3code, indicator: code, ref_year: +x.date, value: +x.value }); });
    }
    const agg = [];
    for (const code of [IND.YT, IND.YF, IND.YM, IND.AD]) {
      const r = await fetch(`${WB}/country/WLD;OED;LCN;CSS/indicator/${code}?format=json&per_page=50&mrnev=1`, { signal: ctl.signal });
      if (!r.ok) continue;
      const [, rows] = await r.json();
      (rows || []).forEach(x => { if (x.value != null) agg.push({ aggregate: x.countryiso3code, indicator: code, ref_year: +x.date, value: +x.value }); });
    }
    return { records: out, bench: agg, sourceUpdated: updated, mode: 'live-api' };
  } finally { clearTimeout(t); }
}

function applyLive(live) {
  const key = o => `${o.country}|${o.indicator}|${o.ref_year}`;
  const snap = new Map(S.snapshot.map(o => [key(o), o]));
  let changed = 0, added = 0;
  const merged = S.snapshot.map(o => ({ ...o, live: 'not-in-live' }));
  const idx = new Map(merged.map(o => [key(o), o]));
  for (const l of live.records) {
    const k = key(l), s = snap.get(k);
    if (s) {
      const o = idx.get(k);
      if (Math.abs(s.value - l.value) > 1e-6) { o.value = l.value; o.live = 'changed'; o.snapshot_value = s.value; changed++; }
      else o.live = 'match';
    } else if (S.c[l.country]) {
      const snapLatest = Math.max(-Infinity, ...S.snapshot.filter(o => o.country === l.country && o.indicator === l.indicator).map(o => o.ref_year));
      const isNew = l.ref_year > snapLatest;
      if (isNew) added++;
      merged.push({ id: `live-${k}`.toLowerCase().replace(/[|.]/g, '-'), ...l, source_id: 'worldbank-wdi', original_producer: 'UNESCO Institute for Statistics (UIS)',
        source_url: `${WB}/country/${l.country}/indicator/${l.indicator}?format=json&date=${l.ref_year}`, licence: 'CC BY 4.0', retrieved: new Date().toISOString().slice(0, 10),
        verification: { source_check: 'live', scholarly_review: 'pending' }, flags: [], live: isNew ? 'new' : 'history', origin: 'live' });
    }
  }
  S.obs = merged;
  if (Array.isArray(live.bench) && live.bench.length) {
    const base = S.benchmarks.records;
    S.bench = live.bench.filter(b => AGG_SHORT[b.aggregate]).map(b => { const old = base.find(x => x.aggregate === b.aggregate && x.indicator === b.indicator); return { ...b, live: old && (old.ref_year !== b.ref_year || Math.abs(old.value - b.value) > 1e-6) ? 'changed' : 'match' }; });
  }
  S.live = { mode: live.mode, checkedAt: live.checkedAt || new Date().toISOString(), sourceUpdated: live.sourceUpdated, changed, added };
}

async function refreshLive(manual) {
  const msg = $('#liveMsg');
  try {
    const live = await liveDirect();
    applyLive(live);
    if (manual) msg.textContent = `Checked against the World Bank API just now: ${S.live.changed} changed, ${S.live.added} new value(s) since the verified snapshot.`;
  } catch (e) {
    if (S.live.mode !== 'claude-db') S.live.mode = 'snapshot';
    if (manual) msg.textContent = S.live.mode === 'claude-db'
      ? 'This copy is updated by the Observatory\'s scheduled source check rather than from your browser. Latest check shown in the header.'
      : 'The live source could not be reached from this page, so the verified snapshot is shown.';
  }
  renderAll();
}

async function liveViaClaude() {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  let db = null; try { db = await window.claude.use('db'); } catch (e) { return; }
  if (!db) return;
  try {
    db.doc('live/news').onSnapshot(snap => {
      const v = snap && typeof snap.data === 'function' ? snap.data() : snap;
      if (!v || !v.meta || !Array.isArray(v.items) || !v.briefing) return;
      if (S.news && String(v.meta.updated) <= String(S.news.meta.updated)) return;
      S.news = v; renderNews();
    }, () => {});
    db.doc('live/worldbank').onSnapshot(snap => {
      const v = snap && typeof snap.data === 'function' ? snap.data() : snap;
      if (!v || !Array.isArray(v.records)) return;
      if (S.live.mode === 'live-api') return; // browser fetch already gives fresher data
      const recs = v.records.filter(r => r && S.c[r.country] && Object.values(IND).includes(r.indicator) && Number.isFinite(+r.value) && Number.isFinite(+r.ref_year))
        .map(r => ({ country: String(r.country), indicator: String(r.indicator), ref_year: +r.ref_year, value: +r.value }));
      applyLive({ records: recs, sourceUpdated: v.source_last_updated ? String(v.source_last_updated) : null, mode: 'claude-db', checkedAt: v.checked_at ? String(v.checked_at) : null });
      renderAll();
    }, () => {});
  } catch (e) { /* stay on snapshot */ }
}

function renderLiveBadge() {
  let b = $('#liveBadge');
  if (!b) { b = document.createElement('p'); b.id = 'liveBadge'; b.className = 'live-badge'; b.setAttribute('role', 'status'); $('.top').appendChild(b); }
  const L = S.live, when = L.checkedAt ? fmtDateTime(L.checkedAt) : '';
  const src = L.sourceUpdated ? ` · source updated ${esc(L.sourceUpdated)}` : '';
  const ch = L.changed || L.added ? ` · <b>${L.changed + L.added} change(s) awaiting review</b>` : '';
  const maxH = S.gov.data_max_age_hours || 48, ageH = (Date.now() - new Date(S.observations.meta.retrieved + 'T12:00:00Z')) / 36e5;
  b.innerHTML = L.mode === 'snapshot'
    ? (ageH > maxH ? `<span class="pulse off"></span><b>Data last refreshed ${esc(fmtDate(S.observations.meta.retrieved))} — over ${maxH} hours ago; the scheduled update is overdue.</b>` : `<span class="pulse off"></span>Data refreshed ${esc(fmtDate(S.observations.meta.retrieved))} · updated at least every ${maxH} hours`)
    : `<span class="pulse"></span>Live · checked ${esc(when)}${src}${ch}`;
}

/* ---------- views ---------- */
const VIEWS = ['compare', 'home', 'about', 'agenda', 'director', 'dashboard', 'profiles', 'repository', 'publications', 'policy', 'methods', 'collaborate', 'accessibility', 'news', 'strategies'];
function route() {
  closeCite();
  let h = location.hash.slice(1) || 'home', view = h;
  if (h.startsWith('country-')) { view = 'country'; renderCountry(h.slice(8).toUpperCase()); }
  else if (h === 'compare' || h.startsWith('compare-')) { view = 'compare'; renderCompare(h.slice(8)); }
  else if (!VIEWS.includes(h)) view = 'home';
  $$('[data-view]').forEach(s => s.hidden = s.dataset.view !== view);
  $$('#nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + (view === 'country' || view === 'compare' ? 'profiles' : view)));
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  if (view === 'collaborate' && S.prefill) { $('#fPurpose').value = 'Report a data error'; $('#fRef').value = S.prefill; S.prefill = null; }
  window.scrollTo(0, 0);
  const sec = $(`[data-view="${view}"]`), hd = sec && $("h1", sec);
  if (hd) { document.title = (view === "home" ? "" : hd.textContent + ' · ') + 'Caribbean Literacy Observatory'; if (S.routed) { hd.tabIndex = -1; hd.focus({ preventScroll: true }); } }
  S.routed = true;
  if (view === 'collaborate' && S.purpose) { $('#fPurpose').value = S.purpose; S.purpose = null; }
}

function renderHome() {
  const recs = S.countries.records, st = recs.map(c => status(c.iso3, IND.YT));
  const n = k => st.filter(s => s === k).length;
  const avail = n('available') + n('incomplete');
  $('#heroFinding').textContent = `${avail} of ${recs.length} CARICOM member states have a youth literacy figure from ${threshold()} or later in the international record. For the rest, the most recent figure is older, or there is none. Mapping those gaps is the Observatory's first piece of research.`;
  $('#statusCounts').innerHTML = [['available', 'with a recent youth literacy figure'], ['outdated', `whose latest figure predates ${threshold()}`], ['unavailable', 'with no figure in the series'], ['not-audited', 'outside the series, not yet audited']]
    .map(([k, t]) => `<div><b>${n(k)}</b><span>${t}</span></div>`).join('');
  drawSky();
}

function drawSky() {
  const svg = $('#sky'), X = lon => 30 + (lon + 90) / 36 * 500, Y = lat => 20 + (26 - lat) / 22 * 360;
  const nudge = { KNA: [-14, -6], ATG: [10, -8], MSR: [-2, 10] };
  const right = ['KNA', 'ATG', 'MSR', 'DMA', 'LCA', 'VCT', 'BRB', 'GRD', 'TTO'];
  const place = { BHS: ['start', 14, 4], JAM: ['middle', 0, 24], HTI: ['start', 14, 4], BLZ: ['middle', 0, -16], GUY: ['end', -14, 4], SUR: ['middle', 0, 26] };
  let stars = '', seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 70; i++) stars += `<circle cx="${(rnd() * 610).toFixed(1)}" cy="${(rnd() * 400).toFixed(1)}" r="${(rnd() * 1.1 + .3).toFixed(2)}" fill="#fff" opacity="${(rnd() * .35 + .1).toFixed(2)}"${i % 9 === 0 ? ' class="twinkle"' : ''}/>`;
  let grid = '';
  for (let lon = -85; lon <= -55; lon += 10) grid += `<line x1="${X(lon)}" y1="22" x2="${X(lon)}" y2="392" stroke="#fff" stroke-opacity=".12"/><text x="${X(lon) + 3}" y="16" font-size="11" fill="#fff" fill-opacity=".85">${-lon}°W</text>`;
  for (let lat = 10; lat <= 25; lat += 5) grid += `<line x1="12" y1="${Y(lat)}" x2="600" y2="${Y(lat)}" stroke="#fff" stroke-opacity=".12"/><text x="14" y="${Y(lat) - 3}" font-size="11" fill="#fff" fill-opacity=".85">${lat}°N</text>`;
  let marks = '', labels = '';
  const cl = right.map(k => S.c[k]).sort((a, b) => Y(a.lat) - Y(b.lat));
  let ly = 130;
  cl.forEach(c => { const [dx, dy] = nudge[c.iso3] || [0, 0], x = X(c.lon) + dx, y = Y(c.lat) + dy; ly = Math.max(ly + 17, y - 4); c._lab = [x, y, ly]; });
  S.countries.records.forEach(c => {
    const st = status(c.iso3, IND.YT), [dx, dy] = nudge[c.iso3] || [0, 0], x = X(c.lon) + dx, y = Y(c.lat) + dy, o = latest(c.iso3, IND.YT);
    const tip = `${c.name}: ${o ? fmt(o.value) + ' (' + o.ref_year + ')' : 'no published youth literacy figure'} — ${LABEL[st]}`;
    marks += `<a href="#country-${c.iso3.toLowerCase()}" aria-label="${esc(tip)}"><title>${esc(tip)}</title><g transform="translate(${x - 11} ${y - 11}) scale(1.1)">${st === 'available' ? '<circle cx="10" cy="10" r="10" fill="#FFD21F" opacity=".25"/>' : ''}${SHAPE[st](st === 'available' ? '#FFD21F' : '#fff')}</g></a>`;
    const short = c.name.replace('Saint Vincent and the Grenadines', 'St Vincent & Gren.').replace('Saint Kitts and Nevis', 'St Kitts & Nevis').replace('Saint Lucia', 'St Lucia').replace('Antigua and Barbuda', 'Antigua & Barbuda').replace('Trinidad and Tobago', 'Trinidad & Tobago').replace('The Bahamas', 'Bahamas');
    if (c._lab) { const [, , yy] = c._lab; labels += `<path d="M${x + 9} ${y} L462 ${yy - 4} H468" fill="none" stroke="#fff" stroke-opacity=".35"/><text x="472" y="${yy}" font-size="12" fill="#fff">${esc(short)}</text>`; }
    else { const [a, ox, oy] = place[c.iso3]; labels += `<text x="${x + ox}" y="${y + oy}" text-anchor="${a}" font-size="13" font-weight="700" fill="#fff">${esc(short)}</text>`; }
  });
  svg.innerHTML = `${stars}${grid}<text x="250" y="230" font-size="15" font-style="italic" fill="#fff" fill-opacity=".85" font-family="Gloock, Georgia, serif">Caribbean Sea</text><text x="330" y="80" font-size="15" font-style="italic" fill="#fff" fill-opacity=".85" font-family="Gloock, Georgia, serif">Atlantic Ocean</text>${labels}${marks}`;
  $('#skyList').innerHTML = S.countries.records.map(c => { const o = latest(c.iso3, IND.YT); return `<li><a href="#country-${c.iso3.toLowerCase()}">${esc(c.name)}</a>: ${LABEL[status(c.iso3, IND.YT)]}${o ? `, ${fmt(o.value)} in ${o.ref_year}` : ''}</li>`; }).join('');
  $('#skyLegend').innerHTML = ['available', 'outdated', 'unavailable', 'not-audited'].map(k => `<span><svg viewBox="0 0 20 20">${SHAPE[k](k === 'available' ? '#FFD21F' : '#fff')}</svg>${LABEL[k]}</span>`).join('');
}

function renderAgenda() {
  $('#streams').innerHTML = STREAMS.map(([t, q], i) => `<article class="stream"><span class="n">${i + 1}</span><h3>${t}</h3><p>${q}</p></article>`).join('');
}

function refLines(code) {
  const w = bench('WLD', code), o = bench('OED', code);
  return (w ? `<span class="ref" style="left:${w.value}%" aria-hidden="true"></span>` : '') + (o ? `<span class="ref oecd" style="left:${o.value}%" aria-hidden="true"></span>` : '');
}
function refKey(el, code) {
  const w = bench('WLD', code), o = bench('OED', code);
  el.innerHTML = (w ? `<span><i></i>World ${fmt(w.value)} (${w.ref_year})</span>` : '') + (o ? `<span><i class="oecd"></i>OECD members ${fmt(o.value)} (${o.ref_year})</span>` : '');
}
function bars(el, code) {
  const unit = S.indMap[code].unit;
  el.innerHTML = S.countries.records.map(c => {
    const o = latest(c.iso3, code), st = status(c.iso3, code);
    if (!o) return `<div class="bar none"><span class="lab">${icon(st)}${esc(c.name)}</span><div class="track"><span class="val">${st === 'not-audited' ? 'Not in this series' : 'No published figure'}</span></div></div>`;
    const ch = o.live === 'changed' || o.live === 'new' ? ' <span class="flag">changed at source</span>' : '';
    return `<div class="bar"><span class="lab">${icon(st)}${esc(c.name)}</span><div class="track" title="${esc(c.name)} ${fmt(o.value, unit)} (${o.ref_year})">${refLines(code)}<span class="fill${st === 'outdated' ? ' old' : ''}" style="width:${Math.max(0, Math.min(100, o.value))}%"></span><span class="val">${fmt(o.value, unit)} <small>${o.ref_year}</small>${ch}</span></div></div>`;
  }).join('');
}

function renderDashboard() {
  const jm = latest('JAM', IND.YT), jf = latest('JAM', IND.YF), jmm = latest('JAM', IND.YM);
  if (jf && jmm && jf.ref_year === jmm.ref_year) $('#dashTitle').textContent = `In Jamaica, young women's literacy rate is ${(jf.value - jmm.value).toFixed(1)} points above young men's`;
  $('#dashSub').textContent = `${jm ? `Jamaica youth literacy ${fmt(jm.value)} (${jm.ref_year}). ` : ''}Every figure below is as published by the World Bank from UNESCO Institute for Statistics data, with its reference year.`;
  bars($('#barsYouth'), IND.YT); bars($('#barsAdult'), IND.AD); refKey($('#refKeyYouth'), IND.YT); refKey($('#refKeyAdult'), IND.AD); renderBench();
  const lo = 85, pos = v => Math.max(0, Math.min(100, (v - lo) / (100 - lo) * 100));
  const rows = S.countries.records.map(c => ({ c, f: latest(c.iso3, IND.YF), m: latest(c.iso3, IND.YM) })).filter(r => r.f && r.m && r.f.ref_year === r.m.ref_year);
  $('#dumbbell').innerHTML = rows.map(({ c, f, m }) => {
    const a = pos(Math.min(f.value, m.value)), b = pos(Math.max(f.value, m.value)), g = f.value - m.value;
    return `<div class="db"><span>${esc(c.name.replace('Saint ', 'St ').replace(' and the Grenadines', ' & Gren.').replace('Trinidad and Tobago', 'Trinidad & Tobago'))} <small class="note">${f.ref_year}</small></span><span class="sr-only">Female ${fmt(f.value)}, male ${fmt(m.value)}, difference</span><div class="line" aria-hidden="true" title="Female ${fmt(f.value)}, male ${fmt(m.value)}"><span class="seg" style="left:${a}%;width:${b - a}%"></span><span class="pt m" style="left:${pos(m.value)}%"></span><span class="pt f" style="left:${pos(f.value)}%"></span></div><span class="gap">${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(1)}</span></div>`;
  }).join('') + `<div class="db-axis" aria-hidden="true"><span></span><div><span>85%</span><span>90%</span><span>95%</span><span>100%</span></div><span>F − M</span></div>`;
  const cols = S.indicators.records;
  $('#matrix').innerHTML = `<caption class="sr-only">Data status of each indicator for each member state</caption><thead><tr><th>Country</th>${cols.map(i => `<th title="${esc(i.name)}">${esc(i.short)}${i.kind === 'proxy' ? ' (proxy)' : ''}</th>`).join('')}</tr></thead><tbody>${S.countries.records.map(c => `<tr><td><a href="#country-${c.iso3.toLowerCase()}">${esc(c.name)}</a></td>${cols.map(i => { const st = status(c.iso3, i.code), o = latest(c.iso3, i.code); return `<td title="${esc(LABEL[st] + (o ? ' · ' + o.ref_year : ''))}">${icon(st)}</td>`; }).join('')}</tr>`).join('')}</tbody>`;
  $('#matrixLegend').innerHTML = Object.keys(LABEL).map(k => `<span>${icon(k)}${LABEL[k]}</span>`).join('');
  const sel = $('#obsInd');
  if (!sel.options.length) { sel.innerHTML = `<option value="">All audited indicators</option>` + S.indicators.records.filter(i => i.audited).map(i => `<option value="${esc(i.code)}">${esc(i.short)}</option>`).join(''); sel.value = IND.YT; sel.onchange = renderObsTable; }
  renderObsTable();
  if (!$('#citeData')) $('#copyCsv').insertAdjacentHTML('beforebegin', '<button class="btn small ghost" id="citeData" type="button" aria-expanded="false">Cite this data</button>');
  if (!$('#obsCalc')) $('#obsTable').insertAdjacentHTML('afterend', '<p class="calc" id="obsCalc">† Calculated by the Observatory: country value minus the world average, in percentage points. Reference years usually differ, so read it as context, not a ranking.</p>');
}

function renderBench() {
  if (!S.benchmarks.aggregates.length) { $('#comparePanel').hidden = true; $('#pisaPanel').hidden = true; return; }
  const cols = [IND.YT, IND.YF, IND.YM, IND.AD], jam = c => latest('JAM', c);
  const cell = r => r ? `<td class="num"><b>${fmt(r.value)}</b> <small>${r.ref_year}</small>${r.live === 'changed' ? ' <span class="flag">changed at source</span>' : ''}</td>` : '<td class="num">—</td>';
  $('#benchTable').innerHTML = `<caption class="sr-only">Literacy rates for benchmark groups and Jamaica</caption><thead><tr><th>Group</th>${cols.map(c => `<th class="num">${esc(S.indMap[c].short)}</th>`).join('')}</tr></thead><tbody>` +
    S.benchmarks.aggregates.map(a => `<tr><td>${esc(a.name)}</td>${cols.map(c => cell(bench(a.code, c))).join('')}</tr>`).join('') +
    `<tr><td><b>Jamaica</b> <small class="note">(for reference)</small></td>${cols.map(c => cell(jam(c))).join('')}</tr></tbody>`;
  $('#benchNote').textContent = S.benchmarks.meta.caution + ' The Caribbean small states average was last computed for 2008–2009.';
  const P = S.benchmarks.pisa; if (!P) { $('#pisaPanel').hidden = true; return; }
  $('#pisaSub').innerHTML = `A different measure: how well 15-year-olds read on a common test. Source: <a href="${safeUrl(P.url)}">${esc(P.source)}</a>.`;
  $('#pisaBars').innerHTML = P.measures.map(m => `<div class="m"><h3>${esc(m.label)}</h3><div class="row"><span>Jamaica</span><div class="t"><span class="f" style="width:${m.value}%"></span></div><span class="v">${m.value}%</span></div><div class="row"><span>OECD average</span><div class="t"><span class="f o" style="width:${m.oecd}%"></span></div><span class="v">${m.oecd}%</span></div></div>`).join('');
  $('#pisaNotes').innerHTML = P.notes.map(n => `<li>${esc(n)}</li>`).join('');
}

function obsFlags(o) {
  const f = [];
  if (o.indicator === IND.GPI) { const g = gpiCheck(o.country); if (g && g.year === o.ref_year && g.mismatch) f.push('Parity index ≠ female ÷ male'); }
  if (o.ref_year < threshold()) f.push('Outdated');
  if (o.live === 'changed') f.push(`Changed at source (was ${fmt(o.snapshot_value, S.indMap[o.indicator].unit)}) — awaiting review`);
  if (o.live === 'new') f.push('New at source — awaiting review');
  if (o.is_estimate === true) f.push('Published estimate');
  return f;
}
function filteredObs() { const v = $('#obsInd').value; return S.obs.filter(o => !v || o.indicator === v).sort((a, b) => a.country.localeCompare(b.country) || a.indicator.localeCompare(b.indicator) || b.ref_year - a.ref_year); }
function renderObsTable() {
  const rows = filteredObs();
  $('#obsTable').innerHTML = `<caption class="sr-only">Every published record for the selected indicator</caption><thead><tr><th>Country</th><th>Indicator</th><th>Year</th><th>Value</th><th>World</th><th>OECD</th><th>vs world†</th><th>Notes</th><th>Source</th><th>Record</th></tr></thead><tbody>${rows.map(o => {
    const u = safeUrl(o.source_url), ind = S.indMap[o.indicator], w = bench('WLD', o.indicator), oe = bench('OED', o.indicator);
    const d = w ? o.value - w.value : null;
    return `<tr><td>${esc(S.c[o.country]?.name || o.country)}</td><td>${esc(ind?.short || o.indicator)}</td><td class="num">${esc(o.ref_year)}</td><td class="num">${fmt(o.value, ind?.unit)}</td><td class="num">${w ? `${fmt(w.value)} <small>${w.ref_year}</small>` : '—'}</td><td class="num">${oe ? `${fmt(oe.value)} <small>${oe.ref_year}</small>` : '—'}</td><td class="num">${d == null ? '—' : (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + ' pts'}</td><td>${obsFlags(o).map(x => `<span class="flag">${esc(x)}</span>`).join(' ')}</td><td>${srcLinks(o)}</td><td><code>${esc(o.id)}</code> <a href="#collaborate" data-report="${esc(o.id)}">Report</a></td></tr>`; }).join('')}</tbody>`;
}

function renderProfiles() {
  $('#countryGrid').innerHTML = S.countries.records.map(c => {
    const o = latest(c.iso3, IND.YT), st = status(c.iso3, IND.YT);
    return `<a class="ccard" href="#country-${c.iso3.toLowerCase()}"><b>${esc(c.name)}</b>${o ? `<span class="big">${fmt(o.value)} <small>youth, ${o.ref_year}</small></span>` : `<span class="note">No published youth literacy figure</span>`}${pill(st)}</a>`;
  }).join('');
}

function renderCountry(iso) {
  const c = S.c[iso];
  if (!c || !S.obs) { $('#cName').textContent = 'Country not found'; $('#cBody').innerHTML = ''; return; }
  $('#cName').textContent = c.name;
  const cc = $('#cCompare'); if (cc) cc.href = '#compare-' + [iso, ...['JAM', 'TTO', 'BRB'].filter(x => x !== iso)].slice(0, 3).join('-').toLowerCase();
  const audited = S.indicators.records.filter(i => i.audited), gaps = S.indicators.records.filter(i => !i.audited);
  $('#cSub').textContent = c.in_wdi ? `${audited.filter(i => latest(iso, i.code)).length} of ${audited.length} audited international indicators have a published value.` : 'Not covered by the World Bank series. National sources are yet to be audited.';
  const kpis = audited.map(i => { const o = latest(iso, i.code), st = status(iso, i.code); return `<div class="kpi"><span>${esc(i.short)}</span><b>${o ? fmt(o.value, i.unit) : '—'}</b><span>${o ? 'Reference year ' + o.ref_year : 'No published figure'}</span>${(() => { const w = bench('WLD', i.code), oe = bench('OED', i.code); return w || oe ? `<span>World ${w ? fmt(w.value, i.unit) + ' (' + w.ref_year + ')' : '—'} · OECD ${oe ? fmt(oe.value, i.unit) + ' (' + oe.ref_year + ')' : '—'}</span>` : ''; })()}<div>${pill(st)}</div></div>`; }).join('');
  const g = gpiCheck(iso);
  const gpiNote = g && g.mismatch ? `<div class="callout"><b>Consistency check.</b> The published gender parity index for ${g.year} is ${g.published.toFixed(3)}, but the published female and male rates give a ratio of ${g.ratio.toFixed(3)}. Both are shown as published; the difference has been logged for a query to the source.</div>` : '';
  const hist = S.obs.filter(o => o.country === iso && o.indicator === IND.YT).sort((a, b) => a.ref_year - b.ref_year);
  const histNote = hist.length > 1 ? `<p>Youth literacy has ${hist.length} published observations: ${hist.map(o => `${o.ref_year}: ${fmt(o.value)}`).join(' · ')}. No values are drawn between them.</p>` : '';
  const recs = S.obs.filter(o => o.country === iso);
  $('#cBody').innerHTML = `${c.in_wdi ? `<div class="kpis">${kpis}</div>${gpiNote}${histNote}` : `<div class="empty">This member state is not covered by the World Bank literacy series. Its national statistics office and ministry will be audited directly.</div>`}
    <div class="two mt"><div><h2>Gaps still to audit</h2><ul>${gaps.map(i => `<li>${esc(i.short)}${i.kind === 'proxy' ? ' <span class="note">(proxy indicator)</span>' : ''}</li>`).join('')}</ul></div>
    <div><h2>Sources</h2><p>World Bank World Development Indicators, data from the UNESCO Institute for Statistics. Licence CC BY 4.0.</p><p><button type="button" class="btn small ghost" id="citeCountryData" aria-expanded="false">Cite this data</button></p>${iso === 'JAM' ? '<p>National sources queued for audit: STATIN, PIOJ and the Ministry of Education and Youth.</p>' : ''}</div></div>
    ${recs.length ? `<h2 class="mt">Records</h2><div class="scroll"><table class="data stack"><thead><tr><th>Indicator</th><th>Year</th><th>Value</th><th>Notes</th><th>Source</th></tr></thead><tbody>${recs.sort((a, b) => a.indicator.localeCompare(b.indicator) || b.ref_year - a.ref_year).map(o => `<tr><td>${esc(S.indMap[o.indicator]?.short)}</td><td class="num">${o.ref_year}</td><td class="num">${fmt(o.value, S.indMap[o.indicator]?.unit)}</td><td>${obsFlags(o).map(x => `<span class="flag">${esc(x)}</span>`).join(' ')}</td><td>${srcLinks(o)} · <a href="#collaborate" data-report="${esc(o.id)}">Report</a></td></tr>`).join('')}</tbody></table></div>` : ''}`;
}



/* ---------- printing: country briefs and strategy toolkits ---------- */
function printPack(title, kicker, html) {
  let pa = $('#printArea');
  if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
  const today = new Date().toISOString().slice(0, 10);
  pa.innerHTML = `<header class="pr-head"><img src="assets/img/logo.svg" alt="" width="56" height="56"><div><b>Caribbean Literacy Observatory</b><span>${esc(kicker)}</span></div></header><h1>${esc(title)}</h1>${html}<footer class="pr-foot"><p>Printed ${esc(fmtDate(today))} from ${esc(SITE_URL)}${esc(location.hash)}. Statistics: World Bank World Development Indicators, data from the UNESCO Institute for Statistics, CC BY 4.0. Strategies link to their published research.</p><p>Created by Dr. Rohan Jowallah, Ed.D., FHEA · Caribbean Literacy Observatory</p></footer>`;
  $$('button, .cite-panel, [data-report]', pa).forEach(b => b.remove());
  $$('details', pa).forEach(d => d.open = true);
  document.body.classList.add('print-one');
  const done = () => document.body.classList.remove('print-one');
  window.addEventListener('afterprint', done, { once: true });
  try { window.print(); } catch (e) { done(); }
}
function printCountry() {
  const name = $('#cName').textContent;
  const body = $('#cBody').cloneNode(true);
  printPack(`${name}: literacy country brief`, 'Country brief', `<p class="pr-sub">${esc($('#cSub').textContent)}</p>${body.innerHTML}`);
}
function printStrategies(list, title, kicker) {
  const D = S.strategies;
  printPack(title, kicker, `<p class="pr-sub">${esc(D.meta.note || '')}</p>` + list.map(x => stratCard(x, D)).join(''));
}

/* ---------- compare ---------- */
const CMP_AGG = [['WLD', 'World'], ['LCN', 'Latin America & Caribbean'], ['CSS', 'Caribbean small states'], ['OED', 'OECD members']];
function renderCompare(arg) {
  const sels = ['#cmpA', '#cmpB', '#cmpC'].map(x => $(x));
  if (!sels[0].options.length) {
    const opts = S.countries.records.map(c => `<option value="${esc(c.iso3)}">${esc(c.name)}</option>`).join('');
    sels.forEach((x, i) => { x.innerHTML = (i ? '<option value="">None</option>' : '') + opts; x.addEventListener('input', () => { const codes = sels.map(y => y.value).filter(Boolean); history.replaceState(null, '', '#compare-' + codes.join('-').toLowerCase()); renderCompare(codes.join('-')); }); });
    $('#cmpShare').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href.split('#')[0] + location.hash); $('#cmpMsg').textContent = 'Link copied. Anyone who opens it sees this comparison.'; } catch (e) { $('#cmpMsg').textContent = 'Copy this address from your browser bar to share the comparison.'; } });
  }
  let codes = String(arg || '').toUpperCase().split('-').filter(c => S.c[c]).slice(0, 3);
  if (!codes.length) codes = ['JAM', 'TTO', 'GUY'].filter(c => S.c[c]);
  sels.forEach((x, i) => x.value = codes[i] || '');
  const inds = S.indicators.records.filter(i => i.audited);
  $('#cmpBody').innerHTML = inds.map(i => {
    const idx = i.unit === 'index', w = v => idx ? Math.min(100, v / 1.2 * 100) : Math.max(0, Math.min(100, v));
    const row = (name, o, st, cls) => o
      ? `<div class="bar ${cls}"><span class="lab">${st ? icon(st) : ''}${esc(name)}</span><div class="track"><span class="fill${st === 'outdated' ? ' old' : ''}" style="width:${w(o.value)}%"></span><span class="val">${fmt(o.value, i.unit)} <small>${o.ref_year}</small></span></div></div>`
      : `<div class="bar none ${cls}"><span class="lab">${st ? icon(st) : ''}${esc(name)}</span><div class="track"><span class="val">${st === 'not-audited' ? 'Not in this series' : 'No published figure'}</span></div></div>`;
    const countries = codes.map(c => row(S.c[c].name, latest(c, i.code), status(c, i.code), 'cmp-c')).join('');
    const aggs = CMP_AGG.map(([k, n]) => { const b = bench(k, i.code); return b ? row(n, b, null, 'cmp-agg') : ''; }).join('');
    return `<section class="panel cmp-panel"><h2>${esc(i.name || i.short)}</h2>${idx ? '<p class="note">1.00 means equal rates for young women and young men; above 1 favours young women.</p>' : ''}<div class="bars">${countries}</div>${aggs ? `<p class="lbl cmp-sep">Averages for comparison</p><div class="bars">${aggs}</div>` : ''}</section>`;
  }).join('');
  if (S.routed) document.title = 'Compare ' + codes.map(c => S.c[c].name).join(', ') + ' · Caribbean Literacy Observatory';
}

/* ---------- repository ---------- */
function repoIndex() {
  const items = [];
  S.research.records.filter(r => r.review && r.review.status === S.gov.public_requires_review_status).forEach(r => items.push({ type: 'Research record', cite: r.citation, title: r.title, country: r.country, domain: r.domain, year: r.year, text: [r.title, r.findings, r.methodology, r.framework, r.citation, r.level].join(' '), url: r.url, body: `${r.findings} Method: ${r.methodology}.${r.limitations ? ' Limitations: ' + r.limitations : ''} ${r.citation}` }));
  S.obs.forEach(o => { const i = S.indMap[o.indicator], c = S.c[o.country]; items.push({ type: 'Statistic', title: `${c?.name}: ${i?.short} ${fmt(o.value, i?.unit)} (${o.ref_year})`, country: o.country, domain: i?.domain, year: o.ref_year, text: `${c?.name} ${i?.name} ${i?.domain} ${o.ref_year}`, url: wbPage(o.indicator, o.country), body: `${i?.name}. Source: World Bank WDI / UIS. Record ${o.id}.` }); });
  S.sources.records.forEach(s => items.push({ type: 'Source', title: `${s.name} — ${s.publisher}`, country: '', domain: s.indicators.join(', '), year: '', text: [s.name, s.publisher, s.coverage, s.notes, s.indicators.join(' ')].join(' '), url: s.url, body: `${s.coverage}. Access: ${s.access}. Licence: ${s.licence}${s.licence_status === 'verified' ? ' (verified)' : ''}. Audit: ${s.audit}.${s.notes ? ' ' + s.notes : ''}` }));
  return items;
}
function renderRepo() {
  const fc = $('#fCountry'), fd = $('#fDomain');
  if (fc.options.length < 2) {
    fc.innerHTML += countryOptions();
    fd.innerHTML += [...new Set(S.indicators.records.map(i => i.domain))].map(d => `<option>${esc(d)}</option>`).join('');
    ['#q', '#fType', '#fCountry', '#fDomain'].forEach(s => $(s).addEventListener('input', renderRepo));
  }
  const q = $('#q').value.toLowerCase().split(/\s+/).filter(Boolean), t = $('#fType').value, cc = fc.value, d = fd.value;
  const hits = repoIndex().filter(it => (!t || it.type === t) && (!cc || it.country === cc) && (!d || String(it.domain).includes(d)) && q.every(w => (it.title + ' ' + it.text).toLowerCase().includes(w)));
  const approved = S.research.records.filter(r => r.review && r.review.status === 'approved').length;
  $('#repoCount').textContent = `${hits.length} result${hits.length === 1 ? '' : 's'} · ${approved} research record${approved === 1 ? "" : "s"}`;
  const order = { 'Research record': 0, 'Source': 1, 'Statistic': 2 };
  hits.sort((a, b) => order[a.type] - order[b.type] || String(b.year).localeCompare(String(a.year)));
  const shown = hits.slice(0, 60);
  $('#repoResults').innerHTML = (t === 'Research record' && !approved ? `<div class="empty">No research records have been added yet. Entries appear here once they are checked against their sources.</div>` : '') +
    shown.map(it => `<article class="result"><div class="meta"><span class="pill">${esc(it.type)}</span>${it.year ? `<span class="pill">${esc(it.year)}</span>` : ''}${it.domain ? `<span class="pill">${esc(it.domain)}</span>` : ''}</div><h3>${safeUrl(it.url) ? `<a href="${safeUrl(it.url)}">${esc(it.title)}</a>` : esc(it.title)}</h3><p class="note">${esc(it.body)}</p>${it.cite ? `<button type="button" class="btn small ghost cite-item" data-cite-text="${esc(it.cite)}" aria-expanded="false">Copy citation</button>` : ''}</article>`).join('') +
    (hits.length > 60 ? `<p class="note">Showing 60 of ${hits.length}. Narrow the search to see more.</p>` : '');
}

function renderPubs() {
  const SITE = 'https://rj952.github.io/caribbean-literacy-observatory/';
  const nice = d => d ? fmtDate(d) : '';
  const cite = p => `Caribbean Literacy Observatory. (${(p.date || '').slice(0, 4) || 'n.d.'}). ${p.title}${p.series ? ` (${p.series}${p.number ? ' ' + p.number : ''})` : ''}. ${SITE}${p.url && p.url.startsWith('#') ? p.url : ''}`;
  const card = p => {
    const live = p.status === 'published', link = p.url && p.url.startsWith('#') ? esc(p.url) : safeUrl(p.url);
    return `<article class="pub ${live ? 'live' : 'next'}"><div class="pub-side"><span class="series">${esc(p.series)}${p.number ? ' ' + esc(p.number) : ''}</span><span class="st ${live ? 'on' : 'soon'}">${live ? '● Available' : '○ In preparation'}</span>${p.frequency ? `<span class="when">${esc(p.frequency)}</span>` : p.date ? `<span class="when">${live ? 'Published ' : 'Expected '}${esc(nice(p.date))}</span>` : ''}</div><div><h3>${live && link ? `<a href="${link}">${esc(p.title)}</a>` : esc(p.title)}</h3><p>${esc(p.summary)}</p>${live ? `<div class="pub-actions">${link ? `<a class="btn small" href="${link}">Read it</a>` : ''}<button class="btn small ghost" type="button" data-cite="${esc(cite(p))}">Copy citation</button></div>` : ''}</div></article>`;
  };
  const recs = S.publications.records;
  $('#pubNow').innerHTML = recs.filter(p => p.status === 'published').map(card).join('') || '<div class="empty">Nothing published yet.</div>';
  $('#pubNext').innerHTML = recs.filter(p => p.status !== 'published').map(card).join('') || '<div class="empty">Nothing in preparation.</div>';
  const pol = S.policy.records.filter(r => r.review && r.review.status === 'approved');
  $('#policyList').innerHTML = pol.length ? `<div class="toolbar"><label>Country <select id="polCountry"><option value="">All</option>${countryOptions()}</select></label></div><div class="results" id="polResults"></div>`
    : `<div class="empty"><p><b>The archive is open for entries but holds no documents yet.</b></p></div>`;
}

function renderPolicyList() {
  const sel = $('#polCountry'); if (!sel) return;
  const pol = S.policy.records.filter(r => r.review && r.review.status === 'approved' && (!sel.value || r.country === sel.value)).sort((a, b) => (b.year || 0) - (a.year || 0));
  $('#polResults').innerHTML = !pol.length ? `<div class="empty">No documents for ${esc(S.c[sel.value]?.name || 'this selection')} yet. Suggest one through the <a href="#collaborate">Collaborate</a> page.</div>` : pol.map(r => `<article class="result"><div class="meta"><span class="pill">${esc(S.c[r.country]?.name || r.country)}</span><span class="pill">${esc(r.year || 'Year not shown')}</span><span class="pill">${esc(r.type)}</span></div><h3>${safeUrl(r.url) ? `<a href="${safeUrl(r.url)}">${esc(r.title)}</a>` : esc(r.title)}</h3><p class="note">${r.publisher ? `<b>${esc(r.publisher)}.</b> ` : ''}${esc(r.summary || '')}</p></article>`).join('');
}

function renderContact() {
  const mail = S.gov.contact && S.gov.contact.email;
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return;
  $('#contactLine').innerHTML = `Email the Observatory at <a href="mailto:${esc(mail)}">${esc(mail)}</a>.`;
  $('#footEmail').innerHTML = `<a href="mailto:${esc(mail)}">${esc(mail)}</a><br>`;
}

function renderMethods() {
  $('#statusDefs').innerHTML = Object.entries(S.gov.statuses).map(([k, v]) => `<div class="sdef">${icon(k)}<div><b>${LABEL[k]}</b> — ${esc(v)}${k === 'outdated' ? ` (here: reference year before ${threshold()}).` : '.'}</div></div>`).join('');
  const aud = S.indicators.records.filter(i => i.audited), cs = S.countries.records;
  const noYouth = cs.filter(c => status(c.iso3, IND.YT) === 'unavailable').map(c => c.name);
  const oldest = S.obs.filter(o => o.indicator === IND.YT).map(o => o.ref_year);
  const mism = cs.map(c => [c, gpiCheck(c.iso3)]).filter(([, g]) => g && g.mismatch).map(([c, g]) => `${c.name} (${g.year})`);
  const adultOld = cs.filter(c => status(c.iso3, IND.AD) === 'outdated').length;
  $('#auditNote').innerHTML = `<p>Five international literacy series were checked for the ${cs.length} CARICOM member states on ${esc(fmtDate(S.observations.meta.retrieved))}.</p><ul>
    <li>${aud.map(i => `${esc(i.short)}: ${cs.filter(c => status(c.iso3, i.code) === 'available').length} available, ${cs.filter(c => status(c.iso3, i.code) === 'outdated').length} outdated, ${cs.filter(c => status(c.iso3, i.code) === 'unavailable').length} unavailable`).join('</li><li>')}</li>
    <li>No youth literacy figure at all: ${esc(noYouth.join(', ') || 'none')}. Montserrat is outside the series.</li>
    <li>The most recent youth figures span ${Math.min(...oldest)} to ${Math.max(...oldest)}; ${adultOld} member states' latest adult figure predates ${threshold()}.</li>
    <li>Parity index cannot be reproduced from the published female and male rates for: ${esc(mism.join(', ') || 'none')}.</li></ul>
    <p class="note">Draft for review. Foundational reading, national assessments, examination results, digital and disability-disaggregated literacy are not yet audited.</p>`;
  const log = S.changelog.records.concat(S.sessionLog);
  $('#changelog').innerHTML = log.map(e => `<li><b>${esc(fmtDate(e.date))}</b> — ${esc(e.summary)}</li>`).join('') + (S.live.changed + S.live.added ? `<li><b>Live</b> — ${S.live.changed + S.live.added} value(s) differ from the verified snapshot and are awaiting review.</li>` : '');
  $('#retrieved').textContent = fmtDate(S.observations.meta.retrieved);
}

function renderAll() { renderLiveBadge(); renderHome(); renderNews(); renderDashboard(); renderProfiles(); renderRepo(); renderMethods(); if (location.hash.startsWith('#country-')) renderCountry(location.hash.slice(9).toUpperCase()); }

/* ---------- citations (APA 7, MLA 9, BibTeX) ---------- */
const SITE_URL = 'https://rj952.github.io/caribbean-literacy-observatory/';
const ORG = 'Caribbean Literacy Observatory';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MLA_M = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
function citeFormats(c) {
  const now = new Date(), year = c.year || String(now.getFullYear());
  const acc = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`, accMla = `${now.getDate()} ${MLA_M[now.getMonth()]} ${now.getFullYear()}`;
  const author = c.author || ORG, url = c.url || SITE_URL;
  const isData = c.type === 'dataset';
  const apa = isData
    ? `${author}. (${year}). ${c.title} [Data set]. ${c.container || ''}${c.container ? '. ' : ''}Retrieved ${acc}, from ${url}`
    : `${author}. (${year}). ${c.title}${c.kind ? ` [${c.kind}]` : ''}. ${c.container || ORG}. Retrieved ${acc}, from ${url}`;
  const mla = `${author}. "${c.title}." ${c.container || ORG}, ${year}, ${url.replace(/^https?:\/\//, '')}. Accessed ${accMla}.`;
  const key = (author.split(/[\s,]+/)[0] + '_' + year + '_' + String(c.title).split(/\W+/).filter(Boolean).slice(0, 3).join('')).toLowerCase().replace(/[^a-z0-9_]/g, '');
  const bib = `@misc{${key},\n  author = {{${author}}},\n  title = {${c.title}},\n  year = {${year}},\n  howpublished = {\\url{${url}}},\n  note = {${isData ? 'Data set. ' : ''}Accessed ${now.toISOString().slice(0, 10)}}\n}`;
  return [['APA 7', apa], ['MLA 9', mla], ['BibTeX', bib]];
}
function closeCite() { const p = $('#citePanel'); if (!p) return; const b = S.citeBtn; p.remove(); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); } S.citeBtn = null; }
function openCite(btn, c) {
  if (S.citeBtn === btn) { closeCite(); return; }
  closeCite();
  const p = document.createElement('div');
  p.id = 'citePanel'; p.className = 'cite-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Cite: ' + c.title);
  p.innerHTML = `<div class="cite-head"><b>Cite this ${esc(c.what || 'page')}</b><button type="button" class="cite-x" aria-label="Close">×</button></div>` +
    citeFormats(c).map(([f, txt], i) => `<div class="cite-row"><div class="cite-f">${f}</div><pre class="cite-t" id="cite-${i}">${esc(txt)}</pre><button type="button" class="btn small" data-copy="cite-${i}">Copy ${f}</button></div>`).join('') +
    '<p class="note cite-msg" role="status"></p>';
  btn.insertAdjacentElement('afterend', p);
  btn.setAttribute('aria-expanded', 'true'); S.citeBtn = btn;
  p.querySelector('.cite-x').addEventListener('click', closeCite);
  p.addEventListener('keydown', e => { if (e.key === 'Escape') closeCite(); });
  p.addEventListener('click', async e => { const b = e.target.closest('[data-copy]'); if (!b) return; const txt = $('#' + b.dataset.copy).textContent; try { await navigator.clipboard.writeText(txt); p.querySelector('.cite-msg').textContent = `${b.textContent.replace('Copy ', '')} citation copied.`; } catch (err) { const r = document.createRange(); r.selectNodeContents($('#' + b.dataset.copy)); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); p.querySelector('.cite-msg').textContent = 'Copy was blocked — the citation is selected; press Ctrl+C or Cmd+C.'; } });
  p.querySelector('[data-copy]').focus();
}
function pageCitation() {
  const h = location.hash.slice(1) || 'home', sec = $$('[data-view]').find(s => !s.hidden), title = sec && $('h1', sec) ? $('h1', sec).textContent.trim() : ORG;
  return { title: h === 'home' ? 'Caribbean Literacy Observatory: An open data research initiative' : title, url: SITE_URL + (h === 'home' ? '' : '#' + h), what: 'page' };
}
// Brand: marker highlight on the key word of each page heading
function markHeadings() {
  $$('.page-head h1').forEach(h => {
    if (h.querySelector('.mark') || h.children.length) return;
    const t = h.textContent.trim(), i = t.lastIndexOf(' ');
    if (i < 1) return;
    h.textContent = t.slice(0, i + 1);
    const m = document.createElement('span'); m.className = 'mark'; m.textContent = t.slice(i + 1); h.appendChild(m);
  });
}
async function sharePage(btn) {
  const url = SITE_URL + location.hash, title = document.title;
  const say = t => { let r = $('#toast'); if (!r) { r = document.createElement('p'); r.id = 'toast'; r.setAttribute('role', 'status'); r.className = 'toast'; document.body.appendChild(r); } r.textContent = t; r.classList.add('on'); clearTimeout(r._t); r._t = setTimeout(() => r.classList.remove('on'), 3500); };
  if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); say('Link copied: ' + url); } catch (e) { say('Copy this link: ' + url); }
}
function addPageCiteButtons() {
  $$('[data-view]').forEach(sec => {
    const head = $('.page-head .wrap', sec) || $('.hero-text', sec); if (!head || $('.cite-page', head)) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small cite-page'; b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" fill="currentColor"/></svg>Cite this page';
    b.addEventListener('click', () => openCite(b, pageCitation()));
    head.appendChild(b);
    const sh = document.createElement('button'); sh.type = 'button'; sh.className = 'btn small cite-page share-page';
    sh.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.2 1l-7-4a3 3 0 0 0 0-2l7-4A3 3 0 1 0 15 5l-7 4a3 3 0 1 0 0 6l7 4a3 3 0 1 0 3-3" fill="currentColor"/></svg>Share';
    sh.addEventListener('click', () => sharePage(sh));
    head.appendChild(sh);
  });
}
const DATASET_CITE = code => ({ type: 'dataset', what: 'data set', author: 'World Bank', year: (S.observations.meta.source_last_updated || '').slice(0, 4) || String(NOW_YEAR), title: S.indMap[code] ? S.indMap[code].name : 'Literacy indicators', container: 'World Development Indicators (data from the UNESCO Institute for Statistics)', url: `https://data.worldbank.org/indicator/${code}` });

/* ---------- strategies ---------- */
function stratCard(x, D) {
  return `<details class="strat-acc" id="st-${esc(x.id)}"><summary><span class="st-title">${esc(x.title)}</span><span class="st-tags">${x.builds.map(b => `<span class="pill bld">${esc(b)}</span>`).join('')}<span class="pill ev ev-${esc(String(x.strength).split(' ')[0])}">${esc(x.strength)}</span></span></summary>
    <div class="st-body"><div class="meta">${x.settings.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div><p class="lbl">What to do</p><p>${esc(x.do)}</p><p class="lbl">Why it works</p><p>${esc(x.why)}</p>${x.caribbean ? `<p class="carib"><b>Caribbean lens.</b> ${esc(x.caribbean)}</p>` : ''}<p class="src">Sources: ${x.sources.map(k => D.sources[k]).filter(Boolean).map(v => safeUrl(v.url) ? `<a href="${safeUrl(v.url)}">${esc(v.publisher)} (${esc(v.year)})</a>` : esc(v.publisher)).join('; ')}</p><div class="pub-actions"><button type="button" class="btn small ghost cite-item" data-cite-strategy="${esc(x.id)}" aria-expanded="false">Cite</button><button type="button" class="btn small ghost" data-print-strategy="${esc(x.id)}">Print as a card</button></div></div></details>`;
}
function renderStrategies() {
  const D = S.strategies; if (!D || !Array.isArray(D.strategies)) return;
  const stages = [...new Set(D.strategies.map(x => x.stage))];
  const stSel = $('#sStage');
  const plural = n => n + (n === 1 ? ' strategy' : ' strategies');
  if (stSel.options.length < 2) {
    stSel.innerHTML += stages.map(x => `<option>${esc(x)}</option>`).join('');
    $('#lifeline').innerHTML = stages.map((x, i) => `<li><button type="button" data-stage="${esc(x)}" aria-pressed="false"><span class="dot2" aria-hidden="true">${i + 1}</span><b>${esc(x)}</b><small>${plural(D.strategies.filter(y => y.stage === x).length)}</small></button></li>`).join('');
    $('#lifeline').addEventListener('click', e => { const b = e.target.closest('button[data-stage]'); if (!b) return; stSel.value = stSel.value === b.dataset.stage ? '' : b.dataset.stage; renderStrategies(); if (stSel.value) { const g = $(`.stage-acc[data-stage="${CSS.escape(stSel.value)}"]`); if (g) { g.open = true; g.scrollIntoView({ block: 'start' }); } } });
    ['#sStage', '#sSetting', '#sStrength', '#sBuilds'].forEach(id => $(id).addEventListener('input', renderStrategies));
    $('#sOpenAll').addEventListener('click', () => $$('#stratList details').forEach(d => d.open = true));
    $('#sCloseAll').addEventListener('click', () => $$('#stratList details').forEach(d => d.open = false));
    $('#sNote').textContent = D.meta.note;
    $('#sSources').innerHTML = Object.values(D.sources).map(v => `<li>${esc(v.publisher)} (${esc(v.year)}). ${safeUrl(v.url) ? `<a href="${safeUrl(v.url)}">${esc(v.title)}</a>` : esc(v.title)}.</li>`).join('');
    const sc = D.science;
    if (sc) {
      $('#sciIntro').textContent = sc.intro;
      const srcLink = k => { const v = D.sources[k]; return v && safeUrl(v.url) ? `<p class="src">Source: <a href="${safeUrl(v.url)}">${esc(v.title.split(' (')[0])}</a> (${esc(v.year)})</p>` : ''; };
      $('#sciModels').innerHTML = sc.models.map(m => {
        let pic = '';
        if (m.formula) pic = `<div class="formula" role="img" aria-label="${esc(m.formula[0])} times ${esc(m.formula[1])} equals ${esc(m.formula[2])}"><span>${esc(m.formula[0])}</span><b aria-hidden="true">×</b><span>${esc(m.formula[1])}</span><b aria-hidden="true">=</b><span class="res">${esc(m.formula[2])}</span></div>`;
        if (m.strands) pic = `<div class="strands">${Object.entries(m.strands).map(([k, arr]) => `<div><b>${esc(k)}</b><ul>${arr.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`).join('')}<div class="weave" aria-hidden="true">↘ woven together ↙<br><b>Skilled reading</b></div></div>`;
        if (m.items) pic = `<ol class="five">${m.items.map(a => `<li>${esc(a)}</li>`).join('')}</ol>`;
        return `<article class="sci"><h3>${esc(m.title)}</h3>${pic}<p>${esc(m.text)}</p>${srcLink(m.source)}</article>`;
      }).join('');
      $('#sciBeyond').innerHTML = `<b>Beyond phonics.</b> ${esc(sc.beyond)} ${(v => v ? `<a href="${safeUrl(v.url)}">Castles, Rastle &amp; Nation (${esc(v.year)})</a>` : '')(D.sources[sc.beyond_source])}`;
      $('#sciCarib').innerHTML = `<b>Caribbean lens.</b> ${esc(sc.caribbean)}`;
    }
  }
  $$('#lifeline button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stage === stSel.value)));
  const fs = stSel.value, fset = $('#sSetting').value, fev = $('#sStrength').value, fb = $('#sBuilds').value;
  const list = D.strategies.filter(x => (!fs || x.stage === fs) && (!fset || x.settings.includes(fset)) && (!fev || x.strength === fev) && (!fb || x.builds.includes(fb)));
  $('#sCount').textContent = `${list.length} of ${D.strategies.length} strategies`;
  const filtered = fs || fset || fev || fb;
  $('#stratList').innerHTML = list.length ? stages.filter(st => list.some(x => x.stage === st)).map((st, i) => {
    const items = list.filter(x => x.stage === st);
    return `<details class="stage-acc" data-stage="${esc(st)}"${filtered || i === 0 ? ' open' : ''}><summary><span class="dot2" aria-hidden="true">${stages.indexOf(st) + 1}</span><span class="sa-t">${esc(st)}</span><span class="sa-n">${plural(items.length)}</span></summary><div class="stage-body"><div class="stage-tools"><button type="button" class="btn small" data-print-stage="${esc(st)}">Print this stage as a toolkit (${plural(items.length)})</button></div>${items.map(x => stratCard(x, D)).join('')}</div></details>`;
  }).join('') : '<div class="empty">No strategies match these filters.</div>';
}

/* ---------- daily briefing ---------- */
const TYPE_LABEL = { news: 'News', official: 'Official release', opinion: 'Opinion', research: 'Research', headline: 'Automated headline' };
const fmtDateTime = d => { const x = new Date(d); if (isNaN(x)) return ''; return x.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/,? (\d\d:\d\d)$/, ', $1'); };
const fmtDate = d => { if (!d) return 'Date not shown'; const p = String(d).split('-'); if (p.length === 1) return p[0]; const dt = new Date(Date.UTC(+p[0], (+p[1] || 1) - 1, +p[2] || 1)); return dt.toLocaleDateString('en-GB', { timeZone: 'UTC', day: p[2] ? 'numeric' : undefined, month: 'long', year: 'numeric' }); };
const daysOld = iso => Math.floor((Date.now() - new Date(iso)) / 86400000);
function renderNews() {
  const N = S.news; if (!N || !N.meta) return;
  const ed = N.meta.edition, age = daysOld(N.meta.updated);
  $('#newsTitle').textContent = `Caribbean literacy briefing — ${fmtDate(ed)}`;
  $('#newsSub').textContent = `${N.meta.schedule}. Last updated ${fmtDateTime(N.meta.updated)}.`;
  const st = $('#newsStale');
  if (age >= (N.meta.stale_after_days || 2)) { st.hidden = false; st.textContent = `This briefing is ${age} days old. The daily update has not run since; the stories below may not include the latest news.`; } else st.hidden = true;
  $('#briefPoints').innerHTML = (N.briefing.points || []).map(p => `<li>${esc(p)}</li>`).join('');
  $('#dataWatch').innerHTML = (N.data_watch || []).map(w => `<li><b>${safeUrl(w.url) ? `<a href="${safeUrl(w.url)}">${esc(w.label)}</a>` : esc(w.label)}</b><br>${esc(w.detail)}</li>`).join('');
  const items = (N.items || []).slice().sort((a, b) => String(b.date || '0').localeCompare(String(a.date || '0')));
  const cSel = $('#nCountry'), tSel = $('#nTopic');
  if (cSel.options.length < 2) {
    cSel.innerHTML += countryOptions();
    tSel.innerHTML += [...new Set(items.map(i => i.topic).filter(Boolean))].sort().map(t => `<option>${esc(t)}</option>`).join('');
    ['#nCountry', '#nTopic', '#nType'].forEach(id => $(id).addEventListener('input', renderNews));
  }
  const fc = cSel.value, ft = tSel.value, fy = $('#nType').value;
  const shown = items.filter(i => (!fc || i.country === fc) && (!ft || i.topic === ft) && (!fy || i.type === fy));
  $('#newsList').innerHTML = shown.length ? shown.map(i => `<article class="result news-item"><div class="meta"><span class="pill"><time datetime="${esc(i.date)}">${esc(fmtDate(i.date))}</time></span><span class="pill type-${esc(i.type)}">${esc(TYPE_LABEL[i.type] || i.type)}</span>${i.topic ? `<span class="pill">${esc(i.topic)}</span>` : ''}${i.country ? `<span class="pill">${esc(S.c[i.country]?.name || (i.country === 'REGIONAL' ? 'Regional' : i.country))}</span>` : ''}</div><h3>${safeUrl(i.url) ? `<a href="${safeUrl(i.url)}">${esc(i.title)}</a>` : esc(i.title)}</h3><p class="note"><b>${esc(i.source)}.</b> ${esc(i.summary || '')}</p></article>`).join('') : '<div class="empty">No stories match these filters.</div>';
  $('#newsMethod').textContent = `${N.meta.method} ${N.meta.disclaimer}`;
  $('#teaserDate').textContent = `${fmtDate(ed)}${age >= (N.meta.stale_after_days || 2) ? ` · ${age} days old` : ''}`;
  $('#teaserList').innerHTML = items.slice(0, 3).map(i => `<li>${safeUrl(i.url) ? `<a href="${safeUrl(i.url)}">${esc(i.title)}</a>` : esc(i.title)}<span class="src">${esc(i.source)} · ${esc(fmtDate(i.date))}</span></li>`).join('');
}

/* ---------- reading options ---------- */
const OPTS = [
  ['size', 'Text size', [['standard', 'Standard'], ['large', 'Large'], ['larger', 'Larger']]],
  ['contrast', 'Contrast', [['standard', 'Standard'], ['high', 'High contrast']]],
  ['font', 'Font', [['expressive', 'Expressive headings'], ['plain', 'Plain headings'], ['lexend', 'Lexend (easy reading)']]],
  ['spacing', 'Spacing', [['standard', 'Standard'], ['wide', 'Wider']]],
  ['motion', 'Motion', [['system', 'Follow my system'], ['reduce', 'No animation']]],
  ['links', 'Links', [['standard', 'Standard'], ['underline', 'Underline all']]]];
const A11Y_KEY = 'clo-reading-options';
function readOpts() { try { return JSON.parse(localStorage.getItem(A11Y_KEY)) || {}; } catch (e) { return {}; } }
function saveOpts(o) { try { localStorage.setItem(A11Y_KEY, JSON.stringify(o)); } catch (e) { /* not available: settings last for this visit */ } }
function applyOpts(o) {
  const root = document.documentElement;
  const prefersMore = window.matchMedia && matchMedia('(prefers-contrast: more)').matches;
  const eff = { ...o }; if (!eff.contrast && prefersMore) eff.contrast = 'high';
  OPTS.forEach(([k, , vals]) => { const v = eff[k]; if (v && v !== vals[0][0]) root.dataset[k] = v; else delete root.dataset[k]; });
  if (eff.font === 'lexend' && !$('#lexendFont')) { const l = document.createElement('link'); l.id = 'lexendFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap'; document.head.appendChild(l); }
  OPTS.forEach(([k, , vals]) => { const cur = eff[k] || vals[0][0]; const r = $(`input[name="opt-${k}"][value="${cur}"]`); if (r) r.checked = true; });
}
function buildOpts() {
  $('#optGrid').innerHTML = OPTS.map(([k, label, vals]) => `<fieldset><legend>${label}</legend><div class="seg">${vals.map(([v, t]) => `<label><input type="radio" name="opt-${k}" value="${v}"><span>${t}</span></label>`).join('')}</div></fieldset>`).join('');
  $('#optGrid').addEventListener('change', e => { const m = e.target.name && e.target.name.match(/^opt-(.+)$/); if (!m) return; const o = readOpts(); o[m[1]] = e.target.value; saveOpts(o); S.opts = o; applyOpts(o); });
  const btn = $('#optBtn'), panel = $('#a11yPanel');
  const toggle = open => { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) $('input', panel).focus(); else btn.focus(); };
  btn.addEventListener('click', () => toggle(panel.hidden));
  $('#optClose').addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
  $('#optReset').addEventListener('click', () => { saveOpts({}); applyOpts({}); });
  applyOpts(readOpts());
  if (window.matchMedia) matchMedia('(prefers-contrast: more)').addEventListener?.('change', () => applyOpts(readOpts()));
}
const CONTRAST = [
  ['Body text on Sea Salt', '#050E33', '#FFF4C9', 17.04, 4.5], ['Body text on pale sun panels', '#050E33', '#FFE9A0', 15.59, 4.5], ['Secondary text on Sea Salt', '#3A4472', '#FFF4C9', 8.46, 4.5], ['Secondary text on pale sun panels', '#3A4472', '#FFE9A0', 7.74, 4.5], ['Links on Sea Salt', '#1740E0', '#FFF4C9', 6.69, 4.5], ['Links on pale sun panels', '#1740E0', '#FFE9A0', 6.12, 4.5], ['White text on Cobalt', '#FFFFFF', '#1740E0', 7.38, 4.5], ['Sun text on Cobalt', '#FFD21F', '#1740E0', 5.09, 4.5], ['Pale text on Cobalt', '#E6EBFF', '#1740E0', 6.22, 4.5], ['Sun text on Deep Sea', '#FFD21F', '#071A5C', 11.05, 4.5], ['White text on Deep Sea', '#FFFFFF', '#071A5C', 16.01, 4.5], ['Footer text on Deep Sea', '#DFE5FF', '#071A5C', 12.80, 4.5], ['Deep Sea text on Sun', '#071A5C', '#FFD21F', 11.05, 4.5], ['Deep Sea text on Mango', '#071A5C', '#FFAE00', 8.62, 4.5], ['Form field borders', '#4B5A92', '#FFF4C9', 5.99, 3], ['Frames', '#071A5C', '#FFF4C9', 14.52, 3], ['Chart bars on panel track', '#1740E0', '#FFE9A0', 6.12, 3], ['Focus ring on Sea Salt', '#071A5C', '#FFF4C9', 14.52, 3], ['Focus ring on Cobalt', '#FFD21F', '#1740E0', 5.09, 3], ['Body text, dark mode', '#FFF4C9', '#050E33', 17.04, 4.5], ['Secondary text, dark mode', '#C3CCF0', '#050E33', 11.83, 4.5], ['Links, dark mode', '#FFD21F', '#050E33', 12.97, 4.5], ['Text on dark panels', '#FFF4C9', '#0B2470', 12.69, 4.5], ['Secondary on dark panels', '#C3CCF0', '#0B2470', 8.81, 4.5], ['Chart bars, dark mode (Lagoon)', '#19B4F0', '#0B2470', 5.88, 3], ['Field borders, dark mode', '#8E9BD6', '#050E33', 6.99, 3], ['High contrast: text', '#000000', '#FFFFFF', 21.00, 7], ['High contrast: links', '#0000C8', '#FFFFFF', 11.45, 7], ['High contrast: yellow on deep blue', '#FFE066', '#0A2290', 9.79, 7]];
function renderContrast() {
  $('#contrastTable').innerHTML = `<caption class="sr-only">Measured contrast ratios</caption><thead><tr><th>Pair</th><th>Colours</th><th>Ratio</th><th>Needed</th></tr></thead><tbody>${CONTRAST.map(([n, a, b, r, need]) => `<tr><td>${n}</td><td><span class="swatch" style="background:${a}" aria-hidden="true"></span><span class="swatch" style="background:${b}" aria-hidden="true"></span>${a} on ${b}</td><td class="num">${r.toFixed(2)}:1</td><td class="num">${need}:1 ✓</td></tr>`).join('')}</tbody>`;
}

/* ---------- interactions ---------- */
function bind() {
  $('#cBrief')?.addEventListener('click', printCountry);
  document.addEventListener('click', e => {
    const ps = e.target.closest('[data-print-stage]'); if (ps) { const st = ps.dataset.printStage; printStrategies(S.strategies.strategies.filter(x => x.stage === st), `What works: ${st}`, 'Strategy toolkit for families, teachers and communities'); return; }
    const pc = e.target.closest('[data-print-strategy]'); if (pc) { const x = S.strategies.strategies.find(y => y.id === pc.dataset.printStrategy); if (x) printStrategies([x], x.title, `Strategy card · ${x.stage}`); }
  });
  $('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); });
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => { const a = e.target.closest('[data-report]'); if (a) S.prefill = a.dataset.report; const p = e.target.closest('[data-purpose]'); if (p) S.purpose = p.dataset.purpose; });
  $('#copyCsv').addEventListener('click', async () => {
    const head = ['record_id', 'country', 'indicator_code', 'indicator', 'ref_year', 'value', 'licence', 'retrieved', 'source_url', 'notes'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head.join(',')].concat(filteredObs().map(o => [o.id, o.country, o.indicator, S.indMap[o.indicator]?.name, o.ref_year, o.value, o.licence, o.retrieved, o.source_url, obsFlags(o).join('; ')].map(q).join(','))).join('\n');
    try { await navigator.clipboard.writeText(csv); $('#liveMsg').textContent = 'CSV copied. Attribution: World Bank WDI, data from UNESCO Institute for Statistics, CC BY 4.0.'; } catch (e) { $('#liveMsg').textContent = 'Copy was blocked by the browser. Use the Raw JSON link instead.'; }
  });
  $('#liveCheck').addEventListener('click', () => { $('#liveMsg').textContent = 'Checking the source…'; refreshLive(true); });
  $('#contactForm').addEventListener('submit', async e => {
    e.preventDefault();
    const v = id => $(id).value.trim(), m = $('#formMsg');
    const bad = [['#fName', !v('#fName'), 'your name'], ['#fEmail', !/^\S+@\S+\.\S+$/.test(v('#fEmail')), 'a valid email address'], ['#fMsg', !v('#fMsg'), 'a message']];
    bad.forEach(([id, b]) => { $(id).setAttribute('aria-invalid', String(b)); if (b) $(id).setAttribute('aria-describedby', 'formMsg'); else $(id).removeAttribute('aria-describedby'); });
    const miss = bad.filter(x => x[1]);
    if (miss.length) { m.innerHTML = `<span class="err">Please add ${miss.map(x => x[2]).join(', ')}.</span>`; $(miss[0][0]).focus(); return; }
    const text = `To: Caribbean Literacy Observatory\nPurpose: ${v('#fPurpose')}\nFrom: ${v('#fName')} <${v('#fEmail')}>${v('#fAff') ? '\nAffiliation: ' + v('#fAff') : ''}${v('#fRef') ? '\nRecord: ' + v('#fRef') : ''}\n\n${v('#fMsg')}`;
    const out = $('#enquiryOut'); out.textContent = text; out.hidden = false; $('#copyEnquiry').hidden = false;
    const ep = S.gov.contact && S.gov.contact.form_endpoint, mail = S.gov.contact && S.gov.contact.email;
    if (ep && /^https:\/\//.test(ep)) {
      try { const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: v('#fName'), email: v('#fEmail'), affiliation: v('#fAff'), purpose: v('#fPurpose'), record: v('#fRef'), message: v('#fMsg') }) }); m.textContent = r.ok ? 'Thank you — your enquiry has been received.' : 'The form service did not accept the enquiry. Please copy it instead.'; }
      catch (err) { m.textContent = 'The form service could not be reached. Please copy the enquiry instead.'; }
    } else if (mail) {
      const href = `mailto:${mail}?subject=${encodeURIComponent('Caribbean Literacy Observatory: ' + v('#fPurpose'))}&body=${encodeURIComponent(text)}`;
      m.innerHTML = `Your enquiry is ready. <a class="btn small" href="${esc(href)}">Open it in your email app</a> or copy it below and send it to <b>${esc(mail)}</b>.`;
    } else m.textContent = 'Enquiry prepared. Copy it below to keep it.';
  });
  document.addEventListener('click', async e => { const b = e.target.closest('[data-cite]'); if (!b) return; try { await navigator.clipboard.writeText(b.dataset.cite); $('#pubMsg').textContent = 'Citation copied.'; } catch (err) { $('#pubMsg').textContent = b.dataset.cite; } });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-cite-strategy]');
    if (s) { const x = S.strategies.strategies.find(y => y.id === s.dataset.citeStrategy); if (x) openCite(s, { what: 'strategy', title: `${x.title}. In What works to grow readers: Research-based literacy strategies from the early years to adulthood`, url: SITE_URL + '#strategies', year: '2026' }); return; }
    const r = e.target.closest('[data-cite-text]');
    if (r) { (async () => { try { await navigator.clipboard.writeText(r.dataset.citeText); r.textContent = 'Citation copied'; } catch (err) { r.textContent = 'Copy blocked'; } setTimeout(() => { r.textContent = 'Copy citation'; }, 2000); })(); return; }
    if (e.target.closest('#citeData')) { const v = $('#obsInd').value || IND.YT; openCite($('#citeData'), DATASET_CITE(v)); return; }
    if (e.target.closest('#citeCountryData')) { const iso = location.hash.slice(9).toUpperCase(); const c = DATASET_CITE(IND.YT); c.title = `Literacy indicators for ${S.c[iso]?.name || iso} (youth, adult and gender parity series)`; c.url = `https://data.worldbank.org/indicator/${IND.YT}?locations=${S.c[iso]?.iso2 || ''}`; openCite($('#citeCountryData'), c); return; }
    if (S.citeBtn && !e.target.closest('#citePanel') && e.target !== S.citeBtn && !S.citeBtn.contains(e.target)) closeCite();
  });
  $('#copyEnquiry').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#enquiryOut').textContent); $('#formMsg').textContent = 'Copied.'; } catch (e) { $('#formMsg').textContent = 'Copy was blocked; select the text instead.'; } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.live.mode === 'live-api' && Date.now() - new Date(S.live.checkedAt) > LIVE_EVERY_MS) refreshLive(false); });
}

(async () => {
  buildOpts();
  try { await load(); } catch (e) {
    $('#view').insertAdjacentHTML('afterbegin', `<div class="band wrap"><div class="empty" role="alert"><p><b>The Observatory's data could not be loaded just now.</b></p><p>This is usually a brief connection or update problem. <button class="btn small" type="button" onclick="location.reload()">Try again</button></p></div></div>`);
    return;
  }
  if (window.claude) $$('a[href="admin/"]').forEach(a => a.closest('div').lastElementChild === a && (a.previousElementSibling?.remove(), a.remove()));
  renderAgenda(); renderPubs(); renderPolicyList(); $('#polCountry')?.addEventListener('input', renderPolicyList); renderContrast(); renderContact(); renderStrategies(); markHeadings(); addPageCiteButtons(); bind(); renderAll(); route();
  if ('serviceWorker' in navigator && window.top === window && /github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
  refreshLive(false);
  setInterval(() => refreshLive(false), LIVE_EVERY_MS);
  liveViaClaude();
})();
}

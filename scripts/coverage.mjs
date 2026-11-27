// Coverage test: every CARICOM member state must have, for each required category,
// at least one approved literacy source OR an explicitly recorded gap (with a check date).
// Fails (exit 1) on missing coverage, invalid records, or a gap that contradicts a record.
import { readFileSync } from 'node:fs';
const load = f => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url)));
const countries = load('countries').records.map(c => c.iso3);
const D = load('country_sources');
const cats = Object.keys(D.meta.categories), req = D.meta.required;
const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);
const ids = new Set();
const today = new Date();
for (const r of D.records) {
  const at = `country_sources/${r.id}`;
  if (!r.id || ids.has(r.id)) err(`${at}: missing or duplicate id`); ids.add(r.id);
  if (!/^https:\/\//.test(r.url || '')) err(`${at}: url must be https`);
  if (!r.title || !r.publisher || !r.literacy) err(`${at}: title, publisher and literacy note required`);
  if (!Array.isArray(r.countries) || !r.countries.length || r.countries.some(c => !countries.includes(c))) err(`${at}: countries must be CARICOM member ISO3 codes`);
  if (!Array.isArray(r.categories) || !r.categories.length || r.categories.some(c => !cats.includes(c))) err(`${at}: unknown category`);
  if (!r.review || r.review.status !== 'approved' || !r.review.checked_on) err(`${at}: approved review with checked_on required`);
  else if ((today - new Date(r.review.checked_on)) / 864e5 > 120) warn(`${at}: not re-checked for over 120 days`);
}
const has = (c, k) => D.records.some(r => r.countries.includes(c) && r.categories.includes(k));
const gap = (c, k) => (D.gaps || []).find(g => g.country === c && g.category === k);
const matrix = {};
for (const c of countries) {
  matrix[c] = {};
  for (const k of req) {
    const h = has(c, k), g = gap(c, k);
    if (h && g) err(`${c}/${k}: recorded as a gap but a source now exists; remove the gap`);
    if (!h && !g) err(`${c}/${k}: no source and no recorded gap`);
    if (g && (today - new Date(g.checked_on)) / 864e5 > 60) warn(`${c}/${k}: gap last searched ${g.checked_on}; search again`);
    matrix[c][k] = h ? 'source' : g ? 'gap' : 'MISSING';
  }
}
const covered = countries.reduce((n, c) => n + req.filter(k => matrix[c][k] === 'source').length, 0);
const total = countries.length * req.length;
console.log('Coverage (source / gap / MISSING):');
console.log(['', ...req].join('\t'));
for (const c of countries) console.log([c, ...req.map(k => matrix[c][k])].join('\t'));
warnings.forEach(w => console.log('warn ', w));
errors.forEach(e => console.log('ERROR', e));
console.log(`\n${D.records.length} sources · ${covered}/${total} country–category cells covered by a source (${Math.round(covered / total * 100)}%) · ${(D.gaps || []).length} recorded gaps — ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);

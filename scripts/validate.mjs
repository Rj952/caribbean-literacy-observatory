#!/usr/bin/env node
// Enforces the Observatory's data integrity principles on every commit.
// Usage: node scripts/validate.mjs        (exit code 1 on any error)
import { readFileSync } from 'node:fs';

const load = n => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url)));
const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);

const gov = load('settings');
const countries = load('countries').records;
const indicators = load('indicators').records;
const sources = load('sources').records;
const obs = load('observations');
const research = load('research').records;
const policy = load('policy').records;
const pubs = load('publications').records;
const news = load('news');
const benchmarks = load('benchmarks');

const iso = new Set(countries.map(c => c.iso3));
const ind = new Map(indicators.map(i => [i.code, i]));
const src = new Set(sources.map(s => s.id));
const https = u => typeof u === 'string' && /^https:\/\//.test(u);
const thisYear = new Date().getFullYear();

// Directive 10: no synthetic or demonstration data anywhere.
const banned = /\b(demo|sample|synthetic|lorem|placeholder|fake)\b/i;
for (const [name, recs] of [['observations', obs.records], ['research', research], ['policy', policy], ['publications', pubs]]) {
  recs.forEach(r => { if (r.synthetic || r.demo || banned.test(JSON.stringify(r))) err(`${name}/${r.id}: looks like demonstration or synthetic data`); });
}

// Directives 4, 6, 11: provenance on every observation.
const ids = new Set();
for (const o of obs.records) {
  const at = `observations/${o.id}`;
  if (!o.id) err('observation without id'); else if (ids.has(o.id)) err(`${at}: duplicate id`); ids.add(o.id);
  if (!iso.has(o.country)) err(`${at}: unknown country ${o.country}`);
  if (!ind.has(o.indicator)) err(`${at}: unknown indicator ${o.indicator}`);
  else if (!ind.get(o.indicator).audited) err(`${at}: indicator not marked audited`);
  if (!src.has(o.source_id)) err(`${at}: unknown source ${o.source_id}`);
  if (!https(o.source_url)) err(`${at}: source_url must be https`);
  if (!o.licence) err(`${at}: licence missing`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.retrieved || '')) err(`${at}: retrieved date missing`);
  if (!Number.isInteger(o.ref_year) || o.ref_year < 1900 || o.ref_year > thisYear) err(`${at}: bad ref_year`);
  if (typeof o.value !== 'number' || !Number.isFinite(o.value)) err(`${at}: value must be a number`);
  const unit = ind.get(o.indicator)?.unit;
  if (unit === '%' && (o.value < 0 || o.value > 100)) err(`${at}: percentage out of range`);
  if (!o.verification || !o.verification.source_check) err(`${at}: verification.source_check missing`);
  if (o.ref_year < thisYear - gov.outdated_after_years) warn(`${at}: outdated (${o.ref_year})`);
}

// Gender parity consistency (published GPI vs published female/male rates).
for (const g of obs.records.filter(o => o.indicator === 'SE.ADT.1524.LT.FM.ZS')) {
  const f = obs.records.find(o => o.country === g.country && o.ref_year === g.ref_year && o.indicator === 'SE.ADT.1524.LT.FE.ZS');
  const m = obs.records.find(o => o.country === g.country && o.ref_year === g.ref_year && o.indicator === 'SE.ADT.1524.LT.MA.ZS');
  if (f && m && Math.abs(f.value / m.value - g.value) > gov.gpi_tolerance) warn(`${g.country} ${g.ref_year}: published GPI ${g.value.toFixed(3)} ≠ female/male ${(f.value / m.value).toFixed(3)}`);
}

// Directive 15: research and policy records need review metadata and a citation.
const reviewStates = ['draft', 'in_review', 'approved', 'rejected'];
for (const r of research) {
  const at = `research/${r.id}`;
  for (const k of ['id', 'title', 'country', 'domain', 'level', 'year', 'methodology', 'citation']) if (!r[k]) err(`${at}: ${k} missing`);
  if (r.url && !https(r.url)) err(`${at}: url must be https`);
  if (!r.review || !reviewStates.includes(r.review.status)) err(`${at}: review.status must be one of ${reviewStates}`);
  if (r.review?.status === 'approved' && !r.review.checked_on) err(`${at}: approved without checked_on date`);
}
for (const r of policy) {
  if (!https(r.url)) err(`policy/${r.id}: url to the official public copy required`);
  if (!r.review || !reviewStates.includes(r.review.status)) err(`policy/${r.id}: review.status invalid`);
}
for (const p of pubs) if (!['planned', 'draft', 'published'].includes(p.status)) err(`publications/${p.id}: bad status`);
for (const s of sources) if (!https(s.url)) err(`sources/${s.id}: url must be https`);
// News: links only to https sources; no article text beyond a short summary in our own words.
const nIds = new Set();
for (const i of news.items || []) {
  if (!i.id || nIds.has(i.id)) err(`news/${i.id}: missing or duplicate id`); nIds.add(i.id);
  if (!https(i.url)) err(`news/${i.id}: url must be https`);
  if (!i.title || !i.source) err(`news/${i.id}: title and source required`);
  if ((i.summary || '').length > 400) err(`news/${i.id}: summary too long — keep summaries brief and in our own words`);
  if (!['news', 'official', 'opinion', 'research', 'headline'].includes(i.type)) err(`news/${i.id}: bad type`);
}
if (!news.briefing || !Array.isArray(news.briefing.points)) err('news: briefing.points missing');
const aggCodes = new Set(benchmarks.aggregates.map(a => a.code));
for (const r of benchmarks.records) {
  if (!aggCodes.has(r.aggregate)) err(`benchmarks/${r.id}: unknown aggregate ${r.aggregate}`);
  if (!https(r.source_url) || !r.licence || !r.retrieved) err(`benchmarks/${r.id}: provenance missing`);
  if (typeof r.value !== 'number' || r.value < 0 || r.value > 100) err(`benchmarks/${r.id}: bad value`);
}
if (!https(benchmarks.pisa?.url)) err('benchmarks: PISA source url required');
const maxH = gov.data_max_age_hours || 48;
const dataAgeH = (Date.now() - new Date(obs.meta.retrieved + 'T12:00:00Z')) / 36e5;
if (dataAgeH > maxH) warn(`observations: data is ${dataAgeH.toFixed(0)} hours old (limit ${maxH})`);
const strategies = JSON.parse(readFileSync(new URL('../data/strategies.json', import.meta.url)));
for (const st of strategies.strategies) { for (const k of st.sources) if (!strategies.sources[k]) err(`strategies/${st.id}: unknown source ${k}`); }
for (const [k, s2] of Object.entries(strategies.sources)) if (!https(s2.url)) err(`strategies source ${k}: url must be https`);
const age = (Date.now() - new Date(news.meta.updated)) / 864e5;
if (age > 2) warn(`news: briefing is ${age.toFixed(1)} days old`);

warnings.forEach(w => console.log('warn ', w));
errors.forEach(e => console.log('ERROR', e));
console.log(`\n${obs.records.length} observations, ${sources.length} sources, ${research.length} research, ${policy.length} policy records, ${(news.items||[]).length} news items — ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);

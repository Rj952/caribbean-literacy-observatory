#!/usr/bin/env node
// Retrieves the literacy series from the World Bank API, preserves the raw responses,
// and refreshes data/observations.json. Unchanged values keep their review status;
// new or changed values are marked scholarly_review: "pending" and logged.
// Usage: node scripts/fetch-worldbank.mjs   (Node 18+, no dependencies)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root)));
const write = (p, v) => writeFileSync(new URL(p, root), JSON.stringify(v, null, 1) + '\n');

const today = new Date().toISOString().slice(0, 10);
const countries = read('data/countries.json').records.filter(c => c.in_wdi).map(c => c.iso3);
const indicators = read('data/indicators.json').records.filter(i => i.audited && !i.code.startsWith('CLO.')).map(i => i.code);
const obsFile = read('data/observations.json');
const log = read('data/changelog.json');
const prev = new Map(obsFile.records.map(o => [`${o.country}|${o.indicator}|${o.ref_year}`, o]));

mkdirSync(new URL(`data/raw/worldbank/${today}/`, root), { recursive: true });
const records = []; let lastUpdated = null; let changed = 0, added = 0;

for (const code of indicators) {
  const url = `https://api.worldbank.org/v2/country/${countries.join(';')}/indicator/${code}?format=json&per_page=20000&date=1960:${new Date().getFullYear()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(new URL(`data/raw/worldbank/${today}/${code}.json`, root), text); // byte-exact original
  const [meta, rows] = JSON.parse(text);
  lastUpdated = meta?.lastupdated || lastUpdated;
  for (const r of rows || []) {
    if (r.value == null) continue;
    const y = +r.date, k = `${r.countryiso3code}|${code}|${y}`, old = prev.get(k);
    const same = old && Math.abs(old.value - r.value) < 1e-9;
    if (!old) added++; else if (!same) changed++;
    records.push({
      id: `wb-${code}-${r.countryiso3code}-${y}`.toLowerCase().replace(/\./g, '-'),
      country: r.countryiso3code, indicator: code, ref_year: y, value: r.value,
      source_id: 'worldbank-wdi', original_producer: 'UNESCO Institute for Statistics (UIS)',
      source_url: `https://api.worldbank.org/v2/country/${r.countryiso3code}/indicator/${code}?format=json&date=${y}`,
      licence: 'CC BY 4.0', retrieved: today,
      is_estimate: old?.is_estimate ?? null,
      obs_status: r.obs_status || '',
      transformations: [],
      verification: { source_check: 'matched-api-response', scholarly_review: same ? (old.verification?.scholarly_review || 'pending') : 'pending' },
      flags: same ? (old.flags || []) : (old ? [`value changed at source from ${old.value}`] : []),
      notes: old?.notes || ''
    });
  }
}
const removed = [...prev.keys()].filter(k => !records.some(r => `${r.country}|${r.indicator}|${r.ref_year}` === k)).length;

obsFile.meta = { ...obsFile.meta, retrieved: today, source_last_updated: lastUpdated,
  caveat: `Raw API responses preserved in data/raw/worldbank/${today}/.` };
obsFile.records = records.sort((a, b) => a.country.localeCompare(b.country) || a.indicator.localeCompare(b.indicator) || a.ref_year - b.ref_year);
write('data/observations.json', obsFile);
if (changed || added || removed) {
  log.records.push({ date: today, type: 'refresh', summary: `World Bank refresh: ${added} new, ${changed} changed, ${removed} no longer published. Changed and new values await scholarly review.`, records: added + changed + removed });
  write('data/changelog.json', log);
}
console.log(`Retrieved ${records.length} values (source updated ${lastUpdated}). New ${added}, changed ${changed}, removed ${removed}.`);

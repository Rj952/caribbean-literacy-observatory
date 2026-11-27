#!/usr/bin/env node
// Daily headline gathering for the briefing, from the GDELT DOC 2.0 API (open news index).
// Adds headlines (title + link + source + date only — no article text) to data/news.json.
// If no written briefing exists for today, writes an automated digest so the page never
// silently goes stale. Written briefings from the Observatory are never overwritten.
// Usage: node scripts/fetch-news.mjs   (Node 18+, no dependencies)
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../data/news.json', import.meta.url);
const news = JSON.parse(readFileSync(file));
const now = new Date(), today = now.toISOString().slice(0, 10);
const KEEP_HEADLINE_DAYS = 14, KEEP_STORY_DAYS = 400;

const PLACES = '(Jamaica OR Caribbean OR CARICOM OR Barbados OR Trinidad OR Guyana OR Belize OR Bahamas OR Haiti OR Suriname OR "Saint Lucia" OR Grenada OR Dominica OR Antigua OR "St Vincent" OR "St Kitts" OR Montserrat)';
const QUERIES = [
  ['literacy', 'Literacy'],
  ['(reading OR "reading levels" OR "reading programme")', 'Reading'],
  ['("Primary Exit Profile" OR CSEC OR CXC) (English OR literacy)', 'Assessment'],
  ['"digital literacy"', 'Digital literacy']
];
const COUNTRY = { Jamaica: 'JAM', Barbados: 'BRB', 'Trinidad and Tobago': 'TTO', Trinidad: 'TTO', Guyana: 'GUY', Belize: 'BLZ', Bahamas: 'BHS', Haiti: 'HTI', Suriname: 'SUR', 'Saint Lucia': 'LCA', 'St Lucia': 'LCA', Grenada: 'GRD', Dominica: 'DMA', Antigua: 'ATG', 'St Vincent': 'VCT', 'Saint Vincent': 'VCT', 'St Kitts': 'KNA', 'Saint Kitts': 'KNA', Montserrat: 'MSR' };
const guessCountry = t => { for (const [k, v] of Object.entries(COUNTRY)) if (t.includes(k)) return v; return 'REGIONAL'; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const found = [];
for (const [q, topic] of QUERIES) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`${q} ${PLACES} sourcelang:english`)}&mode=artlist&format=json&maxrecords=75&timespan=3d&sort=datedesc`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'CaribbeanLiteracyObservatory/1.0 (open research; github)' } });
    const text = await r.text();
    const j = text.trim().startsWith('{') ? JSON.parse(text) : { articles: [] };
    for (const a of j.articles || []) {
      if (!/^https:\/\//.test(a.url) || !a.title) continue;
      const d = a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}` : today;
      found.push({ id: 'h-' + Buffer.from(a.url).toString('base64url').slice(-24), date: d, title: a.title.trim().slice(0, 220), source: a.domain || new URL(a.url).hostname, url: a.url, country: guessCountry(a.title), topic, type: 'headline', summary: '' });
    }
  } catch (e) { console.log(`GDELT query failed (${topic}): ${e.message}`); }
  await sleep(6000); // GDELT asks for gentle request rates
}

const seen = new Set((news.items || []).map(i => i.url));
const added = found.filter(i => !seen.has(i.url) && !seen.has(i.url.replace(/\/$/, '')) && seen.add(i.url));
const cutoff = days => new Date(now - days * 864e5).toISOString().slice(0, 10);
news.items = [...added, ...(news.items || [])].filter(i => !i.date || i.date >= cutoff(i.type === 'headline' ? KEEP_HEADLINE_DAYS : KEEP_STORY_DAYS));

// Keep the briefing current: if nobody wrote today's briefing, publish an automated digest.
if (news.briefing?.date !== today) {
  const recent = news.items.filter(i => i.date && i.date >= cutoff(7));
  const byCountry = {}; recent.forEach(i => { byCountry[i.country] = (byCountry[i.country] || 0) + 1; });
  const top = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c === 'REGIONAL' ? 'regional' : c} (${n})`).join(', ');
  news.briefing = { date: today, automated: true, points: [
    `Automated digest: ${recent.length} literacy-related stories and releases from the past seven days are listed below${top ? `; most coverage: ${top}` : ''}.`,
    `${added.length} new headline(s) were found in today's check.`,
    'A written briefing will replace this digest when the Observatory reviews today\'s news.'
  ] };
}
news.meta.edition = today;
news.meta.updated = now.toISOString();
news.meta.headline_source = 'GDELT DOC 2.0 API (headline, link, source and date only)';
writeFileSync(file, JSON.stringify(news, null, 1) + '\n');
console.log(`News: ${added.length} new headline(s); ${news.items.length} items kept; briefing ${news.briefing.automated ? 'automated digest' : 'written'} for ${news.briefing.date}.`);

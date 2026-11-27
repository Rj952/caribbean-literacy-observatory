# Caribbean Literacy Observatory

**An open data research initiative.** Open Data · Open Scholarship · Research Integrity
Founder: Dr. Rohan Jowallah

A research website for literacy across the Caribbean. Every statistic on it comes from a public source, carries its reference year, licence and retrieval date, and links to the exact query that returned it. Missing and outdated data are shown as findings, never filled in.

## What is in the site

| Section | What it does |
|---|---|
| Home | Star-chart overview of what the public record holds for the 15 CARICOM member states |
| About | Founding statement and open data commitment |
| Research agenda | Seven streams, first 90 days, flagship project, long-term ecosystem |
| Founder | Profile |
| Strategies | Research-based strategies for improving literacy from the early years to adulthood, at home, in school and in the community |
| Daily briefing | Caribbean literacy news, a short written briefing and a data watch, updated every day |
| Benchmarks | World, OECD, Latin America & Caribbean and Caribbean small states averages beside every figure; OECD PISA 2022 reading proficiency for Jamaica |
| Dashboard | Youth, gender and adult literacy; data-landscape matrix; every record, copyable as CSV |
| Country profiles | One page per member state with status, consistency checks and gaps |
| Repository | Search across approved research records, statistics and sources |
| Publications | Working papers and reports, labelled planned / draft / published |
| Policy archive | Policy and curriculum documents (approved entries only) |
| Methods & data | Pipeline, status definitions, audit note, correction log, data integrity principles |
| Collaborate | Enquiry and error-report form |
| Accessibility | Statement, measured contrast ratios, how to report a barrier |

## Accessibility

Targets WCAG 2.2 AA. Every colour pair is measured (text ≥ 4.5:1, chart marks, borders and focus rings ≥ 3:1); high-contrast mode meets 7:1. A **Reading options** panel lets each reader set text size, high contrast (also automatic with the system's *more contrast* setting), plain or Lexend fonts, wider spacing, no animation and underlined links. Colour never carries meaning alone, every chart has a text equivalent, and focus moves to the page heading on navigation. Not yet independently audited or tested with screen-reader users.

## Live updates

The page checks the World Bank API when it opens and every 30 minutes. Values are compared with the verified snapshot in `data/observations.json`:

- **Match** — shown as verified.
- **Changed or new at source** — shown with the live value and flagged *awaiting review*. The header badge counts them.
- **Source unreachable** — the verified snapshot is shown and the badge says so.

Data must never be more than 48 hours old (`data_max_age_hours` in `data/settings.json`); the site warns openly if that limit is passed. A daily GitHub Action (`daily-update.yml`, 05:17 Jamaica time) re-retrieves the series, preserves the raw responses, gathers news headlines, validates everything, commits and redeploys, so the public site is always current. New or changed statistics go live at once with `scholarly_review: pending` and are flagged on the site until reviewed.

## Daily briefing

`data/news.json` holds the briefing: a few key points, a data watch (when each source last updated), and stories with links and short summaries in the Observatory's own words — never copied article text.
- **Written briefing:** produced each morning by a Claude scheduled task that searches the news and commits the update.
- **Automatic fallback:** `scripts/fetch-news.mjs` (run by the daily Action) adds headlines from the open GDELT news index and, if no written briefing exists for the day, publishes an automated digest labelled as such. The page warns readers if the briefing is ever more than two days old.

When the site is hosted inside Claude, the browser cannot contact outside sites; there a scheduled task checks the source daily and writes the result into the page's own database, which the page reads live.

## Run it locally

No build step and no dependencies.

```bash
python3 -m http.server 8000      # then open http://localhost:8000
node scripts/validate.mjs        # data integrity checks (Node 18+)
node scripts/fetch-worldbank.mjs # refresh data from the World Bank API
```

Opening `index.html` straight from disk will not load the data; serve the folder.

## Deploy on GitHub Pages

1. Create a repository (suggested name `caribbean-literacy-observatory`) and push this folder to `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. The `Validate and deploy` workflow runs the validator and publishes. A failed validation blocks deployment.
4. Settings → Actions → General → allow GitHub Actions to create pull requests (for the daily refresh).

## Editing without code

`/admin/` is a point-and-click editor (Decap CMS) for research records, policy documents, publications and the source catalogue. Every edit becomes a draft → in review → ready pull request, and only records marked **approved** appear on the public site. Setup: `docs/EDITOR-SETUP.md`.

## Data and licences

- Statistics: World Bank World Development Indicators, data from the UNESCO Institute for Statistics, **CC BY 4.0**. Please keep this attribution.
- Licences of other sources are recorded in `data/sources.json`; those marked `to-verify` are not reused until checked.
- Code: MIT (see `LICENSE`).

## Repository layout

```
index.html                 site shell and written content
assets/css/site.css        design
assets/js/app.js           data loading, live checks, charts, search, routing
data/*.json                verified snapshot, catalogue, news, benchmarks, settings
data/raw/                  preserved original retrievals
admin/                     no-code editor
schema/                    PostgreSQL schema and JSON Schemas
scripts/                   validator and World Bank retrieval
docs/                      architecture, data integrity, implementation plan, audit
.github/workflows/         validation, deployment, daily refresh
```

See `docs/` for the architecture, data integrity principles, implementation plan and the first audit note.

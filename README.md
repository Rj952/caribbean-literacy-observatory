# Caribbean Literacy Observatory

**An open data research initiative.** Open Data · Open Scholarship · Research Integrity
Founder and Research Director: Dr. Rohan Jowallah

A research website for literacy across the Caribbean. Every statistic on it comes from a public source, carries its reference year, licence and retrieval date, and links to the exact query that returned it. Missing and outdated data are shown as findings, never filled in.

## What is in the site

| Section | What it does |
|---|---|
| Home | Star-chart overview of what the public record holds for the 15 CARICOM member states |
| About | Founding statement, open data commitment, governance |
| Research agenda | Seven streams, first 90 days, flagship project, long-term ecosystem |
| Research director | Profile (draft, awaiting approval) |
| Dashboard | Youth, gender and adult literacy; data-landscape matrix; every record, copyable as CSV |
| Country profiles | One page per member state with status, consistency checks and gaps |
| Repository | Search across approved research records, statistics and sources |
| Publications | Working papers and reports, labelled planned / draft / published |
| Policy archive | Policy and curriculum documents (approved entries only) |
| Methods & data | Pipeline, status definitions, audit note, correction log, governance directive |
| Collaborate | Enquiry and error-report form |

## Live updates

The page checks the World Bank API when it opens and every 30 minutes. Values are compared with the verified snapshot in `data/observations.json`:

- **Match** — shown as verified.
- **Changed or new at source** — shown with the live value and flagged *awaiting review*. The header badge counts them.
- **Source unreachable** — the verified snapshot is shown and the badge says so.

A daily GitHub Action (`refresh-data.yml`) also retrieves the series, preserves the raw responses and opens a pull request. Merging it, after review, updates the verified snapshot.

When the site is hosted inside Claude, the browser cannot contact outside sites; there a scheduled task checks the source daily and writes the result into the page's own database, which the page reads live.

## Run it locally

No build step and no dependencies.

```bash
python3 -m http.server 8000      # then open http://localhost:8000
node scripts/validate.mjs        # governance checks (Node 18+)
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
- Code: MIT (see `LICENSE`). Site text: proposed CC BY 4.0, subject to the Research Director's approval.

## Repository layout

```
index.html                 site shell and written content
assets/css/site.css        design
assets/js/app.js           data loading, live checks, charts, search, routing
data/*.json                verified snapshot, catalogue, governance settings
data/raw/                  preserved original retrievals
admin/                     no-code editor
schema/                    PostgreSQL schema and JSON Schemas
scripts/                   validator and World Bank retrieval
docs/                      architecture, governance, implementation plan, audit
.github/workflows/         validation, deployment, daily refresh
```

See `docs/` for the architecture, data governance directive, implementation plan and the first audit note.

# Project architecture

The software sits beneath the research functions: it retrieves, checks, stores and displays public evidence. It is never the source of a statistic.

```
Public sources (APIs, datasets, reports)
        │  scripts/fetch-worldbank.mjs  ·  daily GitHub Action  ·  Claude scheduled task
        ▼
Collection ── raw responses preserved in data/raw/<source>/<date>/
        ▼
Validation ── scripts/validate.mjs (provenance, licence, ranges, parity consistency, no demo data)
        ▼
Research database ── data/*.json now; schema/database.sql when it outgrows the repo
        ▼
Scholarly review ── pull requests + /admin editorial workflow; only "approved" scholarship is public
        ▼
Public observatory ── static site (GitHub Pages or Claude) with a live check against source
```

## Choices and why
- **Static, build-free site.** Nothing to compile or maintain; any researcher can read the code; free hosting; long-term sustainability.
- **JSON files in Git as the first database.** Every change is versioned, reviewable and attributable, which gives the version history and correction log the directive requires.
- **Live layer that never overwrites.** Live values are compared with the verified snapshot and flagged, not silently adopted.
- **Decap CMS for editing.** Forms instead of code; edits become pull requests, so review is built in.
- **PostgreSQL schema ready.** When records reach the thousands or need full-text search, load the same fields into `schema/database.sql` (e.g. Supabase).

## Hosting modes
| | GitHub Pages | Claude |
|---|---|---|
| Data files | from the repository | published with the page |
| Live check | browser calls World Bank API | scheduled task writes to the page's database; page reads it |
| Editing | /admin | ask Claude, or edit the repository |

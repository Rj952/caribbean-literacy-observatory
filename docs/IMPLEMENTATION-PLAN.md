# Implementation plan

| Period | Deliverable | State on 27 Nov 2026 |
|---|---|---|
| Days 1–15 | Founding statement and research agenda | Done |
| Days 16–30 | Website prototype and data source audit | Prototype built; first audit pass on 5 World Bank series done |
| Days 31–45 | Searchable research repository | Structure, schema, search and editor built; no records yet |
| Days 46–60 | Jamaica profile and verified dashboard | Profile shows audited international series; national sources (STATIN, PIOJ, MoEY) next |
| Days 61–75 | Initial Caribbean research mapping report | Not started |
| Days 76–90 | Public launch and first working paper | Not started |

## Next technical steps
1. Push to GitHub, enable Pages, run `fetch-worldbank.mjs` once to replace the transcribed snapshot with byte-exact raw responses.
2. Ingest UIS directly and compare with the WDI copies; confirm the UIS licence.
3. Check which CARICOM members have public UNICEF Foundational Learning Skills results.
4. Audit national sources for Jamaica; then expand country by country.
5. Seed the research repository from OpenAlex and ERIC searches, each record reviewed before approval.
6. Confirm the contact address or form service and set it in `data/settings.json`.
7. Set up the editor sign-in (`EDITOR-SETUP.md`).

## Open decisions for the founder
- Confirm the "outdated" threshold (currently 10 years).
- Publish Audit Note 1.
- Set a contact address or form service.

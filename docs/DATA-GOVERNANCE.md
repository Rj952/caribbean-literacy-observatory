# Public data governance directive

The Observatory uses only publicly available datasets and publicly accessible research.

1. Retrieve data exclusively from credible, publicly accessible sources.
2. Prioritise official national, regional and international repositories.
3. Exclude confidential institutional records, private student information and personally identifiable data.
4. Verify the licensing and permitted use of every dataset.
5. Preserve original datasets and keep a documented record of all transformations.
6. Record the source URL, publisher, reference year, publication date, retrieval date and methodological information.
7. Distinguish original published statistics from the Observatory's calculations and interpretations.
8. Identify missing, outdated, incomplete and non-comparable data.
9. Never fabricate, interpolate or extrapolate missing statistics.
10. Never present synthetic or demonstration data on the public platform.
11. Ensure every visualisation can be traced to its original source.
12. Enable users to reach original datasets and reproduce findings, subject to licensing.
13. Distinguish direct literacy measurements from proxy indicators, including examination performance.
14. Avoid presenting correlation as causation.
15. Require scholarly approval before publishing substantive interpretations.
16. Maintain a transparent data catalogue, version history and correction log.

AI may support retrieval, organisation, validation, analysis and visualisation. It must never be the original source of statistical evidence.

## How the code enforces it
| Directive | Where |
|---|---|
| 4, 6 | `validate.mjs` requires licence, https source URL, retrieval date, reference year |
| 5 | `fetch-worldbank.mjs` saves byte-exact raw responses |
| 7 | `transformations` field on every observation; the site shows published values unchanged |
| 8 | status engine in `app.js`; outdated threshold in `data/governance.json` |
| 9, 10 | no interpolation anywhere; validator rejects demo/synthetic markers |
| 11, 12 | every record links to its API query; CSV copy and raw JSON |
| 13 | `kind: proxy` on indicators, labelled in the UI |
| 15 | `review.status = approved` required for research and policy records to appear |
| 16 | Git history, `data/changelog.json`, daily refresh pull requests |

## Data status
Available · Outdated (reference year older than 10 years, configurable) · Incomplete · Unavailable · Not comparable · Not yet audited.

# Repo cleanup

Removed old research records, reference screenshots, previous check captures, asset download tools, source name mappings, and file manager metadata. The four preview READMEs and project lockfiles now use the current preview names. Asset manifests contain local request paths, file types, and sizes, without upstream URLs.

Removed debug source map references from 85 local assets and updated their manifest sizes. Removed inactive development bundles and build caches. Current app assets and required third-party license notices remain.

The shared preview bridge keeps canonical and social page URLs on the local editor routes, including URLs added after page load. Identity checks now validate current preview brands, local identity URLs, local asset manifests, and the absence of capture folders and debug map references. Route checks use the current page files instead of deleted research fixtures.

## Verification

Evidence is in `artifacts/repo-cleanup/`.

| Check | Result |
| --- | --- |
| Project file and asset scan | 1,717 files; no source-name matches. `repo-scan.json` records scope. |
| `npm test` | Exit 0; 16 tests |
| `npm --prefix tervix test` | Exit 0; 15 tests |
| `npm --prefix nuvexa test` | Exit 0; 10 tests |
| `npm --prefix orvian test` | Exit 0; 4 tests |
| `npm --prefix avenlo test` | Exit 0; no tests were discovered |
| Offline builds for Tervix and Nuvexa | Exit 0; asset sizes, local requests, and module imports pass |
| `npm run build` | Exit 0 |
| `node scripts/check-source-subpages.mts` | Exit 0; 127 main routes, 1,570 Avenlo routes, and 163 Tervix pages |
| Late canonical link checks | Exit 0; all four website previews replace an external test URL with the local editor URL. `metadata.json`. |
| `npm run lint:ui` | Exit 0; home page, two sizes and both themes. `lint-ui.json`. |

The identity run checks 767 static text files and 1,787 raw routes. It checks rendered home pages and dashboards at 390 × 844 and 1440 × 900, in light and dark themes: 28 states. It reports no identity metadata failures or failed page loads. The child page UI scan reports design and accessibility findings, so the combined command exits 1. Reports: `artifacts/identity-removal/final/report.json` and `ui.jsonl`. It uses the current project UI policy; no policy settings or exceptions were changed.

An earlier run overlapped a local build and server restart and had three readiness timeouts. The saved attempt is `artifacts/repo-cleanup/identity-during-build.json`. The final run completed all 28 states. The mobile Nuvexa page and a local replacement image were inspected.

## Limits

The file scan excludes installed dependencies, generated bundles, font license metadata, and hosting configuration. Project names in lockfiles are included. These checks remove explicit source records; they do not prove that a design, font, asset, or retained client code cannot be matched to another site. Required license notices remain. Copies outside this directory were not changed.

Checked locally in Chromium. Safari and Firefox were not checked. Not deployed.

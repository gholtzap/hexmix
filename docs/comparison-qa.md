# Palette comparison

## Use

Each preview fills its half of the window. Each uses the same Studio toolbar as a single-site preview. The comparison layout places the five color controls on the first row and the action controls on the second row.

- Select **Palettes** to choose a named saved palette. The comparison starts on the Saved tab. Saved records do not change when colors are edited.
- Use the normal color pickers, shuffle, undo, fonts, and export controls. Manual color edits are stored in the comparison URL and survive reloads. Font changes apply to both previews.
- The theme control changes both previews. It uses neutral text and background colors and keeps the primary, secondary, and accent colors. A mode change clears manual text and background overrides for the previous mode.
- Select a site in **More tools → Previews** to change both previews.
- Select **Compare palettes** in the toolbar menu to open comparison options. These include the shared mode, share link, and **Use palette A/B** links.
- On mobile, use the top A/B controls to switch previews. Both documents stay mounted at the same size. The top controls hide while a picker or panel is open so they do not cover its close button.

Scrolling stays linked. Share links contain both palettes, names, preview, fonts, mode, and manual color overrides. A recipient does not need saved palettes or an account. Older links still work. Clipboard failure leaves the link selected for manual copy.

## Checks

Local target: http://127.0.0.1:3100. Chromium tests used 390 and 1440 px, with light and dark starting palettes. Nested dashboard scrolling also used a 700 px window height so the content could scroll. The project UI policy was unchanged.

| Command | Exit | Result | Evidence |
| --- | --- | --- | --- |
| `npm test` | 0 | 28 tests passed | `artifacts/shared-comparison-toolbar/unit.log` |
| `npm run build` | 0 | Build and TypeScript checks passed | `artifacts/shared-comparison-toolbar/build.log` |
| `APP_URL=http://127.0.0.1:3100/compare npm run lint:ui --silent` | 0 | Closed toolbar states have no findings | `artifacts/shared-comparison-toolbar/lint-ui.json` |
| `APP_URL=http://127.0.0.1:3100 npm run test:comparison:toolbar` | 0 | Mobile and desktop toolbar flows passed; eight UI scans have no findings | `artifacts/shared-comparison-toolbar/report.json` |
| `APP_URL=http://127.0.0.1:3100 npm run test:comparison` | 1 | All four functional flows passed; other UI findings remain | `artifacts/comparison/report.json` |

The toolbar tests check a manual background edit, share-URL reload, shuffle and undo, shared fonts, shared mode, JSON export, comparison options, switching both previews from the existing toolbar menu, and the normal single-site toolbar. UI scans cover the toolbar, open color picker, export dialog, and preview submenu at mobile and desktop sizes. Screenshots are in `artifacts/shared-comparison-toolbar/`.

The full comparison checks cover all six previews, saved palettes, empty results, repeated mode changes, original palette storage, linked page scrolling, nested dashboard scrolling, mobile A/B switching, sharing, clipboard failure, and a recipient with no saved palettes. Geometry assertions check the full window height. Test browser contexts are closed after use. Desktop and mobile screenshots were inspected.

The full report contains 248 UI checks. All 120 checks of the embedded Studio toolbar and its panels have no findings. The 80 comparison-host checks contain 12 unresolved dialog-reference findings: each trigger points to the correct unique dialog ID in the rendered DOM, but Lintapple cannot determine that reference for `aria-haspopup=dialog`. The 48 existing source-preview scans contain 4632 findings across repeated states. These are not distinct bug counts. The full UI check is not a pass. No policy exceptions were added.

## Limits

The feature was not deployed. A team link needs a URL that recipients can reach. The URL does not store votes, dashboard data, scroll position, navigation within a preview, or element-specific role assignments. Safari and Firefox were not checked. The separate contrast suites were not repeated; the changed toolbar states were checked with the project UI policy.

## Top-right palette buttons removed

The desktop Palette A/B buttons were removed. Comparison options still open from **More tools → Compare palettes** in either Studio toolbar. Mobile A/B switching stays available.

`APP_URL=http://127.0.0.1:3100/compare npm run lint:ui --silent` exited 0; report: `artifacts/comparison-no-badges/lint-ui.json`. `npm run test:comparison:toolbar` exited 0 at mobile and desktop sizes; report: `artifacts/shared-comparison-toolbar/report.json`, log: `artifacts/comparison-no-badges/toolbar.log`. Its eight scans cover the toolbar, picker, light-mode export dialog, and preview menu, with no findings. App type checks exited 0; log: `artifacts/comparison-no-badges/types.log`. Desktop screenshot inspected. The full comparison suite and build were not repeated for this removal.

## Comparison scrollbars hidden

Scrollbar tracks and handles are hidden in both source-preview documents, including nested dashboard scroll areas. Scrolling and linked positions remain enabled. The rule is installed and removed by the existing comparison scroll hook, so single-site previews are unchanged.

`APP_URL=http://127.0.0.1:3100/compare npm run lint:ui --silent` exited 0 with no findings; report: `artifacts/comparison-scrollbars/lint-ui.json`. App type checks exited 0; log: `artifacts/comparison-scrollbars/types.log`. Four mobile/desktop and light/dark checks confirmed hidden scrollbars and linked movement in both directions; report: `artifacts/comparison-scrollbars/scrolling.json`. A nested dashboard check confirmed mouse-wheel scrolling and linked movement; report: `artifacts/comparison-scrollbars/wheel.json`. Desktop screenshot inspected; screenshots are in the same directory. Safari and Firefox were not checked.

## Main branch publication checks

The comparison change was prepared in an isolated checkout of the current remote main branch. Other local work was excluded. In that checkout, `npm test` exited 0 with 24 tests, and `npm run build` exited 0. The production server at port 3200 passed all four comparison flows. Its 200 comparison-host and toolbar scans have no findings. The 48 existing source-preview scans contain 4632 findings, so the full comparison command exits 1.

The separate toolbar test passed at 390 and 1440 px. It uses keyboard activation for menu items so pointer movement during a UI scan does not close a submenu. The closed comparison page also passed `lint:ui`. Reports and logs from this production check are retained locally under `artifacts/comparison-publish/`. Public deployment was not checked.

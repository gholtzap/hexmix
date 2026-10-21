# Linked comparison interactions

## Behavior

Page actions are linked by default in `/compare`. The comparison options contain a **Link interactions** checkbox. This setting also controls linked scrolling. A shared link keeps the setting through `linked=0` when it is off.

The two page documents share navigation, menus, dialogs, tabs, search, filters, form input, selected files, and form submission. Controls are matched by their labels and other stable attributes. Palette editing, shuffle, save, and export remain separate. The existing shared font, theme, and preview controls remain shared.

When linking is enabled again, future actions are linked. Changes made while linking was off are not replayed. Hover and pointer position are not linked.

On mobile, the A/B controls have a separate 52 px row above the preview. This prevents the controls from covering page navigation.

## Test scope

The feature was checked in a separate checkout based on `origin/main` at `085ac985cb48f42f7ee5c0e6d34dfdbdc8a802ce`. Other work was changing the shared view-state code in the main checkout. That concurrent work was excluded from these results. The feature changes are also present in the main checkout.

All commands below used `http://127.0.0.1:3300`.

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` | 0 | 25 tests passed, including comparison-link parsing and round trips. |
| `npm run build` | 0 | Browser assets, type checks, and Next.js build completed. |
| `APP_URL=http://127.0.0.1:3300/compare npm run lint:ui --silent` | 0 | Mobile and desktop, light and dark: no findings on the comparison page. |
| `APP_URL=http://127.0.0.1:3300 COMPARE_QUICK=1 npm run test:comparison` | 0 | One flow, 44 UI checks, no findings. Includes linked scrolling. |
| `APP_URL=http://127.0.0.1:3300 npm run test:comparison:interactions` | 1 | All four action flows passed. Embedded-page UI findings prevent a full UI pass. |

The interaction test used widths of 390 and 1440 px in both light and dark modes. It checked all six previews. It checked open menus, outside-click and Escape dismissal, open dialogs, search, filters, navigation, accordion controls, and linking off and on. It also checked separate palette shuffle, file selection, and exactly one chat message per Enter or Send action. No page errors were recorded.

The 64 UI scans include 24 scans of the comparison page with no findings. The 40 embedded-page scans recorded 4,649 findings across repeated states. These include viewport bounds, typography, clipping, contrast, dialog focus, and control rules. The policy was not changed. These embedded pages are not UI-clean.

Screenshots were reviewed for the mobile comparison options and desktop workspace. JSON reports, screenshots, and command logs are in `artifacts/linked-interactions/`. `report.json` contains the final interaction run; `lint-ui.json` contains the separate comparison-page check. Files named `failed` and `initial-full-report.json` are from earlier test runs.

## Limits

Chromium was checked locally. Firefox, Safari, and public hosting were not checked. The combined main checkout needs its own checks after the concurrent work is complete. An extra check of independent scrolling while linking is off did not finish before the disk filled; no result is claimed for that check. The existing linked-scroll regression passed.

## Check before push

The feature commit was applied without conflicts on top of `main` at `c89da379b6518abfdff268e36891331087a133ac`. The 29 unit tests and production build passed, both with exit 0. The production server used port 3310.

`APP_URL=http://127.0.0.1:3310/compare npm run lint:ui --silent` completed with exit 0: four mobile and desktop theme runs, no findings. `APP_URL=http://127.0.0.1:3310 LINK_QUICK=1 npm run test:comparison:interactions` passed the desktop light action flow across all six previews with no page errors. It returned exit 1 because of the embedded-page UI findings. The comparison controls had no findings. Reports from this check are kept in `artifacts/linked-interactions/publish/` in the working repository.

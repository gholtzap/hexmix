# Mobile layout checks

Date: 2026-10-20

## Changes

- The phone toolbar uses one row: five colors and a Tools menu. Its normal height is 60 px at 320 px screen width. The menu includes fonts, palettes, theme controls, and preview links.
- Color, font, palette, and export panels fit the visible screen. Inputs use 16 px text. Phone controls have a touch area of at least 44 px.
- The palette browser uses one scroll area on phones. The header stays visible. The list keeps its scroll position when a palette is applied or the panel is reopened.
- Preview pages receive the same phone touch styles. The phone dashboard uses its full size. Preview content cannot cause horizontal page scrolling.
- The homepage has the color toolbar on the first screen.

## Test setup

The production build ran in an isolated copy at `/tmp/hexmix-mobile-check`, on port 3300. This kept the shared development server on port 3100 available. The reports are saved in `artifacts/mobile-improvements/`. The project UI policy was unchanged.

| Command | Result | Coverage or report |
| --- | --- | --- |
| `npm run build` | Exit 0 | Isolated production build; `build-final.log` |
| `npm run typecheck` | Exit 0 | Current workspace; `typecheck-final.log` |
| `npm test` | Exit 0 | 26 tests; `unit.log` |
| `APP_URL=http://127.0.0.1:3300 npm run lint:ui` | Exit 0 | Homepage, both themes, 390 and 1440 px; `home-ui.json` |
| `APP_URL=http://127.0.0.1:3300 npm run test:mobile` | Exit 0 | Eight flows, 82 UI states, no findings; `reports/mobile-improvements/mobile-report.json` |
| `npm run test:picker` | Exit 0 | Picker actions and 44 UI states; `reports/reui/picker-report.json` |
| `npm run test:palettes` | Exit 0 | Saved data, 3,000 palettes, filters, Load more, scroll retention, and 50 UI states; `reports/palettes/report.json` |
| `npm run test:site-switcher` | Exit 0 | 52 UI states; `reports/site-switcher/` |
| `npm run test:home` | Exit 0 | 64 UI states; `reports/home/` |
| `npm run test:thumbnails` | Exit 0 | 11 screenshot and color checks; `thumbnails.log` |
| `npm run capture:previews` | Exit 0 | Six previews in both themes; `captures.log` |
| `APP_URL=http://127.0.0.1:3300 npm run test:mobile:previews` | Exit 1 | 24 page checks passed; 40 UI reports have 3,998 findings; `reports/mobile-improvements/preview-report.json` |

The mobile flows cover 320 × 568, 390 × 844, 844 × 390, and 1440 × 900, in both palette themes. They use touch input for compact layouts. States include all five color pickers, a locked color, fonts, open menus, saved palettes, name errors, empty results, filters, Load more, undo, redo, theme changes, export, and toolbar collapse. Short-screen and visual viewport probes check panel bounds with viewport offsets of 0 and 48 px.

The preview checks cover Avenlo, Tervix, Nuvexa, Orvian, workspace, and infrastructure at 320 and 390 px, in both themes. They check open navigation menus, touch target sizes, and page width. No horizontal page overflow remained. Full UI checks still report existing font, contrast, decorative clipping, and accessibility findings in these templates. These pages do not have a clean full UI report.

## Limits

- Chromium touch simulation was used. Safari, physical phones, and a physical on-screen keyboard were not checked.
- The current local app was also opened at 320 × 568 on port 3100. The toolbar measured 60 px and the Primary color picker opened.
- A push to main does not prove that the public deployment is ready.

## Release checks on 2026-10-21

The release checkout starts from main commit `7373370`. It contains the mobile changes and shared homepage toolbar. Comparison and element-selection changes from other local tasks are excluded. The existing repository link is kept.

The exact release files passed `npm run build`, `npm run test:home` (64 UI states), `npm run test:mobile` (82 UI states), `npm run test:palettes` (50 UI states), and `npm run lint:ui`. Each command returned exit 0. Browser checks used `APP_URL=http://127.0.0.1:3300`. The reports and logs are saved in the original workspace at `artifacts/mobile-improvements/release-20261021/`.

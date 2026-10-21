# Shared views

## Link contract

- Colors and fonts use the existing query fields. The editor updates these fields after a change and keeps other route fields.
- Small view settings use version 1 state in the query. Larger live state uses the URL fragment to avoid HTTP header limits.
- Share captures the current page and its same-origin previews. It uses a direct link for small public state, or an immutable `/s/<id>` snapshot for drafts and large data.
- Snapshots contain copies. A shared palette collection does not replace the recipient's saved palettes.
- A snapshot link is public to anyone with the link. It is not an access control system. Do not put confidential text in a shared draft.
- Password inputs and environment variable values are excluded. The source session keeps these values. Binary files, browser permission prompts, and live recording sessions are not copied.
- State is limited to 4 MB. Invalid versions, unsafe object keys, excessive nesting, external routes, and external write origins are rejected.
- Snapshot IDs have 128 random bits. Snapshot writes do not overwrite an existing record.

## State owners

Use `useLinkState` with a stable field key for React controls. Use its validator for enums, nullable data, and records. Use `private: true` for draft data that must stay out of the live address. Use a redactor for protected fields. Redaction rules stay for the session because private drafts can outlive their controls.

Use `registerSharedView` for authored browser controls. The shared document adapter restores native menus, tabs, forms, dialogs, and scroll positions. It excludes controls that have a named React state owner. Restoration does not repeat form submissions.

Each preview gets a page and frame scope. Comparison sides have separate frame scopes. Only the current route's data is included when Share is used.

## Storage

`BLOB_READ_WRITE_TOKEN` enables Vercel Blob storage. The `hexmix-shares` store is connected to the project's development, preview, and production environments. Pull the environment with the normal Vercel setup before a local test. Keep the token out of source control.

Local development without a Blob token uses `.local/shares`. Vercel fails the request if storage is not configured. Server errors produce a retry message. If the clipboard is blocked, the interface displays the complete link for manual copy.

The write endpoint has a per-process limit of 60 requests per IP per hour. This is not a global rate limit. Add a shared rate limit if public write volume requires it.

## Checks

Reports are under `artifacts/shareability/`.

- `npm test`: 40 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed in the isolated production copy at `/tmp/hexmix-share-check`.
- `APP_URL=http://127.0.0.1:3300 npm run test:sharing`: exit 0; four phone/desktop and theme flows, 22 UI states, zero UI findings. Includes fresh-browser restoration, Back, color address updates, open picker, locks, history, palette filters and batch, export, dashboard grid and project, 3,000 saved palettes, and an unsaved task draft.
- `APP_URL=http://127.0.0.1:3300 node scripts/check-sharing-details.mts`: exit 0; seven checks and five UI states, zero UI findings. Covers protected fields, closed drafts, demo errors, comparison options, clipboard failure, invalid requests, and a missing snapshot.
- `APP_URL=http://127.0.0.1:3300 npm run lint:ui`: exit 0; homepage check with the unchanged project policy and zero findings. JSON is in `home-ui.json`.
- `node scripts/check-sharing-pages.mts`: page inventory checks. The base report covers 37 pages at two sizes and both themes: 148 checks, 96 fresh-browser search restorations, and 4,105 UI findings. `CHILD_ONLY=1` covers 85 child pages: 340 checks and 62,287 UI findings. These checks returned exit 1. The preview pages are not UI-clean. Full JSON reports are retained.

The inventory covers 122 distinct pages. It does not prove every possible action sequence. The interactive share checks use Chromium with phone-size viewports, not physical phones or Safari.

The local checks do not establish a deployed release.

The 39 synthetic snapshots were deleted after the checks. The isolated test server and copy were removed. The shared development server on port 3100 was left running and returned HTTP 200 for `/editor`.

## Three confirmed problems: repeat check

The current development app on port 3100 passed `APP_URL=http://127.0.0.1:3100 npm run test:sharing` with exit 0. The repeat check covers 390 px and 1440 px in light and dark themes.

- Share keeps `view=grid` and `preview=acme-web`. A fresh browser shows the grid and open project preview.
- Committing Primary `123456` updates the editor address. The copied address and Share link restore that same color.
- The Dashboard category stays selected after reload, in a fresh browser, and after Back.

The test now has explicit assertions for category reload and matching address/share colors. All 22 UI states passed with zero findings under the unchanged policy. Script type checking passed. Reports: `artifacts/shareability/three-problems-results.json` and `three-problems-report.json`. Test snapshots were deleted after the check. No app source change was needed for this repeat check.

## Main integration check

The final change was applied to main commit `6f685db` in a separate worktree. `npm test` passed all 40 tests. `npm run build` passed, including the full type checks. On its production server at port 3400, `npm run test:sharing` and `node scripts/check-sharing-details.mts` both returned exit 0: 27 UI states, zero findings. These integration checks used the local snapshot store. Vercel Blob read/write restoration was verified in the earlier check.

Reports were retained in `artifacts/shareability/main-integration/`, with build and test logs in `artifacts/shareability/main-*.log`. No deployed-site check was made for this push.

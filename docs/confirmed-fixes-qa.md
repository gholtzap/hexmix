# Confirmed bug fixes

The ten reported bugs are fixed in the local app. Checks used Chromium at `http://127.0.0.1:3100`. These results do not prove a public deployment.

## Fixes

| ID | Fix | Browser check |
| --- | --- | --- |
| HX-001 | Read the current saved palettes before each edit. Use a shared browser lock and storage events. | Save from two tabs, rename and remove across tabs, then save from two tabs at the same time. |
| HX-006 | Close a support case by its ID. | Create two cases with the same subject. Close one and confirm the other stays open. |
| HX-009 | Include sites in Trash. | Move a site to Trash, restore it, and confirm it returns to Sites. |
| HX-003 | Use the same project-name validation for create and rename. | Reject an existing name, then save a unique name. |
| HX-004 | Validate each domain label and its length. | Reject `-bad..com`, then save `app.example.com`. |
| HX-005 | Read the connected repository in cards, search, and project details. | Connect a repository and check the card and Source field. |
| HX-010 | Use the same conversation state for Search and Recents. | Send a message, then reopen the chat through Search and compare all messages. |
| HX-012 | Keep the draft outside the input element. | Visit the file library and return. Check that New chat clears the draft. |
| HX-007 | Read the saved profile name when the view is rendered. | Save a name, change pages, and check the name, initials, and profile menu. |
| HX-008 | Derive the header checkbox state from visible items. | Filter selected items, then check full and partial selection. |

The UI checks also found missing tooltips on partly visible controls and a profile label that did not include its visible initials. These were corrected with the existing tooltip code. The UI policy was not changed.

## Checks

- `npm test`: exit 0; 18 tests passed.
- `npm run build`: exit 0; includes all TypeScript checks and browser script output.
- `APP_URL=http://127.0.0.1:3100 node scripts/check-confirmed-fixes.mts`: all 40 actions passed; exit 1 from two mobile tooltip overlaps. Report: `artifacts/confirmed-fixes/before-tooltip-spacing.json`.
- After the spacing fix, `APP_URL=http://127.0.0.1:3100 node scripts/check-confirmed-fixes.mts palettes`: exit 0; all four palette flows and eight UI checks passed. Report: `artifacts/confirmed-fixes/palette-final.json`.
- `artifacts/confirmed-fixes/report.json` combines the unchanged dashboard results with the final palette checks: 40 action flows, 112 UI checks, no findings or page errors.
- `APP_URL=http://127.0.0.1:3100 npm run lint:ui --silent`: exit 0; no findings. Report: `artifacts/confirmed-fixes/lint-ui.json`.

The regression script checks all ten actions at 390 × 844 and 1440 × 1000, in light and dark themes. It checks the editor and each changed dashboard state with the project UI policy. States include validation errors, renamed projects, repository details, support cases, the Trash menu and empty Trash, chat search, restored messages and drafts, the profile menu, and full or partial selection. It also checks the color tooltips with pointer and keyboard controls. Screenshots and JSON reports are in `artifacts/confirmed-fixes/`. Selected mobile and desktop screenshots were also inspected.

An earlier browser run used an older server on port 3000. It is not evidence for these fixes. One build attempt met a build lock; a later attempt completed. Neither server nor lock owned by another session was removed.

## Limits

Safari and Firefox were not checked. The changes were not deployed.

Browsers with Web Locks can serialize palette edits across tabs. Older browsers without that API read the latest data before each edit, but edits at exactly the same time can still conflict. The code records this limit.

Chat messages and drafts remain in the current page session. This fix does not add storage across reloads. Dashboard changes continue to use the existing sample data.

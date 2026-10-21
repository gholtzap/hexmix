## Mobile support

- Mobile support is a requirement for every page and feature. It is not optional.
- Keep content readable and controls usable on small screens. Prevent unintended horizontal scrolling and overlapping content.
- Check each UI change at mobile and desktop sizes, including menus, dialogs, and error states. Fix mobile issues before the work is complete.

## UI component reuse

Use icon buttons with accessible names and tooltips for actions. Do not use text-based action buttons.

Use [AICSS](https://www.aicss.dev/) and [Halaska UI](https://ui.halaska.com/components) components when they support the required behavior. Check these libraries and the existing repo components before writing a new control. Keep the page layout, color controls, and font controls when replacing a component. Record the source and license for copied library code.

## Preview text contrast

- Use the shared contrast helpers to select readable text for each surface. Keep the selected palette values unchanged. Require a text contrast ratio of at least 4.5:1.
- Check the visible background, including textures, gradients, artwork, and opacity. Put the selected background on the control itself. An ancestor background color can differ from the visible background.
- After contrast changes, run `npm run test:contrast:all`, `npm run test:contrast:actions`, `npm run test:contrast:guard`, and `npm run lint:ui`. Check mobile and desktop sizes, both themes, and open controls. Wait for the requested palette and animations before measurement. Report incomplete checks and unresolved findings.
- Run `npm run capture:previews` and `npm run test:thumbnails` after preview design changes so that homepage thumbnails match the pages.

## Preview integration

- Keep homepage routes and child app URLs in `src/lib/previews.ts`. Edit `browser/public/color-bridge.ts` for behavior shared by the four iframe previews. `npm run build:browser` creates `public/color-bridge.js`. Dashboard previews use separate styles.
- Make visible colors, icons, SVGs, and replacement media follow the five palette roles. Keep original site, company, and person names and images out of visible previews.
- For color checks and captures, wait until `data-contrast-ready="true"` and `data-contrast-palette` matches the requested palette. Open previews through the editor route; direct child URLs do not receive its palette.
- On public previews, use saved `PreviewThumbnail` captures. A remote browser cannot load child apps at `127.0.0.1` on this computer.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

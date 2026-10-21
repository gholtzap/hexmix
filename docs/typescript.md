# TypeScript source and build outputs

Use Node.js 24 or later. The Node scripts run directly from `.mts` files. No extra runtime or bundler is required.

## Source files

- `src/`: the React app, preview components, API handlers, and shared helpers. These use strict TypeScript checks.
- `browser/`: TypeScript for the browser scripts. Keep the existing public JavaScript URLs when changing these files.
- `scripts/` and each preview's `scripts/`: Node scripts and tests in TypeScript.
- `config/postcss.config.mts`: the source for the generated PostCSS config.
- `scripts/browser-files.json`: maps each generated public file to its TypeScript source. Several old and new URLs share one source file.

Do not edit a generated `.js` file. Run `npm run build:browser` after editing browser code. The `dev` and `build` commands run this step automatically. It also updates the generated file sizes in the captured asset lists.

## Checks

Run `npm run typecheck`. This checks the app, browser code, and Node scripts. It also rejects project JavaScript outside the declared build outputs.

The legacy browser scripts and test scripts allow implicit parameter types and nullable DOM access. Their separate configs keep this limit clear. The React app and the server handlers imported by it retain strict checks. There are no file-wide TypeScript suppressions.

Browsers still execute generated JavaScript. Downloaded framework bundles, scene libraries, and captured third-party modules also remain JavaScript. They are build artifacts or external code, not project source. Their licenses remain in place.

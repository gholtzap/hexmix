# Hexmix

Try color palettes and fonts on sample websites and dashboards. Save palettes, share links, and export CSS, Tailwind theme values, or JSON tokens.

## Run locally

Install dependencies:

```sh
npm install
```

Start the app:

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). The editor, dashboards, and website previews run on this server.

## Main pages

- `/` — choose a palette, fonts, and a preview.
- `/editor` — start with a blank page.
- `/avenlo`, `/tervix`, `/orvian`, `/nuvexa` — website previews.
- `/dashboards/ai-chatbot` — sample chat workspace.
- `/dashboards/infra-dashboard` — sample infrastructure dashboard.

Use the preview toolbar to change colors and fonts, save palettes, or switch pages. On phones, More tools contains share, export, undo, redo, and reset.

## TypeScript

Use Node.js 24 or later. Browser scripts compile automatically when you run the app. Edit files in `browser/`, not their generated JavaScript outputs.

Run `npm run typecheck` to check all project TypeScript. `npm run build` also runs these checks. See [TypeScript source and build outputs](docs/typescript.md).

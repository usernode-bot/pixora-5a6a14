# Pixora

AI-powered creative tools for image generation, upscaling, background removal,
and more.

Pixora opens on **Batch convert**, the one working tool: many images in, each
converted to WebP/JPEG/PNG in the browser, downloaded one by one or as a .zip.
Files never leave the device. The other five tools in the sidebar — Creative,
Upscale Image, Remove Background, Metadata AI and Prompt Generator — are
placeholder pages that describe what they will do. There is no AI, no payment
and no sign-in behind them yet.

## Pages

The app is one HTML document; `public/js/routes.js` maps a path to a view.

| Path | Page |
| --- | --- |
| `/` | Batch convert (working) |
| `/creative` | Creative (placeholder) |
| `/upscale` | Upscale Image (placeholder) |
| `/remove-background` | Remove Background (placeholder) |
| `/metadata` | Metadata AI (placeholder) |
| `/prompt-generator` | Prompt Generator (placeholder) |

Unknown paths fall back to `/`. The sidebar is a fixed dark column on wide
screens and a dark top bar with a Menu button on phones.

## Code

- `server.js` — Express: serves `public/`, verifies the platform identity
  token, redirects anonymous document visits to the platform shell.
- `public/index.html` — the app shell: sidebar, every page's markup.
- `public/js/routes.js` — path → view table (UMD, tested by `npm test`).
- `public/js/app.js` — the batch queue's screen wiring, plus the navigation
  (view switching, history, the phone menu).
- `public/js/batch-core.js` — non-DOM batch logic: the parallel queue and the
  hand-rolled stored .zip writer (UMD, tested by `npm test`).
- `styles/tailwind-input.css` + `tailwind.config.js` — the design kit; the
  stylesheet is precompiled to `public/tailwind.css` by `npm run build`.

## Develop

```sh
npm ci --include=dev
npm run build   # compile the stylesheet
npm test
npm start
```
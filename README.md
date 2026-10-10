# Pixora

AI-powered creative tools for image generation, upscaling, background
removal, and more. Runs on Homeroom.

## What's here today

**Batch convert** (the home screen): drop or pick many images at once and
convert them to WebP, JPEG or PNG, optionally scaling them down to a
maximum side length.

- Each file gets its own row in a queue with its status and progress.
- Up to three files convert at the same time; a file that fails shows why
  and can be retried, and never stops the others.
- Download each result on its own, or everything that finished as one
  `.zip`.
- Conversion happens in the browser with a canvas. Files are never
  uploaded, so there is no server code or database table for it.

## Code

- `public/index.html`: the screen.
- `public/js/app.js`: the queue UI, decoding and re-encoding.
- `public/js/batch-core.js`: the parallel-limited queue and the `.zip`
  writer, free of the DOM so they can be tested under node.
- `tests/`: `npm test` runs them (`node --test`).
- `server.js`: Express, platform sign-in, static files.

Styling is Tailwind, precompiled by `npm run build` during the image build,
in a light and a dark look that follow the viewer's Homeroom theme.

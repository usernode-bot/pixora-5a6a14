# Pixora

AI-powered creative tools for image generation, upscaling, background
removal, and more — built on Homeroom.

## The five tools

A dark sidebar lists the tools; the tool area follows the viewer's Homeroom
theme (light and dark). Each tool is its own view with a shareable URL:

- **Creative** (`#/creative`) — generate images from a text description.
- **Upscale Image** (`#/upscale`) — increase an image's resolution.
- **Remove Background** (`#/remove-bg`) — cut the subject out of a picture.
- **Metadata AI** (`#/metadata`) — read and explain an image's metadata.
- **Prompt Generator** (`#/prompt`) — turn a rough idea into a detailed
  image prompt.

An unknown hash falls back to Creative, the default on load. On narrow
screens the sidebar collapses into a compact top bar with a horizontally
scrollable tool nav.

This first version is the app's structure and interface only: the tool
pages are static shells with honest empty states, and each tool's primary
action button is disabled until its real processing is built. There is no
payment, account system, credit system or AI processing yet.

## Sign-in

You're signed in through Homeroom automatically: the server verifies the
platform-issued user token (an RS256 JWT) on every request. No accounts to
build, and no data is stored — the app currently has no database.

## Run and build

- `npm ci --include=dev` — install dependencies (Tailwind is a dev
  dependency).
- `npm run build` — compile `styles/tailwind-input.css` to
  `public/tailwind.css` (the image build does this on every deploy, so the
  stylesheet always matches the markup in the same commit).
- `npm start` — serve the app on port 3000 (or `PORT`).
- `npm run build && npm start` locally is the whole loop; there is no test
  framework yet.

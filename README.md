[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ssj6go/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/ssj6go/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Vice Cover Studio

A GTA-style cover art maker that runs entirely offline in a desktop browser.
Drop in your own photos (or use the samples), pick a multi-panel layout, a Vice
City colour grade and a caption, and export a poster-ready PNG in 1080×1080,
1080×1350 or 1920×1080. Photos never leave your machine.

## What it does

- **Four multi-panel layouts** — Vice Grid (hero + two scenes), Sunset Hero
  (full-bleed photo with a synthwave sun), Neon Split (three vertical strips)
  and Coast Strip (three horizontal bands) — each adapting to square, portrait
  and landscape sizes.
- **Six colour grades** — Vice Sunset, Neon Nights, Palm Noir, Golden Hour,
  Chrome and Original — applied per panel with canvas filters and blend-mode
  overlays.
- **Any photo, any panel** — upload several photos, assign each panel its own,
  drag to reposition and scroll to zoom, or fill every panel with one photo.
- **Bold poster lettering** — condensed display type (Anton, SIL OFL) with a
  thick outline, gradient fill and drop shadow, auto-fitted to one or two
  lines, plus a letter-spaced subtitle on an accent bar.
- **Live preview and one-click export** — what you see is what the PNG holds.

## Try it

```sh
node serve.ts   # serves app/ at http://localhost:8080
```

Open the page, load a photo, and press Export PNG. No build step, no network.

## Layout of this repository

- `app/` — the web app (static files, offline): `index.html`, `style.css`,
  `src/cover.js` (the renderer), `src/main.js` (the editor), `src/shots.js`
  (fixed screenshot scenes), `fonts/` (Anton and Bebas Neue, SIL OFL),
  `samples/` (two sample photos, free to use).
- `screenshots/` — 3–4 screenshots: exported covers and the editor at work.
- `main.ts` — the entrypoint: copies `app/` and `screenshots/` to `/output`
  and writes `dossier.json`.
- `shots.json` — the screenshot scenes (query, viewport) used to take them.

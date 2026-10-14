# AGENTS.md

Read this before changing the site. It is the design system and the map of the code.

## What this is

A one-page portfolio for Akshaj Srirambhatla. Static HTML, CSS and ES modules, no
dependencies and no framework. `node build.mjs` writes `dist/`, which deploys as is.

On first visit an opening animation plays: a cloth-bound book opens, turns to its
contents page, riffles, and the camera drives into the last (blank) page, which is the
site's own paper colour, so it hands over to the page underneath. It plays once per
browser session and can be skipped or replayed. Under `prefers-reduced-motion` it plays a
gentle version instead: the shut book fades in, rests, and dissolves into the site, with
only opacity changing (`GENTLE_HOLD` in `intro.mjs`, the reduced-motion block in `site.css`).

## Files

| File | What it holds |
|---|---|
| `src/content.mjs` | Every word on the site: person, experience, projects, skills, education, and `SECTIONS` (ids, numbers and the book's page numbers). Edit content here only. |
| `build.mjs` | Renders `dist/index.html` from `content.mjs` and copies `src/` to `dist/assets/`. |
| `src/site.css` | All styles and every colour token. |
| `src/intro.mjs` | The timeline (`TIME`, `RIFFLE`), the camera, skip and replay. |
| `src/book/scene.mjs` | The book's geometry and drawing: boards, spine, curling leaves, ribbon. |
| `src/book/pages.mjs` | What is printed on each face: cover stamping, marbled endpapers, bookplate, title page, contents, text pages. |
| `src/book/dims.mjs` | The book's measurements in world units. |
| `src/book/kit/` | The Anatomy kit (`iso-kit.mjs`, `iso.css`), MIT licensed, unmodified. |

## Design system

- **Light paper theme.** Page background is `--paper` (#f6f4ef). The intro's desk is `--desk`.
  The last page of the book is drawn exactly in `--paper`; never change one without the other.
- **Radius 0.** No rounded corners anywhere.
- **No shadows or glows.** Separation comes from 1px rules (`--rule`, `--rule-strong`).
  The one exception is the soft halo under the book in the intro, which is part of the object.
- **One accent.** Muted blue `--accent` (#46648c) only for the lit part: the silk ribbon in
  the book, and hover states on links. No other colour.
- **Type.** Outfit (`--display`) for the name, headings and anything stamped or set in the
  book; Source Serif 4 (`--serif`) for body text; the system monospace (`--mono`) for labels,
  dates and numbers.
- **The contents nav mirrors the book.** Section numbers, titles and page numbers come from
  `SECTIONS`, which also draws the contents page in the intro.

## Working on the intro

- Freeze any moment for a screenshot with `?t=<ms>` (for example `/?t=3000` is the contents
  spread). Force a replay with `/?intro`.
- The book is drawn with the Anatomy skill's camera and tone rules (azimuth 112°, elevation
  46°). Faces are shaded from their normals, so a page lying flat is exactly `--paper`.
- **Performance rules.** Many visitors have 120 Hz screens, which leave 8.3 ms per frame.
  Keep these or the intro stutters in Chrome:
  - Parts are created once in `createBook` and each frame only changes attributes, through
    `set()`, which skips unchanged values. Never rebuild the markup per frame.
  - The book's text uses `text-rendering: geometricPrecision`. Any other value makes Chrome
    re-lay out every letter on every frame of the camera zoom.
  - Hidden parts use `visibility`, not `display`, so their text is laid out before the clock starts.
  - No CSS or SVG filters on anything that moves with the camera. The halo is a pre-blurred image.
  - The first frame is painted before the clock starts, and `intro.mjs` drops to an even
    60 fps if a screen keeps missing frames.
- **Measure in real Chrome**, not headless (its frame clock is simulated): with `npm run serve`
  running, `npm run frames` opens a visible Chrome window, plays the intro and lists every late
  frame. Today it reports 0–3 late frames out of about 600 at 120 Hz.
- Check desktop (1440 × 900) and phone (390 × 844). On tall screens the camera frames the
  right-hand page instead of the whole spread.

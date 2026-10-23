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
| `build.mjs` | Renders `dist/index.html` from `content.mjs`, inlines both stylesheets into it, and copies the modules and `og.jpg` to `dist/assets/`. |
| `src/site.css` | All styles and every colour token (inlined into the page at build time). |
| `src/og.jpg` | The 1200×630 share image: the shut book. Regenerate it after changing the cover (see below). |
| `src/intro.mjs` | The timeline (`TIME`, `RIFFLE`), the camera, skip and replay. |
| `src/book/scene.mjs` | The book's geometry and drawing: boards, spine, curling leaves, ribbon. |
| `src/book/pages.mjs` | What is printed on each face: cover stamping, marbled endpapers, bookplate, title page, contents, text pages. |
| `src/book/dims.mjs` | The book's measurements in world units. |
| `src/book/kit/` | The Anatomy kit (`iso-kit.mjs`, `iso.css`), MIT licensed, unmodified. |

## Design system

- **Light paper theme.** Page background is `--paper` (#f6f4ef).
- **The book rests on a pale oak tabletop** (`src/book/table.mjs`, colours `--wood*` in `site.css`):
  one seamless slab in the book's own floor plane, painted once into a canvas before the clock
  starts and only moved and scaled by the camera (a CSS transform, so it costs nothing per frame).
  Never redraw it per frame.
  The last page of the book is drawn exactly in `--paper`; never change one without the other.
- **Dark mode.** The square button at the top right toggles `data-theme="dark"` on `<html>`;
  the choice is kept in `localStorage` (`theme`) and applied by an inline head script before
  first paint. Light is the default. Dark overrides the site's tokens at the top of `site.css`
  and `.intro` re-declares the light ones, so the book always stays on paper.
- **Radius 0.** No rounded corners anywhere.
- **No shadows or glows.** Separation comes from 1px rules (`--rule`, `--rule-strong`).
  The one exception is the soft halo under the book in the intro, which is part of the object.
- **One accent.** Muted blue `--accent` (#46648c) only for the lit part: the silk ribbon in
  the book, and hover states on links. No other colour in the site's own UI.
- **The book's case is navy cloth stamped in antique gold foil** (`--cloth*`, `--foil*` in
  `site.css`): colours of the object, like the oak table, not of the interface. The pages,
  endpapers and everything printed on them stay on paper.
- **Type.** Outfit (`--display`) for the name, headings and anything stamped or set in the
  book; Source Serif 4 (`--serif`) for body text; the system monospace (`--mono`) for labels,
  dates and numbers.
- **The contents nav mirrors the book.** Section numbers, titles and page numbers come from
  `SECTIONS`, which also draws the contents page in the intro.

## Loading

- The page is plain HTML with its CSS inlined, so it draws after one request plus the fonts.
- Fonts are self-hosted in `src/fonts/` (Latin subset, from Google Fonts, SIL OFL licences beside
  them): Outfit 400–500 (one variable file) and Source Serif 4 400 roman and italic, about 72 KB.
  The two used above the fold are preloaded. To add a weight or a character outside Latin,
  download the matching woff2 from Google Fonts and add an `@font-face` at the top of `site.css`;
  the optical-size axis roughly triples Source Serif's size, so leave it out.
- `intro.mjs` is tiny and always loads. The book's modules (`book/*`, `content.mjs`) are imported
  only when the intro will play, and the inline head script preloads them in that case only,
  so a returning visitor downloads none of them.
- If the book's modules haven't arrived after 4 s, the head script hands the page back and flags
  `data-intro-late`, so the intro never starts on top of a page someone is already reading.
- If anything in the intro throws (an old browser, a failed download), `bail()` removes it and
  shows the site.
- Regenerate the share image with the server running:
  `node ~/.claude/skills/anatomy/scripts/capture.mjs "http://localhost:4173/?t=420&fill=0.84" --out shots/og-raw.png --select ".intro" --width 1260 --height 690 --scale 1`,
  then `sips -c 630 1200 --cropOffset 30 30 shots/og-raw.png --out src/og.png` and
  `sips -s format jpeg -s formatOptions 88 src/og.png --out src/og.jpg` (delete the png).

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
  - No SVG `<pattern>` with a small tile (the cover's cloth weave is a pre-drawn image):
    Safari redraws every tile on every frame of the camera move.
  - Never read layout (`clientWidth`, `getBoundingClientRect`…) inside a frame: `intro.mjs`
    keeps the window size from a resize listener, and caches the camera framings per shape.
    A read after a write forces the browser to lay the page out mid-frame.
  - Anything fully invisible is hidden (`display`/`visibility`), not left at opacity 0:
    the unused shadow images, and the table once the camera is inside the last page.
  - The first frame is painted before the clock starts, and `intro.mjs` drops to an even
    60 fps if a screen keeps missing frames.
- **On a real phone**, open the site with `?intro&stats`: after the intro it shows that device's
  frame rate, frame count and slow frames.
- **Measure in real Chrome**, not headless (its frame clock is simulated): with `npm run serve`
  running, `npm run frames` opens a visible Chrome window, plays the intro and lists every late
  frame. Today it reports 0–3 late frames out of about 600 at 120 Hz.
- Check desktop (1440 × 900) and phone (390 × 844). On tall screens the camera frames the
  right-hand page instead of the whole spread.

# Portfolio

Akshaj Srirambhatla's portfolio. A static site with no dependencies; the opening book
animation is drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) kit.

## Run it locally

Needs Node 18+ and Python 3 (for the local server).

```bash
npm run serve
```

Then open http://localhost:4173. Add `?intro` to replay the opening, or `?t=3000` to
freeze it at 3 seconds.

## Edit the content

Everything the site says is in `src/content.mjs`. Run `node build.mjs` after editing.
See `AGENTS.md` for the design system and how the code is laid out.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (for example `Akshaj01.github.io`).
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. `.github/workflows/pages.yml` builds the site and publishes `dist/`.

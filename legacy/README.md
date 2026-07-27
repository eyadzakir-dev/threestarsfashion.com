# legacy/

The nine hand-maintained HTML files as they existed at commit `14c1186`, before
the Astro migration. **Reference only — nothing here is built or served.**

Kept because:

1. `scripts/verify_migration.mjs` diffs `dist/*.html` against these to prove the
   step 2 lift-and-shift changed nothing it shouldn't have.
2. Steps 3–8 rebuild every page. These are the source of record for copy, claims
   and markup while that happens — alongside `PARITY.md`, which is the
   authoritative claim register.

Delete this directory once step 9 passes and the rebuild is merged.

The live content now lives in:

- `src/pages/*.astro` — page shells (generated, throwaway; replaced in steps 7–8)
- `src/content/legacy/{body,head,tail}/` — extracted verbatim regions
- `src/layouts/Layout.astro` — header, nav, fullscreen menu, footer
- `public/` — `assets/`, `styles.css`, `pages.css`, `script.js`, `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`

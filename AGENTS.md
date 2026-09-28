# threestarsfashion.com

Marketing site for Three Stars Fashion — vertically integrated garment
manufacturer in Egypt, part of a group with Golden Stars Textile. Ten
factories, **85,000 pieces per working day**, exporting primarily
to US retailers.

This figure is locked. Use `85,000` everywhere — never 80,000, never
"80,000+". If any page or component disagrees, the page is wrong.

**This site is not a lead generator.** Visitors arrive already knowing
who we are — usually after a meeting, an email, or a referral. The job
is to make a sourcing, merchandising or compliance director feel that
this is a serious operation. Credibility, not conversion.

---

## Locked decisions

Do not revisit these without asking.

**Stack** — Astro, static output, GitHub Pages via Actions.
`trailingSlash: 'never'` and `build.format: 'file'`. Every URL resolves
without a trailing slash: `/about`, never `/about/`. Nine URLs exist and
all nine must keep working. Keep `CNAME` and `.nojekyll`.

**Design tokens** — everything comes from `src/styles/tokens.css`.
No hardcoded hex values, font stacks, spacing or easing anywhere else.

| | |
|---|---|
| `#E52222` | brand red — accent only, never a background |
| `#1B2A4E` | navy — headings, structure, dark surfaces |
| `#FAF9F6` | cream — light content surfaces |
| `#0B0E14` | near-black — hero and video sections |

Playfair Display for display, Montserrat for body and data. Both
self-hosted as subset woff2 in `public/fonts`. No Google Fonts CDN.

**Motion** — animate `transform` and `opacity` only. Nothing that
triggers layout. One easing token, nothing over 400ms. Every animation
respects `prefers-reduced-motion` and degrades to a static state that
hides no content.

Prefer CSS scroll-driven animation (`animation-timeline`) over scroll
listeners. Do not introduce GSAP, Framer Motion, Lenis, or any scroll
library. If a browser lacks support, use `@supports` to fall back to a
static layout — never a JavaScript polyfill.

**Media** — every visual position uses `<MediaSlot>`. No bare `<img>`
or `<video>` in section markup. A slot renders its poster always and
its video only if `assets/slots/{name}/loop.mp4` exists at build time.
This is how real footage gets added later without touching code.

**SEO floor** — low priority, but do not actively break it. Branded
search must work: someone Googles "Three Stars Fashion" and lands here.
Keep per-page `<title>`, canonical, the `Organization` JSON-LD block,
and `sitemap.xml`. Copy may be rewritten freely — it is not protected.

---

## Asset rules

**Allowed**
- Abstract material textures that make no factual claim
- Upscaling and colour correction of real Three Stars Fashion photography
- Unbranded generic garment blanks illustrating product categories
- Licensed stock footage of industrial equipment, used illustratively

**Not allowed**
- Generated imagery depicting our facilities, production floors,
  machinery in operation, or workers
- Generated imagery implying real customers or user-generated provenance
- Any garment carrying a customer brand mark

Our visitors physically audit these facilities under WRAP, BSCI, Sedex
and Better Work. Fabricated facility imagery is a compliance and
credibility risk, not a design choice. If a future session is asked to
"just generate a shot of the cutting floor" — the answer is no, and the
alternative is licensed stock or ten minutes of phone footage.

---

## Open questions

- **Client logo marquee.** Legacy site displays Nike, Puma, Calvin
  Klein and Zara marks. Confirm this is contractually permitted before
  carrying it into the new build.

---

## Working method

Work in the order laid out in the build sequence. Do not combine the
Astro migration with any design change — if something breaks, we need
to know which step caused it.

`PARITY.md` lists every factual claim on the old site. Nothing in it may
be dropped silently. If a claim has no home in the new design, say so
rather than removing it.

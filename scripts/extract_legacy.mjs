#!/usr/bin/env node
/**
 * One-shot extractor for the Astro lift-and-shift (step 2).
 *
 * Slices each legacy HTML file into three verbatim regions and a metadata
 * record, so the migration is a mechanical transform rather than 230 KB of
 * hand-retyping. Nothing here rewrites content — if this script changes a
 * single character of body copy, that is a bug.
 *
 *   region        source span                              consumed by
 *   ------------  ---------------------------------------  ---------------------
 *   head extras   <script ld+json> and <style> in <head>    Layout <slot name="head">
 *   body          after the fullscreen-menu close, to       page default slot
 *                 just before <footer>
 *   tail          after </footer> to just before </body>,      Layout <slot name="tail">
 *                 INCLUDING the <script src="script.js"> tag
 *
 * Run:  node scripts/extract_legacy.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = ['index', 'about', 'services', 'facilities', 'certifications',
               'logistics', 'faq', 'contact', 'privacy-policy'];

const OUT = 'src/content/legacy';
for (const d of ['body', 'head', 'tail']) mkdirSync(join(OUT, d), { recursive: true });

// Attribute values and <title> hold HTML entities (&amp; appears in several
// titles and og:descriptions). Decode on the way out: Astro re-escapes when it
// renders the interpolated value, so decoding here makes the round-trip exact.
// Skipping this ships `&amp;amp;`.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s == null ? null : s
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ENTITIES[n]);

const pick = (re, s, g = 1) => { const m = s.match(re); return m ? decode(m[g]) : null; };

const records = [];
const problems = [];

for (const page of PAGES) {
  const src = readFileSync(`legacy/${page}.html`, 'utf8');
  const lines = src.split('\n');

  const headEnd = lines.findIndex((l) => l.includes('</head>'));
  const head = lines.slice(0, headEnd).join('\n');

  // ---- region boundaries -------------------------------------------------
  const fsMenuStart = lines.findIndex((l) => l.includes('class="fullscreen-menu"'));
  const footerStart = lines.findIndex((l) => /<footer class="footer"/.test(l));
  const footerEnd   = lines.findIndex((l) => l.includes('</footer>'));
  const bodyClose   = lines.findIndex((l) => l.includes('</body>'));

  // The fullscreen menu closes with the first column-4 `</div>` after it opens.
  let fsMenuEnd = -1;
  for (let i = fsMenuStart + 1; i < footerStart; i++) {
    if (lines[i] === '    </div>') { fsMenuEnd = i; break; }
  }

  if ([fsMenuStart, footerStart, footerEnd, bodyClose, fsMenuEnd].some((i) => i < 0)) {
    problems.push(`${page}: could not locate all region boundaries`);
    continue;
  }

  const body = lines.slice(fsMenuEnd + 1, footerStart).join('\n').replace(/^\n+|\s+$/g, '');

  // Everything after </footer>, verbatim and in original order. This MUST
  // include the <script src="script.js"> tag rather than the layout emitting
  // its own: contact.html has its inline Tally loader BEFORE script.js, while
  // facilities and certifications have theirs AFTER. Hardcoding script.js in
  // the layout and appending the rest silently reordered them — and an earlier
  // version of this script, which sliced from script.js onward, dropped the
  // Tally loader entirely and shipped a dead contact form.
  const tail = lines.slice(footerEnd + 1, bodyClose).join('\n').replace(/^\n+|\s+$/g, '');
  if (!/src="script\.js"/.test(tail)) {
    problems.push(`${page}: tail region does not contain script.js — boundary logic is wrong`);
  }

  // ---- head extras: JSON-LD + inline <style>, verbatim -------------------
  const extras = [];
  for (const m of head.matchAll(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>/g)) {
    extras.push(m[0].replace(/^\n+/, ''));
  }
  for (const m of head.matchAll(/[ \t]*<style>[\s\S]*?<\/style>/g)) {
    extras.push(m[0].replace(/^\n+/, ''));
  }

  // ---- metadata ----------------------------------------------------------
  // contact.html and privacy-policy.html are missing the opening
  // `<meta name="description"` tag, leaving an orphan content="..." text node
  // that force-closes <head>. Recover the text; PARITY.md §4 records the fix.
  let description = pick(/<meta name="description"\s*\n?\s*content="([^"]*)"/, head);
  let malformed = false;
  if (!description) {
    description = pick(/<\/title>\s*\n\s*content="([^"]*)"/, head);
    malformed = description != null;
    if (!malformed) problems.push(`${page}: no description found`);
  }

  const rec = {
    page,
    route: page === 'index' ? '/' : `/${page}`,
    title: pick(/<title>([\s\S]*?)<\/title>/, head)?.trim(),
    description,
    descriptionWasMalformed: malformed,
    canonical: pick(/<link rel="canonical" href="([^"]*)"/, head),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/, head),
    ogDescription: pick(/<meta property="og:description" content="([^"]*)"/, head),
    ogUrl: pick(/<meta property="og:url" content="([^"]*)"/, head),
    twitterTitle: pick(/<meta name="twitter:title" content="([^"]*)"/, head),
    twitterDescription: pick(/<meta name="twitter:description" content="([^"]*)"/, head),
    // Which nav item carries `active`; privacy-policy has none.
    activeNav: pick(/<a href="([^"]*)" class="menu-link active">/, src),
    bodyClass: pick(/<body class="([^"]*)"/, src),
    footerId: /<footer class="footer" id="([^"]*)"/.test(src)
      ? pick(/<footer class="footer" id="([^"]*)"/, src) : null,
    pagesCss: head.includes('href="pages.css"'),
    hasHeadExtras: extras.length > 0,
    hasTail: tail.length > 0,
  };
  records.push(rec);

  writeFileSync(join(OUT, 'body', `${page}.html`), body + '\n');
  writeFileSync(join(OUT, 'head', `${page}.html`), extras.join('\n') + (extras.length ? '\n' : ''));
  writeFileSync(join(OUT, 'tail', `${page}.html`), tail + (tail ? '\n' : ''));
}

writeFileSync(join(OUT, 'pages.json'), JSON.stringify(records, null, 2) + '\n');

console.table(records.map((r) => ({
  page: r.page, route: r.route, pagesCss: r.pagesCss, active: r.activeNav,
  bodyClass: r.bodyClass ?? '', footerId: r.footerId ?? '',
  headExtras: r.hasHeadExtras, tail: r.hasTail, badDesc: r.descriptionWasMalformed,
})));

if (problems.length) {
  console.error('\nPROBLEMS:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`\nExtracted ${records.length} pages → ${OUT}`);

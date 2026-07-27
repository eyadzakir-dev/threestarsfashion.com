#!/usr/bin/env node
/**
 * Step 9 merge gate. Runs against a built dist/.
 *
 *   node scripts/verify_build.mjs
 *
 * Checks, in order:
 *   1. Every load-bearing PARITY.md claim appears in the build (scripted, not
 *      eyeballed), and every RETIRED figure is absent.
 *   2. Flat output — nine URLs, no dist/<page>/index.html, deploy contract files.
 *   3. No bare <img>/<video> outside a MediaSlot figure.
 *   4. No hardcoded hex outside tokens.css, scoped to src/ and ignoring SVG.
 *   5. No --ease-spring on any rule that also sets animation-timeline.
 *   6. Head integrity — canonical/og:url extensionless, JSON-LD parses.
 *
 * Lighthouse is deliberately NOT here. It is an observation, not a gate: the
 * rebuilt pages are different documents with different fonts, images and markup,
 * so a point-level comparison against BASELINE.md was never meaningful.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PAGES = ['index', 'about', 'services', 'facilities', 'certifications',
               'logistics', 'faq', 'contact', 'privacy-policy'];

let failures = 0;
let checks = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);
const section = (t) => console.log(`\n${t}`);

// ── load the build ──────────────────────────────────────────────────────────
const html = {};
for (const p of PAGES) {
  const f = join('dist', `${p}.html`);
  if (!existsSync(f)) { fail(`dist/${p}.html missing`); continue; }
  html[p] = readFileSync(f, 'utf8');
}
const allHtml = Object.values(html).join('\n');
// Decode entities generically. Astro escapes apostrophes to &#39;, so a naive
// substring check for "Alexandria's commercial port" misses a claim that is
// actually present — the checker must not invent failures.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
                ndash: '–', mdash: '—', middot: '·', copy: '©' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);

const text = (s) => decode(
  s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
   .replace(/<style[\s\S]*?<\/style>/gi, ' ')
   .replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ');
const allText = text(allHtml);

// ── 1. PARITY claims ────────────────────────────────────────────────────────
section('1. PARITY.md claims present');

/** [label, needle, wherePage|null] — null means anywhere in the build. */
const CLAIMS = [
  ['daily capacity 85,000', '85,000', null],
  ['sewing machines 3,100', '3,100', null],
  ['factories 10', 'Manufacturing factories', null],
  ['24/7 operations', '24/7', null],
  ['greige 600 tons', '600', 'services'],
  ['cotton/CVC 450 tons', '450', null],
  ['lead time 30 days', '30', 'services'],
  ['lead time 45 days', '45 days', 'faq'],
  ['60% local sourcing', '60%', 'faq'],
  ['QIZ', 'QIZ', null],
  ['Euro 1', 'Euro 1', null],
  ['40+ countries', 'Countries served', 'logistics'],
  ['founded 2008', '2008', null],
  ['flat-seam inventory claim', 'flat-seam', null],
  ['Alexandria Public Free Zone', 'Alexandria Public Free Zone', null],
  ['commercial port', "Alexandria's commercial port", null],
  ['Vision 2030', 'Vision 2030', 'about'],
  ['solar 70–80% by 2030', '2030', 'about'],
  ['sourcing office in China', 'China', null],
  ['AQL sampling', 'AQL sampling', 'services'],
  ['six printing machines', 'six advanced screen printing machines', 'services'],
  // group + people
  ['Three Stars Apparels', 'Three Stars Apparels', null],
  ['Golden Stars Textile', 'Golden Stars Textile', null],
  ['Green Point Logistics', 'Green Point Logistics', null],
  ['Zakir Hossain', 'Zakir Hossain', 'about'],
  ['Ziad Zakir', 'Ziad Zakir', 'about'],
  ['Ahmed Mahran', 'Ahmed Mahran', 'about'],
  ['Tarek Gaber', 'Tarek Gaber', 'about'],
  // contact
  ['street address', 'Public Free Zone Amreya', null],
  ['postal code 23512', '23512', null],
  ['email', 'info@tsf.com.eg', null],
  ['landline', '+2 03 4500550', null],
  ['mobile', '+2 011 41333589', null],
  ['map coordinates', '29.7788598', 'contact'],
  ['Google place id', '0x14f5932fe7f32ec9', 'contact'],
  ['Tally form', 'tally.so/embed/9qvgVp', 'contact'],
  ['Tally processor disclosure', 'Tally.so', 'privacy-policy'],
  ['GPL external link', 'gpl.com.eg', null],
  ['copyright 2026', '2026 Three Stars Fashion', null],
  ['privacy last updated', 'April 2026', 'privacy-policy'],
  ['GPL 15+ years (OPEN, carried verbatim)', 'Years experience', 'logistics'],
];

const CERTS = ['ISO 9001', 'WRAP', 'OEKO-TEX', 'GRS', 'OCS', 'BSCI', 'SEDEX',
               'Better Work', 'Higg Index', 'FAMA', 'Inditex'];
const APPROVALS = ['Walmart', 'Under Armour', 'Inditex', 'Disney', 'PVH', 'Primark', 'Fruit of the Loom'];
const BRANDS = ['nike', 'puma-logo', 'disney-2', 'tommy-hilfiger', 'calvin-klein-1',
                'zara-logo-1', 'costco-wholesale', 'reebok-2019-logo', 'fila-9',
                'kenneth-cole', 'eddie-bauer', 'u-s-polo-assn-seeklogo'];

for (const [label, needle, page] of CLAIMS) {
  checks++;
  const haystack = page ? (text(html[page] ?? '') + (html[page] ?? '')) : (allText + allHtml);
  if (haystack.includes(needle)) pass(label);
  else fail(`${label} — "${needle}" not found${page ? ` on /${page}` : ''}`);
}

checks++;
const missingCerts = CERTS.filter((c) => !text(html.certifications ?? '').includes(c));
if (missingCerts.length) fail(`certifications missing on /certifications: ${missingCerts.join(', ')}`);
else pass(`all ${CERTS.length} certifications on /certifications`);

checks++;
const missingApprovals = APPROVALS.filter((a) => !allText.includes(a));
if (missingApprovals.length) fail(`buyer approvals missing: ${missingApprovals.join(', ')}`);
else pass(`all ${APPROVALS.length} buyer approvals present`);

checks++;
const missingBrands = BRANDS.filter((b) => !html.index.includes(b));
if (missingBrands.length) fail(`brand logos missing from homepage: ${missingBrands.join(', ')}`);
else pass(`all ${BRANDS.length} client logos on the homepage`);

// ── retired / forbidden figures ─────────────────────────────────────────────
section('1b. Retired and forbidden figures absent');
for (const [label, needle] of [
  ['printing capacity 65,000 (RETIRED by decision)', '65,000'],
  ['printing capacity 6,000 (RETIRED by decision)', '6,000'],
  ['80,000 (never a valid figure)', '80,000'],
  ['"Eighty thousand"', 'Eighty thousand'],
  ['orphaned taylor-swift logo', 'taylor-swift'],
  ['Google Fonts CDN', 'fonts.googleapis'],
]) {
  checks++;
  if (allHtml.includes(needle)) fail(`${label} — "${needle}" still present`);
  else pass(`${label} absent`);
}

// ── 2. structure ────────────────────────────────────────────────────────────
section('2. URL contract and deploy files');
checks++;
const dirFormat = PAGES.filter((p) => p !== 'index' && existsSync(join('dist', p, 'index.html')));
if (dirFormat.length) fail(`dist/<page>/index.html exists for ${dirFormat.join(', ')} — build.format is not 'file'`);
else pass("flat output, build.format: 'file'");

for (const f of ['CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', '404.html']) {
  checks++;
  if (existsSync(join('dist', f))) pass(`dist/${f}`);
  else fail(`dist/${f} missing`);
}

// ── 3. no bare img/video ────────────────────────────────────────────────────
section('3. All media goes through MediaSlot');
for (const p of PAGES) {
  checks++;
  const doc = html[p] ?? '';
  // Strip every MediaSlot <figure>, then look for what survives.
  const stripped = doc.replace(/<figure class="media-slot[\s\S]*?<\/figure>/g, ' ');
  const strayImg = (stripped.match(/<img\b/g) || []).length;
  const strayVideo = (stripped.match(/<video\b/g) || []).length;
  // The lightbox <img> is populated by the gallery script from MediaSlot's own
  // resolved sources; it is the viewer surface, not an independent image.
  const lightbox = (stripped.match(/<img class="lb__img"/g) || []).length;
  const stray = strayImg - lightbox;
  if (stray > 0 || strayVideo > 0) fail(`/${p}: ${stray} bare <img>, ${strayVideo} bare <video> outside MediaSlot`);
  else pass(`/${p}`);
}

// ── 4. hex outside tokens.css ───────────────────────────────────────────────
section('4. No hardcoded hex outside tokens.css');
const srcFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (['.astro', '.css'].includes(extname(f))) srcFiles.push(f);
  }
})('src');

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const offenders = [];
for (const f of srcFiles) {
  if (f.endsWith('tokens.css')) continue;          // the one sanctioned home
  let body = readFileSync(f, 'utf8');
  // Ignore SVG contents (fill/stroke on vendor marks), comments, and HTML
  // numeric entities — &#8594; (→), &#215; (×), &#8249; (‹) all contain a run of
  // digits after a # and would otherwise be reported as colour literals. A check
  // that cries wolf is worse than no check.
  body = body.replace(/<svg[\s\S]*?<\/svg>/g, ' ')
             .replace(/\/\*[\s\S]*?\*\//g, ' ')
             .replace(/\/\/[^\n]*/g, ' ')
             .replace(/<!--[\s\S]*?-->/g, ' ')
             .replace(/&#x?[0-9a-fA-F]+;/g, ' ');
  const hits = [...new Set(body.match(HEX) || [])];
  if (hits.length) offenders.push(`${f}: ${hits.join(', ')}`);
}
checks++;
if (offenders.length) { for (const o of offenders) fail(o); }
else pass(`${srcFiles.length - 1} src files scanned, zero hex literals`);

// ── 5. easing discipline ────────────────────────────────────────────────────
section('5. Scroll-timeline animations are linear');
const cssFiles = readdirSync('dist/_astro').filter((f) => f.endsWith('.css'));
let easingViolations = 0;
for (const f of cssFiles) {
  const css = readFileSync(join('dist/_astro', f), 'utf8');
  for (const rule of css.split('}')) {
    if (rule.includes('animation-timeline') && rule.includes('ease-spring')) {
      easingViolations++;
      fail(`--ease-spring on a scroll-timeline rule in ${f}: …${rule.slice(-120)}`);
    }
  }
}
checks++;
if (!easingViolations) pass('no --ease-spring on any animation-timeline rule');

// ── 6. head integrity ──────────────────────────────────────────────────────
section('6. Head integrity');
for (const p of PAGES) {
  checks++;
  const doc = html[p] ?? '';
  const canonical = (doc.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const ogUrl = (doc.match(/<meta property="og:url" content="([^"]*)"/) || [])[1];
  const desc = (doc.match(/<meta name="description" content="([^"]{20,})"/) || [])[1];
  const expected = p === 'index'
    ? 'https://threestarsfashion.com/'
    : `https://threestarsfashion.com/${p}`;
  const problems = [];
  if (canonical !== expected) problems.push(`canonical "${canonical}" != "${expected}"`);
  if (ogUrl !== expected) problems.push(`og:url "${ogUrl}" != "${expected}"`);
  if (!desc) problems.push('meta description missing or too short');
  if (/\.html/.test(canonical ?? '')) problems.push('canonical contains .html');
  if (problems.length) fail(`/${p}: ${problems.join('; ')}`);
  else pass(`/${p} canonical, og:url, description`);
}

section('6b. JSON-LD');
for (const [p, type] of [['index', 'Organization'], ['faq', 'FAQPage']]) {
  checks++;
  const m = (html[p] ?? '').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) { fail(`/${p}: ${type} JSON-LD missing`); continue; }
  try {
    const j = JSON.parse(m[1]);
    if (j['@type'] !== type) fail(`/${p}: expected @type ${type}, got ${j['@type']}`);
    else pass(`/${p}: ${type} parses`);
  } catch (e) { fail(`/${p}: JSON-LD parse error — ${e.message}`); }
}

// ── summary ────────────────────────────────────────────────────────────────
console.log(`\n${failures ? `FAILED — ${failures} problem(s) across ${checks} checks`
                           : `PASS — ${checks} checks, no problems`}`);
process.exit(failures ? 1 : 0);

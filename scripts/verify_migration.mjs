#!/usr/bin/env node
/**
 * Proves the step-2 lift-and-shift changed nothing it shouldn't have.
 *
 * Compares each dist/<page>.html against legacy/<page>.html on:
 *   - head metadata (title, description, canonical, og:*, twitter:*)
 *   - JSON-LD blocks, compared as parsed objects
 *   - visible text content, whitespace-normalised
 *   - every <img src>, <a href> and iframe src
 *
 * Known-and-accepted deviations are declared in ALLOWED below; anything else
 * is a failure. Exit code 1 on any unexplained difference.
 *
 * Run against a built dist/:  node scripts/verify_migration.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const PAGES = ['index', 'about', 'services', 'facilities', 'certifications',
               'logistics', 'faq', 'contact', 'privacy-policy'];

// The two pages whose legacy <head> was malformed: the missing opening tag
// meant no description reached the DOM at all. PARITY.md §4.
const ALLOWED = {
  contact: ['description'],
  'privacy-policy': ['description'],
};

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

const text = (html) => decode(
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ').trim();

// On contact.html and privacy-policy.html the malformed meta left an orphan
// `content="…">` string that the parser treated as a text node in <body> — the
// description was literally rendered on the page. Once the tag is well-formed
// that text correctly disappears, so strip it from the legacy side before
// comparing text content. Matches nothing on the seven intact pages.
const stripOrphanMeta = (t) => t.replace(/content="[^"]*">\s*/g, '');

const attr = (html, re) => { const m = html.match(re); return m ? decode(m[1]).trim() : null; };

const meta = (html) => ({
  title: attr(html, /<title>([\s\S]*?)<\/title>/),
  description: attr(html, /<meta name="description"\s*\n?\s*content="([^"]*)"/),
  canonical: attr(html, /<link rel="canonical" href="([^"]*)"/),
  ogType: attr(html, /<meta property="og:type" content="([^"]*)"/),
  ogSiteName: attr(html, /<meta property="og:site_name" content="([^"]*)"/),
  ogTitle: attr(html, /<meta property="og:title" content="([^"]*)"/),
  ogDescription: attr(html, /<meta property="og:description" content="([^"]*)"/),
  ogUrl: attr(html, /<meta property="og:url" content="([^"]*)"/),
  ogImage: attr(html, /<meta property="og:image" content="([^"]*)"/),
  twCard: attr(html, /<meta name="twitter:card" content="([^"]*)"/),
  twTitle: attr(html, /<meta name="twitter:title" content="([^"]*)"/),
  twDescription: attr(html, /<meta name="twitter:description" content="([^"]*)"/),
  twImage: attr(html, /<meta name="twitter:image" content="([^"]*)"/),
});

const jsonld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => { try { return JSON.stringify(JSON.parse(m[1])); } catch { return 'UNPARSEABLE:' + m[1].slice(0, 60); } })
  .sort();

const urls = (html, re) => [...html.matchAll(re)].map((m) => m[1])
  .filter((u) => !u.startsWith('data:')).sort();

let failures = 0;
let checks = 0;
const note = (page, msg) => { failures++; console.log(`  ✗ [${page}] ${msg}`); };

for (const page of PAGES) {
  const distPath = `dist/${page}.html`;
  if (!existsSync(distPath)) { note(page, `dist/${page}.html does not exist`); continue; }

  const legacy = readFileSync(`legacy/${page}.html`, 'utf8');
  const built = readFileSync(distPath, 'utf8');
  console.log(`\n${page}`);

  // --- head metadata ---
  const [a, b] = [meta(legacy), meta(built)];
  for (const k of Object.keys(a)) {
    checks++;
    if (a[k] === b[k]) continue;
    if (ALLOWED[page]?.includes(k)) {
      console.log(`  ~ ${k}: accepted deviation (legacy had none — PARITY.md §4)`);
      continue;
    }
    note(page, `${k} differs\n      legacy: ${JSON.stringify(a[k])}\n      built:  ${JSON.stringify(b[k])}`);
  }

  // --- JSON-LD ---
  checks++;
  const [la, lb] = [jsonld(legacy), jsonld(built)];
  if (JSON.stringify(la) !== JSON.stringify(lb)) {
    note(page, `JSON-LD differs (legacy ${la.length} block(s), built ${lb.length})`);
  }

  // --- visible text ---
  checks++;
  const [ta, tb] = [stripOrphanMeta(text(legacy)), text(built)];
  if (ta !== tb) {
    let i = 0;
    while (i < ta.length && i < tb.length && ta[i] === tb[i]) i++;
    note(page, `text content differs at char ${i} (legacy ${ta.length}, built ${tb.length})\n` +
               `      legacy: …${ta.slice(Math.max(0, i - 50), i + 70)}…\n` +
               `      built:  …${tb.slice(Math.max(0, i - 50), i + 70)}…`);
  }

  // --- resource URLs ---
  for (const [label, re] of [
    ['img src', /<img[^>]+src="([^"]*)"/g],
    ['a href', /<a[^>]+href="([^"]*)"/g],
    ['iframe', /<iframe[^>]+(?:data-tally-)?src="([^"]*)"/g],
  ]) {
    checks++;
    const [ua, ub] = [urls(legacy, re), urls(built, re)];
    if (JSON.stringify(ua) !== JSON.stringify(ub)) {
      const missing = ua.filter((u) => !ub.includes(u));
      const added = ub.filter((u) => !ua.includes(u));
      note(page, `${label} set differs` +
        (missing.length ? `\n      missing: ${missing.slice(0, 5).join(', ')}` : '') +
        (added.length ? `\n      added:   ${added.slice(0, 5).join(', ')}` : ''));
    }
  }

  if (!failures) console.log('  ✓ parity');
}

// --- structural: no directory-format output ---
console.log('\nstructure');
checks++;
const dirFormat = PAGES.filter((p) => p !== 'index' && existsSync(`dist/${p}/index.html`));
if (dirFormat.length) {
  note('build', `found dist/<page>/index.html for: ${dirFormat.join(', ')} — build.format is not 'file'`);
} else {
  console.log("  ✓ flat output, build.format: 'file' confirmed");
}
for (const f of ['CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', '404.html']) {
  checks++;
  if (existsSync(`dist/${f}`)) console.log(`  ✓ dist/${f}`);
  else note('build', `dist/${f} missing`);
}

console.log(`\n${failures ? `FAILED — ${failures} difference(s) across ${checks} checks` : `PASS — ${checks} checks, no unexplained differences`}`);
process.exit(failures ? 1 : 0);

#!/usr/bin/env node
/**
 * Reduce raw Lighthouse JSON to a median-per-page markdown table.
 *
 *   node scripts/lighthouse_summarize.mjs .lighthouse/baseline
 *   node scripts/lighthouse_summarize.mjs .lighthouse/astro .lighthouse/baseline
 *
 * A second argument turns on delta columns against that earlier run.
 *
 * NOTE ON INP: Lighthouse lab runs cannot measure INP — it is a field metric
 * requiring real interaction. Total Blocking Time is the accepted lab proxy and
 * is what this reports. Do not relabel TBT as INP.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const PAGES = ['index', 'about', 'services', 'facilities', 'certifications',
               'logistics', 'faq', 'contact', 'privacy-policy'];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function collect(dir) {
  const byPage = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const page = basename(f).replace(/\.\d+\.json$/, '');
    let r;
    try {
      r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    if (!r.categories) continue;
    (byPage[page] ??= []).push({
      perf: r.categories.performance?.score * 100,
      a11y: r.categories.accessibility?.score * 100,
      bp: r.categories['best-practices']?.score * 100,
      seo: r.categories.seo?.score * 100,
      lcp: r.audits['largest-contentful-paint']?.numericValue,
      cls: r.audits['cumulative-layout-shift']?.numericValue,
      tbt: r.audits['total-blocking-time']?.numericValue,
    });
  }
  const out = {};
  for (const [page, runs] of Object.entries(byPage)) {
    out[page] = { n: runs.length };
    for (const k of ['perf', 'a11y', 'bp', 'seo', 'lcp', 'cls', 'tbt']) {
      out[page][k] = median(runs.map((r) => r[k]).filter((v) => v != null));
    }
  }
  return out;
}

const dir = process.argv[2];
const baseDir = process.argv[3];
if (!dir) {
  console.error('usage: lighthouse_summarize.mjs <dir> [baselineDir]');
  process.exit(1);
}

const cur = collect(dir);
const base = baseDir ? collect(baseDir) : null;

const n0 = (v, d = 0) => (v == null ? '—' : v.toFixed(d));
const delta = (a, b, d = 0, invert = false) => {
  if (a == null || b == null) return '';
  const diff = a - b;
  if (Math.abs(diff) < (d === 0 ? 0.5 : 10 ** -d / 2)) return ' (=)';
  const good = invert ? diff < 0 : diff > 0;
  return ` (${good ? '+' : ''}${diff.toFixed(d)}${good ? ' ✅' : ' ⚠️'})`;
};

const rows = [];
for (const page of PAGES) {
  const c = cur[page];
  if (!c) { rows.push(`| \`/${page === 'index' ? '' : page}\` | — | — | — | — | — | — | — |`); continue; }
  const b = base?.[page];
  rows.push(
    `| \`/${page === 'index' ? '' : page}\` | ${n0(c.perf)}${b ? delta(c.perf, b.perf) : ''} | ` +
    `${n0(c.a11y)}${b ? delta(c.a11y, b.a11y) : ''} | ` +
    `${n0(c.bp)}${b ? delta(c.bp, b.bp) : ''} | ` +
    `${n0(c.seo)}${b ? delta(c.seo, b.seo) : ''} | ` +
    `${n0(c.lcp)} ms${b ? delta(c.lcp, b.lcp, 0, true) : ''} | ` +
    `${n0(c.cls, 3)}${b ? delta(c.cls, b.cls, 3, true) : ''} | ` +
    `${n0(c.tbt)} ms${b ? delta(c.tbt, b.tbt, 0, true) : ''} |`
  );
}

const runCounts = [...new Set(Object.values(cur).map((c) => c.n))].join('/');
console.log(`| Page | Perf | A11y | Best Prac. | SEO | LCP | CLS | TBT |`);
console.log(`|---|---|---|---|---|---|---|---|`);
console.log(rows.join('\n'));
console.log(`\n_Median of ${runCounts} runs per page. TBT is the lab proxy for INP._`);

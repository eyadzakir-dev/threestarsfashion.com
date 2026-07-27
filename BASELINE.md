# BASELINE.md — pre-migration Lighthouse

Measured against commit `14c1186` (last pre-migration commit), the flat HTML site.

**These numbers are indicative, not precise.** They exist to catch a catastrophic regression, not to support point-level comparison. Read §"How to use this" before comparing anything.

---

## Results — median of 5 runs, mobile

| Page | Perf | A11y | Best Prac. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 81 | 94 | 100 | 100 | 3778 ms | 0.000 | 0 ms |
| `/about` | 86 | 94 | 100 | 100 | 3106 ms | 0.000 | 0 ms |
| `/services` | 86 | 94 | 100 | 100 | 3110 ms | 0.000 | 0 ms |
| `/facilities` | 81 | 95 | 100 | 100 | 3767 ms | 0.000 | 0 ms |
| `/certifications` | 82 | 93 | 100 | 100 | 3542 ms | 0.000 | 0 ms |
| `/logistics` | 86 | 92 | 100 | 100 | 3101 ms | 0.000 | 0 ms |
| `/faq` | 86 | 94 | 100 | 100 | 3119 ms | 0.000 | 0 ms |
| `/contact` | **100** | 92 | 100 | **92** | **1576 ms** | 0.038 | 0 ms |
| `/privacy-policy` | **100** | 92 | 100 | **92** | **1576 ms** | 0.038 | 0 ms |

Raw JSON in `.lighthouse/baseline/`. Production reference (1 run, real network) in `.lighthouse/production/`.

---

## How to use this

**Step 9's Lighthouse check is an observation, not a gate.** Record whether the migrated site is roughly comparable and move on. Do not chase a delta.

The post-migration pages are *different documents* — different fonts, different images, different markup, different component structure. A point-level comparison against the old pages was never going to mean anything. A 5-point swing is noise; a 40-point collapse is a signal.

**The real performance check happens once, at the end, on the preview deploy, from a phone.** That is the number that matters, because it is the only one measured on the hardware and network a sourcing director will actually use.

---

## ⚠️ `/contact` and `/privacy-policy` score better because they are broken

This is the genuinely useful part of the baseline, and it will otherwise be misread as a regression.

Both pages are missing the opening `<meta name="description"` tag (PARITY.md §4). The orphan `content="…"` text node force-closes `<head>`, so everything after it — including the Google Fonts `<link>` — gets parsed into `<body>`.

Lighthouse confirms the mechanism:

| | `/` (intact head) | `/contact` (broken head) |
|---|---|---|
| Render-blocking resources | **Google Fonts CDN**, `/styles.css` | `/pages.css`, `/styles.css` |
| SEO failures | none | `meta-description` |
| LCP element | `.logo-company-name` | `<body>` |
| LCP | 3778 ms | 1576 ms |

The Google Fonts round-trip is render-blocking on the seven intact pages and **not** on the two broken ones. That single difference is the entire ~2200 ms LCP gap and the ~15-point performance gap.

**Expected movement in step 2, all of it correct:**

| Metric | Before | After | Why |
|---|---|---|---|
| SEO | 92 | **100** | meta description restored |
| Perf | 100 | **~86** | fonts link render-blocking again |
| CLS | 0.038 | **~0.000** | stylesheets no longer load mid-body |

**Do not treat the Perf drop on these two pages as a regression.** It is the price of fixing a real SEO defect. They rejoin the other seven at the correct baseline.

### They also accidentally prove the step 3 win

They demonstrate what removing the render-blocking Google Fonts round-trip is worth: roughly **2200 ms of LCP and ~15 Perf points**. Step 3 self-hosts both families as subset woff2 with no CDN round-trip, which should deliver that gain deliberately across all nine pages.

---

## Harness

```bash
python3 scripts/audit_server.py --root . --port 8080      # legacy site
scripts/lighthouse_run.sh http://127.0.0.1:8080 .lighthouse/baseline 5
node scripts/lighthouse_summarize.mjs .lighthouse/baseline
```

Post-migration, only the served root changes:

```bash
python3 scripts/audit_server.py --root dist --port 8080
scripts/lighthouse_run.sh http://127.0.0.1:8080 .lighthouse/astro 5
node scripts/lighthouse_summarize.mjs .lighthouse/astro .lighthouse/baseline
```

| Setting | Value |
|---|---|
| Lighthouse | 12.8.2 via `npx lighthouse@12` |
| Form factor | mobile, `simulate` throttling (Lighthouse mobile defaults) |
| Runs | 5 per page, **median** |
| Server | `scripts/audit_server.py` — clean URLs, `no-store`, nothing injected |

**Why 5 runs, not 3.** At 3 runs a single contended run moved the median by up to 21 points — `/services` measured [66, 61, 87] and `/about` [86, 65, 86], with LCP swinging 3.9 s. At 5 runs `/services` settles at 86. Run with the machine otherwise idle; these are still ±5 points.

**Why not `scripts/dev_server.py`.** It injects a livereload `<script>` into every HTML response. `audit_server.py` exists so both sides are measured identically.

**On INP.** Lighthouse lab runs cannot measure INP — it needs real interaction and is field-only. **TBT is the lab proxy** and is what that column reports. Do not relabel it.

**One harness bug worth remembering.** The first version of `audit_server.py` did not percent-decode request paths, so every asset under `4 Pics home page/`, `Cutting Area/` and `Adminstrative Building.jpg` returned 404. Five images silently never loaded, Best Practices read 96 instead of 100, and LCP was optimistic. Fixed before these numbers were taken — but it is a good illustration of how a measurement harness fails quietly.

---

## Standing issues visible in the baseline

| Issue | Evidence | Addressed in |
|---|---|---|
| Google Fonts CDN render-blocking on 7 pages | `render-blocking-resources` | Step 3 |
| Missing meta description on 2 pages | SEO 92 | Step 2 |
| A11y ceiling of 92–95; no page reaches 100 | All pages | Steps 6–8 |
| 57 of 90 `<img>` carry no width/height | Source inspection | Step 4 |
| `favicon.svg` 271 KB, `tsflogo.png` 203 KB | Asset inventory | Step 4 |

CLS is 0.000 on the seven intact pages despite the missing image dimensions, because those images are below the fold and lazy-loaded, so they never shift measured content. That is luck, not correctness — **CLS has no headroom and can only get worse.** It is the one metric worth watching closely.

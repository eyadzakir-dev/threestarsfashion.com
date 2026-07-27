# PARITY.md — factual claim register

Every verifiable claim on the pre-migration site, with exact wording and source.

**Nothing here may be dropped silently.** If a claim has no home in the new design, say so rather than removing it. The step 9 merge check greps the build against this file.

Line numbers refer to the flat HTML files as of commit `14c1186` (the last pre-migration commit). Quotes are verbatim, including typos and inconsistent spacing.

**Status vocabulary**

| Status | Meaning |
|---|---|
| **CARRY** | Must appear in the rebuild |
| **RETIRED** | Deliberately removed by decision. Not a regression — do not flag |
| **OPEN** | Unresolved. Do not guess, do not normalise |
| **META-ONLY** | Exists only in a meta tag, never in body copy |

---

## 1. Conflict register

| # | Conflict | Status | Decision |
|---|---|---|---|
| 1 | Screen printing capacity: `6,000+` (1 meta) vs `65,000+` (5 body) | **RETIRED** | Capability stated with **no quantity**. No softer quantifier either — "high-capacity"/"industrial-scale" are still capacity claims. See §6. |
| 2 | `15+ Years Experience` vs `foundingDate 2008` and `© 2026` | **OPEN** | 18 years by the site's own dating. Figure sits unlabelled in the GPL stat row, so it may be scoped to GPL rather than the group. Needs a decision. |
| 3 | Certification count: 8 (certifications page body) vs 11 (FAQ + design system) | **CARRY — adopt 11** | Adds Higg Index, FAMA (Disney), Inditex Approved Facility, all three of which already appear in `faq.html` body copy and meta. |
| 4 | `98% on-time delivery`, `Gerber` cutting systems | **META-ONLY** | Neither appears in any body copy. Surfacing them creates a newly-prominent claim; dropping the meta deletes them. Flag, don't silently resolve. |
| 5 | Solar commitment "by 2026" — past due | **RESOLVED** | Restated as **70–80% solar power by 2030**, under Vision 2030. Original wording preserved in §5. |
| 6 | `600 tons` greige vs `450 tons` cotton/CVC | **CARRY** | Almost certainly nested (450 is a subset of 600) but the site never says so. State the relationship explicitly in the rebuild. |
| 7 | Three phone formats | **OPEN — do not normalise** | See §7. All three are well-formed; the apparent "extra digit" is a Cairo-vs-Alexandria area-code ambiguity, not an error. |
| 8 | `process-scroll.html` stage 06: "Eighty thousand pieces" | **RESOLVED** | → **85,000**. CLAUDE.md locks this figure. |

### The 80,000 figure does not exist in this repo

CLAUDE.md warns against `80,000`. Searched every tracked file and all 23 commits across every ref for `80,000`, `80000`, `80 000`, `80K`, `eighty`. **Zero hits.** All 12 in-repo occurrences of daily capacity read `85,000+`.

The single wrong instance is in the design file `process-scroll.html` (stage 06 caption), which is not yet in the repo and enters via step 5.

---

## 2. Global claims — identical on all 9 pages

### Fullscreen menu footer
| Claim | Exact wording |
|---|---|
| Email | `info@tsf.com.eg` |
| Phone | `+2 03 4500550` |
| Location | `Alexandria Free Zone` / `Egypt` |

### Page footer — contact block
```
Factory / Head Office:
Street No. 7 - Public Free Zone Amreya
Alexandria, Egypt | Postal Code: 23512
Tel: +2 03 4500550 | +2 011 41333589
Email: info@tsf.com.eg
```

### Footer bottom
`© 2026 Three Stars Fashion. All rights reserved.`

### Social
`https://www.linkedin.com/company/three-stars-fashion-group/posts/?feedView=all` — header + footer on every page, `target="_blank"` (note: no `rel="noopener"`).

### Brand
Logo `assets/Brands/tsflogo.png`, alt `Three Stars Fashion`. Wordmark text `Three Stars Fashion`.

### Canonical URLs — CARRY EXACTLY
`https://threestarsfashion.com/` · `/about` · `/services` · `/facilities` · `/certifications` · `/logistics` · `/faq` · `/contact` · `/privacy-policy`

No `.html`, no trailing slash. `og:url` matches canonical on every page. `sitemap.xml` uses identical forms.

### Repo-level
- `CNAME` → `threestarsfashion.com`
- `sitemap.xml` — 9 URLs, all `<lastmod>2026-04-05</lastmod>`; priorities 1.0 home, 0.8 about/services/contact, 0.7 facilities/certifications/logistics, 0.6 faq, 0.3 privacy-policy
- `site.webmanifest` — `"name": "Three Stars Fashion"`, `"short_name": "TSF"`, `theme_color #1B2A4E`, `background_color #FAF9F6`
- `og:site_name` = `Three Stars Fashion Group`; og:image = `https://threestarsfashion.com/assets/og-image.jpg`

---

## 3. Per-page claims

### 3.1 index.html

**JSON-LD `Organization`** (L32–73) — CARRY VERBATIM
- `name` `Three Stars Fashion Group`; `alternateName` `TSF`
- `url` `https://threestarsfashion.com` — note: **no trailing slash, unlike the canonical**
- `logo` `.../assets/Brands/tsflogo.png`; `image` `.../assets/og-image.jpg`
- **`foundingDate` `2008`**
- `description`: "A leading garment manufacturing and apparel exporting group based in Alexandria, Egypt, specializing in high-quality knitted and woven garments for globally recognized brands."
- `PostalAddress`: `Street No. 7, Public Free Zone Amreya` / `Alexandria` / `EG` / `23512`
- `ContactPoint`: `+20-3-4500550`, `sales`, `info@tsf.com.eg`, `["English","Arabic"]`
- `sameAs`: `https://www.linkedin.com/company/three-stars-fashion-group/`
- `knowsAbout` (10): Garment Manufacturing, Apparel Export, Knitted Garments, Woven Garments, Activewear, Casualwear, Screen Printing, Embroidery, Private Label Manufacturing, OEM Apparel
- `hasCredential` (9): ISO 9001, WRAP Gold, OEKO-TEX Standard 100, GRS - Global Recycled Standard, BSCI, SEDEX, Better Work, Higg Index, OCS - Organic Content Standard

**Hero** (L175–186)
- Label: `ESTABLISHED 2008`
- Body: "Three Stars Fashion Group (TSF) is a vertically integrated garment manufacturing group and leading apparel exporter based in Alexandria, Egypt. With 85,000+ units daily capacity, 3,100+ sewing machines, and duty-free access to both the US and EU, we deliver scalable, compliance-ready production for global brands and retailers — from development and sampling through manufacturing, embellishment, and logistics."

**Stats** (L278–296) — CARRY
| Value | Label |
|---|---|
| `85000` + `+` | `Daily Production Capacity (Units)` |
| `3100` + `+` | `Sewing Machines` |
| `10` | `Manufacturing Factories` |
| `24/7` | `Operations Capability` |

**About preview** (L257–264) — buyer approvals
> "Three Stars Fashion Group operates under internationally recognized compliance and sustainability standards including WRAP Gold, ISO 9001, GRS, OEKO-TEX, Better Work, and BSCI. We are an approved manufacturing facility for brands including Walmart, Under Armour, Inditex, Disney, and others."

**Customers** (L308–310)
> "We are an approved supplier and active manufacturing partner for major international brands and retailers across the US, EU, and global markets."

**Client logos** (12, rendered twice for the marquee) — CARRY all 12
Nike · Puma · Disney · Tommy Hilfiger · Calvin Klein · Zara · Costco · Reebok · FILA · Kenneth Cole · Eddie Bauer · U.S. Polo Assn.

**CTA** (L403–406)
> "Partner with one of Egypt's largest vertically integrated apparel manufacturers. 85,000+ daily unit capacity, certified facilities, own logistics arm, and duty-free access to the US and EU."

**Expertise tiles** (L211–238): Cutting — "Precision cutting with advanced CAD technology"; Printing — see §6 (RETIRED); Production — "Expert manufacturing with state-of-the-art sewing machines"; Warehousing — "Full warehousing and logistics management".

---

### 3.2 about.html

**Our story** (L146–172)
- Heading: `Vertically Integrated Manufacturing Since 2008`
- "Three Stars Fashion Group (TSF) is a pioneering garment manufacturing company and prominent apparel exporter based in Alexandria, Egypt. Established in 2008, TSF specializes in the production of high-quality knitted and woven garments for globally recognized brands and retailers."
- **Group companies:** "Our group of companies includes Three Stars Fashion, Three Stars Apparels, Golden Stars Textile, and Green Point Logistics. Together, we are ranked as one of the largest apparel manufacturers and exporters in Egypt."
- **Product range:** "Our product range spans activewear and athletics, casualwear, uniforms, and underwear — covering men's, ladies', and kids' categories. Supported by one of the largest flat-seam machine inventories in Egypt, we are particularly recognized for our expertise in performance and athletic garments."

**Values** (L199–252)
- Sustainability — see §5 (solar, RESTATED)
- Innovation: "Continuously investing in manufacturing technology, process automation, and production engineering to maintain efficiency and quality standards across high-volume, multi-category programs."
- **Ethical Practices:** "Upholding fair labor practices and contributing to the well-being of our employees and communities. We actively support local communities through food programs and healthcare partnerships."
- Customer Satisfaction: "Prioritizing partner requirements across every stage of engagement — from initial sampling and development through bulk production, quality assurance, and on-time delivery."

**Vision** (L260–275) — label `VISION 2030`
> "To be a global leader in sustainable apparel manufacturing, setting new benchmarks in operational efficiency, environmental stewardship, and social responsibility."
> "Looking ahead, Three Stars Fashion Group is focused on expanded manufacturing capacity and automation, deeper integration of renewable energy, broader adoption of recycled and organic materials, expansion into new global markets, and continued investment in technology, people, and compliance."

**Leadership** (L305–336) — named individuals, CARRY EXACTLY
| Name | Title |
|---|---|
| `Zakir Hossain` | `Founder & Chairman` |
| `Ziad Zakir` | `Chief Executive Officer` |
| `Ahmed Mahran` | `General Manager` |
| `Tarek Gaber` | `Chief Marketing Officer` |

---

### 3.3 services.html

Seven numbered service cards. Full descriptions and feature lists CARRY.

| # | Title | Key claims |
|---|---|---|
| 01 | Precision Cutting | CAD/CAM, automated cutting, pattern optimization, multi-layer |
| 02 | Expert Sewing | **`3,100+ machines`**, activewear/casualwear/uniforms/underwear |
| 03 | Screen Printing | **6 machines** CARRY; capacity figure RETIRED — see §6 |
| 04 | Embroidery | Computerized, multi-head, in-house digitization |
| 05 | Packing & Finishing | Pressing, inspection, labeling, export-ready |
| 06 | Quality Assurance | **`AQL sampling standards`**, in-line checks |
| 07 | Product Development & Sourcing | **`Dedicated sourcing office in China`**, **`450+ tons cotton/CVC jersey stock`** |

Intro: "TSF offers a complete range of garment manufacturing services — from cutting and sewing through embellishment, finishing, quality assurance, and product development."

---

### 3.4 facilities.html

**Location / trade access** (L461–467) — CARRY, this is a load-bearing claim
> "Our manufacturing complex is located in the Alexandria Public Free Zone, providing direct access to Alexandria's commercial port and positioning us at a logistical crossroads between Europe, Africa, and the Middle East — with duty-free export access to the US under QIZ and to the EU under Euro1."

**Named buildings** (3)
1. `Three Stars Printing Facility` — 6 screen printing machines (capacity figure RETIRED, §6)
2. `Administrative Building` — "administrative and technical offices, our precision cutting department, and extensive fabric storage facilities"
3. `TSF Building (B) - Production Hub` — "sewing department, packing area, accessories store, and finished goods warehouse"

**Department galleries** (4): Cutting Area (8 images), Printing Facility (3), Production (5), Warehousing (6)

**Stats** — same four as index, one label differs: `Daily Production Capacity` (index says `Daily Production Capacity (Units)`)

**CTA:** `Schedule a Factory Audit or Tour` — "We welcome sourcing teams and prospective partners to conduct factory audits, evaluate our production capabilities, and tour our facilities firsthand."

**Asset filename note:** `assets/Buildings/Adminstrative Building.jpg` is misspelled in the filename and referenced as-is by `index.html:246` and `facilities.html:488`. Renaming breaks both.

---

### 3.5 certifications.html

**Eight cards in body.** Adopt **11** per conflict #3 — the three additions already exist in `faq.html` body copy.

| # | Title | Description (verbatim) |
|---|---|---|
| 1 | `ISO 9001` | "Quality Management System certification ensuring consistent product quality, customer satisfaction, and continuous improvement across all processes." |
| 2 | `Better Work` | "ILO-IFC partnership certification ensuring improved working conditions and labor compliance with international standards." |
| 3 | `BSCI` | "Business Social Compliance Initiative certification ensuring fair working conditions, ethical labor practices, and respect for human rights." |
| 4 | `WRAP (Gold)` | "Gold-level Worldwide Responsible Accredited Production certification confirming lawful, humane, and ethical manufacturing throughout our facilities." |
| 5 | `OEKO-TEX` | "Standard 100 certification guaranteeing that our products are tested for harmful substances and are safe for human and environmental health." |
| 6 | `OCS` | "Organic Content Standard certification for products containing 5% or more organic material, ensuring organic fiber integrity throughout the supply chain." |
| 7 | `SEDEX` | "Supplier Ethical Data Exchange membership demonstrating ethical supply chain management and transparency in our labor, health, and environmental practices." |
| 8 | `GRS` | "Global Recycled Standard certification validating recycled content claims and responsible social and environmental practices in production." |
| +9 | `Higg Index` | From faq.html / meta. No body description exists — needs one written. |
| +10 | `FAMA (Disney)` | From faq.html / meta. No body description exists. |
| +11 | `Inditex Approved Facility` | From faq.html / meta. No body description exists. |

**No certificate numbers, no issuers (beyond "ILO-IFC"), no validity dates, and no scope statements exist anywhere on the site.** The actual award names exist only inside the six `Awards and Recognitions/*.jpg` images, not as text.

Intro: "These certifications are independently audited and represent verified operational standards — not marketing claims."

Naming inconsistency to settle: `WRAP Gold` (index) vs `WRAP (Gold)` (certifications, faq).

---

### 3.6 logistics.html

**Green Point Logistics** (L593–623)
> "Green Point Logistics (GPL) is the dedicated logistics subsidiary of Three Stars Fashion Group, providing fully integrated supply chain management from production floor to destination port. As an in-house operation, GPL eliminates the gaps between manufacturing and delivery — giving our partners a single point of accountability across the entire fulfillment cycle."

**GPL stats** (hard-coded text, not `data-count`)
| Value | Label |
|---|---|
| `40+` | `Countries Served` |
| `3` | `Shipping Modes (Air, Sea, Land)` |
| `15+` | `Years Experience` — **OPEN**, conflict #2 |

**Capability cards** (4): Global Freight (air/sea/land) · Expert Customs Clearance (Egyptian customs) · Warehousing & Storage · Specialized Shipping (**garment-on-hanger (GOH), flat-pack**)

**External link:** `https://gpl.com.eg/`

**META-ONLY on this page:** `98% on-time delivery` (L17, L21, L26). No body copy states an on-time percentage.

---

### 3.7 faq.html

Seven Q&A. Body copy and the `FAQPage` JSON-LD are **byte-identical** — keep them in sync. All CARRY.

| Q | Load-bearing figures |
|---|---|
| Freight lead time | EU "within one week"; US "approximately three weeks" |
| Duty-free | **QIZ** (US), **Euro-Mediterranean Partnership / Euro 1** (EU) |
| Total order lead time | **~30 days** single jersey; **600+ tons greige in-house**; **~45 days** local knits incl. Jersey and Fleece |
| Materials sourcing | **~60% locally sourced** basic knits; China sourcing office; **450+ tons cotton and CVC jersey** |
| Product range | men's/ladies'/kids'/uniforms/underwear; hoodies, leggings, sports bras, rash guards, soft-shell jackets, t-shirts, polos, pants, dresses, outerwear, scrubs, team uniforms, boxers, nightwear; "one of the largest flat-seam machine inventories in Egypt" |
| Certifications | The canonical **11-item list** + approvals: **Walmart, Under Armour, Fruit of the Loom, PVH, Primark** |
| Product development | In-house design/development/sampling; China fabric sourcing and quality office |

`faq.html` is the **only source** for: the 30/45-day lead times, the 60% local sourcing figure, and the 600-ton greige stock. Losing this page loses those claims.

---

### 3.8 contact.html

- `Factory / Head Office` — `Street No. 7 - Public Free Zone Amreya`, `Alexandria, Egypt`, `Postal Code: 23512`
- Phones — displayed `+2 03 4500550` and `+2 011 41333589` (see §7)
- Email `info@tsf.com.eg`
- LinkedIn, labelled `Three Stars Fashion`
- **Tally form:** `https://tally.so/embed/9qvgVp?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`, title `Submit an Inquiry / Contact Form` — CARRY, decision is to keep the embed
- **Google Maps embed** — coordinates **lng `29.7788598`, lat `31.0302978`**, place id `0x14f5932fe7f32ec9:0x86e2c0b341a01c68`, iframe title `Three Stars Fashion - Alexandria Free Zone, Egypt`

Intro: "Whether you're sourcing a new manufacturing partner for ongoing programs, evaluating capacity for a new product line, or requesting compliance documentation, our team is ready to support your requirements."

---

### 3.9 privacy-policy.html

- **`Last Updated: April 2026`**
- Entity: `Three Stars Fashion Group ("TSF", "we", "us", or "our")`; domain `threestarsfashion.com`
- **Group companies — 3 affiliates** (vs 4 entities in about.html, which includes TSF itself): `Three Stars Apparels, Golden Stars Textile, Green Point Logistics`
- **Named processor:** "We use Tally.so to process contact form submissions."
- Data collected: contact details, inquiry details, technical/log data
- "We do not collect any sensitive personal data (such as payment card information) through this website."
- "We do not sell, rent, or trade your personal information to third parties."
- "We do not use cookies to track you across other websites."
- "We will not use your information for unsolicited marketing without your prior consent."
- Rights: access / correction / deletion / object-or-restrict
- Section structure (8 numbered sections) CARRIES

---

## 4. Head tags — port verbatim

All 9 pages: `<title>`, meta description, canonical, `og:type`/`site_name`/`title`/`description`/`url`/`image`, `twitter:card`/`title`/`description`/`image`. Head tag ORDER is currently identical across all 9 — preserve it.

`og:description` and `twitter:description` are byte-identical to each other on every page.

Literal `&amp;` appears in the `<title>` of services, logistics and faq — preserve as-is.

### Known defect — the one sanctioned deviation

`contact.html:14` and `privacy-policy.html:14` are **missing the `<meta name="description"` opening tag**, leaving a bare `content="…"` text node in `<head>`. Per HTML parsing rules this force-closes `<head>` and opens `<body>`, so on these two pages every og/twitter tag, both preconnects, the fonts link and both stylesheets are parsed into `<body>` — and the description is lost to crawlers entirely.

Astro cannot reproduce this. **The rebuild emits a correct tag with the text preserved exactly.** Recorded here so the change is visible rather than silent.

Both description strings, verbatim:
- contact: "Contact Three Stars Fashion Group for garment manufacturing inquiries and submit an inquiry. Visit our Alexandria Free Zone facilities or reach us via phone (+2 03 4500550) and email (info@tsf.com.eg)."
- privacy-policy: "Privacy Policy for Three Stars Fashion Group. Learn how we collect, use, and protect your personal information when you contact us or submit an inquiry for garment manufacturing services."

---

## 5. Solar commitment — RESTATED

**Original** (`about.html:202-203`):
> "Committed to reducing our environmental footprint through eco-friendly practices and the use of sustainable materials and energy. **We're transitioning to 70-80% solar power by 2026.**"

**Replacement:** transitioning to **70–80% solar power by 2030**, under Vision 2030. Range unchanged.

Rationale: the site is dated `© 2026` and `Last Updated: April 2026`, so the original deadline is now due or past. A past-due public environmental commitment is read by brand ESG teams, and deleting it silently is itself a signal to anyone who archived the page. Restating with a real date is the honest option.

---

## 6. Screen printing capacity — RETIRED BY DECISION

**Not a lost claim. Do not flag as a regression in step 9.**

The rebuild states in-house screen printing as a **capability with no quantity attached**. No softer quantifier is permitted either — "high-capacity", "large-scale" and "industrial-scale" are still capacity claims and defeat the purpose.

**What is retired:** both `6,000+` and `65,000+` pcs/day.
**What is kept:** the existence of in-house screen printing, and the **6 machines** count.

All source locations, preserved for the record:

| File:line | Verbatim |
|---|---|
| `services.html:15` | "screen printing (6,000+ pcs/day)" — meta description |
| `services.html:192` | "a daily capacity of 65,000+ pieces" |
| `services.html:198` | "65,000+ pieces daily capacity" — feature list |
| `index.html:223` | "Screen printing with 65,000+ pcs daily capacity" |
| `facilities.html:481` | "production capacity exceeding 65,000 pieces per day" |
| `facilities.html:524` | "65,000+ pieces daily production capacity" |

Also present in the design system's `ui_kits/website/data.js` in four places — `capabilities[1].meta`, `services[2].description`, `programme[1]`, `facilities[2]` — which must be stripped during steps 6–8.

Note the meta tag is the only `6,000+`; the five body instances agree on `65,000+`. This looks like a dropped digit, but the figure is retired rather than corrected, so the discrepancy is moot.

---

## 7. Phone numbers — OPEN, DO NOT NORMALISE

Three formats exist. **All three are well-formed.** Record and leave alone pending confirmation by dialling.

| Form | Source | Parses as |
|---|---|---|
| `+2 03 4500550` | Displayed text, all 9 pages | Ambiguous display formatting |
| `tel:+20234500550` | `contact.html:175`, `privacy-policy.html:201` | Valid **Cairo**: `+20` `2` `34500550` (8-digit subscriber) |
| `+20-3-4500550` | `index.html:52` JSON-LD | Valid **Alexandria**: `+20` `3` `4500550` (7-digit subscriber) |

Egypt assigns Cairo area code `2` with 8-digit subscriber numbers and Alexandria area code `3` with 7-digit. There is no extra digit unless you assume Alexandria going in — "correcting" `tel:+20234500550` to `tel:+2034500550` would change a working number into a different one.

Mobile `tel:+201141333589` is unambiguous and well-formed.

---

## 8. Claims with NO in-repo source

Recorded so nobody invents them later. The site says nothing about: employee headcount, floor area, production line counts, annual or monthly output, MOQs, incoterms, named ports (only "Alexandria's commercial port" and "major U.S. ports"), export percentages, revenue, company registration numbers, award names as text, industry memberships, or certificate numbers and validity dates.

`40+ Countries Served` (logistics) is the only country-coverage figure.

---

## 9. Orphans and asset notes

- **`assets/Brands/taylor-swift.svg`** — present in the repo, referenced by **zero** pages. Decision: **drop**. The design system's brand list excludes it. If a Taylor Swift merch programme is real, it needs a copy claim, not a silent logo.
- **Duplicate files:** `4 Pics home page/production.jpg` is byte-identical to `Cutting Area/9.jpg`; `4 Pics home page/printing.jpg` to `Printing Facility/4.jpg`.
- **`assets/favicon/favicon.svg` is 271 KB** — larger than any photograph on the site.
- **`assets/Brands/tsflogo.png` is 203 KB** — the header logo on every page.
- Lightbox `data-full-src` is referenced by the JS but **exists nowhere**, so the lightbox always shows the thumbnail at full size. No hi-res path is wired up.

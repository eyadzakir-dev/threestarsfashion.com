/**
 * Every figure and claim on the site, in one place. Edit facts here, not in
 * page markup.
 *
 * Authority is PARITY.md. Three content resolutions from it are already applied:
 *
 *  1. Screen printing capacity is RETIRED. The site states in-house screen
 *     printing as a CAPABILITY WITH NO QUANTITY. Neither 6,000+ nor 65,000+
 *     appears here, and no softer quantifier either — "high-capacity",
 *     "large-scale" and "industrial-scale" are still capacity claims and defeat
 *     the purpose. The machine count (6) is kept; it is not a capacity claim.
 *  2. The solar commitment reads 70-80% by 2030, under Vision 2030. The original
 *     "by 2026" is preserved in PARITY.md §5.
 *  3. The certification list is 11 items, matching faq.html body copy, not the
 *     8 that the legacy certifications page showed.
 *
 * Two conflicts remain OPEN and are deliberately NOT resolved here:
 *  - GPL "15+ Years Experience" vs founded 2008 (18 years). Left as-is.
 *  - Three phone number formats, all well-formed. Not normalised.
 */

export const COMPANY = {
  name: 'Three Stars Fashion',
  group: 'Three Stars Fashion Group',
  short: 'TSF',
  founded: '2008',
  street: 'Street No. 7 – Public Free Zone Amreya',
  city: 'Alexandria',
  country: 'Egypt',
  postalCode: '23512',
  email: 'info@tsf.com.eg',
  phoneLandline: '+2 03 4500550',
  phoneLandlineHref: 'tel:+20234500550',
  phoneMobile: '+2 011 41333589',
  phoneMobileHref: 'tel:+201141333589',
  linkedin: 'https://www.linkedin.com/company/three-stars-fashion-group/posts/?feedView=all',
  gpl: 'https://gpl.com.eg/',
} as const;

/** The four headline figures. `count` drives the count-up. */
export const STATS = [
  { value: '85,000', suffix: '+', label: 'Units per working day', animate: true },
  { value: '3,100', suffix: '+', label: 'Sewing machines', animate: true },
  { value: '10', label: 'Manufacturing factories', animate: true },
  { value: '24/7', label: 'Operations capability', animate: false },
] as const;

export const CAPABILITIES = [
  {
    index: '01',
    title: 'Cutting',
    description: 'Automated CAD/CAM cutting with multi-layer capability and pattern optimization.',
    meta: '450+ tons jersey in stock',
    dir: 'assets/4 Pics home page',
    basename: 'cutting',
    alt: 'Fabric spreading and cutting tables',
  },
  {
    index: '02',
    title: 'Printing',
    // No capacity figure. Six machines is a count, not a capacity claim.
    description: 'Six screen-printing machines, water-based and plastisol inks, special effects.',
    meta: 'In-house screen printing',
    dir: 'assets/4 Pics home page',
    basename: 'printing',
    alt: 'Screen printing operation',
  },
  {
    index: '03',
    title: 'Production',
    description: 'Flat-seam, coverstitch and lockstitch lines across multiple factory buildings.',
    meta: '3,100+ machines',
    dir: 'assets/4 Pics home page',
    basename: 'production',
    alt: 'Sewing lines in Building B',
  },
  {
    index: '04',
    title: 'Warehousing',
    description: 'Raw material and finished-goods storage with in-house export consolidation.',
    meta: 'GOH and flat-pack',
    dir: 'assets/4 Pics home page',
    basename: 'warehousing',
    alt: 'Finished goods warehousing',
  },
] as const;

/** Programme parameters. Note the absence of a printing capacity row. */
export const PROGRAMME = [
  { label: 'Daily production capacity', value: '85,000', unit: 'pcs' },
  { label: 'Sewing machines', value: '3,100', unit: '+' },
  { label: 'Greige fabric held in-house', value: '600', unit: 'tons' },
  { label: 'Cotton / CVC jersey stock', value: '450', unit: 'tons' },
  { label: 'Lead time — single jersey', value: '30', unit: 'days' },
  { label: 'Lead time — local knits', value: '45', unit: 'days' },
  { label: 'Freight — European ports', value: '7', unit: 'days' },
  { label: 'Freight — major US ports', value: '21', unit: 'days' },
] as const;

export const GROUP_COMPANIES = [
  { label: 'Three Stars Fashion', value: 'Knitted and woven garment manufacturing' },
  { label: 'Three Stars Apparels', value: 'Additional sewing capacity' },
  { label: 'Golden Stars Textile', value: 'Textile operations' },
  { label: 'Green Point Logistics', value: 'Freight, customs and warehousing' },
] as const;

export const TRADE = [
  { label: 'United States', value: 'Duty-free', unit: 'QIZ' },
  { label: 'European Union', value: 'Duty-free', unit: 'Euro 1' },
  { label: 'Countries served', value: '40', unit: '+' },
  { label: 'Shipping modes', value: '3', unit: 'air / sea / land' },
] as const;

/** Eleven items, per PARITY.md conflict 3. */
export const CERTIFICATIONS = [
  { name: 'ISO 9001', scope: 'Quality management system' },
  { name: 'WRAP', grade: 'Gold', scope: 'Social compliance — all facilities' },
  { name: 'OEKO-TEX Standard 100', scope: 'Product safety and restricted substances' },
  { name: 'GRS', scope: 'Global Recycled Standard — recycled content' },
  { name: 'OCS', scope: 'Organic Content Standard' },
  { name: 'BSCI', scope: 'Business Social Compliance Initiative' },
  { name: 'SEDEX', scope: 'Supplier ethical data exchange' },
  { name: 'Better Work', scope: 'ILO / IFC programme participation' },
  { name: 'Higg Index', scope: 'Environmental and social performance' },
  { name: 'FAMA', scope: 'Disney facility and merchandise authorisation' },
  { name: 'Inditex approved facility', scope: 'Vendor approval status' },
] as const;

/** Named in copy, no logos held. */
export const APPROVALS = [
  'Walmart', 'Under Armour', 'Inditex', 'Disney', 'PVH', 'Primark', 'Fruit of the Loom',
] as const;

/**
 * All 12 client marks carry forward, confirmed contractually permitted.
 * taylor-swift.svg is deliberately absent — it is referenced by no page and the
 * design system's brand list excludes it (PARITY.md §9).
 */
export const BRANDS = [
  { dir: 'assets/Brands', basename: 'nike', name: 'Nike' },
  { dir: 'assets/Brands', basename: 'puma-logo', name: 'Puma' },
  { dir: 'assets/Brands', basename: 'disney-2', name: 'Disney' },
  { dir: 'assets/Brands', basename: 'tommy-hilfiger', name: 'Tommy Hilfiger' },
  { dir: 'assets/Brands', basename: 'calvin-klein-1', name: 'Calvin Klein' },
  { dir: 'assets/Brands', basename: 'zara-logo-1', name: 'Zara' },
  { dir: 'assets/Brands', basename: 'costco-wholesale', name: 'Costco' },
  { dir: 'assets/Brands', basename: 'reebok-2019-logo', name: 'Reebok' },
  { dir: 'assets/Brands', basename: 'fila-9', name: 'FILA' },
  { dir: 'assets/Brands', basename: 'kenneth-cole', name: 'Kenneth Cole' },
  { dir: 'assets/Brands', basename: 'eddie-bauer', name: 'Eddie Bauer' },
  { dir: 'assets/Brands', basename: 'u-s-polo-assn-seeklogo', name: 'U.S. Polo Assn.' },
] as const;

/** Alexandria to the US East Coast, and to the EU. */
export const TRANSIT = [
  { stage: 'Ex-factory', detail: 'Alexandria Public Free Zone', days: null },
  { stage: 'Consolidation and documentation', detail: 'Green Point Logistics, in-house', days: null },
  { stage: 'Alexandria commercial port', detail: 'Direct access from the complex', days: null },
  { stage: 'European ports', detail: 'Within one week', days: '7' },
  { stage: 'Major U.S. ports', detail: 'Approximately three weeks', days: '21' },
] as const;

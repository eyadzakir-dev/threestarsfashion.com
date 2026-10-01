// Homepage star journey: the three stars of the TSF logo travel the page as you scroll.
// Hero logo → key figures → right-hand margin (while the page runs on) → screen-printing stencil (printed onto
// the shirt) → globe routes → closing logo.
// Star shapes come from the shared #three-stars symbol, and every position is derived from live element rects,
// so the stars stay attached to the page at any scroll offset.

const STAR_COUNT = 3;
const BOW = [0.8, -0.45, 0.3];
const DOCK_OF_STAR = [2, 1, 0];
const GLOBE_ROLE = ['us', 'eu', 'alex'];
const GLOBE_RADII = [9, 11, 15];
const CLUSTER_PX_PER_UNIT = 0.24;
const STAR_BOX = 400;
const STAR_PAD = 1.15;
const STAR_STROKE = 0.07;
const STAGGER = 0.08;
const SPIN_DEG = 28;
const MAX_BOW_PX = 150;
const STAGE_MARGIN = 18;
const HEAL_FADE_RADII = 1.5;
const IGNITE = { delay: 0.45, gap: 0.26, length: 1.1 };
const LINE_STATIONS = 10;
const PRINT = { station: 4, start: 0.04, span: 0.74, sweepStart: 0.14, sweepSpan: 0.32, squeegeeTravel: 128, inkLeft: 28, inkWidth: 70 };
// Parked in the page gutter (half of --pad from the edge) between the key figures and the production line.
const PARK = { wide: { inset: 16, radii: [4.5, 6, 7.5], gap: 24 }, narrow: { inset: 10, radii: [3.5, 4.5, 6], gap: 18 } };
const NARROW = matchMedia('(max-width: 899px)');
const RED = [229, 34, 34];
const WHITE = [255, 255, 255];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v, a, b) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOutBack = (t) => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2;

/* ---------- Overlay ---------- */

// Star outlines from #three-stars. `.star-heal` fills in the large star's edges that the logo's "3" covers.
function readStarShapes() {
  const symbol = document.getElementById('three-stars');
  if (!symbol) return [];
  const stars = [...symbol.querySelectorAll('path:not(.star-heal)')];
  const heal = symbol.querySelector('.star-heal')?.getAttribute('d') ?? '';
  return stars.map((path, i) => ({ d: path.getAttribute('d'), heal: i === stars.length - 1 ? heal : '' }));
}

// Frame an overlay star on its own bounding box; returns its centre and radius in logo units.
function fitStar({ el, path }) {
  const b = path.getBBox();
  const geo = { cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: Math.max(b.width, b.height) / 2 };
  const half = geo.r * STAR_PAD;
  el.setAttribute('viewBox', `${geo.cx - half} ${geo.cy - half} ${half * 2} ${half * 2}`);
  path.setAttribute('stroke-width', (geo.r * STAR_STROKE).toFixed(2));
  return geo;
}

function buildOverlay(shapes) {
  const layer = document.createElement('div');
  layer.className = 'journey';
  layer.setAttribute('aria-hidden', 'true');
  const stars = shapes.map((s, i) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'journey__star');
    el.style.setProperty('--n', i);
    el.innerHTML = `<path pathLength="1" d="${s.d}"/>` + (s.heal ? `<path class="journey__heal" d="${s.heal}"/>` : '');
    layer.append(el);
    return { el, path: el.firstElementChild, heal: el.querySelector('.journey__heal') };
  });
  document.body.append(layer);
  return { layer, stars, geo: stars.map(fitStar) };
}

// Matches a <use href="#three-stars"> rect, which spans every path in the symbol, fill-in pieces included.
function inkBox(stars) {
  const boxes = stars.flatMap(({ path, heal }) => (heal ? [path, heal] : [path])).map((el) => el.getBBox());
  return {
    x0: Math.min(...boxes.map((b) => b.x)),
    y0: Math.min(...boxes.map((b) => b.y)),
    x1: Math.max(...boxes.map((b) => b.x + b.width)),
    y1: Math.max(...boxes.map((b) => b.y + b.height)),
  };
}

function paint({ el, heal }, p) {
  if (p.alpha <= 0.002 || p.r <= 0.2) {
    el.style.opacity = '0';
    el.style.clipPath = '';
    return;
  }
  const scale = (p.r * STAR_PAD * 2) / STAR_BOX;
  el.style.opacity = p.alpha.toFixed(3);
  if (heal) heal.style.opacity = (p.heal ?? 1).toFixed(3);
  el.classList.toggle('is-glowing', (p.glow ?? 0) > 0.5);
  el.style.color = `rgb(${p.color.map((c) => Math.round(c)).join(',')})`;
  el.style.transform = `translate3d(${(p.x - STAR_BOX / 2).toFixed(1)}px, ${(p.y - STAR_BOX / 2).toFixed(1)}px, 0) rotate(${p.rot.toFixed(1)}deg) scale(${scale.toFixed(4)})`;
  el.style.clipPath = p.clipLeft > 0 ? `inset(0 0 0 ${p.clipLeft.toFixed(3)}%)` : '';
}

/* ---------- Anchors (viewport coordinates) ---------- */

// A <use href="#three-stars"> anywhere on the page: its rect spans the stars' ink box.
function symbolAnchors(useEl, ctx) {
  const rect = useEl.getBoundingClientRect();
  const k = rect.width / (ctx.ink.x1 - ctx.ink.x0);
  return ctx.geo.map((g) => ({
    x: rect.left + (g.cx - ctx.ink.x0) * k,
    y: rect.top + (g.cy - ctx.ink.y0) * k,
    r: g.r * k,
    rot: 0,
  }));
}

// The hero logo is drawn in logo units, so its screen matrix maps star centres directly.
function heroAnchors(ctx) {
  const m = ctx.heroMark.getScreenCTM();
  return ctx.geo.map((g) => {
    const c = new DOMPoint(g.cx, g.cy).matrixTransform(m);
    return { x: c.x, y: c.y, r: g.r * m.a, rot: 0 };
  });
}

function dockAnchors(docks) {
  return DOCK_OF_STAR.map((d) => {
    const rect = docks[d].getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: rect.width / 2, rot: 0 };
  });
}

// Shift the whole formation (never individual stars) so it stays inside the drawing while the frame is off-stage.
function clampGroupToStage(points, stage) {
  const r = stage.getBoundingClientRect();
  const left = Math.min(...points.map((p) => p.x - p.r));
  const right = Math.max(...points.map((p) => p.x + p.r));
  const top = Math.min(...points.map((p) => p.y - p.r));
  const bottom = Math.max(...points.map((p) => p.y + p.r));
  const dx = Math.min(0, r.right - STAGE_MARGIN - right) + Math.max(0, r.left + STAGE_MARGIN - left);
  const dy = Math.min(0, r.bottom - STAGE_MARGIN - bottom) + Math.max(0, r.top + STAGE_MARGIN - top);
  return points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
}

function parkAnchors() {
  const park = NARROW.matches ? PARK.narrow : PARK.wide;
  const x = document.documentElement.clientWidth - park.inset;
  return park.radii.map((r, i) => ({ x, y: innerHeight / 2 + (i - 1) * park.gap, r, rot: 0 }));
}

function stencilAnchors(ctx) {
  return clampGroupToStage(symbolAnchors(ctx.stencil, ctx), ctx.stage);
}

function globeAnchors(ctx) {
  const rect = ctx.globe.getBoundingClientRect();
  const g = ctx.globe.globeState;
  const big = ctx.geo[STAR_COUNT - 1];
  const offset = (s) => ({ x: (s.cx - big.cx) * CLUSTER_PX_PER_UNIT, y: (s.cy - big.cy) * CLUSTER_PX_PER_UNIT });
  if (!g) {
    const c = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    return ctx.geo.map((s, i) => ({ x: c.x + offset(s).x, y: c.y + offset(s).y, r: GLOBE_RADII[i], rot: 0, alpha: 0 }));
  }
  const alex = g.places.alex;
  const appear = smooth(g.view.zoom, 1.4, 1.05);
  return ctx.geo.map((s, i) => {
    const cluster = { x: alex.x + offset(s).x, y: alex.y + offset(s).y };
    const role = GLOBE_ROLE[i];
    const head = role === 'alex' ? alex : g.heads[role];
    const leave = role === 'alex' ? 1 : smooth(g.view[role], 0, 0.12);
    const pos = { x: lerp(cluster.x, head.x, leave), y: lerp(cluster.y, head.y, leave) };
    const facing = smooth(head.z, 0.05, 0.3);
    const pop = easeOutBack(clamp01((appear - i * 0.15) / 0.7));
    return { x: rect.left + pos.x, y: rect.top + pos.y, r: GLOBE_RADII[i] * pop, rot: (1 - appear) * -90, alpha: clamp01(appear * 3) * facing, glow: 1 };
  });
}

/* ---------- Phase progress (all from live rects) ---------- */

function lineProgress(line) {
  return parseFloat(getComputedStyle(line).getPropertyValue('--p')) || 0;
}

// Mirrors the embellishment timing in home.css (--a4, --sw, --pr).
function printProgress(p) {
  const station = clamp01((p * LINE_STATIONS - PRINT.station - PRINT.start) / PRINT.span);
  const sweep = clamp01((station - PRINT.sweepStart) / PRINT.sweepSpan);
  return clamp01((sweep * PRINT.squeegeeTravel - PRINT.inkLeft) / PRINT.inkWidth);
}

function phaseProgress(ctx) {
  const vh = innerHeight;
  const dockTop = ctx.docks[0].getBoundingClientRect().top;
  const lineTop = ctx.line.getBoundingClientRect().top;
  const figTop = ctx.globe.getBoundingClientRect().top;
  const ctaTop = ctx.cta.getBoundingClientRect().top;
  return {
    toDocks: clamp01((1.25 * vh - dockTop) / (0.7 * vh)),
    leaveDocks: clamp01((0.35 * vh - dockTop) / (0.45 * vh)),
    toLine: clamp01((vh - lineTop) / vh),
    print: printProgress(lineProgress(ctx.line)),
    globeNear: figTop < vh * 1.1 && figTop > -ctx.globe.offsetHeight,
    toCta: clamp01((1.1 * vh - ctaTop) / (0.6 * vh)),
  };
}

/* ---------- Motion ---------- */

function fly(a, b, t, i) {
  const s = clamp01((t - i * STAGGER) / (1 - 2 * STAGGER));
  const e = easeInOut(s);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.sin(Math.PI * e) * Math.min(MAX_BOW_PX, len * 0.3) * BOW[i];
  return {
    x: lerp(a.x, b.x, e) - (dy / len) * bow,
    y: lerp(a.y, b.y, e) + (dx / len) * bow,
    r: lerp(a.r, b.r, e),
    rot: lerp(a.rot, b.rot, e) + Math.sin(Math.PI * e) * SPIN_DEG * (i % 2 ? -1 : 1),
    alpha: lerp(a.alpha ?? 1, b.alpha ?? 1, e),
    glow: lerp(a.glow ?? 0, b.glow ?? 0, e),
  };
}

function igniteFactor(i, elapsed) {
  const t = clamp01((elapsed - IGNITE.delay - i * IGNITE.gap) / IGNITE.length);
  return { scale: lerp(0.25, 1, easeOutBack(t)), spin: (1 - t) * -70 };
}

function heroTargets(ctx, elapsed, ignite) {
  return heroAnchors(ctx).map((p, i) => {
    if (!ignite) return p;
    const f = igniteFactor(i, elapsed);
    return { ...p, r: p.r * f.scale, rot: p.rot + f.spin };
  });
}

function colorAt(mix) {
  return RED.map((c, k) => lerp(c, WHITE[k], mix));
}

function withColor(points) {
  const color = colorAt(0);
  return points.map((p) => ({ ...p, alpha: p.alpha ?? 1, color }));
}

function flight(from, to, t) {
  return withColor(from.map((a, i) => fly(a, to[i], t, i)));
}

// The shirt's clip and this one share the ink box, so the overlay vanishes exactly where ink appears.
function clipLeftOf(geo, edge) {
  const half = geo.r * STAR_PAD;
  return clamp01((edge - (geo.cx - half)) / (half * 2)) * 100;
}

// Docks → margin as the key figures scroll away; the line's approach then flies them on from wherever they are.
function parkedPoints(ctx, leave) {
  const docks = dockAnchors(ctx.docks);
  if (leave <= 0) return docks;
  const park = parkAnchors();
  return docks.map((a, i) => fly(a, park[i], leave, i));
}

function printingPoints(ctx, print) {
  const edge = ctx.ink.x0 + print * (ctx.ink.x1 - ctx.ink.x0);
  return stencilAnchors(ctx).map((p, i) => ({ ...p, clipLeft: clipLeftOf(ctx.geo[i], edge) }));
}

function closingPoints(ctx, ph) {
  const to = symbolAnchors(ctx.ctaUse, ctx);
  const from = ph.globeNear ? globeAnchors(ctx) : to.map((p) => ({ ...p, alpha: 0 }));
  const top = ctx.ctaSection.getBoundingClientRect().top;
  return from.map((a, i) => fly(a, to[i], ph.toCta, i)).map((p) => ({
    ...p,
    alpha: p.alpha ?? 1,
    color: colorAt(smooth(p.y, top - p.r, top + p.r)),
  }));
}

function resolve(ctx, ph, elapsed, ignite) {
  if (ph.toCta > 0) return closingPoints(ctx, ph);
  if (ph.toDocks < 1) {
    const hero = heroTargets(ctx, elapsed, ignite);
    if (ph.toDocks === 0) return withColor(hero);
    return flight(hero, dockAnchors(ctx.docks), ph.toDocks);
  }
  if (ph.leaveDocks < 1 || ph.toLine < 1) return flight(parkedPoints(ctx, ph.leaveDocks), stencilAnchors(ctx), ph.toLine);
  if (ph.print > 0 && ph.print < 1) return withColor(printingPoints(ctx, ph.print));
  if (ph.print < 1) return withColor(stencilAnchors(ctx));
  if (ph.globeNear) return withColor(globeAnchors(ctx));
  return ctx.geo.map(() => ({ alpha: 0 }));
}

// Fill-in stays off while the large star's box touches any logo "3", then fades in over a distance
// proportional to the star's size. The star spins in flight, so the box is the rotated square.
function healBox(star) {
  const half = star.r * STAR_PAD;
  const rad = (star.rot || 0) * Math.PI / 180;
  const extent = half * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)));
  return { left: star.x - extent, right: star.x + extent, top: star.y - extent, bottom: star.y + extent };
}

// Gap between two boxes along the axis where they are farthest apart; negative when they overlap.
function separation(box, rect) {
  return Math.max(rect.left - box.right, box.left - rect.right, rect.top - box.bottom, box.top - rect.bottom);
}

function healAmount(star, threes) {
  const box = healBox(star);
  const gap = threes.reduce((min, el) => Math.min(min, separation(box, el.getBoundingClientRect())), Infinity);
  return smooth(gap, 0, star.r * HEAL_FADE_RADII);
}

function withHeal(points, threes) {
  const star = points[STAR_COUNT - 1];
  if (!star || !(star.r > 0.2)) return points;
  return points.map((p, i) => (i === STAR_COUNT - 1 ? { ...p, heal: healAmount(star, threes) } : p));
}

/* ---------- Boot ---------- */

function collect() {
  const els = {
    heroMark: document.querySelector('.hero__stars'),
    docks: [...document.querySelectorAll('.star-dock')],
    line: document.querySelector('.line'),
    stage: document.querySelector('.line .stage'),
    stencil: document.querySelector('.line .stencil--stars'),
    globe: document.querySelector('[data-globe]'),
    cta: document.querySelector('.cta__stars'),
    ctaUse: document.querySelector('.cta__logo-stars'),
    ctaSection: document.querySelector('.cta'),
  };
  const isComplete = Object.values(els).every(Boolean) && els.docks.length === STAR_COUNT;
  return isComplete ? { ...els, threes: logoThrees() } : null;
}

function logoThrees() {
  return [
    '.hero__stars use[href="#tsf-three"]',
    '.line use.stencil:not(.stencil--stars)',
    '.cta__stars use[href="#tsf-three"]',
  ].map((sel) => document.querySelector(sel)).filter(Boolean);
}

export function initJourney() {
  const els = collect();
  const shapes = readStarShapes();
  if (!els || shapes.length !== STAR_COUNT) return null;
  const overlay = buildOverlay(shapes);
  const ctx = { ...els, geo: overlay.geo, ink: inkBox(overlay.stars) };
  const start = performance.now();
  const ignite = scrollY < innerHeight * 0.4;
  let raf = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const elapsed = (now - start) / 1000;
    const points = withHeal(resolve(ctx, phaseProgress(ctx), elapsed, ignite), ctx.threes);
    points.forEach((p, i) => paint(overlay.stars[i], p));
  };
  const sync = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; return; }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  document.documentElement.classList.add('journey-on');
  if (ignite) overlay.layer.classList.add('is-igniting');
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    stop() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', sync);
      overlay.layer.remove();
      document.documentElement.classList.remove('journey-on');
    },
  };
}

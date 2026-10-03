// Facilities page: the whole page is a scroll-driven walk-through of the Model Factory. three.js and
// factory/scene.js load straight away; scrolling through the chapter sections moves the camera along the
// keyframes, and the chapter rail tracks (and jumps between) chapters. Any failure (no WebGL 2, import error,
// lost context) falls back to the static chapter sheet.

const root = document.documentElement;
const PRELOAD_MARGIN = "250% 0px";
const IDLE_TIMEOUT_MS = 2000;

// Where each keyframe (named in factory/scene.js) lands inside its chapter's scroll span:
// 0 = the chapter has just reached the top of the viewport, 1 = its last screen.
const KEYFRAME_AT = {
  entry: 0, entryHold: 0.35,
  knitA: 0, knitB: 0.6,
  dyeA: 0.1, dyeB: 0.6,
  cutA: 0, cutB: 0.5,
  sewA: 0, sewHold: 0.12, sewMid: 0.46, sewEnd: 0.9,
  embA: 0.1, embB: 0.78,
  dispA: 0.1, dispB: 0.78,
  siteA: 0.34, siteB: 1,
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);

/* ---------- Scroll position ↔ keyframe progress ---------- */

function measureAnchors(keyframes, chapters) {
  return keyframes.map((k) => {
    const el = chapters[k.chapter];
    if (!el) return 0;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, el.offsetHeight - window.innerHeight);
    return top + (KEYFRAME_AT[k.name] ?? 0) * span;
  });
}

// The camera eases into every keyframe, so each one reads as a short stop on the way through.
function progressAt(anchors, y) {
  const last = anchors.length - 1;
  if (y <= anchors[0]) return 0;
  if (y >= anchors[last]) return last;
  const i = anchors.findLastIndex((anchor) => anchor <= y);
  const f = (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
  return i + smootherstep(clamp01(f));
}

function followScroll(scene, chapters) {
  let anchors = [];
  const apply = () => scene.setProgress(progressAt(anchors, window.scrollY));
  const measure = () => {
    anchors = measureAnchors(scene.keyframes, chapters);
    apply();
  };
  measure();
  window.addEventListener("scroll", apply, { passive: true });
  window.addEventListener("resize", measure);
  new ResizeObserver(measure).observe(document.body);
  document.fonts?.ready.then(measure);
}

/* ---------- Chapter rail: per-chapter progress and the current chapter ---------- */

function initRail(tour) {
  const links = [...tour.querySelectorAll(".scale__rail a")];
  const targets = links.map((link) => document.getElementById(link.hash.slice(1)));
  let spans = [];
  let frame = 0;

  function update() {
    frame = 0;
    const y = window.scrollY;
    const current = Math.max(0, spans.findLastIndex((s) => s.top <= y + window.innerHeight / 2));
    tour.dataset.current = targets[current].dataset.chapter;
    links.forEach((link, i) => {
      link.parentElement.style.setProperty("--done", clamp01((y - spans[i].top) / spans[i].span).toFixed(3));
      if (i === current) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    });
  }

  function measure() {
    spans = targets.map((el) => ({
      top: el.getBoundingClientRect().top + window.scrollY,
      span: Math.max(1, el.offsetHeight - window.innerHeight),
    }));
    update();
  }

  window.addEventListener("scroll", () => { frame ||= requestAnimationFrame(update); }, { passive: true });
  window.addEventListener("resize", measure);
  new ResizeObserver(measure).observe(document.body);
  measure();
}

/* ---------- Boot ---------- */

function useStaticSheet() {
  root.classList.remove("has-3d");
}

function canCreateWebGL2() {
  return Boolean(document.createElement("canvas").getContext("webgl2"));
}

function collect(tour) {
  const pick = (attr) => Object.fromEntries([...tour.querySelectorAll(`[data-${attr}]`)].map((el) => [el.dataset[attr], el]));
  return {
    chapters: pick("chapter"),
    counters: pick("count"),
    stage: tour.querySelector("[data-stage]"),
    canvas: tour.querySelector("[data-canvas]"),
    hudLabel: tour.querySelector("[data-hud-label]"),
    hudFill: tour.querySelector("[data-hud-fill]"),
    unitList: tour.querySelector("[data-units]"),
  };
}

async function loadModel(tour) {
  if (!canCreateWebGL2()) {
    useStaticSheet();
    return;
  }
  try {
    const { initScene } = await import("./factory/scene.js");
    const ui = collect(tour);
    const scene = await initScene(ui);
    followScroll(scene, ui.chapters);
    ui.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      scene.stop();
      useStaticSheet();
    }, { once: true });
  } catch (error) {
    console.warn("3D factory model unavailable; showing the static chapters instead.", error);
    useStaticSheet();
  }
}

function whenIdle(callback) {
  if ("requestIdleCallback" in window) requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(callback, 1);
}

function initModelTour() {
  const tour = document.querySelector("[data-scale]");
  if (!tour || !root.classList.contains("has-3d")) return;
  initRail(tour);
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    whenIdle(() => loadModel(tour));
  }, { rootMargin: PRELOAD_MARGIN });
  observer.observe(tour);
}

initModelTour();

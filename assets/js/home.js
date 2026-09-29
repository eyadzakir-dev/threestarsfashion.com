// Homepage: capacity meter, production-line scroll progress, station rail, 3D factory loader.

const root = document.documentElement;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const NARROW = matchMedia("(max-width: 899px)");
const HAS_SCROLL_TIMELINE = CSS.supports("animation-timeline: view()");

const DAILY_CAPACITY = 85000;
const SECONDS_PER_DAY = 86400;
const TICK_MS = 1000;
const FLIP_STEP_MS = 240;
const HERO_RANGE = 0.8;
const BOARD_DIGITS = 5;
const THOUSAND = 1000;
const FLAP_SEQUENCE = " 0123456789";
const STATION_COUNT = 8;
const STATION_LEAD = 0.1;
const MODEL_PRELOAD_MARGIN = "250% 0px";
const IDLE_TIMEOUT_MS = 2000;

const cairoFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const unitFormat = new Intl.NumberFormat("en-US");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hasMotion = () => root.classList.contains("motion");

let journey = null;

function syncMotionClass() {
  root.classList.toggle("motion", !REDUCED_MOTION.matches);
  if (!REDUCED_MOTION.matches) return;
  root.classList.remove("has-3d");
  journey?.stop();
  journey = null;
}

function getCairoTime(now = new Date()) {
  const parts = Object.fromEntries(cairoFormat.formatToParts(now).map((p) => [p.type, p.value]));
  const seconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return { hm: `${parts.hour}:${parts.minute}`, hms: `${parts.hour}:${parts.minute}:${parts.second}`, seconds };
}

function getCapacityUnits(seconds) {
  return Math.floor((DAILY_CAPACITY * seconds) / SECONDS_PER_DAY);
}

/* ---------- Split-flap board ---------- */

function createLayer(modifier, text) {
  const el = document.createElement("span");
  el.className = `flap__layer flap__${modifier}`;
  el.textContent = text;
  return el;
}

function buildFlap(el) {
  const names = ["layer--top", "layer--bot", "leaf--top", "leaf--bot"];
  const [top, bot, leafTop, leafBot] = names.map((name) => createLayer(name, " "));
  el.replaceChildren(top, bot, leafTop, leafBot);
  return { el, top, bot, leafTop, leafBot, current: " ", target: " ", timer: 0 };
}

function showDigit(cell, digit) {
  cell.top.textContent = digit;
  cell.bot.textContent = digit;
  cell.leafTop.textContent = digit;
  cell.leafBot.textContent = digit;
  cell.current = digit;
}

function flipOnce(cell, next) {
  cell.top.textContent = next;
  cell.bot.textContent = cell.current;
  cell.leafTop.textContent = cell.current;
  cell.leafBot.textContent = next;
  cell.el.classList.remove("is-flipping");
  void cell.el.offsetWidth;
  cell.el.classList.add("is-flipping");
  cell.current = next;
}

function nextInSequence(digit) {
  const index = FLAP_SEQUENCE.indexOf(digit);
  return FLAP_SEQUENCE[(index + 1) % FLAP_SEQUENCE.length];
}

function stepToward(cell) {
  cell.timer = 0;
  if (cell.current === cell.target) {
    cell.bot.textContent = cell.current;
    return;
  }
  flipOnce(cell, nextInSequence(cell.current));
  cell.timer = setTimeout(() => stepToward(cell), FLIP_STEP_MS);
}

function setFlapTarget(cell, digit, animate) {
  cell.target = digit;
  if (!animate) {
    clearTimeout(cell.timer);
    cell.timer = 0;
    showDigit(cell, digit);
    return;
  }
  if (!cell.timer) stepToward(cell);
}

/* ---------- Capacity meter ---------- */

function initMeter() {
  const meter = document.querySelector("[data-meter]");
  if (!meter) return;
  const cells = [...meter.querySelectorAll("[data-flap]")].map(buildFlap);
  const separator = meter.querySelector(".meter__sep");
  const text = meter.querySelector("[data-meter-text]");
  const share = meter.querySelector("[data-meter-share]");
  const srText = meter.querySelector("[data-meter-sr]");
  const clock = meter.querySelector("[data-cairo-clock-s]");
  text.textContent = "units by this time today.";

  let isVisible = false;
  let intervalId = 0;

  function render() {
    const time = getCairoTime();
    const units = getCapacityUnits(time.seconds);
    const digits = String(units).padStart(BOARD_DIGITS, " ").slice(-BOARD_DIGITS);
    clock.textContent = time.hms;
    share.textContent = `${((time.seconds / SECONDS_PER_DAY) * 100).toFixed(1)}% of today elapsed`;
    srText.textContent = ` Approximately ${unitFormat.format(units)} units by ${time.hm} Cairo time.`;
    separator.style.visibility = units >= THOUSAND ? "visible" : "hidden";
    if (!isVisible) return;
    const animate = !REDUCED_MOTION.matches;
    cells.forEach((cell, i) => setFlapTarget(cell, digits[i], animate));
  }

  function syncTicker() {
    const shouldRun = !document.hidden;
    if (shouldRun && !intervalId) intervalId = setInterval(render, TICK_MS);
    if (!shouldRun && intervalId) {
      clearInterval(intervalId);
      intervalId = 0;
    }
  }

  new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    render();
  }, { threshold: 0.25 }).observe(meter);

  document.addEventListener("visibilitychange", () => {
    syncTicker();
    if (!document.hidden) render();
  });
  render();
  syncTicker();
}

/* ---------- Line progress ----------
   Desktop uses a CSS view timeline where supported. On narrow screens the stations
   have uneven heights, so --p is mapped piecewise: station i owns t in [i - 0.1, i + 0.9),
   which switches the drawing exactly as a station's edge crosses the reading line.
   The last station is shortened so its sequence completes before the sticky stage releases. */

function measureStations(line) {
  const stage = line.querySelector(".stage");
  const stageBottom = parseFloat(getComputedStyle(stage).top) + stage.offsetHeight;
  const readOffset = (stageBottom + innerHeight) / 2;
  return {
    readOffset,
    tailInset: innerHeight - readOffset,
    spans: [...line.querySelectorAll(".track .station")].map((el) => ({
      top: el.getBoundingClientRect().top + scrollY,
      height: el.offsetHeight,
    })),
  };
}

function getPiecewiseProgress(layout) {
  const readY = scrollY + layout.readOffset;
  const { spans } = layout;
  const index = spans.findLastIndex((span) => span.top <= readY);
  if (index < 0) return 0;
  const span = spans[index];
  const isLast = index === spans.length - 1;
  const height = Math.max(1, isLast ? span.height - layout.tailInset : span.height);
  const t = index - STATION_LEAD + (readY - span.top) / height;
  return clamp(t / STATION_COUNT, 0, 1);
}

function getLinearProgress(line) {
  const rect = line.getBoundingClientRect();
  const range = rect.height - innerHeight;
  return range > 0 ? clamp(-rect.top / range, 0, 1) : 0;
}

function initLineProgress() {
  const line = document.querySelector(".line");
  const hero = document.querySelector(".hero");
  if (!line || !hero) return;
  let layout = null;
  let isQueued = false;

  const usesScript = () => hasMotion() && (NARROW.matches || !HAS_SCROLL_TIMELINE);

  function update() {
    isQueued = false;
    line.classList.toggle("is-scripted", usesScript());
    if (!usesScript()) {
      line.style.removeProperty("--p");
      hero.style.removeProperty("--hp");
      return;
    }
    if (NARROW.matches && !layout) layout = measureStations(line);
    const progress = NARROW.matches ? getPiecewiseProgress(layout) : getLinearProgress(line);
    line.style.setProperty("--p", progress.toFixed(4));
    if (!HAS_SCROLL_TIMELINE) {
      hero.style.setProperty("--hp", clamp(scrollY / (innerHeight * HERO_RANGE), 0, 1).toFixed(4));
    }
  }

  function requestUpdate() {
    if (isQueued) return;
    isQueued = true;
    requestAnimationFrame(update);
  }

  function remeasure() {
    layout = null;
    requestUpdate();
  }

  addEventListener("scroll", requestUpdate, { passive: true });
  new ResizeObserver(remeasure).observe(line);
  addEventListener("resize", remeasure);
  REDUCED_MOTION.addEventListener("change", () => {
    syncMotionClass();
    remeasure();
  });
  NARROW.addEventListener("change", remeasure);
  update();
}

/* ---------- Station rail: move focus to the station a link names ---------- */

function initRail() {
  const stations = [...document.querySelectorAll(".track .station")];
  stations.forEach((el) => el.setAttribute("tabindex", "-1"));
  document.querySelectorAll(".rail a").forEach((link, i) => {
    link.addEventListener("click", (event) => {
      const station = stations[i];
      if (!station) return;
      const isPinned = hasMotion() && !NARROW.matches;
      const target = isPinned ? document.querySelector(link.hash) : station;
      event.preventDefault();
      target.scrollIntoView({ block: "start" });
      history.replaceState(null, "", link.hash);
      station.focus({ preventScroll: true });
    });
  });
}

/* ---------- 3D factory model: loaded on approach, static sheet on any failure ---------- */

function useStaticModel() {
  root.classList.remove("has-3d");
}

function canCreateWebGL2() {
  return Boolean(document.createElement("canvas").getContext("webgl2"));
}

function collectModelElements(section) {
  const pick = (attr) => Object.fromEntries(
    [...section.querySelectorAll(`[data-${attr}]`)].map((el) => [el.dataset[attr], el]),
  );
  return {
    tour: section,
    chapters: pick("chapter"),
    counters: pick("count"),
    stage: section.querySelector("[data-stage]"),
    canvas: section.querySelector("[data-canvas]"),
    hudLabel: section.querySelector("[data-hud-label]"),
    hudFill: section.querySelector("[data-hud-fill]"),
  };
}

async function loadModel(section) {
  if (!canCreateWebGL2()) {
    useStaticModel();
    return;
  }
  try {
    const { initScene } = await import("./factory/scene.js");
    const elements = collectModelElements(section);
    const scene = await initScene(elements);
    elements.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      scene.stop();
      useStaticModel();
    }, { once: true });
  } catch (error) {
    console.warn("3D factory model unavailable; showing the static version.", error);
    useStaticModel();
  }
}

function whenIdle(callback) {
  if ("requestIdleCallback" in window) requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(callback, 1);
}

function initFactoryModel() {
  const section = document.querySelector("[data-scale]");
  if (!section || !root.classList.contains("has-3d")) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    whenIdle(() => loadModel(section));
  }, { rootMargin: MODEL_PRELOAD_MARGIN });
  observer.observe(section);
}

function initStarJourney() {
  if (!hasMotion()) return;
  import("./journey.js")
    .then(({ initJourney }) => { journey = initJourney(); })
    .catch((error) => console.warn("Star journey unavailable; showing the static marks.", error));
}

initMeter();
initLineProgress();
initRail();
initFactoryModel();
initStarJourney();

// Homepage: key-figure count-ups, portfolio tabs, capacity meter, production-line scroll progress,
// station rail, star journey.

const root = document.documentElement;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const NARROW = matchMedia("(max-width: 899px)");
const HAS_SCROLL_TIMELINE = CSS.supports("animation-timeline: view()");

const SHIFT_CAPACITY = 100000;
const SHIFT_HOURS = 8;
const MINUTES_PER_HOUR = 60;
const PER_HOUR = SHIFT_CAPACITY / SHIFT_HOURS;
const PER_MINUTE = Math.round(PER_HOUR / MINUTES_PER_HOUR);
const THOUSAND = 1000;
const SECOND_MS = 1000;
// Time-lapse: one real second shows one production minute, so a shift hour plays in 60 s.
const LIVE_HOUR_MS = MINUTES_PER_HOUR * SECOND_MS;
const LIVE_TICK_MS = 250;
const METER_THRESHOLD = 0.4;
const METER_HOLD_MS = 1600;
const METER_SHRINK_MS = 750;
const METER_UNIT_TEXT = { shift: "pieces.", live: "pieces in one hour of a shift." };
const LIVE_NOTE_TEXT = `Time-lapse: every second here is one minute on our floor, at about ${PER_MINUTE} pieces a minute on average.`;
const FLIP_STEP_MS = 240;
const HERO_RANGE = 0.8;
const BOARD_DIGITS = 6;
const FLAP_SEQUENCE = " 0123456789";
const STATION_COUNT = 10;
const STATION_LEAD = 0.1;
const COUNT_MS = 1100;
// Matches REVEAL_THRESHOLD in site.js, so the numbers count while the isotypes tick in.
const COUNT_THRESHOLD = 0.3;
const TAB_STEP = { ArrowRight: 1, ArrowLeft: -1 };

const cairoFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hasMotion = () => root.classList.contains("motion");

let journey = null;

function syncMotionClass() {
  root.classList.toggle("motion", !REDUCED_MOTION.matches);
  if (!REDUCED_MOTION.matches) return;
  journey?.stop();
  journey = null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function toBoardDigits(value) {
  return String(value).padStart(BOARD_DIGITS, " ").slice(-BOARD_DIGITS).split("");
}

function getFlipSteps(from, to) {
  const count = FLAP_SEQUENCE.length;
  return (FLAP_SEQUENCE.indexOf(to) - FLAP_SEQUENCE.indexOf(from) + count) % count;
}

// Resolves once every cell has flipped through to its digit.
function flipBoardTo(board, value) {
  const digits = toBoardDigits(value);
  const steps = board.cells.map((cell, i) => getFlipSteps(cell.current, digits[i]));
  board.cells.forEach((cell, i) => setFlapTarget(cell, digits[i], true));
  return wait((Math.max(...steps) + 1) * FLIP_STEP_MS);
}

function clearBoard(board) {
  board.cells.forEach((cell) => setFlapTarget(cell, " ", false));
}

// One flip straight to the digit, so the live counter can change several times a second.
function flipCellTo(cell, digit) {
  if (cell.current === digit) return;
  clearTimeout(cell.timer);
  cell.timer = 0;
  cell.target = digit;
  flipOnce(cell, digit);
}

function getDigitsBox(cells) {
  const first = cells.find((cell) => cell.current !== " ").el.getBoundingClientRect();
  const last = cells[cells.length - 1].el.getBoundingClientRect();
  return { x: (first.left + last.right) / 2, y: (first.top + first.bottom) / 2, width: last.right - first.left, height: first.height };
}

// FLIP: the small shift total starts at the board's size and position, then settles into its line.
function shrinkFrom(target, box) {
  const rect = target.getBoundingClientRect();
  const scale = Math.min(box.width / rect.width, box.height / rect.height);
  const dx = box.x - (rect.left + rect.width / 2);
  const dy = box.y - (rect.top + rect.height / 2);
  target.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "none" }],
    { duration: METER_SHRINK_MS, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
  );
}

function showMeterPhase(meter, phase) {
  meter.dataset.phase = phase;
  meter.querySelector("[data-meter-unit]").textContent = METER_UNIT_TEXT[phase];
}

// Progress through the time-lapse hour, one tick ahead so the last tick lands on the full hour.
function getLiveHourState(startTime) {
  const progress = Math.min(1, (((performance.now() - startTime) % LIVE_HOUR_MS) + LIVE_TICK_MS) / LIVE_HOUR_MS);
  return { progress, pieces: Math.round(PER_HOUR * progress), minute: Math.ceil(progress * MINUTES_PER_HOUR) };
}

function renderLiveHour(live) {
  const { progress, pieces, minute } = getLiveHourState(live.start);
  const digits = toBoardDigits(pieces);
  live.board.cells.forEach((cell, i) => flipCellTo(cell, digits[i]));
  live.board.separator.style.visibility = pieces >= THOUSAND ? "visible" : "hidden";
  live.bar.classList.toggle("is-reset", pieces < live.pieces);
  live.bar.style.transform = `scaleX(${progress.toFixed(4)})`;
  live.minute.textContent = String(minute).padStart(2, "0");
  live.pieces = pieces;
}

// Replays one shift hour every 60 s, then restarts; idle while off screen.
function startLiveHour(meter, board) {
  const live = {
    board, start: performance.now(), pieces: 0, isVisible: true,
    bar: meter.querySelector("[data-meter-bar]"), minute: meter.querySelector("[data-meter-min]"),
  };
  new IntersectionObserver(([entry]) => { live.isVisible = entry.isIntersecting; }).observe(meter);
  renderLiveHour(live);
  setInterval(() => { if (live.isVisible) renderLiveHour(live); }, LIVE_TICK_MS);
}

async function playMeter(meter, board) {
  await flipBoardTo(board, SHIFT_CAPACITY);
  await wait(METER_HOLD_MS);
  const digitsBox = getDigitsBox(board.cells);
  showMeterPhase(meter, "live");
  shrinkFrom(meter.querySelector("[data-meter-was]"), digitsBox);
  clearBoard(board);
  startLiveHour(meter, board);
}

function observeOnce(el, callback, threshold = METER_THRESHOLD) {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    callback();
  }, { threshold });
  observer.observe(el);
}

function startCairoClock(clock) {
  if (!clock) return;
  const tick = () => { clock.textContent = cairoFormat.format(new Date()); };
  tick();
  setInterval(tick, SECOND_MS);
}

function initMeter() {
  const meter = document.querySelector("[data-meter]");
  if (!meter) return;
  startCairoClock(meter.querySelector("[data-cairo-clock-s]"));
  if (!hasMotion()) return;
  const board = { cells: [...meter.querySelectorAll("[data-flap]")].map(buildFlap), separator: meter.querySelector(".meter__sep") };
  meter.querySelector("[data-meter-note]").textContent = LIVE_NOTE_TEXT;
  meter.querySelector("[data-meter-unit-sizer]").textContent = METER_UNIT_TEXT.live;
  showMeterPhase(meter, "shift");
  observeOnce(meter, () => playMeter(meter, board));
}

/* ---------- Key figures: numbers count up as the isotypes tick in ---------- */

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function countUp(el) {
  const target = Number(el.dataset.countTo);
  const start = performance.now();
  const step = (now) => {
    const t = clamp((now - start) / COUNT_MS, 0, 1);
    el.textContent = Math.round(target * easeOutCubic(t)).toLocaleString("en-US");
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCountUps() {
  const figs = document.querySelector(".figs");
  if (!figs || !hasMotion()) return;
  const counters = [...figs.querySelectorAll("[data-count-to]")];
  counters.forEach((el) => { el.textContent = "0"; });
  observeOnce(figs, () => counters.forEach(countUp), COUNT_THRESHOLD);
}

/* ---------- Product portfolio: ARIA tabs; each panel's rack swings in as it opens ---------- */

function replayRack(panel) {
  const rack = panel.querySelector(".rack");
  if (!rack?.classList.contains("is-armed")) return;
  rack.classList.remove("is-in");
  void rack.offsetWidth;
  rack.classList.add("is-in");
}

function selectTab(tabs, next, { focus = false, replay = true } = {}) {
  tabs.forEach((tab) => {
    const isSelected = tab === next;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !isSelected;
  });
  if (focus) next.focus();
  if (replay) replayRack(document.getElementById(next.getAttribute("aria-controls")));
}

function getTabTarget(key, index, count) {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key in TAB_STEP) return (index + TAB_STEP[key] + count) % count;
  return -1;
}

function handleTabKey(event, tabs) {
  const target = getTabTarget(event.key, tabs.indexOf(event.currentTarget), tabs.length);
  if (target < 0) return;
  event.preventDefault();
  selectTab(tabs, tabs[target], { focus: true });
}

function initPortfolio() {
  const list = document.querySelector("[data-port-tabs]");
  if (!list) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  list.hidden = false;
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => { if (tab.getAttribute("aria-selected") !== "true") selectTab(tabs, tab); });
    tab.addEventListener("keydown", (event) => handleTabKey(event, tabs));
  });
  selectTab(tabs, tabs[0], { replay: false });
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

function initStarJourney() {
  if (!hasMotion()) return;
  import("./journey.js")
    .then(({ initJourney }) => { journey = initJourney(); })
    .catch((error) => console.warn("Star journey unavailable; showing the static marks.", error));
}

initCountUps();
initPortfolio();
initMeter();
initLineProgress();
initRail();
initStarJourney();

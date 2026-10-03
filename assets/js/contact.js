// Contact page: Alexandria working-hours clock with a local-time ruler, copy buttons, checklist reveal.

const CAIRO_TZ = "Africa/Cairo";
const WORK_START_MIN = 7 * 60;
const WORK_END_MIN = 17 * 60;
const DAY_MIN = 24 * 60;
const MS_PER_MIN = 60000;
const CLOCK_TICK_MS = 15000;
const COPY_RESET_MS = 2200;
const EDGE_ALIGN_PCT = 8;
const REVEAL_THRESHOLD = 0.2;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");

const cairoParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAIRO_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const wrapDay = (min) => ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
const toPct = (min) => `${(min / DAY_MIN) * 100}%`;
const pad2 = (n) => String(n).padStart(2, "0");
const formatHm = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

/* ---------- Clock ---------- */

function getCairoOffsetMin(date) {
  const minuteStart = Math.floor(date.getTime() / MS_PER_MIN) * MS_PER_MIN;
  const parts = Object.fromEntries(
    cairoParts.formatToParts(minuteStart).map(({ type, value }) => [type, Number(value)]),
  );
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((wallAsUtc - minuteStart) / MS_PER_MIN);
}

function formatOffset(min) {
  const abs = Math.abs(min);
  const minutes = abs % 60 ? `:${pad2(abs % 60)}` : "";
  return `UTC${min < 0 ? "−" : "+"}${Math.floor(abs / 60)}${minutes}`;
}

function getLocalPlace() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return zone.split("/").pop().replaceAll("_", " ");
}

function getEdgeAlign(pct) {
  if (pct < EDGE_ALIGN_PCT) return "start";
  if (pct > 100 - EDGE_ALIGN_PCT) return "end";
  return "";
}

function placeEdge(el, min) {
  const pct = (min / DAY_MIN) * 100;
  el.style.left = `${pct}%`;
  el.textContent = formatHm(min);
  el.dataset.align = getEdgeAlign(pct);
}

function placeBands(bands, start, end) {
  const segments = start < end ? [[start, end]] : [[start, DAY_MIN], [0, end]];
  bands.forEach((band, i) => {
    const segment = segments[i];
    band.hidden = !segment;
    if (!segment) return;
    band.style.left = toPct(segment[0]);
    band.style.width = toPct(segment[1] - segment[0]);
  });
}

function setLocalText(el, range) {
  const place = getLocalPlace();
  const strong = document.createElement("b");
  strong.textContent = range;
  el.replaceChildren(`In your time${place ? ` (${place})` : ""}, that is `, strong, ".");
}

function renderLocal(ui, cairoMin, shift) {
  ui.localRuler.hidden = shift === 0;
  if (shift === 0) {
    ui.localText.textContent = "Your clock is already on Alexandria time.";
    return;
  }
  const start = wrapDay(WORK_START_MIN + shift);
  const end = wrapDay(WORK_END_MIN + shift);
  placeBands(ui.bands, start, end);
  ui.edges.forEach((edge, i) => placeEdge(edge, i === 0 ? start : end));
  ui.localNow.style.left = toPct(wrapDay(cairoMin + shift));
  setLocalText(ui.localText, `${formatHm(start)}–${formatHm(end)}`);
}

function renderClock(ui) {
  const now = new Date();
  const cairoOffset = getCairoOffsetMin(now);
  const cairoMin = wrapDay(now.getUTCHours() * 60 + now.getUTCMinutes() + cairoOffset);
  ui.alx.textContent = formatHm(cairoMin);
  ui.offset.textContent = `· ${formatOffset(cairoOffset)}`;
  ui.alxNow.style.left = toPct(cairoMin);
  renderLocal(ui, cairoMin, -now.getTimezoneOffset() - cairoOffset);
}

function getClockUi(root) {
  const localRuler = root.querySelector("[data-ruler-local]");
  return {
    alx: root.querySelector("[data-clock-alx]"),
    offset: root.querySelector("[data-clock-offset]"),
    alxNow: root.querySelector("[data-ruler-now]"),
    localRuler,
    bands: localRuler.querySelectorAll("[data-band]"),
    edges: localRuler.querySelectorAll("[data-edge]"),
    localNow: localRuler.querySelector("[data-ruler-now]"),
    localText: root.querySelector("[data-clock-local]"),
  };
}

function playBandDraw(root) {
  if (REDUCED_MOTION.matches) return;
  root.classList.add("is-armed");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-in")));
}

function initClock() {
  const root = document.querySelector("[data-clock]");
  if (!root) return;
  const ui = getClockUi(root);
  renderClock(ui);
  root.querySelectorAll("[data-clock-now], [data-ruler-now], [data-clock-local]").forEach((el) => { el.hidden = false; });
  setInterval(() => renderClock(ui), CLOCK_TICK_MS);
  playBandDraw(root);
}

/* ---------- Copy buttons ---------- */

function createStatus() {
  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  document.body.append(status);
  return status;
}

function getCopyText(button) {
  if (button.dataset.copy) return button.dataset.copy;
  return [...document.querySelectorAll("[data-brief] b")].map((label) => `${label.textContent}:`).join("\n");
}

function flashDone(button, status) {
  const original = [...button.childNodes];
  button.classList.add("is-done");
  button.replaceChildren("Copied ✓");
  status.textContent = button.dataset.copyLabel;
  setTimeout(() => {
    button.classList.remove("is-done");
    button.replaceChildren(...original);
  }, COPY_RESET_MS);
}

async function handleCopy(button, status) {
  if (button.classList.contains("is-done")) return;
  try {
    await navigator.clipboard.writeText(getCopyText(button));
    flashDone(button, status);
  } catch (error) {
    console.warn("Clipboard write failed.", error);
    status.textContent = "Copy failed. Select the text and copy it manually.";
  }
}

function initCopyButtons() {
  if (!navigator.clipboard?.writeText) return;
  const status = createStatus();
  document.querySelectorAll("[data-copy], [data-copy-brief]").forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", () => handleCopy(button, status));
  });
}

/* ---------- Checklist reveal ---------- */

function initBriefReveal() {
  const list = document.querySelector("[data-brief]");
  if (!list || REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    list.classList.add("is-in");
    observer.disconnect();
  }, { threshold: REVEAL_THRESHOLD });
  list.classList.add("is-armed");
  observer.observe(list);
}

initClock();
initCopyButtons();
initBriefReveal();

// Facilities page: click-to-play 3D tour of the Model Factory. The poster stays until the visitor presses play;
// three.js and the model load on that click, then the camera follows a timed path through the chapters.

const root = document.documentElement;
const WIDE = matchMedia("(min-width: 900px)");
const MAX_STEP_S = 0.1;
const SECONDS_PER_MINUTE = 60;

// Travel time from each keyframe (named in factory/scene.js) to the next one.
const SEGMENT_SECONDS = {
  entry: 4, entryHold: 4,
  knitA: 3.5, knitB: 3,
  dyeA: 3.5, dyeB: 3,
  cutA: 3.5, cutB: 3,
  sewA: 2.5, sewHold: 4, sewMid: 5, sewEnd: 4,
  embA: 3.5, embB: 3,
  dispA: 3.5, dispB: 4.5,
  siteA: 5,
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${String(whole % SECONDS_PER_MINUTE).padStart(2, "0")}`;
}

/* ---------- Timeline: seconds ↔ keyframe progress ---------- */

function buildTimeline(keyframes) {
  const starts = [0];
  keyframes.slice(0, -1).forEach((k, i) => starts.push(starts[i] + (SEGMENT_SECONDS[k.name] ?? 3)));
  const chapters = [];
  keyframes.forEach((k, i) => {
    if (!chapters.some((c) => c.name === k.chapter)) chapters.push({ name: k.chapter, start: starts[i] });
  });
  chapters.forEach((c, i) => { c.end = chapters[i + 1]?.start ?? starts[starts.length - 1]; });
  return { starts, chapters, total: starts[starts.length - 1] };
}

// The camera eases into and out of every keyframe, so each one reads as a short stop.
function progressAt(timeline, t) {
  const { starts } = timeline;
  const last = starts.length - 1;
  if (t >= timeline.total) return last;
  const i = Math.max(0, starts.findLastIndex((start) => start <= t));
  const f = (t - starts[i]) / Math.max(1e-6, starts[i + 1] - starts[i]);
  return i + smootherstep(clamp01(f));
}

/* ---------- Player UI ---------- */

function collect(player) {
  const pick = (attr) => Object.fromEntries([...player.querySelectorAll(`[data-${attr}]`)].map((el) => [el.dataset[attr], el]));
  return {
    player,
    stage: player.querySelector("[data-stage]"),
    canvas: player.querySelector("[data-canvas]"),
    start: player.querySelector("[data-start]"),
    status: player.querySelector("[data-status]"),
    controls: player.querySelector("[data-controls]"),
    play: player.querySelector("[data-play]"),
    fullscreen: player.querySelector("[data-fullscreen]"),
    time: player.querySelector("[data-time]"),
    total: player.querySelector("[data-total]"),
    hudLabel: player.querySelector("[data-hud-label]"),
    hudFill: player.querySelector("[data-hud-fill]"),
    unitList: player.querySelector("[data-units]"),
    panels: pick("panel"),
    jumps: pick("jump"),
    counters: pick("count"),
  };
}

function showChapter(ui, chapter) {
  Object.entries(ui.panels).forEach(([name, el]) => el.classList.toggle("is-active", name === chapter));
  Object.entries(ui.jumps).forEach(([name, el]) => {
    if (name === chapter) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  });
}

function renderPlayButton(ui, mode) {
  const labels = { playing: "Pause the tour", paused: "Play the tour", ended: "Replay the tour" };
  ui.play.dataset.mode = mode;
  ui.play.setAttribute("aria-label", labels[mode]);
}

function renderProgress(ui, timeline, t) {
  ui.time.textContent = formatTime(t);
  timeline.chapters.forEach((c) => {
    const done = clamp01((t - c.start) / Math.max(1e-6, c.end - c.start));
    ui.jumps[c.name]?.parentElement.style.setProperty("--done", done.toFixed(3));
  });
}

/* ---------- Playback ---------- */

function createPlayback(ui, scene) {
  const timeline = buildTimeline(scene.keyframes);
  const state = { t: 0, isPlaying: false, raf: 0, last: 0 };
  ui.total.textContent = formatTime(timeline.total);

  function apply() {
    scene.setProgress(progressAt(timeline, state.t));
    renderProgress(ui, timeline, state.t);
  }

  function tick(now) {
    const dt = state.last ? Math.min(MAX_STEP_S, (now - state.last) / 1000) : 0;
    state.last = now;
    state.t = Math.min(timeline.total, state.t + dt);
    apply();
    if (state.t >= timeline.total) return pause("ended");
    state.raf = requestAnimationFrame(tick);
  }

  function play() {
    if (state.t >= timeline.total) state.t = 0;
    state.isPlaying = true;
    state.last = 0;
    renderPlayButton(ui, "playing");
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
  }

  function pause(mode = "paused") {
    state.isPlaying = false;
    cancelAnimationFrame(state.raf);
    renderPlayButton(ui, mode);
  }

  function seekChapter(name) {
    const chapter = timeline.chapters.find((c) => c.name === name);
    if (!chapter) return;
    state.t = chapter.start;
    apply();
    if (!state.isPlaying) play();
  }

  ui.play.addEventListener("click", () => (state.isPlaying ? pause() : play()));
  Object.entries(ui.jumps).forEach(([name, el]) => el.addEventListener("click", () => seekChapter(name)));
  apply();
  return { play, pause };
}

/* ---------- Full screen ---------- */

function initFullscreen(ui) {
  if (!document.fullscreenEnabled) {
    ui.fullscreen.hidden = true;
    return;
  }
  ui.fullscreen.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else ui.player.requestFullscreen().catch((error) => console.warn("Full screen unavailable.", error));
  });
  document.addEventListener("fullscreenchange", () => {
    const isFull = document.fullscreenElement === ui.player;
    ui.fullscreen.setAttribute("aria-label", isFull ? "Exit full screen" : "Full screen");
    ui.fullscreen.dataset.mode = isFull ? "exit" : "enter";
  });
}

/* ---------- Boot: the model loads on the first press of play ---------- */

// Brings the stage and its controls fully into view once the tour starts.
function revealPlayer(player) {
  const rect = player.getBoundingClientRect();
  const headerHeight = document.querySelector(".hdr")?.offsetHeight ?? 0;
  if (rect.top >= headerHeight && rect.bottom <= innerHeight) return;
  player.scrollIntoView({ block: "start" });
}

function useStaticSheet(ui, message) {
  root.classList.remove("has-3d");
  ui.status.textContent = message;
}

async function startTour(ui) {
  ui.start.disabled = true;
  ui.status.textContent = "Loading the 3D model…";
  try {
    const { initScene } = await import("./factory/scene.js");
    const scene = await initScene({
      canvas: ui.canvas,
      stage: ui.stage,
      counters: ui.counters,
      hudLabel: ui.hudLabel,
      hudFill: ui.hudFill,
      unitList: ui.unitList,
      isPanelBeside: () => WIDE.matches,
      onChapter: (chapter) => showChapter(ui, chapter),
    });
    ui.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      scene.stop();
      useStaticSheet(ui, "The 3D tour stopped. The chapters are listed below.");
    }, { once: true });
    ui.player.classList.add("is-live");
    ui.controls.hidden = false;
    ui.status.textContent = "";
    revealPlayer(ui.player);
    createPlayback(ui, scene).play();
    ui.play.focus({ preventScroll: true });
  } catch (error) {
    console.warn("3D tour unavailable; showing the chapters instead.", error);
    useStaticSheet(ui, "The 3D tour could not start on this device. The chapters are listed below.");
  }
}

function initModelTour() {
  const player = document.querySelector("[data-model]");
  if (!player || !root.classList.contains("has-3d")) return;
  const ui = collect(player);
  initFullscreen(ui);
  ui.start.addEventListener("click", () => startTour(ui), { once: true });
}

initModelTour();

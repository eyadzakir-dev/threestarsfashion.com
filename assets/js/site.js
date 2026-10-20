// Shared behaviour for every page: language switch, mobile menu, one-shot reveals, image lightbox.

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const DESKTOP_NAV = matchMedia("(min-width: 1181px)");
const REVEAL_THRESHOLD = 0.3;
const GLOBE_PRELOAD_MARGIN = "150% 0px";

// The header language switch: remember the choice so the page-load redirect follows it, and keep the section anchor.
function initLangSwitch() {
  document.querySelectorAll("[data-lang-switch]").forEach((link) => {
    link.addEventListener("click", (event) => {
      try {
        localStorage.setItem("tsf-lang", link.dataset.langSwitch);
      } catch (error) {
        console.warn("Language choice not saved.", error);
      }
      if (!location.hash) return;
      event.preventDefault();
      location.href = link.getAttribute("href") + location.hash;
    });
  });
}

function initMenu() {
  const menu = document.querySelector(".menu");
  if (!menu) return;
  const summary = menu.querySelector("summary");
  const close = () => { menu.open = false; };

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !menu.open) return;
    close();
    summary.focus();
  });
  menu.querySelectorAll(".menu__panel a").forEach((link) => link.addEventListener("click", close));
  DESKTOP_NAV.addEventListener("change", (event) => { if (event.matches) close(); });
}

function initReveal(selector) {
  if (REDUCED_MOTION.matches) return;
  const targets = document.querySelectorAll(selector);
  if (!targets.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { threshold: REVEAL_THRESHOLD });
  targets.forEach((el) => {
    el.classList.add("is-armed");
    observer.observe(el);
  });
}

/* ---------- Route globe: loaded as the route diagram approaches the viewport ---------- */

function initGlobes() {
  const figures = document.querySelectorAll("[data-globe]");
  if (!figures.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      import("./globe/globe.js")
        .then(({ initGlobe }) => initGlobe(entry.target))
        .catch((error) => console.warn("Route globe unavailable; keeping the flat diagram.", error));
    });
  }, { rootMargin: GLOBE_PRELOAD_MARGIN });
  figures.forEach((figure) => observer.observe(figure));
}

/* ---------- Lightbox: any [data-gallery] whose links point at full-size images ---------- */

function buildLightbox() {
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Image viewer");
  dialog.innerHTML = `
    <div class="lightbox__in">
      <div class="lightbox__bar">
        <p class="mono" data-lb-count></p>
        <button class="lightbox__btn mono" type="button" data-lb-close>Close <span aria-hidden="true">×</span></button>
      </div>
      <button class="lightbox__btn lightbox__prev mono" type="button" data-lb-step="-1" aria-label="Previous image">←</button>
      <img class="lightbox__img" alt="">
      <button class="lightbox__btn lightbox__next mono" type="button" data-lb-step="1" aria-label="Next image">→</button>
      <p class="lightbox__cap mono" data-lb-caption></p>
    </div>`;
  document.body.append(dialog);
  return {
    dialog,
    img: dialog.querySelector(".lightbox__img"),
    count: dialog.querySelector("[data-lb-count]"),
    caption: dialog.querySelector("[data-lb-caption]"),
    steppers: dialog.querySelectorAll("[data-lb-step]"),
  };
}

function initLightbox() {
  const galleries = document.querySelectorAll("[data-gallery]");
  if (!galleries.length || typeof HTMLDialogElement !== "function") return;
  const ui = buildLightbox();
  const state = { items: [], index: 0, trigger: null };

  function show(index) {
    state.index = (index + state.items.length) % state.items.length;
    const link = state.items[state.index];
    const thumb = link.querySelector("img");
    ui.img.src = link.href;
    ui.img.alt = thumb?.alt ?? "";
    ui.caption.textContent = link.dataset.caption || thumb?.alt || "";
    ui.count.textContent = `${state.index + 1} / ${state.items.length}`;
  }

  function open(link) {
    const gallery = link.closest("[data-gallery]");
    state.items = [...gallery.querySelectorAll("a[href]")];
    state.trigger = link;
    ui.steppers.forEach((btn) => { btn.hidden = state.items.length < 2; });
    show(state.items.indexOf(link));
    ui.dialog.showModal();
  }

  galleries.forEach((gallery) => gallery.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    event.preventDefault();
    open(link);
  }));

  ui.dialog.addEventListener("click", (event) => {
    const step = event.target.closest("[data-lb-step]");
    if (step) return show(state.index + Number(step.dataset.lbStep));
    const isBackdrop = event.target === ui.dialog || event.target.classList.contains("lightbox__in");
    if (isBackdrop || event.target.closest("[data-lb-close]")) ui.dialog.close();
  });
  ui.dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(state.index - 1);
    if (event.key === "ArrowRight") show(state.index + 1);
  });
  ui.dialog.addEventListener("close", () => state.trigger?.focus());
}

initLangSwitch();
initMenu();
initReveal(".stamps, .routes, .cta__stars, .figs, .fabrics, .ship, .adv, .rack, .hangtags, .solar");
initLightbox();
initGlobes();

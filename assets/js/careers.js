// Careers pages: role list reveal, overview / application tabs with a sliding indicator, copy-link button.

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_THRESHOLD = 0.15;
const COPY_RESET_MS = 2200;
const APPLICATION_HASH = "#application";

/* ---------- Role list reveal ---------- */

function initRoleReveal() {
  const list = document.querySelector("[data-roles]");
  if (!list || REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    list.classList.add("is-in");
    observer.disconnect();
  }, { threshold: REVEAL_THRESHOLD });
  list.classList.add("is-armed");
  observer.observe(list);
}

/* ---------- Tabs ---------- */

function moveInk(tabs, tab) {
  const label = tab.querySelector("[data-tab-label]") || tab;
  const stripLeft = tabs.root.getBoundingClientRect().left;
  const box = label.getBoundingClientRect();
  tabs.root.style.setProperty("--x", `${box.left - stripLeft}px`);
  tabs.root.style.setProperty("--w", `${box.width}px`);
}

function playEnter(panel) {
  if (REDUCED_MOTION.matches) return;
  panel.classList.remove("is-entering");
  void panel.offsetWidth;
  panel.classList.add("is-entering");
}

function selectTab(tabs, tab, { focus = false, animate = true } = {}) {
  tabs.buttons.forEach((button) => {
    const isOn = button === tab;
    button.setAttribute("aria-selected", String(isOn));
    button.tabIndex = isOn ? 0 : -1;
    document.getElementById(button.getAttribute("aria-controls")).hidden = !isOn;
  });
  const panel = document.getElementById(tab.getAttribute("aria-controls"));
  moveInk(tabs, tab);
  if (animate) playEnter(panel);
  if (focus) tab.focus();
  panel.dispatchEvent(new CustomEvent("tab:shown", { bubbles: true }));
  const hash = tab.dataset.tabHash || "";
  if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname + location.search);
}

function handleTabKeys(event, tabs) {
  const index = tabs.buttons.indexOf(event.target);
  if (index === -1) return;
  const last = tabs.buttons.length - 1;
  const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: last };
  if (!(event.key in moves)) return;
  event.preventDefault();
  const next = tabs.buttons[(moves[event.key] + tabs.buttons.length) % tabs.buttons.length];
  selectTab(tabs, next, { focus: true });
}

function openApplication(tabs) {
  const tab = tabs.buttons.find((button) => button.dataset.tabHash === APPLICATION_HASH);
  if (!tab) return;
  selectTab(tabs, tab);
  tabs.root.scrollIntoView({ block: "start", behavior: REDUCED_MOTION.matches ? "auto" : "smooth" });
  const firstField = document.getElementById(tab.getAttribute("aria-controls")).querySelector("input:not([type=hidden]), select");
  firstField?.focus({ preventScroll: true });
}

function initTabs() {
  const root = document.querySelector("[data-tabs]");
  if (!root) return;
  const tabs = { root, buttons: [...root.querySelectorAll("[role=tab]")] };
  root.hidden = false;
  const initial = tabs.buttons.find((button) => button.dataset.tabHash === location.hash) || tabs.buttons[0];
  selectTab(tabs, initial, { animate: false });
  requestAnimationFrame(() => root.classList.add("is-ready"));

  root.addEventListener("click", (event) => {
    const tab = event.target.closest("[role=tab]");
    if (tab && tab.getAttribute("aria-selected") !== "true") selectTab(tabs, tab);
  });
  root.addEventListener("keydown", (event) => handleTabKeys(event, tabs));
  document.querySelectorAll("[data-open-application]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openApplication(tabs);
    });
  });
  addEventListener("hashchange", () => {
    const tab = tabs.buttons.find((button) => button.dataset.tabHash === location.hash);
    if (tab) selectTab(tabs, tab);
  });
  addEventListener("resize", () => moveInk(tabs, tabs.buttons.find((b) => b.getAttribute("aria-selected") === "true")));
  document.fonts?.ready.then(() => moveInk(tabs, tabs.buttons.find((b) => b.getAttribute("aria-selected") === "true")));
}

/* ---------- Copy link ---------- */

function initCopyLink() {
  const button = document.querySelector("[data-copy-link]");
  if (!button || !navigator.clipboard?.writeText) return;
  const label = button.textContent;
  button.hidden = false;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname);
      button.classList.add("is-done");
      button.textContent = "Link copied ✓";
      setTimeout(() => {
        button.classList.remove("is-done");
        button.textContent = label;
      }, COPY_RESET_MS);
    } catch (error) {
      console.warn("Clipboard write failed.", error);
    }
  });
}

initRoleReveal();
initTabs();
initCopyLink();

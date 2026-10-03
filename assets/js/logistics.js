// Logistics page: one-shot reveals for the door-to-door line and the in-house checklist.
// Content stays visible without JS or with reduced motion; only this script arms the hidden start state.

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_THRESHOLD = 0.25;
const REVEAL_TARGETS = ".d2d, .checks";

function initReveals(selector) {
  if (REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(selector);
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

initReveals(REVEAL_TARGETS);

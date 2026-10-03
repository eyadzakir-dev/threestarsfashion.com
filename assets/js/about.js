// About page: one-shot reveal for the timeline (axis draws, solar bars rise, labels fade in).
// Content stays visible without JS or with reduced motion; only this script arms the hidden start state.

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_THRESHOLD = 0.3;
const REVEAL_TARGETS = ".tl";

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

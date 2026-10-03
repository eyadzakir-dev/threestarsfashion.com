// /services: one-shot scroll reveals for the service sheet rows, the timeline and the product racks.

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_SELECTOR = ".op, .tl, .make__rack";
const REVEAL_THRESHOLD = 0.2;

function initReveal() {
  if (REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { threshold: REVEAL_THRESHOLD });
  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
    el.classList.add("is-armed");
    observer.observe(el);
  });
}

initReveal();

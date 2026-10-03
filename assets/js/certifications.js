// Certifications page: one-shot reveals for the register stamps and the approval tags.

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_THRESHOLD = 0.2;

function initReveal(selector) {
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

initReveal("[data-reveal]");

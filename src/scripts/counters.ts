/**
 * Count-up for [data-count] figures.
 *
 * Why JS at all: a pure-CSS @property + counter() count-up cannot render a
 * thousands separator, and the design system mandates `85,000` never `85000`.
 * The formatted figure is already in the HTML, so with JS disabled the page is
 * correct — this only animates what is already there. Not a scroll library and
 * not a scroll listener, so it stays inside CLAUDE.md's motion constraints.
 *
 * Three things that are easy to get wrong and are deliberate here:
 *  - toLocaleString('en-US') is PINNED. Unqualified it uses the browser locale,
 *    so on a phone set to Egypt `85000` renders as ٨٥٬٠٠٠. The audience is US
 *    sourcing directors, but the team here would be the first to see it.
 *  - unobserve() after firing, so scrolling back does not re-run it.
 *  - Skipped entirely under prefers-reduced-motion: the final value stays put.
 */
const DURATION = 1400;

export function initCounters(): void {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-count]')
  );
  if (!targets.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  // easeOutQuart — fast start, settles rather than stopping dead
  const ease = (t: number) => 1 - Math.pow(1 - t, 4);

  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const started = performance.now();

    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / DURATION);
      const current = Math.round(target * ease(t));
      el.textContent = current.toLocaleString('en-US');
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString('en-US');
    };
    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        run(el);
      }
    },
    { threshold: 0.4 }
  );

  for (const el of targets) observer.observe(el);
}

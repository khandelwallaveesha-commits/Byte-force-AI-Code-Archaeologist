/* reveal.js — scroll-reveal + pointer spotlight on cards. */

let observer = null;

/** Reveal every [data-reveal] inside root as it enters the viewport. */
export function initReveal(root = document) {
  const items = root.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const delay = Number(entry.target.dataset.reveal) || 0;
          entry.target.style.transitionDelay = `${delay}ms`;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
    );
  }
  items.forEach((el) => observer.observe(el));
}

/** Cursor-following glow inside .feature-card elements. */
export function initSpotlight(root = document) {
  root.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

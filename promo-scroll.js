(function () {
  const hero = document.querySelector('.hero');
  const wrap = document.querySelector('.promo-shorts-wrap');
  if (!hero || !wrap || window.matchMedia('(max-width: 1000px)').matches) return;

  const MIN_SCALE = 0.52;

  function updateScale() {
    const heroRect = hero.getBoundingClientRect();
    const heroHeight = hero.offsetHeight;
    const scrolled = Math.max(0, -heroRect.top);
    const range = Math.max(heroHeight * 0.72, 320);
    const progress = Math.min(1, scrolled / range);
    const scale = 1 - progress * (1 - MIN_SCALE);
    wrap.style.transform = 'scale(' + scale.toFixed(3) + ')';
  }

  window.addEventListener('scroll', updateScale, { passive: true });
  window.addEventListener('resize', updateScale);
  updateScale();
})();

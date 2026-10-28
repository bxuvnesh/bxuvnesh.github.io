/* cursor-glow.js — soft glow orb that trails the mouse. Desktop only. */
(() => {
  // No cursor on touch devices, and respect reduced-motion settings
  if (matchMedia('(hover: none), (pointer: coarse)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- Tweak these ----
const CORE = 'rgba(165, 180, 252, 0.4)';  // primary  #a5b4fc
const EDGE = 'rgba(103, 232, 249, 0.12)'; // accent   #67e8f9
const SIZE = 30;                          // px
const SWELL = 1;                          // no growing
const LAG = 1;                            // 1 = glued to the cursor, zero delay
  const HOVER_SEL = 'a, button, [role="button"], input, textarea, label, .tile, .card, [data-glow]';
  // ---------------------

  const style = document.createElement('style');
  style.textContent = `
    .cursor-glow{
      position:fixed; top:0; left:0; width:${SIZE}px; height:${SIZE}px;
      margin:${-SIZE / 2}px 0 0 ${-SIZE / 2}px; border-radius:50%;
      pointer-events:none; z-index:9999; opacity:0; transition:opacity .3s;
      will-change:transform;
      background:radial-gradient(circle, ${CORE} 0%, ${EDGE} 40%, transparent 70%);
    }
    .cursor-glow.on{ opacity:1; }`;
  document.head.appendChild(style);

  const orb = document.createElement('div');
  orb.className = 'cursor-glow';
  orb.setAttribute('aria-hidden', 'true');
  document.body.appendChild(orb);

  let tx = 0, ty = 0, x = 0, y = 0, s = 1, ts = 1, running = false;

  addEventListener('mousemove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    ts = e.target.closest && e.target.closest(HOVER_SEL) ? SWELL : 1;
    if (!orb.classList.contains('on')) { x = tx; y = ty; orb.classList.add('on'); }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: true });

  document.addEventListener('mouseleave', () => orb.classList.remove('on'));

  function tick() {
    x += (tx - x) * LAG;
    y += (ty - y) * LAG;
    s += (ts - s) * 0.12;
    orb.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    // Stop looping once the orb has settled, so it costs nothing at rest
    if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1 && Math.abs(ts - s) < 0.005) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  }
})();

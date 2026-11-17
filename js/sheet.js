// Panneau qui monte du bas de l'écran (formulaires, actions).
const sheet = () => document.getElementById('sheet');
const backdrop = () => document.getElementById('sheet-backdrop');
let onCloseCb = null;

export function openSheet(html, bind, onClose) {
  const s = sheet();
  s.innerHTML = `<div class="sheet-handle"></div>${html}`;
  s.hidden = false;
  backdrop().hidden = false;
  requestAnimationFrame(() => {
    s.classList.add('open');
    backdrop().classList.add('open');
  });
  onCloseCb = onClose || null;
  if (bind) bind(s);
  const first = s.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 250);
}

export function closeSheet() {
  const s = sheet();
  s.classList.remove('open');
  backdrop().classList.remove('open');
  setTimeout(() => {
    s.hidden = true;
    backdrop().hidden = true;
    s.innerHTML = '';
  }, 220);
  const cb = onCloseCb;
  onCloseCb = null;
  if (cb) cb();
}

export function initSheet() {
  backdrop().addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet().hidden) closeSheet();
  });
}

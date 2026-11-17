// Écran Heure : le disque qui se vide.
import * as store from './store.js';
import { createDisk } from './disk.js';
import * as sound from './sound.js';
import { fmtClock, fmtMinutes, fmtTime, clamp, vibrate, toast, esc, MIN } from './util.js';

const MAX_MIN = 180;
let root, disk, ctx;
let setMinutes = 15;
let raf = 0;
let lastFrame = 0;
let fillAnim = null;   // petite animation de remplissage au démarrage
let wakeLock = null;
let wakePending = false;
let visible = true;

const T = () => store.get().timer;
const S = () => store.get().settings;

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  again: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
  later: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.8-4.3L13 11h7V4l-2.4 2.4A8 8 0 0 0 12 4Z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m16.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export function initTimer(el, navCtx) {
  root = el;
  ctx = navCtx;
  const t = T();
  if (t.status === 'idle' && t.duration) setMinutes = clamp(Math.round(t.duration / MIN), 1, MAX_MIN);

  root.innerHTML = `
  <div class="timer">
    <div class="timer-top">
      <div class="timer-label" id="t-label"></div>
      <button class="sound-btn" id="t-sound" aria-pressed="false"></button>
    </div>
    <div class="disk-wrap" id="t-wrap">
      <div class="disk-host" id="t-host"></div>
      <button class="disk-center" id="t-center" aria-label="Changer l'affichage">
        <span class="big" id="t-big"></span>
        <span class="small" id="t-small"></span>
      </button>
    </div>
    <div class="presets" id="t-presets">
      <button data-min="5">5 min</button>
      <button data-min="15">15 min</button>
      <button data-min="30">30 min</button>
    </div>
    <div class="controls" id="t-controls"></div>
    <div class="hint" id="t-hint"></div>
  </div>`;

  disk = createDisk(root.querySelector('#t-host'));
  bindDial(disk.svg);

  root.querySelector('#t-center').addEventListener('click', () => {
    if (T().status === 'idle') return;
    store.update((s) => (s.settings.display = s.settings.display === 'time' ? 'percent' : 'time'));
    frame(true);
  });

  root.querySelector('#t-presets').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-min]');
    if (!b) return;
    setMinutes = Number(b.dataset.min);
    vibrate(8);
    renderControls();
    frame(true);
  });

  root.querySelector('#t-sound').addEventListener('click', () => {
    const on = !S().sound;
    store.update((s) => (s.settings.sound = on));
    if (on) sound.unlock();
    syncSound();
    renderSoundBtn();
    toast(on ? 'Son activé : bourdon grave + battement' : 'Son coupé');
  });

  root.querySelector('#t-controls').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) act(b.dataset.act);
  });

  document.addEventListener('visibilitychange', () => {
    syncWakeLock();
    if (document.visibilityState === 'visible') { checkEnd(); frame(true); }
  });

  // Si l'écran allumé a été refusé, on retente au prochain toucher
  document.addEventListener('pointerdown', () => { if (!wakeLock) syncWakeLock(); });

  // Vérifie la fin même si on est sur un autre onglet de l'appli
  setInterval(checkEnd, 1000);

  // Le timer a pu se terminer pendant que l'appli était fermée
  if (t.status === 'running' && t.endAt <= Date.now()) finish(true);

  renderAll();
  syncWakeLock();
}

export function setVisible(v) {
  visible = v;
  if (v) { renderAll(); loop(); }
  else cancelAnimationFrame(raf);
}

// ---------- états ----------
function remaining() {
  const t = T();
  if (t.status === 'running') return Math.max(0, t.endAt - Date.now());
  if (t.status === 'paused') return t.remaining;
  if (t.status === 'done') return 0;
  return setMinutes * MIN;
}

function act(a) {
  sound.unlock();
  const t = T();
  if (a === 'start') {
    store.update((s) => {
      s.timer = {
        ...s.timer,
        status: 'running',
        duration: setMinutes * MIN,
        endAt: Date.now() + setMinutes * MIN,
        remaining: 0,
        seed: 1 + Math.floor(Math.random() * 99999),
      };
    });
    fillAnim = { from: Math.min(setMinutes, 60) / 60, t0: performance.now() };
    vibrate(15);
  } else if (a === 'pause') {
    store.update((s) => { s.timer.remaining = Math.max(0, t.endAt - Date.now()); s.timer.status = 'paused'; });
  } else if (a === 'resume') {
    store.update((s) => { s.timer.endAt = Date.now() + t.remaining; s.timer.status = 'running'; });
  } else if (a === 'stop' || a === 'ok') {
    store.update((s) => { s.timer.status = 'idle'; s.timer.label = ''; s.timer.taskId = null; });
  } else if (a === 'again') {
    setMinutes = clamp(Math.round(t.duration / MIN), 1, MAX_MIN);
    store.update((s) => { s.timer.status = 'idle'; });
    act('start');
    return;
  } else if (a === 'arrived') {
    const id = t.taskId;
    store.update((s) => {
      const task = s.tasks.find((x) => x.id === id);
      if (task) { task.done = true; task.doneAt = Date.now(); }
      s.timer.status = 'idle'; s.timer.label = ''; s.timer.taskId = null;
    });
    toast('Arrivé. Bien joué.');
  } else if (a === 'postpone') {
    const task = store.get().tasks.find((x) => x.id === t.taskId);
    if (task) ctx.openPostpone(task);
    store.update((s) => { s.timer.status = 'idle'; s.timer.label = ''; s.timer.taskId = null; });
  }
  renderAll();
  syncWakeLock();
  syncSound();
  loop();
}

function checkEnd() {
  const t = T();
  if (t.status === 'running' && t.endAt <= Date.now()) finish(false);
}

function finish(silent) {
  const late = Date.now() - T().endAt;
  store.update((s) => { s.timer.status = 'done'; s.timer.remaining = 0; });
  sound.stop();
  if (!silent && late < 5000) {
    if (S().vibrate) vibrate([300, 150, 300, 150, 600]);
    if (S().sound) sound.finale();
  }
  renderAll();
  syncWakeLock();
}

/** Lance le timer jusqu'à l'heure d'arrivée d'une tâche. */
export function startForTask(task) {
  const t = T();
  if (t.status === 'running' || t.status === 'paused') {
    if (!confirm('Un timer tourne déjà. Le remplacer ?')) return;
  }
  const mins = Math.round((task.due - Date.now()) / MIN);
  if (mins < 1) {
    toast("L'heure d'arrivée est passée : repousse-la d'abord.");
    return;
  }
  setMinutes = clamp(mins, 1, MAX_MIN);
  store.update((s) => { s.timer.status = 'idle'; s.timer.label = task.title; s.timer.taskId = task.id; });
  ctx.go('hour');
  act('start');
  if (mins > MAX_MIN) toast(`Arrivée dans plus de 3 h : timer réglé sur 3 h.`);
}

// ---------- rendu ----------
function renderAll() {
  if (!root) return;
  renderSoundBtn();
  renderControls();
  frame(true);
}

function renderSoundBtn() {
  const b = root.querySelector('#t-sound');
  const on = S().sound;
  b.innerHTML = `${on ? ICON.soundOn : ICON.soundOff}<span>${on ? 'Son' : 'Muet'}</span>`;
  b.setAttribute('aria-pressed', String(on));
  b.classList.toggle('on', on);
}

function btn(act, icon, label, cls = '') {
  return `<button data-act="${act}" class="${cls}">${ICON[icon]}<span>${label}</span></button>`;
}

function renderControls() {
  const t = T();
  const c = root.querySelector('#t-controls');
  const presets = root.querySelector('#t-presets');
  presets.hidden = t.status !== 'idle';
  presets.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', Number(b.dataset.min) === setMinutes));
  let html = '';
  if (t.status === 'idle') html = btn('start', 'play', 'Démarrer', 'primary');
  else if (t.status === 'running') html = btn('pause', 'pause', 'Pause') + btn('stop', 'stop', 'Arrêter', 'ghost');
  else if (t.status === 'paused') html = btn('resume', 'play', 'Reprendre', 'primary') + btn('stop', 'stop', 'Arrêter', 'ghost');
  else if (t.status === 'done' && t.taskId) html = btn('arrived', 'check', 'Arrivé', 'primary') + btn('postpone', 'later', 'Repousser') + btn('ok', 'stop', 'Fermer', 'ghost');
  else if (t.status === 'done') html = btn('again', 'again', 'Relancer', 'primary') + btn('ok', 'check', 'OK', 'ghost');
  c.innerHTML = html;
  root.querySelector('#t-wrap').classList.toggle('setting', t.status === 'idle');
}

function frame(force) {
  if (!root || (!visible && !force)) return;
  const t = T();
  const rem = remaining();
  const big = root.querySelector('#t-big');
  const small = root.querySelector('#t-small');
  const hint = root.querySelector('#t-hint');
  const label = root.querySelector('#t-label');
  const wrap = root.querySelector('#t-wrap');

  label.innerHTML = t.label
    ? `<span class="dest">Destination</span> ${esc(t.label)}`
    : t.status === 'idle' ? 'Combien de temps tu te donnes ?' : 'Concentration';

  wrap.classList.toggle('paused', t.status === 'paused');
  wrap.classList.toggle('done', t.status === 'done');

  if (t.status === 'idle') {
    const rings = Math.floor((setMinutes - 1) / 60);
    disk.set({ fraction: (setMinutes - rings * 60) / 60, wear: 0, seed: 1, rings, knob: true });
    big.textContent = fmtMinutes(setMinutes);
    small.textContent = 'tourne le disque';
    hint.textContent = 'De 1 min à 3 h · un tour = 1 heure';
    wrap.classList.remove('pulse');
    root.style.setProperty('--wear', 0);
    return;
  }

  if (t.status === 'done') {
    disk.set({ fraction: 1, wear: 1, seed: t.seed, rings: 0, knob: false });
    big.textContent = 'Terminé';
    small.textContent = t.taskId ? 'arrivé à destination ?' : 'le temps est écoulé';
    hint.textContent = '';
    wrap.classList.remove('pulse');
    root.style.setProperty('--wear', 1);
    return;
  }

  const frac = t.duration ? rem / t.duration : 0;
  const wear = 1 - frac;
  let shown = frac;
  if (fillAnim) {
    const k = (performance.now() - fillAnim.t0) / 700;
    if (k >= 1) fillAnim = null;
    else shown = fillAnim.from + (frac - fillAnim.from) * (1 - Math.pow(1 - k, 3));
  }
  disk.set({ fraction: shown, wear, seed: t.seed, rings: 0, knob: false });

  if (S().display === 'percent') {
    big.textContent = `${Math.ceil(frac * 100)} %`;
    small.textContent = 'du temps restant';
  } else {
    big.textContent = fmtClock(rem);
    small.textContent = 'restant';
  }

  hint.textContent = t.status === 'paused'
    ? 'En pause · le temps ne file pas'
    : `Fin à ${fmtTime(t.endAt)}${wakeLock ? ' · écran maintenu allumé' : ''}`;

  // Pulsation dans les dernières minutes, au rythme du battement
  const zone = Math.min(120000, t.duration * 0.25);
  const pulse = t.status === 'running' && rem < zone;
  wrap.classList.toggle('pulse', pulse);
  if (pulse) wrap.style.setProperty('--beat', `${(60 / sound.bpmFor(wear, rem)).toFixed(2)}s`);
  root.style.setProperty('--wear', wear.toFixed(3));

  if (t.status === 'running') sound.update(wear, rem);
}

function loop() {
  cancelAnimationFrame(raf);
  const tick = (now) => {
    const t = T();
    if (!visible || (t.status !== 'running' && !fillAnim)) return;
    if (fillAnim || now - lastFrame > 100) {
      lastFrame = now;
      frame();
      checkEnd();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

// ---------- réglage au doigt ----------
function bindDial(svg) {
  let drag = null;
  const angleOf = (e) => {
    const r = svg.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    return ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
  };
  svg.addEventListener('pointerdown', (e) => {
    if (T().status !== 'idle') return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const a = angleOf(e);
    if (setMinutes <= 60) setMinutes = clamp(Math.round(a / 6), 1, 60);
    drag = { last: a, acc: setMinutes };
    frame(true);
    renderControls();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = angleOf(e);
    let d = a - drag.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    drag.last = a;
    drag.acc = clamp(drag.acc + d / 6, 1, MAX_MIN);
    const m = Math.round(drag.acc);
    if (m !== setMinutes) {
      if (m % 5 === 0) vibrate(4);
      setMinutes = m;
      frame(true);
      renderControls();
    }
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    store.update((s) => (s.timer.duration = setMinutes * MIN));
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}

// ---------- écran allumé ----------
async function syncWakeLock() {
  const want = T().status === 'running' && document.visibilityState === 'visible';
  if (want && !wakeLock && !wakePending && 'wakeLock' in navigator) {
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { /* refusé (batterie faible, etc.) */ }
    wakePending = false;
    frame(true);
  } else if (!want && wakeLock) {
    try { await wakeLock.release(); } catch { /* rien */ }
    wakeLock = null;
  }
}

// ---------- son ----------
function syncSound() {
  const t = T();
  if (S().sound && t.status === 'running') {
    const rem = remaining();
    sound.start(1 - rem / t.duration, rem);
  } else {
    sound.stop();
  }
}

export function onStoreChange() {
  // réglages modifiés ailleurs (panneau Réglages)
  if (root) { renderSoundBtn(); syncSound(); }
}

// Élan — point d'entrée : navigation, réglages, installation.
import * as store from './store.js';
import { initSheet, openSheet, closeSheet } from './sheet.js';
import * as timer from './timer.js';
import * as day from './day.js';
import * as week from './week.js';
import * as sound from './sound.js';
import { playWarning, startHeartbeat } from './chimes.js';
import { toast, isoDate } from './util.js';

const views = { hour: timer, day, week };
let current = 'hour';

// Test du son de fin depuis les réglages : un toucher n'importe où l'arrête
let testStop = null;
let testJustStopped = false;
document.addEventListener('pointerdown', () => {
  if (!testStop) return;
  testStop();
  testStop = null;
  testJustStopped = true;
  setTimeout(() => (testJustStopped = false), 400);
}, true);

const nav = {
  go(view, opts = {}) {
    if (view === 'day' && opts.day) day.showDay(opts.day);
    show(view);
  },
  startTimerForTask: (task) => timer.startForTask(task),
  openPostpone: (task) => setTimeout(() => day.openPostpone(task), 50),
};

function show(view) {
  current = view;
  for (const [name, mod] of Object.entries(views)) {
    const el = document.getElementById(`view-${name}`);
    const on = name === view;
    el.hidden = !on;
    mod.setVisible(on);
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.body.dataset.view = view;
}

function openSettings() {
  const s = store.get().settings;
  openSheet(`
    <h2>Réglages</h2>
    <div class="settings">
      <div class="set-row">
        <span>Affichage du timer</span>
        <div class="seg" data-key="display">
          <button data-v="time" class="${s.display === 'time' ? 'sel' : ''}">Temps</button>
          <button data-v="percent" class="${s.display === 'percent' ? 'sel' : ''}">%</button>
        </div>
      </div>
      <div class="set-row">
        <span>Ambiance du timer<small>bourdon grave + battement qui accélère</small></span>
        <button class="switch ${s.sound ? 'on' : ''}" data-toggle="sound" role="switch" aria-checked="${s.sound}"><i></i></button>
      </div>
      <div class="set-row">
        <span>Sons d'alerte<small>bol chantant ×2 à 10 %, battement de cœur à la fin jusqu'à ce que tu touches l'écran</small></span>
        <button class="switch ${s.alerts ? 'on' : ''}" data-toggle="alerts" role="switch" aria-checked="${s.alerts}"><i></i></button>
      </div>
      <div class="set-btns test-btns">
        <button id="s-test-warn">▶ Écouter 10 %</button>
        <button id="s-test-end">▶ Écouter la fin</button>
      </div>
      <div class="set-row">
        <span>Vibration<small>à 10 % et à la fin</small></span>
        <button class="switch ${s.vibrate ? 'on' : ''}" data-toggle="vibrate" role="switch" aria-checked="${s.vibrate}"><i></i></button>
      </div>
      <div class="set-row">
        <span>Google Agenda<small>synchronisation : arrive dans la V2</small></span>
        <button class="switch" disabled role="switch" aria-checked="false"><i></i></button>
      </div>
      <div class="set-block">
        <span>Sauvegarde<small>tes données restent sur ce téléphone</small></span>
        <div class="set-btns">
          <button id="s-export">Exporter</button>
          <button id="s-import">Importer</button>
          <input type="file" id="s-file" accept="application/json,.json" hidden>
        </div>
      </div>
      <p class="about">Élan · V1 · un coach, pas un CV.</p>
    </div>`, (el) => {
    el.querySelector('.seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      store.update((st) => (st.settings.display = b.dataset.v));
      el.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('sel', x === b));
    });
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.toggle;
      const v = !store.get().settings[key];
      store.update((st) => (st.settings[key] = v));
      b.classList.toggle('on', v);
      b.setAttribute('aria-checked', String(v));
    }));
    el.querySelector('#s-test-warn').addEventListener('click', () => playWarning(sound.getCtx()));
    el.querySelector('#s-test-end').addEventListener('click', () => {
      if (testJustStopped) return;
      testStop = startHeartbeat(sound.getCtx());
      toast("Touche l'écran pour couper le son");
    });
    el.querySelector('#s-export').addEventListener('click', () => {
      const blob = new Blob([store.exportData()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `elan-sauvegarde-${isoDate(Date.now())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const file = el.querySelector('#s-file');
    el.querySelector('#s-import').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      if (!confirm('Remplacer toutes les données actuelles par ce fichier ?')) return;
      try {
        store.importData(await f.text());
        closeSheet();
        toast('Sauvegarde importée.');
        show(current);
      } catch {
        toast("Ce fichier n'est pas une sauvegarde Élan.");
      }
    });
  });
}

function init() {
  initSheet();
  timer.initTimer(document.getElementById('view-hour'), nav);
  day.initDay(document.getElementById('view-day'), nav);
  week.initWeek(document.getElementById('view-week'), nav);

  store.subscribe(() => {
    timer.onStoreChange();
    if (current === 'day') day.render();
    if (current === 'week') week.render();
  });

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  show('hour');

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();

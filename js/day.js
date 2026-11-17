// Écran Jour : 24 heures, des destinations (tâches = points d'arrivée).
import * as store from './store.js';
import { openSheet, closeSheet } from './sheet.js';
import {
  startOfDay, addDays, sameDay, dayLabel, shortDay, fmtTime, fmtSpan, atTime, isoDate, fromIsoDate,
  esc, toast, vibrate, MIN, HOUR,
} from './util.js';

let root, ctx;
let day = startOfDay();
let visible = false;
let refreshTimer = 0;
let scrollPending = true;

const FLAG = '<svg class="flag" viewBox="0 0 24 24"><path d="M5 2h2v20H5zM8 3h11l-3 4.5L19 12H8z"/></svg>';

export function initDay(el, navCtx) {
  root = el;
  ctx = navCtx;
  root.innerHTML = `
    <div class="day-head">
      <div class="day-chips" id="d-chips"></div>
      <div class="day-next" id="d-next"></div>
    </div>
    <div class="timeline" id="d-timeline"></div>
    <button class="fab" id="d-add" aria-label="Ajouter une destination">
      <svg viewBox="0 0 24 24"><path d="M11 5h2v14h-2zM5 11h14v2H5z"/></svg>
    </button>`;

  root.querySelector('#d-chips').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-day]');
    if (!b) return;
    day = Number(b.dataset.day);
    scrollPending = true;
    render();
  });

  root.querySelector('#d-timeline').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-task]');
    if (chip) {
      const task = store.get().tasks.find((t) => t.id === chip.dataset.task);
      if (task) openTaskActions(task);
      return;
    }
    const row = e.target.closest('[data-hour]');
    if (row) {
      const h = Number(row.dataset.hour);
      let due = atTime(day, `${h}:00`);
      if (due <= Date.now()) due = nextQuarter();
      openTaskForm(null, due);
    }
  });

  root.querySelector('#d-next').addEventListener('click', (e) => {
    const b = e.target.closest('[data-task]');
    if (!b) return;
    const task = store.get().tasks.find((t) => t.id === b.dataset.task);
    if (task) openTaskActions(task);
  });

  root.querySelector('#d-add').addEventListener('click', () => {
    let due;
    if (sameDay(day, Date.now())) {
      due = Date.now() + HOUR;
      const d = new Date(due);
      d.setMinutes(0, 0, 0);
      due = d.getTime();
      if (!sameDay(due, day)) due = atTime(day, '23:30');
    } else due = atTime(day, '09:00');
    openTaskForm(null, due);
  });
}

export function setVisible(v) {
  visible = v;
  clearInterval(refreshTimer);
  if (v) {
    if (startOfDay(day) < startOfDay()) day = startOfDay();
    scrollPending = true;
    render();
    refreshTimer = setInterval(render, 30000);
  }
}

export function showDay(ts) {
  day = startOfDay(ts);
  scrollPending = true;
}

export function render() {
  if (!root || !visible) return;
  renderChips();
  renderNext();
  renderTimeline();
}

function nextQuarter() {
  const d = new Date(Date.now() + 15 * MIN);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d.getTime();
}

function tasksOf(ts) {
  return store.get().tasks.filter((t) => sameDay(t.due, ts)).sort((a, b) => a.due - b.due);
}

function renderChips() {
  const today = startOfDay();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const { name, num } = shortDay(d);
    const n = tasksOf(d).filter((t) => !t.done).length;
    html += `<button data-day="${d}" class="${sameDay(d, day) ? 'sel' : ''}">
      <span class="n">${i === 0 ? 'auj.' : name}</span><span class="num">${num}</span>
      ${n ? `<span class="dot">${n}</span>` : ''}
    </button>`;
  }
  root.querySelector('#d-chips').innerHTML = html;
}

function renderNext() {
  const now = Date.now();
  const el = root.querySelector('#d-next');
  const isToday = sameDay(day, now);
  const all = tasksOf(day).filter((t) => !t.done);
  const late = isToday ? all.filter((t) => t.due <= now) : [];
  const next = all.find((t) => t.due > now);
  let html = `<div class="day-title">${dayLabel(day, true)}</div>`;
  if (late.length) {
    html += `<button class="late-banner" data-task="${late[0].id}">
      ${late.length === 1 ? '1 arrivée dépassée' : `${late.length} arrivées dépassées`} : on repousse et on continue ↷
    </button>`;
  }
  if (next) {
    html += `<button class="next-card" data-task="${next.id}">
      <span class="lbl">Prochaine arrivée</span>
      <span class="ttl">${esc(next.title)}</span>
      <span class="when">${fmtTime(next.due)} · dans ${fmtSpan(next.due - now)}</span>
    </button>`;
  } else if (!late.length) {
    html += `<div class="empty-note">${isToday ? "Aucune destination d'ici la fin de la journée." : 'Rien de prévu ce jour-là.'} Touche une heure pour en poser une.</div>`;
  }
  el.innerHTML = html;
}

function renderTimeline() {
  const now = Date.now();
  const isToday = sameDay(day, now);
  const isPast = startOfDay(day) < startOfDay(now);
  const curH = new Date(now).getHours();
  const tasks = tasksOf(day);
  let html = '';
  for (let h = 0; h < 24; h++) {
    const inHour = tasks.filter((t) => new Date(t.due).getHours() === h);
    const past = isPast || (isToday && h < curH);
    const cur = isToday && h === curH;
    let nowLine = '';
    if (cur) {
      const pct = (new Date(now).getMinutes() / 60) * 100;
      nowLine = `<div class="now-line" style="top:${pct.toFixed(1)}%"><span>${fmtTime(now)}</span></div>`;
    }
    html += `<div class="hour ${past ? 'past' : ''} ${cur ? 'cur' : ''}" data-hour="${h}">
      <div class="h-label">${String(h).padStart(2, '0')}</div>
      <div class="h-body">${nowLine}${inHour.map((t) => taskChip(t, now)).join('')}</div>
    </div>`;
  }
  const tl = root.querySelector('#d-timeline');
  tl.innerHTML = html;
  if (scrollPending) {
    scrollPending = false;
    const target = isToday ? Math.max(0, curH - 1) : firstTaskHour(tasks, 8);
    requestAnimationFrame(() => {
      const row = tl.querySelector(`[data-hour="${target}"]`);
      if (row) tl.scrollTop = row.offsetTop - tl.offsetTop;
    });
  }
}

function firstTaskHour(tasks, fallback) {
  return tasks.length ? Math.max(0, new Date(tasks[0].due).getHours() - 1) : fallback;
}

function taskChip(t, now) {
  const late = !t.done && t.due <= now;
  let meta = fmtTime(t.due);
  if (t.done) meta += ' · arrivé ✓';
  else if (late) meta += ' · dépassée';
  else if (t.due - now < 24 * HOUR) meta += ` · dans ${fmtSpan(t.due - now)}`;
  const post = t.postponed
    ? `<span class="post" title="Repoussée ${t.postponed} fois, prévue à ${fmtTime(t.originalDue)}">↷${t.postponed > 1 ? t.postponed : ''}</span>`
    : '';
  return `<button class="task ${t.done ? 'done' : ''} ${late ? 'late' : ''}" data-task="${t.id}">
    ${FLAG}<span class="t-main"><span class="t-title">${esc(t.title)}</span><span class="t-meta">${meta}</span></span>${post}
  </button>`;
}

// ---------- formulaires ----------
function dayOptions(selected) {
  const today = startOfDay();
  const opts = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    opts.push(`<option value="${isoDate(d)}" ${sameDay(d, selected) ? 'selected' : ''}>${dayLabel(d, true)}</option>`);
  }
  if (startOfDay(selected) >= addDays(today, 7) || startOfDay(selected) < today) {
    opts.push(`<option value="${isoDate(selected)}" selected>${dayLabel(selected, true)}</option>`);
  }
  return opts.join('');
}

export function openTaskForm(task, due) {
  const editing = !!task;
  const when = editing ? task.due : due;
  openSheet(`
    <h2>${editing ? 'Modifier la destination' : 'Nouvelle destination'}</h2>
    <p class="sheet-sub">Où veux-tu être arrivé, et à quelle heure ?</p>
    <form id="f-task" autocomplete="off">
      <label class="field"><span>Destination</span>
        <input name="title" required maxlength="120" placeholder="ex. Dossier envoyé" value="${editing ? esc(task.title) : ''}" autofocus>
      </label>
      <div class="row2">
        <label class="field"><span>Arrivée à</span><input name="time" type="time" required value="${fmtTime(when)}"></label>
        <label class="field"><span>Jour</span><select name="day">${dayOptions(when)}</select></label>
      </div>
      <div class="sheet-actions">
        ${editing ? '<button type="button" class="danger" id="f-del">Supprimer</button>' : ''}
        <button type="submit" class="primary">${editing ? 'Enregistrer' : 'Poser le drapeau'}</button>
      </div>
    </form>`, (s) => {
    s.querySelector('#f-task').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title')).trim();
      if (!title) return;
      const newDue = atTime(fromIsoDate(String(f.get('day'))), String(f.get('time')));
      store.update((st) => {
        if (editing) {
          const t = st.tasks.find((x) => x.id === task.id);
          if (t) { t.title = title; t.due = newDue; }
        } else {
          st.tasks.push({ id: store.uid(), title, due: newDue, originalDue: newDue, postponed: 0, done: false, created: Date.now() });
        }
      });
      day = startOfDay(newDue);
      closeSheet();
      vibrate(10);
      render();
    });
    const del = s.querySelector('#f-del');
    if (del) del.addEventListener('click', () => {
      if (!confirm('Supprimer cette destination ?')) return;
      store.update((st) => (st.tasks = st.tasks.filter((x) => x.id !== task.id)));
      closeSheet();
      render();
    });
  });
}

export function openTaskActions(task) {
  const now = Date.now();
  const late = !task.done && task.due <= now;
  let status;
  if (task.done) status = `Arrivé ✓ ${task.doneAt ? `à ${fmtTime(task.doneAt)}` : ''}`;
  else if (late) status = `Prévue à ${fmtTime(task.due)} · dépassée de ${fmtSpan(now - task.due)}`;
  else status = `Arrivée à ${fmtTime(task.due)} · dans ${fmtSpan(task.due - now)}`;
  const post = task.postponed
    ? `<p class="post-note">↷ Repoussée ${task.postponed} fois · prévue au départ ${dayLabel(task.originalDue).toLowerCase()} à ${fmtTime(task.originalDue)}</p>`
    : '';
  openSheet(`
    <h2>${esc(task.title)}</h2>
    <p class="sheet-sub">${status}</p>
    ${post}
    <div class="action-list">
      ${task.done
        ? '<button data-a="undo">Pas encore arrivé finalement</button>'
        : `<button data-a="done" class="primary">✓ Arrivé</button>
           ${late ? '' : '<button data-a="timer">⏱ Timer jusqu\'à l\'arrivée</button>'}
           <button data-a="postpone" class="${late ? 'primary-soft' : ''}">↷ Repousser</button>`}
      <button data-a="edit" class="ghost">Modifier</button>
    </div>`, (s) => {
    s.querySelector('.action-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'done') {
        store.update((st) => { const t = st.tasks.find((x) => x.id === task.id); if (t) { t.done = true; t.doneAt = Date.now(); } });
        closeSheet();
        vibrate([10, 60, 20]);
        toast('Arrivé. Bien joué.');
        render();
      } else if (a === 'undo') {
        store.update((st) => { const t = st.tasks.find((x) => x.id === task.id); if (t) { t.done = false; t.doneAt = null; } });
        closeSheet();
        render();
      } else if (a === 'timer') {
        closeSheet();
        ctx.startTimerForTask(task);
      } else if (a === 'postpone') {
        closeSheet();
        setTimeout(() => openPostpone(task), 230);
      } else if (a === 'edit') {
        closeSheet();
        setTimeout(() => openTaskForm(task), 230);
      }
    });
  });
}

export function openPostpone(task) {
  const base = Math.max(task.due, Date.now());
  const opts = [
    ['+15 min', 15 * MIN], ['+30 min', 30 * MIN], ['+1 h', HOUR], ['+2 h', 2 * HOUR],
  ];
  const tomorrow = atTime(addDays(startOfDay(task.due), 1), fmtTime(task.due));
  openSheet(`
    <h2>Repousser</h2>
    <p class="sheet-sub">« ${esc(task.title)} ». Ce n'est pas un arrêt, c'est la suite.</p>
    <div class="grid-btns">
      ${opts.map(([l, ms]) => `<button data-ts="${base + ms}">${l}<small>${fmtTime(base + ms)}</small></button>`).join('')}
      <button data-ts="${Math.max(tomorrow, base + 15 * MIN)}">Demain<small>${fmtTime(tomorrow)}</small></button>
    </div>
    <form id="f-post" class="row2 inline">
      <label class="field"><span>Ou à</span><input type="time" name="time" value="${fmtTime(base + HOUR)}"></label>
      <button type="submit" class="primary">OK</button>
    </form>`, (s) => {
    const apply = (ts) => {
      store.update((st) => {
        const t = st.tasks.find((x) => x.id === task.id);
        if (!t) return;
        if (!t.originalDue) t.originalDue = t.due;
        t.due = ts;
        t.postponed = (t.postponed || 0) + 1;
        t.done = false;
      });
      day = startOfDay(ts);
      closeSheet();
      vibrate(10);
      toast(`↷ Nouvelle arrivée : ${sameDay(ts, Date.now()) ? '' : dayLabel(ts).toLowerCase() + ' '}${fmtTime(ts)}. On continue.`);
      render();
    };
    s.querySelector('.grid-btns').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-ts]');
      if (b) apply(Number(b.dataset.ts));
    });
    s.querySelector('#f-post').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = new FormData(e.target).get('time');
      if (!v) return;
      let ts = atTime(startOfDay(base), String(v));
      if (ts <= Date.now()) ts = atTime(addDays(startOfDay(base), 1), String(v));
      apply(ts);
    });
  });
}

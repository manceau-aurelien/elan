// Écran Semaine : aujourd'hui + 6 jours, et l'objectif qui se rapproche.
import * as store from './store.js';
import { openSheet, closeSheet } from './sheet.js';
import { miniDisk } from './disk.js';
import {
  startOfDay, endOfDay, addDays, sameDay, dayLabel, shortDay, dayOffset, fmtTime, fmtSpan, isoDate, fromIsoDate,
  esc, toast, vibrate, clamp, DAY,
} from './util.js';

let root, ctx;
let visible = false;
let refreshTimer = 0;

export function initWeek(el, navCtx) {
  root = el;
  ctx = navCtx;
  root.innerHTML = `
    <div class="goals" id="w-goals"></div>
    <h3 class="section-title">Les 7 prochains jours</h3>
    <div class="agenda" id="w-agenda"></div>`;

  root.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goal]');
    if (g) {
      const goal = store.get().goals.find((x) => x.id === g.dataset.goal);
      if (goal) openGoalActions(goal);
      return;
    }
    const add = e.target.closest('[data-add-goal]');
    if (add) {
      openGoalForm(null, Number(add.dataset.addGoal));
      return;
    }
    const d = e.target.closest('[data-open-day]');
    if (d) ctx.go('day', { day: Number(d.dataset.openDay) });
  });
}

export function setVisible(v) {
  visible = v;
  clearInterval(refreshTimer);
  if (v) {
    render();
    refreshTimer = setInterval(render, 60000);
  }
}

export function render() {
  if (!root || !visible) return;
  renderGoals();
  renderAgenda();
}

function activeGoals() {
  const now = Date.now();
  return store.get().goals
    .filter((g) => !g.done || (g.doneAt && now - g.doneAt < 2 * DAY))
    .sort((a, b) => (a.done - b.done) || (a.due - b.due));
}

function jLabel(due) {
  const off = dayOffset(due);
  if (off > 0) return `J-${off}`;
  if (off === 0) return 'Jour J';
  return `J+${-off}`;
}

function goalCard(g, now) {
  const total = Math.max(1, g.due - g.created);
  const left = g.due - now;
  const frac = clamp(left / total, 0, 1);
  let line;
  if (g.done) line = 'Atteint ✓';
  else if (left > 0) line = `il te reste ${fmtSpan(left)}`;
  else line = `échéance passée de ${fmtSpan(-left)}`;
  return `<button class="goal-card ${g.done ? 'done' : ''} ${!g.done && left <= 0 ? 'late' : ''}" data-goal="${g.id}">
    ${miniDisk(g.done ? 0 : frac, 1 - frac, 64)}
    <span class="g-main">
      <span class="g-j">${g.done ? '🎯' : jLabel(g.due)}</span>
      <span class="g-title">${esc(g.title)}</span>
      <span class="g-meta">${dayLabel(g.due, true)} · ${line}</span>
    </span>
  </button>`;
}

function renderGoals() {
  const now = Date.now();
  const goals = activeGoals();
  let html = goals.map((g) => goalCard(g, now)).join('');
  if (!goals.length) {
    html = `<div class="goal-empty">
      <p><strong>Fixe un objectif et une date.</strong><br>Tu verras l'échéance se rapprocher : tu as du temps, mais moins qu'hier.</p>
    </div>`;
  }
  html += `<button class="add-goal" data-add-goal="${addDays(startOfDay(), 6)}">+ Objectif</button>`;
  root.querySelector('#w-goals').innerHTML = html;
}

function renderAgenda() {
  const now = Date.now();
  const today = startOfDay();
  const { tasks, goals } = store.get();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const { name, num } = shortDay(d);
    const dayGoals = goals.filter((g) => sameDay(g.due, d) && !g.done);
    const dayTasks = tasks.filter((t) => sameDay(t.due, d)).sort((a, b) => a.due - b.due);
    const open = dayTasks.filter((t) => !t.done);
    const shown = open.slice(0, 3);
    // part de la journée déjà écoulée (aujourd'hui seulement)
    const elapsed = i === 0 ? (now - today) / DAY : 0;
    html += `<div class="ag-day ${i === 0 ? 'today' : ''} ${dayGoals.length ? 'has-goal' : ''}">
      <button class="ag-date" data-open-day="${d}">
        <span class="n">${i === 0 ? 'auj.' : name}</span><span class="num">${num}</span>
        ${i === 0 ? `<span class="ag-bar"><span style="width:${(elapsed * 100).toFixed(1)}%"></span></span>` : ''}
      </button>
      <div class="ag-body" data-open-day="${d}">
        ${dayGoals.map((g) => `<span class="ag-goal" data-goal="${g.id}">🎯 ${esc(g.title)}</span>`).join('')}
        ${shown.map((t) => `<span class="ag-task ${t.due <= now ? 'late' : ''}">${fmtTime(t.due)} ${esc(t.title)}${t.postponed ? ' ↷' : ''}</span>`).join('')}
        ${open.length > 3 ? `<span class="ag-more">+${open.length - 3} autre${open.length - 3 > 1 ? 's' : ''}</span>` : ''}
        ${!dayGoals.length && !open.length ? `<span class="ag-empty">${dayTasks.length ? 'tout est arrivé ✓' : '—'}</span>` : ''}
      </div>
      <button class="ag-add" data-add-goal="${d}" aria-label="Objectif pour ${dayLabel(d, true)}">🎯+</button>
    </div>`;
  }
  root.querySelector('#w-agenda').innerHTML = html;
}

// ---------- objectifs ----------
function openGoalForm(goal, dayTs) {
  const editing = !!goal;
  const when = editing ? goal.due : dayTs;
  const min = isoDate(Date.now());
  openSheet(`
    <h2>${editing ? "Modifier l'objectif" : 'Nouvel objectif'}</h2>
    <p class="sheet-sub">Une destination plus lointaine, avec une date fixe.</p>
    <form id="f-goal" autocomplete="off">
      <label class="field"><span>Objectif</span>
        <input name="title" required maxlength="140" placeholder="ex. Prototype qui tourne" value="${editing ? esc(goal.title) : ''}" autofocus>
      </label>
      <label class="field"><span>Échéance (fin de journée)</span>
        <input name="date" type="date" required min="${min}" value="${isoDate(when)}">
      </label>
      <div class="sheet-actions">
        ${editing ? '<button type="button" class="danger" id="g-del">Supprimer</button>' : ''}
        <button type="submit" class="primary">${editing ? 'Enregistrer' : 'Fixer la date'}</button>
      </div>
    </form>`, (s) => {
    s.querySelector('#f-goal').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title')).trim();
      if (!title) return;
      const due = endOfDay(fromIsoDate(String(f.get('date'))));
      store.update((st) => {
        if (editing) {
          const g = st.goals.find((x) => x.id === goal.id);
          if (g) { g.title = title; g.due = due; }
        } else {
          st.goals.push({ id: store.uid(), title, due, created: Date.now(), done: false });
        }
      });
      closeSheet();
      vibrate(10);
      if (!editing) toast(`🎯 ${jLabel(due)} : le compte à rebours commence.`);
      render();
    });
    const del = s.querySelector('#g-del');
    if (del) del.addEventListener('click', () => {
      if (!confirm('Supprimer cet objectif ?')) return;
      store.update((st) => (st.goals = st.goals.filter((x) => x.id !== goal.id)));
      closeSheet();
      render();
    });
  });
}

function openGoalActions(goal) {
  const now = Date.now();
  const left = goal.due - now;
  openSheet(`
    <h2>${esc(goal.title)}</h2>
    <p class="sheet-sub">${goal.done ? 'Atteint ✓' : `${jLabel(goal.due)} · ${dayLabel(goal.due, true)} · ${left > 0 ? `il te reste ${fmtSpan(left)}` : 'échéance passée'}`}</p>
    <div class="action-list">
      ${goal.done
        ? '<button data-a="undo">Pas encore atteint finalement</button>'
        : `<button data-a="done" class="primary">🎯 Objectif atteint</button>
           <button data-a="day">Voir ce jour-là</button>`}
      <button data-a="edit" class="ghost">Modifier / changer la date</button>
    </div>`, (s) => {
    s.querySelector('.action-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'done' || a === 'undo') {
        store.update((st) => {
          const g = st.goals.find((x) => x.id === goal.id);
          if (g) { g.done = a === 'done'; g.doneAt = a === 'done' ? Date.now() : null; }
        });
        closeSheet();
        if (a === 'done') { vibrate([20, 80, 20, 80, 60]); toast('Objectif atteint. Tu y es arrivé.'); }
        render();
      } else if (a === 'day') {
        closeSheet();
        ctx.go('day', { day: goal.due });
      } else if (a === 'edit') {
        closeSheet();
        setTimeout(() => openGoalForm(goal), 230);
      }
    });
  });
}

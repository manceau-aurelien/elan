// État de l'appli, sauvegardé sur le téléphone (localStorage).
const KEY = 'elan:v1';

const DEFAULTS = () => ({
  settings: {
    display: 'time',   // 'time' | 'percent'
    sound: false,      // ambiance sonore du timer
    vibrate: true,     // vibration à la fin du timer
  },
  // Tâche = point d'arrivée : { id, title, due (ms), originalDue (ms), postponed, done, doneAt }
  tasks: [],
  // Objectif = date-butoir : { id, title, due (ms, fin de journée), created (ms), done }
  goals: [],
  // Timer : { status: 'idle'|'running'|'paused'|'done', duration, endAt, remaining, label, taskId, seed }
  timer: { status: 'idle', duration: 15 * 60000, endAt: 0, remaining: 0, label: '', taskId: null, seed: 1 },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const data = JSON.parse(raw);
    const d = DEFAULTS();
    return {
      ...d,
      ...data,
      settings: { ...d.settings, ...(data.settings || {}) },
      timer: { ...d.timer, ...(data.timer || {}) },
    };
  } catch {
    return DEFAULTS();
  }
}

let state = load();
const listeners = new Set();

export const get = () => state;

export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l());
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function exportData() {
  return JSON.stringify({ app: 'elan', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importData(text) {
  const parsed = JSON.parse(text);
  const data = parsed && parsed.app === 'elan' ? parsed.data : parsed;
  if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.goals)) {
    throw new Error('Fichier non reconnu');
  }
  localStorage.setItem(KEY, JSON.stringify(data));
  state = load();
  listeners.forEach((l) => l());
}

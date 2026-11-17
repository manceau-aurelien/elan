// Petits outils : dates, formats, échappement.
export const MIN = 60000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function startOfDay(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(t) {
  const d = new Date(t);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

// Ajoute n jours en respectant les changements d'heure.
export function addDays(t, n) {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function sameDay(a, b) {
  return startOfDay(a) === startOfDay(b);
}

export function dayOffset(t) {
  return Math.round((startOfDay(t) - startOfDay()) / DAY);
}

export function dayLabel(t, long = false) {
  const off = dayOffset(t);
  if (off === 0) return "Aujourd'hui";
  if (off === 1) return 'Demain';
  if (off === -1) return 'Hier';
  const d = new Date(t);
  return long ? `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : `${DAYS[d.getDay()]} ${d.getDate()}`;
}

export function shortDay(t) {
  const d = new Date(t);
  return { name: DAYS[d.getDay()].replace('.', ''), num: d.getDate() };
}

export function fmtTime(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 754000 -> "12:34" ; 4000000 -> "1:06:40"
export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}

// Durée lisible : "45 min", "1 h 20", "3 j 14 h"
export function fmtSpan(ms) {
  const abs = Math.abs(ms);
  if (abs < MIN) return "moins d'1 min";
  if (abs < HOUR) return `${Math.round(abs / MIN)} min`;
  if (abs < DAY) {
    const total = Math.round(abs / MIN);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  return h ? `${d} j ${h} h` : `${d} j`;
}

export function fmtMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// "14:30" + jour -> timestamp
export function atTime(dayTs, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayTs);
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}

// timestamp -> "2026-11-17"
export function isoDate(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromIsoDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

let toastTimer = 0;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

export function vibrate(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* rien */ }
}

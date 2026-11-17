// Ambiance sonore du timer, entièrement synthétisée :
// un bourdon grave + un battement de cœur qui accélère vers la fin.
import { clamp } from './util.js';

let ctx = null;
let master = null;
let drone = null;
let schedTimer = 0;
let nextBeat = 0;
let current = { progress: 0, remaining: Infinity };
let playing = false;

// Battements par minute selon l'avancée : 40 au départ → 120 à la toute fin
export function bpmFor(progress, remainingMs) {
  let bpm = 40 + 55 * Math.pow(clamp(progress, 0, 1), 1.6);
  if (remainingMs < 60000) bpm = Math.max(bpm, 95 + 25 * (1 - remainingMs / 60000));
  return clamp(bpm, 40, 120);
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// À appeler depuis un geste de l'utilisateur (le navigateur l'exige)
export function unlock() {
  ensureCtx();
}

function startDrone() {
  const t = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 180;
  filter.Q.value = 3;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.32, t + 3);
  filter.connect(gain).connect(master);

  const mk = (type, freq, vol) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    o.connect(g).connect(filter);
    o.start(t);
    return o;
  };
  const oscs = {
    a: mk('sine', 55, 0.55),
    b: mk('sine', 55.5, 0.45),       // léger battement avec a
    c: mk('triangle', 82.4, 0.18),   // quinte
    d: mk('sawtooth', 27.5, 0.22),   // sous-grave
  };

  // respiration lente du filtre
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 50;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start(t);

  drone = { filter, gain, oscs, lfo };
}

function stopDrone() {
  if (!drone) return;
  const d = drone;
  drone = null;
  const t = ctx.currentTime;
  d.gain.gain.cancelScheduledValues(t);
  d.gain.gain.setValueAtTime(d.gain.gain.value, t);
  d.gain.gain.linearRampToValueAtTime(0, t + 0.8);
  setTimeout(() => {
    Object.values(d.oscs).forEach((o) => o.stop());
    d.lfo.stop();
  }, 1000);
}

function thump(time, vol) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(95, time);
  o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  o.connect(g).connect(master);
  o.start(time);
  o.stop(time + 0.35);
}

function scheduler() {
  const ahead = ctx.currentTime + 0.25;
  while (nextBeat < ahead) {
    const bpm = bpmFor(current.progress, current.remaining);
    const intensity = 0.55 + 0.4 * current.progress;
    thump(nextBeat, intensity);                       // « boum »
    thump(nextBeat + Math.min(0.2, 15 / bpm), intensity * 0.6); // « -boum »
    nextBeat += 60 / bpm;
  }
}

export function start(progress, remaining) {
  if (!ensureCtx()) return;
  current = { progress, remaining };
  if (playing) return;
  playing = true;
  startDrone();
  nextBeat = ctx.currentTime + 0.4;
  schedTimer = setInterval(scheduler, 60);
  update(progress, remaining);
}

export function update(progress, remaining) {
  current = { progress, remaining };
  if (!playing || !drone) return;
  const t = ctx.currentTime;
  // la tension monte : le filtre s'ouvre et le battement entre a et b s'accélère
  drone.filter.frequency.setTargetAtTime(180 + 650 * Math.pow(progress, 1.5), t, 1.5);
  drone.oscs.b.frequency.setTargetAtTime(55.5 + 2.5 * progress, t, 2);
}

export function stop() {
  if (!playing) return;
  playing = false;
  clearInterval(schedTimer);
  stopDrone();
}

// Note finale, profonde, quand le temps est écoulé
export function finale() {
  if (!ensureCtx()) return;
  const t = ctx.currentTime + 0.05;
  [55, 82.4, 110].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 / (i + 1), t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 4.2);
  });
}

export const isPlaying = () => playing;

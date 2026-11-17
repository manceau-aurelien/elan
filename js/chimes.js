// Sons d'alerte d'Élan, entièrement synthétisés (aucun fichier audio).
// Doux par construction : attaques adoucies, fréquences médium/graves, un peu de réverbération.

let reverbCache = new WeakMap();

function reverb(ctx) {
  if (reverbCache.has(ctx)) return reverbCache.get(ctx);
  const len = Math.floor(ctx.sampleRate * 2.8);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  conv.connect(wet).connect(ctx.destination);
  reverbCache.set(ctx, conv);
  return conv;
}

// Sortie commune : un passe-bas qui enlève tout ce qui pourrait être strident
function bus(ctx, volume) {
  const g = ctx.createGain();
  g.gain.value = volume;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  g.connect(lp);
  lp.connect(ctx.destination);
  lp.connect(reverb(ctx));
  return g;
}

function tone(ctx, out, { f, t, type = 'sine', attack = 0.01, decay = 1.5, vol = 0.3, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

// Cloche : partiels inharmoniques qui s'éteignent à des vitesses différentes
function bell(ctx, out, f, t, vol = 0.3, decay = 2.6) {
  [[1, 1, 1], [2, 0.32, 0.6], [2.76, 0.18, 0.42], [5.4, 0.06, 0.22]].forEach(([r, v, d]) =>
    tone(ctx, out, { f: f * r, t, attack: 0.006, decay: decay * d, vol: vol * v }));
}

// Bois (marimba) : note courte et ronde
function wood(ctx, out, f, t, vol = 0.35) {
  tone(ctx, out, { f, t, attack: 0.004, decay: 0.55, vol });
  tone(ctx, out, { f: f * 3.93, t, attack: 0.002, decay: 0.09, vol: vol * 0.22 });
  tone(ctx, out, { f: f * 2, t, attack: 0.003, decay: 0.25, vol: vol * 0.12 });
}

// Gong : grave, gonflement lent, longue traîne
function gong(ctx, out, f, t, vol = 0.35, decay = 5) {
  [[1, 1, 1], [1.48, 0.45, 0.7], [2.0, 0.3, 0.55], [2.63, 0.2, 0.4], [3.4, 0.1, 0.3]].forEach(([r, v, d], i) =>
    tone(ctx, out, { f: f * r, t, attack: 0.03 + i * 0.01, decay: decay * d, vol: vol * v, detune: (i % 2 ? 4 : -3) }));
}

// Bol chantant : deux sinus proches qui « battent », attaque gonflée
function bowl(ctx, out, f, t, vol = 0.3, decay = 4.5) {
  tone(ctx, out, { f, t, attack: 0.25, decay, vol });
  tone(ctx, out, { f: f + 2.4, t, attack: 0.3, decay, vol: vol * 0.8 });
  tone(ctx, out, { f: f * 2.71, t, attack: 0.2, decay: decay * 0.5, vol: vol * 0.12 });
}

// Nappe d'accord chaud
function pad(ctx, out, freqs, t, vol = 0.12, decay = 3.5) {
  freqs.forEach((f, i) => {
    tone(ctx, out, { f, t: t + i * 0.04, type: 'triangle', attack: 0.5, decay, vol });
    tone(ctx, out, { f, t: t + i * 0.04, type: 'sine', attack: 0.6, decay, vol: vol * 0.7, detune: 6 });
  });
}

const N = { C3: 130.81, E3: 164.81, G3: 196.0, C4: 261.63, E4: 329.63, G4: 392.0, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };

// ---------- Alertes « il reste 10 % » ----------
export const WARN = {
  cloche: { name: 'Cloche douce', desc: 'Un seul coup de cloche clair, qui résonne.', play: (c, o, t) => bell(c, o, N.E5, t, 0.3, 2.8) },
  gouttes: { name: 'Deux gouttes', desc: "Deux notes rondes qui descendent : « attention… ».", play: (c, o, t) => { wood(c, o, N.G5, t, 0.32); wood(c, o, N.D5, t + 0.24, 0.3); } },
  bol: { name: 'Bol chantant', desc: 'Un son qui gonfle et vibre lentement. Très calme.', play: (c, o, t) => bowl(c, o, 432, t, 0.3, 4.5) },
  marimba: { name: 'Marimba', desc: 'Trois petites notes boisées, discrètes.', play: (c, o, t) => [N.A4, N.C5, N.E5].forEach((f, i) => wood(c, o, f, t + i * 0.15, 0.3)) },
  'gong-leger': { name: 'Gong léger', desc: 'Un petit gong, plus présent mais pas agressif.', play: (c, o, t) => gong(c, o, 196, t, 0.3, 3) },
};

// ---------- Sons de fin ----------
export const END = {
  carillon: { name: 'Carillon', desc: 'Trois cloches qui descendent. Clair et net.', play: (c, o, t) => [N.G5, N.E5, N.C5].forEach((f, i) => bell(c, o, f, t + i * 0.38, 0.28, 3)) },
  gong: { name: 'Gong profond', desc: 'Un grand gong grave, qui remplit la pièce.', play: (c, o, t) => gong(c, o, 82.4, t, 0.42, 6.5) },
  accord: { name: 'Accord chaud', desc: "Une nappe d'accord majeur qui s'ouvre puis s'efface.", play: (c, o, t) => pad(c, o, [N.C3, N.G3, N.C4, N.E4], t, 0.11, 3.8) },
  arpege: { name: "Arpège d'arrivée", desc: 'Quatre notes boisées qui montent : « tu y es ».', play: (c, o, t) => [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => wood(c, o, f, t + i * 0.13, 0.32)) },
  bols: { name: 'Deux bols', desc: "Deux bols chantants, l'un après l'autre, plus graves.", play: (c, o, t) => { bowl(c, o, 432, t, 0.28, 4); bowl(c, o, 324, t + 1.1, 0.3, 5); } },
  boum: { name: 'Le coup final', desc: "L'accord grave actuel (55 Hz), sourd et profond.", play: (c, o, t) => [[55, 0.35], [82.4, 0.18], [110, 0.12]].forEach(([f, v]) => tone(c, o, { f, t, attack: 0.05, decay: 4, vol: v })) },
};

// ---------- Les sons choisis pour Élan ----------

// Alerte à 10 % : le bol chantant, deux fois
export function playWarning(ctx, volume = 0.9) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const out = bus(ctx, volume);
  const t = ctx.currentTime + 0.05;
  bowl(ctx, out, 432, t, 0.3, 4.5);
  bowl(ctx, out, 432, t + 2.6, 0.3, 4.5);
}

// Un coup grave et sourd, légèrement désaccordé à chaque fois (son « brouillé »)
function deepHit(ctx, out, t, vol) {
  const wobble = () => (Math.random() - 0.5) * 18; // ±9 cents
  [[55, 1, 0.9], [82.4, 0.5, 0.7], [110, 0.3, 0.5], [41.2, 0.45, 1.0]].forEach(([f, v, d]) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.12, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    o.detune.value = wobble();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  });
}

/**
 * Fin du timer : le coup final, en battement de cœur, jusqu'à ce qu'on touche l'écran.
 * Cadence ~66 bpm, légèrement irrégulière ; le son monte doucement sur les premiers battements.
 * onBeat(beatIndex) permet de synchroniser la vibration. Arrêt automatique de sécurité après maxMs.
 * Renvoie une fonction stop().
 */
export function startHeartbeat(ctx, { volume = 0.9, onBeat, maxMs = 5 * 60000 } = {}) {
  if (!ctx) return () => {};
  if (ctx.state === 'suspended') ctx.resume();
  const g = ctx.createGain();
  g.gain.value = volume;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 650; // étouffé, comme entendu de l'intérieur
  lp.Q.value = 0.7;
  g.connect(lp);
  lp.connect(ctx.destination);
  lp.connect(reverb(ctx));

  let next = ctx.currentTime + 0.1;
  let beat = 0;
  const started = Date.now();
  const timers = [];
  const iv = setInterval(() => {
    if (Date.now() - started > maxMs) return stop();
    while (next < ctx.currentTime + 0.3) {
      const swell = Math.min(1, 0.45 + beat * 0.14);       // monte sur ~4 battements
      const jitter = (Math.random() - 0.5) * 0.07;          // un cœur n'est pas un métronome
      deepHit(ctx, g, next, 0.5 * swell);                   // « boum »
      deepHit(ctx, g, next + 0.27 + jitter * 0.3, 0.32 * swell); // « -boum »
      if (onBeat) {
        const b = beat;
        timers.push(setTimeout(() => onBeat(b), Math.max(0, (next - ctx.currentTime) * 1000)));
      }
      beat++;
      next += 0.91 + jitter;                                // ~66 bpm
    }
  }, 60);

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(iv);
    timers.forEach(clearTimeout);
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.25);
    setTimeout(() => g.disconnect(), 1500);
  }
  return stop;
}

export function playChime(ctx, kind, id, volume = 0.9) {
  const lib = kind === 'warn' ? WARN : END;
  const s = lib[id];
  if (!s || !ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  s.play(ctx, bus(ctx, volume), ctx.currentTime + 0.05);
}

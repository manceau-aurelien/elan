// Le disque qui se vide — et qui s'use avec le temps.
// fraction : part restante (0 → 1) ; wear : usure (0 = neuf, 1 = en ruine)
import { clamp } from './util.js';

const R = 130; // rayon du disque (viewBox -160..160)
let counter = 0;

// Couleur selon l'usure : or vif → orange → rouge → rouille terne
const STOPS = [
  [0.0, 40, 95, 58],
  [0.45, 26, 90, 54],
  [0.75, 8, 72, 46],
  [1.0, 10, 22, 27],
];
export function wearColor(w, lightShift = 0) {
  w = clamp(w, 0, 1);
  let i = 0;
  while (i < STOPS.length - 2 && w > STOPS[i + 1][0]) i++;
  const [a, h1, s1, l1] = STOPS[i];
  const [b, h2, s2, l2] = STOPS[i + 1];
  const t = (w - a) / (b - a);
  const h = h1 + (h2 - h1) * t;
  const s = s1 + (s2 - s1) * t;
  const l = l1 + (l2 - l1) * t + lightShift;
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

// Générateur pseudo-aléatoire reproductible (mêmes fissures pour un même timer)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polar(r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

export function wedgePath(fraction, r = R) {
  const f = clamp(fraction, 0, 1);
  if (f <= 0.0005) return '';
  if (f >= 0.9995) return `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 Z`;
  const [x, y] = polar(r, f * 360);
  const large = f > 0.5 ? 1 : 0;
  return `M 0 0 L 0 ${-r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

function makeCracks(seed) {
  const rand = rng(seed * 7919 + 13);
  const cracks = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const start = rand() * 360;
    let ang = start;
    let r = R + 4;
    const len = 35 + rand() * 75;
    const pts = [polar(r, ang)];
    let travelled = 0;
    while (travelled < len) {
      const step = 7 + rand() * 9;
      r -= step;
      ang += (rand() - 0.5) * 14;
      travelled += step;
      pts.push(polar(Math.max(r, 12), ang));
    }
    let d = 'M ' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
    // une branche sur certaines fissures
    if (rand() > 0.45 && pts.length > 3) {
      const k = 1 + Math.floor(rand() * (pts.length - 2));
      let [bx, by] = pts[k];
      let br = Math.hypot(bx, by);
      let ba = (Math.atan2(by, bx) * 180) / Math.PI + 90;
      const dir = rand() > 0.5 ? 1 : -1;
      const bpts = [[bx, by]];
      for (let j = 0; j < 3; j++) {
        br -= 6 + rand() * 6;
        ba += dir * (8 + rand() * 10);
        bpts.push(polar(Math.max(br, 12), ba));
      }
      d += ' M ' + bpts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
    }
    // seuil d'apparition : les fissures arrivent à partir de 20 % d'usure
    cracks.push({ d, at: 0.2 + (i / n) * 0.75, w: 1.2 + rand() * 1.6 });
  }
  return cracks;
}

export function createDisk(container) {
  const id = `d${++counter}`;
  container.innerHTML = `
  <svg class="disk" viewBox="-160 -160 320 320" aria-hidden="true">
    <defs>
      <filter id="${id}-erode" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="${id}-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.03  0 0 0 0 0.02  3.2 0 0 0 -1.25"/>
      </filter>
      <radialGradient id="${id}-shade" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity="0.10"/>
        <stop offset="0.7" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
      </radialGradient>
      <clipPath id="${id}-clip"><path class="clip-path"/></clipPath>
    </defs>
    <g class="rings"></g>
    <circle class="track" r="${R}"/>
    <g class="ticks">${ticks()}</g>
    <g class="worn" filter="url(#${id}-erode)">
      <path class="wedge"/>
      <path class="wedge-shade" fill="url(#${id}-shade)"/>
      <g clip-path="url(#${id}-clip)">
        <rect class="grain" x="-${R}" y="-${R}" width="${R * 2}" height="${R * 2}" filter="url(#${id}-grain)"/>
        <g class="cracks"></g>
      </g>
    </g>
    <line class="edge" x1="0" y1="0" x2="0" y2="-${R}"/>
    <circle class="knob" r="11" cx="0" cy="-${R}"/>
    <circle class="hub" r="13"/>
  </svg>`;
  const svg = container.querySelector('svg');
  const q = (s) => svg.querySelector(s);
  const els = {
    wedge: q('.wedge'), shade: q('.wedge-shade'), clip: q('.clip-path'),
    disp: q(`#${id}-erode feDisplacementMap`), turb: q(`#${id}-erode feTurbulence`),
    grain: q('.grain'), cracks: q('.cracks'), knob: q('.knob'), edge: q('.edge'), rings: q('.rings'),
  };
  let crackSeed = null;
  let crackEls = [];
  let last = {};

  function setCracks(seed) {
    if (seed === crackSeed) return;
    crackSeed = seed;
    const cr = makeCracks(seed);
    els.cracks.innerHTML = cr.map((c) => `<path d="${c.d}" stroke-width="${c.w.toFixed(2)}" opacity="0"/>`).join('');
    crackEls = [...els.cracks.children].map((el, i) => ({ el, at: cr[i].at }));
    els.turb.setAttribute('seed', String(seed % 1000));
  }

  return {
    svg,
    /**
     * fraction : part restante du disque (0..1)
     * wear : usure (0..1)
     * seed : graine des fissures
     * rings : nombre d'anneaux d'heures en plus (mode réglage)
     * knob : afficher la poignée de réglage
     */
    set({ fraction, wear = 0, seed = 1, rings = 0, knob = false }) {
      setCracks(seed);
      const d = wedgePath(fraction);
      if (d !== last.d) {
        els.wedge.setAttribute('d', d);
        els.shade.setAttribute('d', d);
        els.clip.setAttribute('d', d);
        last.d = d;
      }
      const w = Math.round(clamp(wear, 0, 1) * 200) / 200;
      if (w !== last.w) {
        last.w = w;
        els.wedge.style.fill = wearColor(w);
        els.disp.setAttribute('scale', (Math.pow(w, 1.4) * 18).toFixed(2));
        els.grain.style.opacity = (w * 0.55).toFixed(3);
        for (const c of crackEls) {
          c.el.setAttribute('opacity', clamp((w - c.at) / 0.12, 0, 0.9).toFixed(2));
        }
        svg.style.setProperty('--wear', w);
      }
      if (rings !== last.rings) {
        last.rings = rings;
        els.rings.innerHTML = Array.from({ length: rings }, (_, i) => `<circle r="${R + 10 + i * 7}"/>`).join('');
      }
      const [kx, ky] = polar(R, clamp(fraction, 0, 1) * 360);
      els.knob.setAttribute('cx', kx.toFixed(2));
      els.knob.setAttribute('cy', ky.toFixed(2));
      els.knob.style.display = knob ? '' : 'none';
      els.edge.style.display = fraction > 0.0005 && fraction < 0.9995 ? '' : 'none';
    },
  };
}

function ticks() {
  let s = '';
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const [x1, y1] = polar(R + 3, i * 6);
    const [x2, y2] = polar(R + (major ? 13 : 7), i * 6);
    s += `<line class="${major ? 'major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return s;
}

// Petit disque statique (objectifs de la semaine)
export function miniDisk(fraction, wear, size = 48) {
  return `<svg class="mini-disk" width="${size}" height="${size}" viewBox="-140 -140 280 280" aria-hidden="true">
    <circle r="${R}" class="track"/>
    <path d="${wedgePath(fraction)}" fill="${wearColor(wear)}"/>
    <circle r="16" class="hub"/>
  </svg>`;
}

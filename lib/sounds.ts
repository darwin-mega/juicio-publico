// ============================================================
// lib/sounds.ts — Sistema de sonido con Web Audio API pura
// ============================================================

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  return ctx;
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// ── Helpers ──────────────────────────────────────────────────

function tone(
  freq: number, dur: number,
  type: OscillatorType = 'sine',
  vol = 0.3, delay = 0,
  freqEnd?: number
) {
  const c = getCtx(); if (!c) return;
  resume();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (freqEnd !== undefined)
    osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + delay + dur);
  gain.gain.setValueAtTime(0, c.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + dur + 0.01);
}

function noise(dur: number, vol = 0.15, delay = 0) {
  const c = getCtx(); if (!c) return;
  resume();
  const buf  = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src  = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  src.connect(gain); gain.connect(c.destination);
  gain.gain.setValueAtTime(vol, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  src.start(c.currentTime + delay);
}

// ── Sonidos de UI ─────────────────────────────────────────────

/** Tap / click suave en cualquier botón */
export function playClick() {
  tone(1200, 0.04, 'sine', 0.1);
  tone(800,  0.06, 'sine', 0.06, 0.02);
}

/** Selección de un jugador en el picker */
export function playSelect() {
  tone(660, 0.07, 'sine', 0.18);
  tone(880, 0.05, 'sine', 0.1, 0.05);
}

/** Deseleccionar */
export function playDeselect() {
  tone(440, 0.06, 'sine', 0.1);
}

/** Transición entre pantallas — whoosh suave */
export function playTransition() {
  tone(200, 0.25, 'sine', 0.12, 0, 600);
  noise(0.15, 0.06);
}

/** Handoff — "pasá el dispositivo" */
export function playHandoff() {
  tone(440, 0.12, 'sine', 0.18);
  tone(550, 0.12, 'sine', 0.14, 0.1);
  tone(660, 0.15, 'sine', 0.12, 0.2);
}

/** Confirmar acción en operativo */
export function playConfirm() {
  tone(523, 0.08, 'sine', 0.22);
  tone(659, 0.1,  'sine', 0.18, 0.06);
  tone(784, 0.15, 'sine', 0.14, 0.12);
}

// ── Sonidos de noticias ───────────────────────────────────────

/**
 * Jingle de noticiero estilo broadcast.
 * Duración aprox 3.2 segundos.
 * Motivo: golpe de percusión → fanfarria ascendente → frase melódica → remate.
 */
export function playNewsJingle() {
  const c = getCtx(); if (!c) return; resume();

  // ── Percusión inicial (bombo + redoblante estilizado) ──
  // Bombo
  tone(80, 0.35, 'sine', 0.5, 0, 30);
  noise(0.08, 0.4, 0);
  // Redoblante
  noise(0.06, 0.25, 0.18);
  tone(200, 0.05, 'square', 0.15, 0.18);

  // ── Golpe metálico (cencerro sintetizado) ──
  tone(1100, 0.18, 'square', 0.18, 0.02);
  tone(1400, 0.1,  'square', 0.1,  0.02);

  // ── Fanfarria ascendente tipo "breaking news" ──
  // E4-G4-B4-E5 con brass-ish
  const fanfare = [
    { f: 330, d: 0.12, t: 0.4  },
    { f: 392, d: 0.12, t: 0.52 },
    { f: 494, d: 0.12, t: 0.64 },
    { f: 659, d: 0.22, t: 0.76 },
  ];
  fanfare.forEach(({ f, d, t }) => {
    tone(f, d, 'sawtooth', 0.22, t);
    tone(f, d, 'sine',     0.14, t);
  });

  // Acorde tras la fanfarria (E mayor)
  [330, 415, 494].forEach((f) => tone(f, 0.3, 'sawtooth', 0.18, 0.98));

  // ── Segunda percusión ──
  noise(0.07, 0.3, 1.10);
  tone(180, 0.3, 'sine', 0.35, 1.10, 50);

  // ── Frase melódica principal ──
  // G4-A4-B4-A4-G4-E4 (patrón "noticias urgentes")
  const melody = [
    { f: 392, d: 0.13, t: 1.35 },
    { f: 440, d: 0.13, t: 1.48 },
    { f: 494, d: 0.13, t: 1.61 },
    { f: 440, d: 0.13, t: 1.74 },
    { f: 392, d: 0.13, t: 1.87 },
    { f: 330, d: 0.22, t: 2.00 },
  ];
  melody.forEach(({ f, d, t }) => {
    tone(f, d, 'sine',     0.28, t);
    tone(f, d, 'triangle', 0.1,  t);
  });

  // ── Remate final ──
  noise(0.06, 0.35, 2.20);
  tone(140, 0.3, 'sine', 0.42, 2.20, 50);
  // Acorde final E mayor amplio
  [165, 207, 247, 330, 494].forEach((f, i) =>
    tone(f, 0.5, 'sawtooth', 0.18 - i * 0.02, 2.28)
  );
  // Shimmer de agudos
  [880, 1047, 1174].forEach((f, i) =>
    tone(f, 0.4, 'sine', 0.1, 2.28 + i * 0.06)
  );
}

// ── Sonidos de gameplay ───────────────────────────────────────

export function playTension() {
  [0, 0.35].forEach((d) => {
    tone(55, 0.18, 'sine',     0.35, d);
    tone(55, 0.18, 'triangle', 0.2,  d + 0.02);
  });
}

export function playDeath() {
  tone(80, 0.6, 'sawtooth', 0.4);
  tone(60, 0.8, 'sine',     0.3, 0.05);
  noise(0.15, 0.3);
  tone(200, 1.1, 'sine', 0.3, 0.1, 40);
}

export function playSaved() {
  [0, 0.12, 0.28].forEach((d, i) =>
    tone([440, 554, 659][i], 0.5, 'sine', 0.2, d)
  );
}

export function playCalm() {
  tone(440, 0.3, 'sine', 0.15);
  tone(660, 0.3, 'sine', 0.1, 0.18);
}

export function playAccusation() {
  const c = getCtx(); if (!c) return; resume();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.25, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.7);
  osc.frequency.setValueAtTime(880, c.currentTime);
  osc.frequency.linearRampToValueAtTime(1100, c.currentTime + 0.18);
  osc.frequency.linearRampToValueAtTime(880,  c.currentTime + 0.36);
  osc.frequency.linearRampToValueAtTime(1100, c.currentTime + 0.54);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.7);
}

export function playInnocent() {
  tone(550, 0.2, 'sine', 0.2);
  tone(440, 0.3, 'sine', 0.15, 0.22);
}

export function playVictory() {
  const notes = [
    {f:523,d:0.15},{f:659,d:0.15},{f:784,d:0.15},
    {f:1047,d:0.4},{f:784,d:0.12},{f:1047,d:0.5},
  ];
  let t = 0;
  notes.forEach(({f,d}) => { tone(f, d+0.05, 'sine', 0.28, t); t += d; });
}

export function playDefeat() {
  [{f:392,d:0.2},{f:330,d:0.2},{f:262,d:0.5}].forEach(({f,d},i) => {
    tone(f, d+0.08, 'sawtooth', 0.2, i*0.22);
  });
}

export function playExpelled() {
  tone(220, 0.4, 'square', 0.2);
  tone(165, 0.5, 'sine',   0.15, 0.32);
}

export function playTick(isLast = false) {
  tone(isLast ? 880 : 660, 0.06, 'sine', isLast ? 0.25 : 0.12);
}

// ============================================================
// lib/sounds.ts
// Sistema de sonido usando Web Audio API pura — sin archivos externos.
// Genera efectos de sonido programáticamente.
// ============================================================

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// ── Helpers internos ──────────────────────────────────────────

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  delay = 0
) {
  const c = getCtx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  gain.gain.setValueAtTime(0, c.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration);
}

function playNoise(duration: number, volume = 0.15, delay = 0) {
  const c = getCtx();
  if (!c) return;
  resume();
  const bufSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  source.connect(gain);
  gain.connect(c.destination);
  gain.gain.setValueAtTime(volume, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  source.start(c.currentTime + delay);
}

// ── Sonidos públicos ──────────────────────────────────────────

/** Click suave al presionar un botón */
export function playClick() {
  playTone(880, 0.06, 'sine', 0.15);
}

/** Tensión creciente — mientras carga la noticia */
export function playTension() {
  // Latido doble de bajo
  [0, 0.35].forEach((delay) => {
    playTone(55, 0.18, 'sine', 0.35, delay);
    playTone(55, 0.18, 'triangle', 0.2, delay + 0.02);
  });
}

/** Golpe dramático — para revelar la víctima */
export function playDeath() {
  // Impacto grave
  playTone(80, 0.6, 'sawtooth', 0.4);
  playTone(60, 0.8, 'sine', 0.3, 0.05);
  playNoise(0.15, 0.3);
  // Descenso
  const c = getCtx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, c.currentTime + 0.1);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 1);
  gain.gain.setValueAtTime(0.3, c.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
  osc.start(c.currentTime + 0.1);
  osc.stop(c.currentTime + 1.2);
}

/** Sonido de alivio — nadie murió o fue salvado */
export function playSaved() {
  // Acorde ascendente suave
  [0, 0.1, 0.25].forEach((delay, i) => {
    const freqs = [440, 550, 660];
    playTone(freqs[i], 0.5, 'sine', 0.2, delay);
  });
}

/** Sorpresa — calma total */
export function playCalm() {
  playTone(440, 0.3, 'sine', 0.15);
  playTone(660, 0.3, 'sine', 0.1, 0.15);
}

/** Revelación policial — sospechoso */
export function playAccusation() {
  // Sirena corta
  const c = getCtx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.25, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
  osc.frequency.setValueAtTime(880, c.currentTime);
  osc.frequency.linearRampToValueAtTime(1100, c.currentTime + 0.15);
  osc.frequency.linearRampToValueAtTime(880, c.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(1100, c.currentTime + 0.45);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.6);
}

/** Revelación policial — inocente */
export function playInnocent() {
  playTone(550, 0.2, 'sine', 0.2);
  playTone(440, 0.3, 'sine', 0.15, 0.22);
}

/** Fanfarria de victoria */
export function playVictory() {
  const notes = [
    { f: 523, d: 0.15 },
    { f: 659, d: 0.15 },
    { f: 784, d: 0.15 },
    { f: 1047, d: 0.35 },
    { f: 784,  d: 0.15 },
    { f: 1047, d: 0.5  },
  ];
  let t = 0;
  notes.forEach(({ f, d }) => {
    playTone(f, d + 0.05, 'sine', 0.28, t);
    t += d;
  });
}

/** Derrota */
export function playDefeat() {
  const notes = [
    { f: 392, d: 0.2 },
    { f: 330, d: 0.2 },
    { f: 262, d: 0.5 },
  ];
  let t = 0;
  notes.forEach(({ f, d }) => {
    playTone(f, d + 0.08, 'sawtooth', 0.2, t);
    t += d;
  });
}

/** Expulsado del juicio */
export function playExpelled() {
  playTone(220, 0.4, 'square', 0.2);
  playTone(165, 0.5, 'sine', 0.15, 0.3);
}

/** Countdown tick */
export function playTick(isLast = false) {
  playTone(isLast ? 880 : 660, 0.06, 'sine', isLast ? 0.25 : 0.12);
}

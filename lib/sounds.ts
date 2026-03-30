// ============================================================
// lib/sounds.ts — Sistema de sonido profesional con música y mute
// ============================================================

let ctx: AudioContext | null = null;
const bufferCache: Record<string, AudioBuffer> = {};
let isMuted = false;

// ── Control de Música ────────────────────────────────────────
let bgMusicSource: AudioBufferSourceNode | null = null;
let bgMusicGain: GainNode | null = null;
const BG_MUSIC_VOL = 0.12; // 12% de volumen solicitado

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return ctx;
}

function resume() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume();
}

/** 
 * Cambia el estado global de silencio 
 */
export function toggleMute() {
  isMuted = !isMuted;
  const c = getCtx();
  if (!c) return isMuted;

  // Si hay música sonando, actualizamos su volumen
  if (bgMusicGain) {
    bgMusicGain.gain.setValueAtTime(isMuted ? 0 : BG_MUSIC_VOL, c.currentTime);
  }
  
  return isMuted;
}

export function getIsMuted() { return isMuted; }

/**
 * Carga un archivo de audio de la carpeta /public
 */
async function loadFile(url: string): Promise<AudioBuffer | null> {
  if (bufferCache[url]) return bufferCache[url];
  const c = getCtx();
  if (!c) return null;

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await c.decodeAudioData(arrayBuffer);
    bufferCache[url] = audioBuffer;
    return audioBuffer;
  } catch (err) {
    console.error(`Error cargando sonido: ${url}`, err);
    return null;
  }
}

/**
 * Reproduce un buffer (muestreo) de forma puntual
 */
function playBuffer(buffer: AudioBuffer, vol = 0.5) {
  if (isMuted) return;
  const c = getCtx(); if (!c) return;
  resume();
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(c.destination);
  gain.gain.setValueAtTime(vol, c.currentTime);
  src.start(0);
}

// ── Música de Fondo ──────────────────────────────────────────

/** Inicia la música de fondo en loop (noticias.mp3 al 12%) */
export async function startBackgroundMusic() {
  const c = getCtx(); if (!c) return;
  resume();

  if (bgMusicSource) return; // Ya está sonando

  const buffer = await loadFile('/Music/noticias.mp3');
  if (!buffer) return;

  bgMusicSource = c.createBufferSource();
  bgMusicGain = c.createGain();
  
  bgMusicSource.buffer = buffer;
  bgMusicSource.loop = true;
  
  bgMusicSource.connect(bgMusicGain);
  bgMusicGain.connect(c.destination);
  
  bgMusicGain.gain.setValueAtTime(isMuted ? 0 : BG_MUSIC_VOL, c.currentTime);
  bgMusicSource.start(0);
}

export function stopBackgroundMusic() {
  if (bgMusicSource) {
    try { bgMusicSource.stop(); } catch {}
    bgMusicSource = null;
    bgMusicGain = null;
  }
}

// ── Helpers de Síntesis "Pro" ────────────────────────────────

function tone(
  freq: number, dur: number,
  type: OscillatorType = 'sine',
  vol = 0.3, delay = 0,
  freqEnd?: number
) {
  if (isMuted) return;
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
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + dur + 0.05);
}

function noise(dur: number, vol = 0.15, delay = 0, filterFreq?: number) {
  if (isMuted) return;
  const c = getCtx(); if (!c) return;
  resume();
  const buf  = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src  = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  
  let targetNode: AudioNode = gain;
  if (filterFreq) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, c.currentTime + delay);
    src.connect(filter);
    filter.connect(gain);
  } else {
    src.connect(gain);
  }

  gain.connect(c.destination);
  gain.gain.setValueAtTime(vol, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  src.start(c.currentTime + delay);
}

// ── Sonidos de UI ─────────────────────────────────────────────

export function playClick() {
  tone(1400, 0.05, 'sine', 0.12);
  tone(900,  0.08, 'sine', 0.08, 0.02);
}

export function playSelect() {
  tone(600,  0.1, 'sine', 0.15);
  tone(1200, 0.05, 'sine', 0.1, 0.06);
}

export function playDeselect() {
  tone(440, 0.15, 'sine', 0.1, 0, 330);
}

export function playTransition() {
  tone(100, 0.4, 'sine', 0.15, 0, 500);
  noise(0.2, 0.08, 0, 1000);
}

export function playHandoff() {
  [440, 550, 660, 880].forEach((f, i) => tone(f, 0.1, 'sine', 0.1, i * 0.08));
}

export function playConfirm() {
  tone(523, 0.15, 'sine', 0.2, 0, 1046);
  tone(784, 0.3, 'sine', 0.1, 0.1);
}

// ── Sonidos de Noticias ───────────────────────────────────────

export async function playNewsJingle() {
  const buffer = await loadFile('/Music/noticias.mp3');
  if (buffer) {
    playBuffer(buffer, 0.6);
    return;
  }
  const c = getCtx(); if (!c) return; resume();
  tone(60, 0.5, 'sine', 0.6, 0, 40);
  [330, 392, 494, 659].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.15, 0.4 + i * 0.12));
  [392, 440, 494, 440, 392, 330].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, 1.35 + i * 0.15));
}

// ── Sfx Gameplay ──────────────────────────────────────────────

export function playTension() {
  [0, 0.4].forEach((d) => {
    tone(40, 0.3, 'sine', 0.4, d, 30);
    noise(0.1, 0.15, d, 200);
  });
}

export function playDeath() {
  tone(100, 1.5, 'sawtooth', 0.3, 0, 50);
  noise(0.8, 0.2);
  tone(200, 1.2, 'sine', 0.2, 0.1, 20);
}

export function playSaved() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, 'sine', 0.15, i * 0.12));
}

export function playCalm() {
  tone(330, 0.4, 'sine', 0.12);
  tone(494, 0.5, 'sine', 0.08, 0.2);
}

export function playAccusation() {
  const c = getCtx(); if (!c) return; resume();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(isMuted ? 0 : 0.2, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
  osc.frequency.setValueAtTime(800, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.15);
  osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.3);
  osc.start();
  osc.stop(c.currentTime + 1.25);
}

export function playInnocent() {
  tone(550, 0.4, 'sine', 0.2, 0, 660);
  tone(440, 0.5, 'sine', 0.15, 0.25);
}

export function playVictory() {
  const notes = [523, 659, 784, 1046, 784, 1046];
  let t = 0;
  notes.forEach((f, i) => {
    tone(f, 0.4, 'sine', 0.2, t);
    t += 0.15;
  });
}

export function playDefeat() {
  [392, 330, 262].forEach((f, i) => tone(f, 1.0, 'sawtooth', 0.2, i * 0.3));
}

export function playExpelled() {
  tone(200, 0.8, 'square', 0.2, 0, 100);
  noise(0.5, 0.2, 0.1, 400);
}

export function playTick(isLast = false) {
  tone(isLast ? 1200 : 800, 0.04, 'sine', isLast ? 0.3 : 0.15);
}


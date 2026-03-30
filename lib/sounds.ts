// ============================================================
// lib/sounds.ts — Sistema de sonido profesional con Master Gain
// ============================================================

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const bufferCache: Record<string, AudioBuffer> = {};
let isMuted = false;

// ── Control de Música ────────────────────────────────────────
let bgMusicSource: AudioBufferSourceNode | null = null;
let bgMusicGain: GainNode | null = null;
const BG_MUSIC_VOL_BASE = 0.15; // 15% como pidió el usuario

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(isMuted ? 0 : 1, ctx.currentTime);
    } catch { return null; }
  }
  return ctx;
}

function resume() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume();
}

/** 
 * Silencio Global 
 */
export function toggleMute() {
  isMuted = !isMuted;
  const c = getCtx();
  if (!c || !masterGain) return isMuted;
  masterGain.gain.exponentialRampToValueAtTime(isMuted ? 0.0001 : 1, c.currentTime + 0.05);
  return isMuted;
}

export function getIsMuted() { return isMuted; }

async function loadFile(url: string): Promise<AudioBuffer | null> {
  if (bufferCache[url]) return bufferCache[url];
  const c = getCtx(); if (!c) return null;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await c.decodeAudioData(arrayBuffer);
    bufferCache[url] = audioBuffer;
    return audioBuffer;
  } catch (err) { return null; }
}

function playBuffer(buffer: AudioBuffer, vol = 0.5) {
  const c = getCtx(); if (!c || !masterGain) return;
  resume();
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(masterGain);
  gain.gain.setValueAtTime(vol, c.currentTime);
  src.start(0);
}

// ── Música de Fondo (Global) ──────────────────────────────────

/** Inicia la música ambiental global musica-fondo.mp3 */
export async function startBackgroundMusic() {
  const c = getCtx(); if (!c || !masterGain) return;
  resume();
  if (bgMusicSource) return;

  const buffer = await loadFile('/Music/musica-fondo.mp3');
  if (!buffer) return;

  bgMusicSource = c.createBufferSource();
  bgMusicGain   = c.createGain();
  bgMusicSource.buffer = buffer;
  bgMusicSource.loop   = true;
  bgMusicSource.connect(bgMusicGain);
  bgMusicGain.connect(masterGain);
  bgMusicGain.gain.setValueAtTime(BG_MUSIC_VOL_BASE, c.currentTime);
  bgMusicSource.start(0);
}

/** Detiene la música actual con un pequeño fade */
export function stopBackgroundMusic() {
  if (bgMusicSource && bgMusicGain) {
    const c = getCtx();
    if (c) {
      bgMusicGain.gain.cancelScheduledValues(c.currentTime);
      bgMusicGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
    }
    setTimeout(() => {
      try { bgMusicSource?.stop(); } catch {}
      bgMusicSource = null;
      bgMusicGain   = null;
    }, 250);
  } else {
    bgMusicSource = null;
    bgMusicGain = null;
  }
}

// ── Sonidos de Noticias ───────────────────────────────────────

/** Corta la música de fondo y reproduce el jingle de noticias */
export async function playNewsJingle() {
  const c = getCtx(); if (!c) return;
  
  // 1. Detenemos la ambientación para que resalte la noticia
  stopBackgroundMusic();

  // 2. Cargamos y reproducimos noticias.mp3 como un "evento" puntual
  const buffer = await loadFile('/Music/noticias.mp3');
  if (buffer) {
    playBuffer(buffer, 0.65);
  }
}

// ── Helpers de Síntesis ──────────────────────────────────────

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, freqEnd?: number) {
  const c = getCtx(); if (!c || !masterGain) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(masterGain);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + delay + dur);
  gain.gain.setValueAtTime(0, c.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + dur + 0.05);
}

function noise(dur: number, vol = 0.15, delay = 0, filterFreq?: number) {
  const c = getCtx(); if (!c || !masterGain) return;
  resume();
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  if (filterFreq) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(filterFreq, c.currentTime + delay);
    src.connect(filter); filter.connect(gain);
  } else { src.connect(gain); }
  gain.connect(masterGain);
  gain.gain.setValueAtTime(vol, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur);
  src.start(c.currentTime + delay);
}

// ── SFX ───────────────────────────────────────────────────────
export function playClick() { tone(1400, 0.05, 'sine', 0.12); tone(900, 0.08, 'sine', 0.08, 0.02); }
export function playSelect() { tone(600, 0.1, 'sine', 0.15); tone(1200, 0.05, 'sine', 0.1, 0.06); }
export function playDeselect() { tone(440, 0.15, 'sine', 0.1, 0, 330); }
export function playTransition() { tone(100, 0.4, 'sine', 0.15, 0, 500); noise(0.2, 0.08, 0, 1000); }
export function playHandoff() { [440, 550, 660, 880].forEach((f, i) => tone(f, 0.1, 'sine', 0.1, i * 0.08)); }
export function playConfirm() { tone(523, 0.15, 'sine', 0.2, 0, 1046); tone(784, 0.3, 'sine', 0.1, 0.1); }
export function playTension() { [0, 0.4].forEach((d) => { tone(40, 0.3, 'sine', 0.4, d, 30); noise(0.1, 0.15, d, 200); }); }
export function playDeath() { tone(100, 1.5, 'sawtooth', 0.3, 0, 50); noise(0.8, 0.2); tone(200, 1.2, 'sine', 0.2, 0.1, 20); }
export function playSaved() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, 'sine', 0.15, i * 0.12)); }
export function playCalm() { tone(330, 0.4, 'sine', 0.12); tone(494, 0.5, 'sine', 0.08, 0.2); }
export function playAccusation() {
  const c = getCtx(); if (!c || !masterGain) return; resume();
  const osc = c.createOscillator(); const gain = c.createGain();
  osc.connect(gain); gain.connect(masterGain); osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.2, c.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
  osc.frequency.setValueAtTime(800, c.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.15);
  osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.3);
  osc.start(); osc.stop(c.currentTime + 1.25);
}
export function playInnocent() { tone(550, 0.4, 'sine', 0.2, 0, 660); tone(440, 0.5, 'sine', 0.15, 0.25); }
export function playVictory() { 
  // Arpegio heroico ascendente con brillo
  const c = getCtx(); if (!c) return;
  [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
    tone(f, 0.6, 'sine', 0.15, i * 0.1);
    tone(f, 0.4, 'triangle', 0.1, i * 0.1); // Armónico
  });
  setTimeout(() => tone(1318.51, 1.2, 'sine', 0.2, 0, 1318.51), 400);
}

export function playDefeat() { 
  // Caída dramática y sombría
  [392, 311, 261, 196].forEach((f, i) => {
    tone(f, 1.2, 'sawtooth', 0.15, i * 0.25, f * 0.8);
    noise(0.6, 0.1, i * 0.25, 300);
  });
}

export function playExpelled() { 
  // Impacto de martillo / sentencia
  tone(100, 0.6, 'square', 0.3, 0, 40); 
  noise(0.4, 0.25, 0, 500); 
  tone(60, 0.8, 'sine', 0.4, 0.05); 
}

export function playTick(isLast = false) { tone(isLast ? 1200 : 800, 0.04, 'sine', isLast ? 0.3 : 0.15); }

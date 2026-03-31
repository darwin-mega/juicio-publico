import type { AmbienceKey, SoundKey } from './types';

interface EnvelopeNode {
  durationMs: number;
}

interface AmbienceHandle {
  stop: (fadeOutMs?: number) => void;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function tone(
  ctx: AudioContext,
  destination: AudioNode,
  {
    delayMs = 0,
    durationMs,
    frequency,
    frequencyEnd,
    type = 'sine',
    volume = 0.2,
  }: {
    delayMs?: number;
    durationMs: number;
    frequency: number;
    frequencyEnd?: number;
    type?: OscillatorType;
    volume?: number;
  }
): EnvelopeNode {
  const startTime = ctx.currentTime + delayMs / 1000;
  const endTime = startTime + durationMs / 1000;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (frequencyEnd != null) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyEnd), endTime);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(clamp(volume), startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.03);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };

  return { durationMs: delayMs + durationMs };
}

function noise(
  ctx: AudioContext,
  destination: AudioNode,
  {
    delayMs = 0,
    durationMs,
    volume = 0.12,
    lowpassHz,
    highpassHz,
  }: {
    delayMs?: number;
    durationMs: number;
    volume?: number;
    lowpassHz?: number;
    highpassHz?: number;
  }
): EnvelopeNode {
  const startTime = ctx.currentTime + delayMs / 1000;
  const endTime = startTime + durationMs / 1000;
  const frameCount = Math.max(1, Math.floor((ctx.sampleRate * durationMs) / 1000));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(clamp(volume), startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  let lastNode: AudioNode = source;

  if (highpassHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpassHz, startTime);
    lastNode.connect(filter);
    lastNode = filter;
  }

  if (lowpassHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpassHz, startTime);
    lastNode.connect(filter);
    lastNode = filter;
  }

  lastNode.connect(gain);
  gain.connect(destination);
  source.start(startTime);
  source.stop(endTime + 0.02);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };

  return { durationMs: delayMs + durationMs };
}

export function playFallbackSound(key: SoundKey, ctx: AudioContext, destination: AudioNode): number {
  let maxDurationMs = 220;
  const track = (node: EnvelopeNode) => {
    maxDurationMs = Math.max(maxDurationMs, node.durationMs);
  };

  switch (key) {
    case 'ui.click':
      track(tone(ctx, destination, { durationMs: 45, frequency: 1420, type: 'triangle', volume: 0.1 }));
      track(tone(ctx, destination, { delayMs: 18, durationMs: 70, frequency: 920, type: 'triangle', volume: 0.06 }));
      break;

    case 'ui.select':
      track(tone(ctx, destination, { durationMs: 90, frequency: 620, frequencyEnd: 940, type: 'sine', volume: 0.14 }));
      break;

    case 'ui.confirm':
      track(tone(ctx, destination, { durationMs: 140, frequency: 520, frequencyEnd: 1040, type: 'triangle', volume: 0.16 }));
      track(tone(ctx, destination, { delayMs: 80, durationMs: 180, frequency: 784, type: 'sine', volume: 0.08 }));
      break;

    case 'ui.joinRoom':
      track(noise(ctx, destination, { durationMs: 130, volume: 0.06, lowpassHz: 1600 }));
      track(tone(ctx, destination, { delayMs: 30, durationMs: 180, frequency: 360, frequencyEnd: 940, type: 'triangle', volume: 0.14 }));
      break;

    case 'ui.screenChange':
      track(noise(ctx, destination, { durationMs: 180, volume: 0.07, lowpassHz: 1800, highpassHz: 120 }));
      track(tone(ctx, destination, { durationMs: 220, frequency: 180, frequencyEnd: 520, type: 'sine', volume: 0.12 }));
      break;

    case 'ui.tick':
      track(tone(ctx, destination, { durationMs: 38, frequency: 880, type: 'square', volume: 0.1 }));
      break;

    case 'game.start':
      track(noise(ctx, destination, { durationMs: 220, volume: 0.08, lowpassHz: 1200 }));
      track(tone(ctx, destination, { durationMs: 360, frequency: 120, frequencyEnd: 420, type: 'sawtooth', volume: 0.22 }));
      track(tone(ctx, destination, { delayMs: 120, durationMs: 260, frequency: 72, type: 'sine', volume: 0.18 }));
      break;

    case 'game.voteStart':
      track(noise(ctx, destination, { durationMs: 160, volume: 0.06, lowpassHz: 900 }));
      track(tone(ctx, destination, { durationMs: 240, frequency: 160, frequencyEnd: 290, type: 'triangle', volume: 0.18 }));
      break;

    case 'game.voteCast':
      track(noise(ctx, destination, { durationMs: 70, volume: 0.12, lowpassHz: 700 }));
      track(tone(ctx, destination, { durationMs: 90, frequency: 160, frequencyEnd: 120, type: 'square', volume: 0.14 }));
      break;

    case 'game.voteEnd':
      track(noise(ctx, destination, { durationMs: 140, volume: 0.15, lowpassHz: 850 }));
      track(tone(ctx, destination, { durationMs: 260, frequency: 130, frequencyEnd: 72, type: 'square', volume: 0.22 }));
      break;

    case 'game.accusation':
      track(tone(ctx, destination, { durationMs: 320, frequency: 620, frequencyEnd: 1080, type: 'sawtooth', volume: 0.22 }));
      track(noise(ctx, destination, { durationMs: 180, volume: 0.08, lowpassHz: 1400 }));
      break;

    case 'game.reveal':
      track(noise(ctx, destination, { durationMs: 200, volume: 0.1, lowpassHz: 1300 }));
      track(tone(ctx, destination, { durationMs: 380, frequency: 120, frequencyEnd: 580, type: 'triangle', volume: 0.2 }));
      track(tone(ctx, destination, { delayMs: 120, durationMs: 420, frequency: 220, type: 'sine', volume: 0.08 }));
      break;

    case 'game.error':
      track(tone(ctx, destination, { durationMs: 110, frequency: 280, frequencyEnd: 190, type: 'square', volume: 0.12 }));
      track(noise(ctx, destination, { durationMs: 70, volume: 0.04, lowpassHz: 700 }));
      break;

    case 'game.phaseTransition':
      track(noise(ctx, destination, { durationMs: 180, volume: 0.05, lowpassHz: 1600 }));
      track(tone(ctx, destination, { durationMs: 260, frequency: 110, frequencyEnd: 480, type: 'triangle', volume: 0.15 }));
      break;

    case 'game.newsJingle':
      track(tone(ctx, destination, { durationMs: 220, frequency: 523, type: 'square', volume: 0.14 }));
      track(tone(ctx, destination, { delayMs: 160, durationMs: 220, frequency: 659, type: 'square', volume: 0.14 }));
      track(tone(ctx, destination, { delayMs: 320, durationMs: 420, frequency: 392, type: 'triangle', volume: 0.12 }));
      break;

    case 'game.death':
      track(noise(ctx, destination, { durationMs: 260, volume: 0.1, lowpassHz: 520 }));
      track(tone(ctx, destination, { durationMs: 680, frequency: 120, frequencyEnd: 46, type: 'sawtooth', volume: 0.2 }));
      break;

    case 'game.saved':
      track(tone(ctx, destination, { durationMs: 180, frequency: 523, type: 'sine', volume: 0.1 }));
      track(tone(ctx, destination, { delayMs: 120, durationMs: 220, frequency: 659, type: 'sine', volume: 0.1 }));
      track(tone(ctx, destination, { delayMs: 220, durationMs: 300, frequency: 784, type: 'triangle', volume: 0.08 }));
      break;

    case 'game.innocent':
      track(tone(ctx, destination, { durationMs: 220, frequency: 440, frequencyEnd: 580, type: 'triangle', volume: 0.1 }));
      track(tone(ctx, destination, { delayMs: 180, durationMs: 260, frequency: 330, type: 'sine', volume: 0.06 }));
      break;

    case 'game.resultTown':
      track(tone(ctx, destination, { durationMs: 240, frequency: 523, type: 'triangle', volume: 0.13 }));
      track(tone(ctx, destination, { delayMs: 100, durationMs: 260, frequency: 659, type: 'triangle', volume: 0.13 }));
      track(tone(ctx, destination, { delayMs: 200, durationMs: 440, frequency: 784, type: 'triangle', volume: 0.12 }));
      track(tone(ctx, destination, { delayMs: 320, durationMs: 900, frequency: 1046, type: 'sine', volume: 0.08 }));
      break;

    case 'game.resultKillers':
      track(noise(ctx, destination, { durationMs: 320, volume: 0.09, lowpassHz: 420 }));
      track(tone(ctx, destination, { durationMs: 820, frequency: 392, frequencyEnd: 110, type: 'sawtooth', volume: 0.18 }));
      track(tone(ctx, destination, { delayMs: 150, durationMs: 760, frequency: 262, frequencyEnd: 82, type: 'sine', volume: 0.14 }));
      break;

    case 'role.assassin':
      track(tone(ctx, destination, { durationMs: 520, frequency: 92, frequencyEnd: 70, type: 'sawtooth', volume: 0.18 }));
      track(noise(ctx, destination, { durationMs: 180, volume: 0.05, lowpassHz: 500 }));
      break;

    case 'role.doctor':
      track(tone(ctx, destination, { durationMs: 220, frequency: 520, type: 'sine', volume: 0.08 }));
      track(tone(ctx, destination, { delayMs: 120, durationMs: 320, frequency: 660, type: 'triangle', volume: 0.08 }));
      break;

    case 'role.police':
      track(tone(ctx, destination, { durationMs: 180, frequency: 440, type: 'square', volume: 0.09 }));
      track(tone(ctx, destination, { delayMs: 120, durationMs: 180, frequency: 660, type: 'square', volume: 0.08 }));
      break;

    case 'role.town':
      track(tone(ctx, destination, { durationMs: 240, frequency: 392, type: 'triangle', volume: 0.08 }));
      track(noise(ctx, destination, { durationMs: 120, volume: 0.03, lowpassHz: 900 }));
      break;

    default:
      track(tone(ctx, destination, { durationMs: 60, frequency: 1000, type: 'triangle', volume: 0.08 }));
      break;
  }

  return maxDurationMs + 80;
}

export function startFallbackAmbience(key: AmbienceKey, ctx: AudioContext, destination: AudioNode): AmbienceHandle {
  const output = ctx.createGain();
  output.gain.setValueAtTime(1, ctx.currentTime);
  output.connect(destination);

  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  const createLayer = (
    type: OscillatorType,
    frequency: number,
    volume: number,
    lfoRate: number,
    lfoDepth: number
  ) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    const layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(volume, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(lfoRate, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(lfoDepth, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(layerGain.gain);

    oscillator.connect(layerGain);
    layerGain.connect(output);

    oscillator.start();
    lfo.start();

    oscillators.push(oscillator, lfo);
    gains.push(layerGain, lfoGain);
  };

  if (key === 'ambience.lobby') {
    createLayer('sine', 58, 0.16, 0.045, 0.03);
    createLayer('triangle', 116, 0.035, 0.07, 0.015);
  } else {
    createLayer('sine', 44, 0.22, 0.07, 0.05);
    createLayer('sawtooth', 88, 0.03, 0.11, 0.018);
    createLayer('triangle', 176, 0.018, 0.16, 0.012);
  }

  const noiseFrames = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, noiseFrames, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.2;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(key === 'ambience.lobby' ? 520 : 380, ctx.currentTime);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(key === 'ambience.lobby' ? 0.05 : 0.075, ctx.currentTime);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(output);
  noiseSource.start();

  const cleanupNodes = [output, noiseFilter, noiseGain] as AudioNode[];

  return {
    stop(fadeOutMs = 500) {
      const now = ctx.currentTime;
      output.gain.cancelScheduledValues(now);
      output.gain.setValueAtTime(Math.max(output.gain.value, 0.0001), now);
      output.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutMs / 1000);

      window.setTimeout(() => {
        noiseSource.stop();
        noiseSource.disconnect();
        oscillators.forEach((node) => {
          node.stop();
          node.disconnect();
        });
        gains.forEach((node) => node.disconnect());
        cleanupNodes.forEach((node) => node.disconnect());
      }, fadeOutMs + 80);
    },
  };
}

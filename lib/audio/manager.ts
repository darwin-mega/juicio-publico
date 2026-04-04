'use client';

import type { Role } from '@/lib/game/state';
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_PREFERENCES, ROLE_SOUND_BY_ROLE, SOUND_CATALOG } from './catalog';
import { playFallbackSound, startFallbackAmbience } from './fallbacks';
import type {
  AmbienceKey,
  AudioPreferences,
  AudioSnapshot,
  PlaySoundOptions,
  RoleSoundKey,
  SetAmbienceOptions,
  SoundDefinition,
  SoundKey,
} from './types';

interface OneShotInstance {
  gain: GainNode;
  timeoutId?: number;
}

interface AmbienceInstance {
  key: AmbienceKey;
  cleanup: (fadeOutMs?: number) => void;
}

const AudioContextClass =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : null;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

class AudioManager {
  private ambienceToken = 0;
  private activeAmbience: AmbienceInstance | null = null;
  private audioContext: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer | null>();
  private bufferPromiseCache = new Map<string, Promise<AudioBuffer | null>>();
  private contextPrimed = false;
  private hydrated = false;
  private listeners = new Set<() => void>();
  private masterGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private pendingAmbienceKey: AmbienceKey | null = null;
  private prefState: AudioSnapshot = {
    ...DEFAULT_AUDIO_PREFERENCES,
    ambienceKey: null,
    unlocked: false,
  };
  private sfxGain: GainNode | null = null;
  private soundCooldowns = new Map<SoundKey, number>();
  private unlockCleanup: (() => void) | null = null;
  private unlockPromise: Promise<boolean> | null = null;

  private emit() {
    this.syncHtmlMediaElements();
    this.listeners.forEach((listener) => listener());
  }

  private hydratePreferences() {
    if (this.hydrated || typeof window === 'undefined') {
      return;
    }

    this.hydrated = true;

    try {
      const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) {
        this.emit();
        return;
      }

      const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
      this.prefState = {
        ...this.prefState,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_PREFERENCES.muted,
        masterVolume:
          typeof parsed.masterVolume === 'number'
            ? clamp(parsed.masterVolume)
            : DEFAULT_AUDIO_PREFERENCES.masterVolume,
        musicVolume:
          typeof parsed.musicVolume === 'number'
            ? clamp(parsed.musicVolume)
            : DEFAULT_AUDIO_PREFERENCES.musicVolume,
        sfxVolume:
          typeof parsed.sfxVolume === 'number'
            ? clamp(parsed.sfxVolume)
            : DEFAULT_AUDIO_PREFERENCES.sfxVolume,
      };
    } catch {
      this.prefState = { ...this.prefState, ...DEFAULT_AUDIO_PREFERENCES };
    }

    this.emit();
  }

  private persistPreferences() {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: AudioPreferences = {
      muted: this.prefState.muted,
      masterVolume: this.prefState.masterVolume,
      musicVolume: this.prefState.musicVolume,
      sfxVolume: this.prefState.sfxVolume,
    };

    try {
      window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // noop
    }
  }

  private ensureContext() {
    if (!AudioContextClass) {
      return null;
    }

    this.hydratePreferences();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    this.audioContext = new AudioContextClass();
    this.contextPrimed = false;
    this.masterGain = this.audioContext.createGain();
    this.musicGain = this.audioContext.createGain();
    this.musicDuckGain = this.audioContext.createGain();
    this.sfxGain = this.audioContext.createGain();

    this.musicGain.connect(this.musicDuckGain);
    this.musicDuckGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    this.musicDuckGain.gain.setValueAtTime(1, this.audioContext.currentTime);
    this.applyMix();

    return this.audioContext;
  }

  private applyMix() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.musicGain || !this.sfxGain) {
      return;
    }

    const now = ctx.currentTime;
    const masterTarget = this.prefState.muted ? 0 : clamp(this.prefState.masterVolume);

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(masterTarget, now + 0.05);

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(clamp(this.prefState.musicVolume), now + 0.05);

    this.sfxGain.gain.cancelScheduledValues(now);
    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, now);
    this.sfxGain.gain.linearRampToValueAtTime(clamp(this.prefState.sfxVolume), now + 0.05);
  }

  private syncHtmlMediaElements() {
    if (typeof document === 'undefined') {
      return;
    }

    document.querySelectorAll('audio, video').forEach((node) => {
      if (!(node instanceof HTMLMediaElement)) {
        return;
      }

      const channel = node.dataset.audioChannel;
      const lockMuted = node.dataset.audioLocked === 'true';
      const masterVolume = clamp(this.prefState.masterVolume);

      let channelVolume = 1;
      if (channel === 'music') {
        channelVolume = clamp(this.prefState.musicVolume);
      } else if (channel === 'sfx') {
        channelVolume = clamp(this.prefState.sfxVolume);
      }

      node.muted = this.prefState.muted || lockMuted;
      node.volume = clamp(masterVolume * channelVolume);
    });
  }

  private async primeAudioContext(ctx: AudioContext) {
    if (this.contextPrimed || ctx.state !== 'running') {
      return;
    }

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };

      source.start(0);
      source.stop(ctx.currentTime + 0.001);
      this.contextPrimed = true;
    } catch {
      // noop
    }
  }

  private async resumeContext() {
    const ctx = this.ensureContext();
    if (!ctx) {
      return null;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return ctx;
      }
    }

    if (ctx.state === 'running') {
      await this.primeAudioContext(ctx);

      if (!this.prefState.unlocked) {
        this.prefState = { ...this.prefState, unlocked: true };
        this.emit();
      } else {
        this.syncHtmlMediaElements();
      }
    }

    return ctx;
  }

  private async getDecodedBuffer(definition: SoundDefinition) {
    const ctx = this.ensureContext();
    if (!ctx || !definition.sources?.length) {
      return null;
    }

    for (const source of definition.sources) {
      const cached = this.bufferCache.get(source);
      if (cached !== undefined) {
        if (cached) {
          return cached;
        }
        continue;
      }

      let promise = this.bufferPromiseCache.get(source);
      if (!promise) {
        promise = (async () => {
          try {
            const response = await fetch(source);
            if (!response.ok) {
              return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            return await ctx.decodeAudioData(arrayBuffer.slice(0));
          } catch {
            return null;
          }
        })();
        this.bufferPromiseCache.set(source, promise);
      }

      const buffer = await promise;
      this.bufferCache.set(source, buffer);
      if (buffer) {
        return buffer;
      }
    }

    return null;
  }

  private createGainBus(channel: 'music' | 'sfx', volumeScale: number) {
    const ctx = this.ensureContext();
    if (!ctx) {
      return null;
    }

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(clamp(volumeScale), ctx.currentTime);

    if (channel === 'music' && this.musicGain) {
      bus.connect(this.musicGain);
    } else if (channel === 'sfx' && this.sfxGain) {
      bus.connect(this.sfxGain);
    } else {
      return null;
    }

    return bus;
  }

  private destroyOneShot(instance: OneShotInstance) {
    if (instance.timeoutId) {
      window.clearTimeout(instance.timeoutId);
    }
    instance.gain.disconnect();
  }

  private scheduleOneShotCleanup(instance: OneShotInstance, durationMs: number) {
    instance.timeoutId = window.setTimeout(() => {
      this.destroyOneShot(instance);
    }, durationMs);
  }

  private fadeMusicDuck(target: number, durationMs: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicDuckGain) {
      return;
    }

    const now = ctx.currentTime;
    this.musicDuckGain.gain.cancelScheduledValues(now);
    this.musicDuckGain.gain.setValueAtTime(Math.max(this.musicDuckGain.gain.value, 0.0001), now);
    this.musicDuckGain.gain.linearRampToValueAtTime(clamp(target, 0.02, 1), now + durationMs / 1000);
  }

  private clearUnlockListeners() {
    this.unlockCleanup?.();
    this.unlockCleanup = null;
  }

  private createAmbienceCleanup(source: AudioBufferSourceNode, gain: GainNode, fadeOutMs: number) {
    return (customFadeOutMs = fadeOutMs) => {
      const ctx = this.ensureContext();
      if (!ctx) {
        return;
      }

      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + customFadeOutMs / 1000);

      window.setTimeout(() => {
        source.stop();
        source.disconnect();
        gain.disconnect();
      }, customFadeOutMs + 80);
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AudioSnapshot => {
    this.hydratePreferences();
    return this.prefState;
  };

  syncFromStorage = () => {
    this.hydratePreferences();
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
      this.prefState = {
        ...this.prefState,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : this.prefState.muted,
        masterVolume:
          typeof parsed.masterVolume === 'number' ? clamp(parsed.masterVolume) : this.prefState.masterVolume,
        musicVolume:
          typeof parsed.musicVolume === 'number' ? clamp(parsed.musicVolume) : this.prefState.musicVolume,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? clamp(parsed.sfxVolume) : this.prefState.sfxVolume,
      };
      this.applyMix();
      this.emit();
    } catch {
      // noop
    }
  };

  installAutoUnlock = () => {
    if (typeof document === 'undefined' || this.unlockCleanup) {
      return this.clearUnlockListeners.bind(this);
    }

    let unlockScheduled = false;
    const unlock = () => {
      if (unlockScheduled || this.prefState.unlocked) {
        return;
      }

      unlockScheduled = true;
      void this.unlock().finally(() => {
        if (!this.prefState.unlocked) {
          unlockScheduled = false;
        }
      });
    };

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
    events.forEach((eventName) => {
      document.addEventListener(eventName, unlock, true);
    });

    this.unlockCleanup = () => {
      events.forEach((eventName) => {
        document.removeEventListener(eventName, unlock, true);
      });
    };

    return this.unlockCleanup;
  };

  async unlock() {
    if (this.unlockPromise) {
      return this.unlockPromise;
    }

    this.unlockPromise = (async () => {
      const ctx = await this.resumeContext();
      if (!ctx || ctx.state !== 'running') {
        return false;
      }

      this.syncHtmlMediaElements();
      this.clearUnlockListeners();

      if (this.pendingAmbienceKey) {
        void this.setAmbience(this.pendingAmbienceKey);
      }

      return true;
    })();

    try {
      return await this.unlockPromise;
    } finally {
      this.unlockPromise = null;
    }
  }

  setMuted(muted: boolean) {
    this.hydratePreferences();
    this.prefState = { ...this.prefState, muted };
    this.persistPreferences();
    this.applyMix();
    this.emit();
    return this.prefState.muted;
  }

  toggleMute() {
    return this.setMuted(!this.getSnapshot().muted);
  }

  setVolume(type: keyof Omit<AudioPreferences, 'muted'>, value: number) {
    this.hydratePreferences();
    this.prefState = {
      ...this.prefState,
      [type]: clamp(value),
    };
    this.persistPreferences();
    this.applyMix();
    this.emit();
  }

  async play(key: SoundKey, options: PlaySoundOptions = {}) {
    const definition = SOUND_CATALOG[key];
    if (!definition) {
      return false;
    }

    if (definition.category === 'ambience') {
      await this.setAmbience(key as AmbienceKey);
      return true;
    }

    const now = performance.now();
    if (!options.bypassCooldown) {
      const lastPlayedAt = this.soundCooldowns.get(key) ?? 0;
      if (now - lastPlayedAt < (definition.cooldownMs ?? 0)) {
        return false;
      }
    }
    this.soundCooldowns.set(key, now);

    const ctx = await this.resumeContext();
    if (!ctx || ctx.state !== 'running') {
      return false;
    }

    const volumeScale = definition.defaultVolume * clamp(options.volume ?? 1);
    const bus = this.createGainBus(definition.channel, volumeScale);
    if (!bus) {
      return false;
    }

    const oneShot: OneShotInstance = { gain: bus };
    const buffer = await this.getDecodedBuffer(definition);

    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(bus);
      source.start();
      source.onended = () => {
        source.disconnect();
        this.destroyOneShot(oneShot);
      };
      return true;
    }

    const durationMs = playFallbackSound(key, ctx, bus);
    this.scheduleOneShotCleanup(oneShot, durationMs + 140);
    return true;
  }

  async setAmbience(key: AmbienceKey | null, options: SetAmbienceOptions = {}) {
    this.pendingAmbienceKey = key;

    if (key == null) {
      this.prefState = { ...this.prefState, ambienceKey: null };
      const previous = this.activeAmbience;
      this.activeAmbience = null;
      previous?.cleanup(options.fadeOutMs ?? 400);
      this.emit();
      return;
    }

    this.prefState = { ...this.prefState, ambienceKey: key };
    this.emit();

    const existing = this.activeAmbience;
    if (existing?.key === key && !options.restart) {
      return;
    }

    const ctx = await this.resumeContext();
    if (!ctx || ctx.state !== 'running') {
      return;
    }

    const token = ++this.ambienceToken;
    const definition = SOUND_CATALOG[key];
    const fadeInMs = options.fadeInMs ?? definition.fadeInMs ?? 900;
    const fadeOutMs = options.fadeOutMs ?? definition.fadeOutMs ?? 450;

    const previous = this.activeAmbience;
    this.activeAmbience = null;
    previous?.cleanup(fadeOutMs);

    const bus = this.createGainBus('music', definition.defaultVolume);
    if (!bus) {
      return;
    }
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);

    const buffer = await this.getDecodedBuffer(definition);
    if (token !== this.ambienceToken) {
      bus.disconnect();
      return;
    }

    let cleanup: AmbienceInstance['cleanup'];

    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(bus);
      source.start();
      cleanup = this.createAmbienceCleanup(source, bus, fadeOutMs);
    } else {
      const fallback = startFallbackAmbience(key, ctx, bus);
      cleanup = (customFadeOutMs = fadeOutMs) => {
        fallback.stop(customFadeOutMs);
        window.setTimeout(() => {
          bus.disconnect();
        }, customFadeOutMs + 120);
      };
    }

    bus.gain.linearRampToValueAtTime(definition.defaultVolume, ctx.currentTime + fadeInMs / 1000);
    this.activeAmbience = {
      key,
      cleanup,
    };
  }

  stopAmbience(options?: SetAmbienceOptions) {
    void this.setAmbience(null, options);
  }

  duckMusic(level = 0.16, durationMs = 280) {
    this.fadeMusicDuck(level, durationMs);
  }

  restoreMusic(durationMs = 900) {
    this.fadeMusicDuck(1, durationMs);
  }

  async playRole(role: Role, options?: PlaySoundOptions) {
    const key = ROLE_SOUND_BY_ROLE[role] as RoleSoundKey;
    return this.play(key, options);
  }
}

export const audioManager = new AudioManager();

'use client';

import type { Role } from '@/lib/game/state';
import { audioManager } from './audio/manager';
import type { AmbienceKey, PlaySoundOptions, SoundKey } from './audio/types';

export type { AmbienceKey, AudioPreferences, AudioSnapshot, SoundKey } from './audio/types';

export function playSound(key: SoundKey, options?: PlaySoundOptions) {
  return audioManager.play(key, options);
}

export function playRoleSound(role: Role, options?: PlaySoundOptions) {
  return audioManager.playRole(role, options);
}

export function setAmbience(key: AmbienceKey | null, options?: { fadeInMs?: number; fadeOutMs?: number; restart?: boolean }) {
  return audioManager.setAmbience(key, options);
}

export function stopAmbience(options?: { fadeOutMs?: number }) {
  audioManager.stopAmbience(options);
}

export function duckMusic(level?: number, durationMs?: number) {
  audioManager.duckMusic(level, durationMs);
}

export function restoreMusic(durationMs?: number) {
  audioManager.restoreMusic(durationMs);
}

export function toggleMute() {
  return audioManager.toggleMute();
}

export function setMuted(muted: boolean) {
  return audioManager.setMuted(muted);
}

export function getIsMuted() {
  return audioManager.getSnapshot().muted;
}

export function getAudioState() {
  return audioManager.getSnapshot();
}

export function setMasterVolume(value: number) {
  audioManager.setVolume('masterVolume', value);
}

export function setMusicVolume(value: number) {
  audioManager.setVolume('musicVolume', value);
}

export function setSfxVolume(value: number) {
  audioManager.setVolume('sfxVolume', value);
}

export function installAudioUnlock() {
  return audioManager.installAutoUnlock();
}

export function syncAudioFromStorage() {
  audioManager.syncFromStorage();
}

export function unlockAudio() {
  return audioManager.unlock();
}

export function startLobbyAmbience(options?: { restart?: boolean }) {
  return setAmbience('ambience.lobby', options);
}

export function startMatchAmbience(options?: { restart?: boolean }) {
  return setAmbience('ambience.match', options);
}

export function startBackgroundMusic(kind: AmbienceKey = 'ambience.match') {
  return setAmbience(kind);
}

export function stopBackgroundMusic() {
  stopAmbience();
}

export function playClick() {
  return playSound('ui.click');
}

export function playSelect() {
  return playSound('ui.select');
}

export function playDeselect() {
  return playSound('ui.click', { bypassCooldown: true, volume: 0.7 });
}

export function playConfirm() {
  return playSound('ui.confirm');
}

export function playHandoff() {
  return playSound('game.phaseTransition', { volume: 0.82 });
}

export function playTransition() {
  return playSound('game.phaseTransition');
}

export function playNewsJingle() {
  duckMusic(0.08, 260);
  return playSound('game.newsJingle');
}

export function playTension() {
  duckMusic(0.12, 220);
  return playSound('game.accusation', { volume: 0.72 });
}

export function playDeath() {
  return playSound('game.death');
}

export function playSaved() {
  return playSound('game.saved');
}

export function playCalm() {
  return playSound('role.town');
}

export function playAccusation() {
  return playSound('game.accusation');
}

export function playInnocent() {
  return playSound('game.innocent');
}

export function playVictory() {
  return playSound('game.resultTown');
}

export function playDefeat() {
  return playSound('game.resultKillers');
}

export function playExpelled() {
  return playSound('game.reveal');
}

export function playTick(isLast = false) {
  return playSound('ui.tick', { volume: isLast ? 1.2 : 0.9 });
}

import type { Role } from '@/lib/game/state';

export type AmbienceKey = 'ambience.lobby' | 'ambience.match';

export type UiSoundKey =
  | 'ui.click'
  | 'ui.select'
  | 'ui.confirm'
  | 'ui.joinRoom'
  | 'ui.screenChange'
  | 'ui.tick';

export type GameSoundKey =
  | 'game.start'
  | 'game.voteStart'
  | 'game.voteCast'
  | 'game.voteEnd'
  | 'game.accusation'
  | 'game.reveal'
  | 'game.error'
  | 'game.phaseTransition'
  | 'game.newsJingle'
  | 'game.death'
  | 'game.saved'
  | 'game.innocent'
  | 'game.resultTown'
  | 'game.resultKillers';

export type RoleSoundKey =
  | 'role.assassin'
  | 'role.doctor'
  | 'role.police'
  | 'role.town';

export type SoundKey = UiSoundKey | GameSoundKey | RoleSoundKey | AmbienceKey;

export interface AudioPreferences {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export interface AudioSnapshot extends AudioPreferences {
  ambienceKey: AmbienceKey | null;
  unlocked: boolean;
}

export interface SoundDefinition {
  category: 'ambience' | 'ui' | 'game' | 'role';
  channel: 'music' | 'sfx';
  cooldownMs?: number;
  defaultVolume: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  loop?: boolean;
  sources?: string[];
}

export interface PlaySoundOptions {
  bypassCooldown?: boolean;
  volume?: number;
}

export interface SetAmbienceOptions {
  fadeInMs?: number;
  fadeOutMs?: number;
  restart?: boolean;
}

export type RoleToSoundMap = Record<Role, RoleSoundKey>;

import type { AudioPreferences, RoleToSoundMap, SoundDefinition, SoundKey } from './types';

export const AUDIO_STORAGE_KEY = 'jp_audio_preferences_v1';

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  muted: false,
  masterVolume: 0.68,
  musicVolume: 0.46,
  sfxVolume: 0.78,
};

export const SOUND_CATALOG: Record<SoundKey, SoundDefinition> = {
  'ambience.lobby': {
    category: 'ambience',
    channel: 'music',
    defaultVolume: 0.18,
    fadeInMs: 1100,
    fadeOutMs: 450,
    loop: true,
    sources: ['/audio/ambience/lobby.mp3', '/Music/musica-fondo.mp3'],
  },
  'ambience.match': {
    category: 'ambience',
    channel: 'music',
    defaultVolume: 0.24,
    fadeInMs: 900,
    fadeOutMs: 450,
    loop: true,
    sources: ['/audio/ambience/match.mp3', '/Music/musica-fondo.mp3'],
  },

  'ui.click': {
    category: 'ui',
    channel: 'sfx',
    cooldownMs: 70,
    defaultVolume: 0.22,
    sources: ['/audio/ui/click.mp3'],
  },
  'ui.select': {
    category: 'ui',
    channel: 'sfx',
    cooldownMs: 90,
    defaultVolume: 0.25,
    sources: ['/audio/ui/select.mp3'],
  },
  'ui.confirm': {
    category: 'ui',
    channel: 'sfx',
    cooldownMs: 140,
    defaultVolume: 0.32,
    sources: ['/audio/ui/confirm.mp3'],
  },
  'ui.joinRoom': {
    category: 'ui',
    channel: 'sfx',
    cooldownMs: 280,
    defaultVolume: 0.34,
    sources: ['/audio/ui/join-room.mp3'],
  },
  'ui.screenChange': {
    category: 'ui',
    channel: 'sfx',
    cooldownMs: 220,
    defaultVolume: 0.24,
    sources: ['/audio/ui/screen-change.mp3'],
  },
  'ui.tick': {
    category: 'ui',
    channel: 'sfx',
    cooldownMs: 180,
    defaultVolume: 0.17,
    sources: ['/audio/ui/tick.mp3'],
  },

  'game.start': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 400,
    defaultVolume: 0.48,
    sources: ['/audio/game/start.mp3'],
  },
  'game.voteStart': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 400,
    defaultVolume: 0.38,
    sources: ['/audio/game/vote-start.mp3'],
  },
  'game.voteCast': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 200,
    defaultVolume: 0.34,
    sources: ['/audio/game/vote-cast.mp3'],
  },
  'game.voteEnd': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 400,
    defaultVolume: 0.42,
    sources: ['/audio/game/vote-end.mp3'],
  },
  'game.accusation': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 320,
    defaultVolume: 0.46,
    sources: ['/audio/game/accusation.mp3'],
  },
  'game.reveal': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 280,
    defaultVolume: 0.44,
    sources: ['/audio/game/reveal.mp3'],
  },
  'game.error': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 140,
    defaultVolume: 0.22,
    sources: ['/audio/game/error.mp3'],
  },
  'game.phaseTransition': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 220,
    defaultVolume: 0.3,
    sources: ['/audio/game/phase-transition.mp3'],
  },
  'game.newsJingle': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 800,
    defaultVolume: 0.55,
    sources: ['/audio/game/news-jingle.mp3', '/Music/noticias.mp3'],
  },
  'game.death': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 500,
    defaultVolume: 0.42,
    sources: ['/audio/game/death.mp3'],
  },
  'game.saved': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 500,
    defaultVolume: 0.34,
    sources: ['/audio/game/saved.mp3'],
  },
  'game.innocent': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 380,
    defaultVolume: 0.28,
    sources: ['/audio/game/innocent.mp3'],
  },
  'game.resultTown': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 600,
    defaultVolume: 0.5,
    sources: ['/audio/game/result-town.mp3'],
  },
  'game.resultKillers': {
    category: 'game',
    channel: 'sfx',
    cooldownMs: 600,
    defaultVolume: 0.5,
    sources: ['/audio/game/result-killers.mp3'],
  },

  'role.assassin': {
    category: 'role',
    channel: 'sfx',
    cooldownMs: 500,
    defaultVolume: 0.32,
    sources: ['/audio/roles/assassin.mp3'],
  },
  'role.doctor': {
    category: 'role',
    channel: 'sfx',
    cooldownMs: 500,
    defaultVolume: 0.28,
    sources: ['/audio/roles/doctor.mp3'],
  },
  'role.police': {
    category: 'role',
    channel: 'sfx',
    cooldownMs: 500,
    defaultVolume: 0.28,
    sources: ['/audio/roles/police.mp3'],
  },
  'role.town': {
    category: 'role',
    channel: 'sfx',
    cooldownMs: 500,
    defaultVolume: 0.22,
    sources: ['/audio/roles/town.mp3'],
  },
};

export const ROLE_SOUND_BY_ROLE: RoleToSoundMap = {
  killer: 'role.assassin',
  doctor: 'role.doctor',
  cop: 'role.police',
  town: 'role.town',
};

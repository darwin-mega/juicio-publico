// ============================================================
// lib/game/state.ts
// Define todos los tipos TypeScript del estado de partida
// y la función para crear el estado inicial.
// ============================================================

// --- Enums / Tipos base ---

export type GameMode = 'table' | 'individual';

export const ROLES = ['killer', 'doctor', 'cop', 'town'] as const;
export type Role = (typeof ROLES)[number];

export const PHASES = [
  'lobby',
  'operative',
  'news',
  'trial',
  'vote',
  'resolution',
] as const;
export type GamePhase = (typeof PHASES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  killer: 'Asesino',
  doctor: 'Doctor',
  cop: 'Policía',
  town: 'Pueblo',
};

export const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: 'Sala',
  operative: 'Operativo Encubierto',
  news: 'Noticias de Último Momento',
  trial: 'Juicio Público',
  vote: 'Votación',
  resolution: 'Resolución',
};

// --- Jugador ---

export interface Player {
  id: string;
  name: string;
  role: Role;
  isAlive: boolean;
  isRevealed: boolean; // se revela el rol al ser eliminado
}

// --- Acciones del operativo ---

export interface OperativeActions {
  killTargetId: string | null;   // acción de los asesinos
  saveTargetId: string | null;   // acción del doctor
  inspectTargetId: string | null; // acción de los policías
}

// --- Reporte de una ronda ---

export interface RoundReport {
  round: number;
  victim: string | null;       // nombre del jugador eliminado
  victimRole: Role | null;     // NUEVO: rol del jugador eliminado
  saved: boolean;              // ¿hubo salvamento?
  inspectedRole: Role | null;  // resultado de la investigación policial
  expelled: string | null;     // nombre del expulsado por votación
  expelledWasKiller: boolean | null;
}

// --- Configuración de la partida ---

export interface GameConfig {
  mode: GameMode;
  playerCount: number;
  killerCount: number;
  copCount: number; // NUEVO: Cantidad de policías
  trialDurationSeconds: number;
}

// --- Estado global de la partida ---

export interface GameState {
  config: GameConfig;
  players: Player[];
  phase: GamePhase;
  round: number;
  operativeActions: OperativeActions;
  votes: Record<string, string>; // voterId -> targetId
  reports: RoundReport[];
  fixedPassOrder: string[]; // NUEVO: IDs de jugadores en orden fijo
  winnerFaction: 'killers' | 'town' | null;
  isOver: boolean;
}

// --- Estado inicial ---

export function createInitialState(
  config: Partial<GameConfig> = {}
): GameState {
  const defaultConfig: GameConfig = {
    mode: 'table',
    playerCount: 6,
    killerCount: 1,
    copCount: 1,
    trialDurationSeconds: 120,
    ...config,
  };

  return {
    config: defaultConfig,
    players: [],
    phase: 'lobby',
    round: 0,
    operativeActions: {
      killTargetId: null,
      saveTargetId: null,
      inspectTargetId: null,
    },
    votes: {},
    reports: [],
    fixedPassOrder: [],
    winnerFaction: null,
    isOver: false,
  };
}

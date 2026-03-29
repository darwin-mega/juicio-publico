// ============================================================
// lib/game/phases.ts
// Orquestador de fases: define el orden y las transiciones.
// ============================================================

import { GamePhase, GameState } from './state';

// --- Orden de fases en cada ronda ---

export const PHASE_ORDER: GamePhase[] = [
  'operative',
  'news',
  'trial',
  'vote',
  'resolution',
];

// --- Duración del temporizador del juicio (segundos) ---
// Se usa desde GameConfig para ser configurable.
export const DEFAULT_TRIAL_DURATION = 120;

// --- Transición de fases ---

/**
 * Retorna la siguiente fase dentro de una ronda.
 * Si la fase actual es 'resolution', la siguiente es 'operative' (nueva ronda).
 */
export function getNextPhase(current: GamePhase): GamePhase {
  if (current === 'lobby') return 'operative';

  const index = PHASE_ORDER.indexOf(current);
  if (index === -1 || index === PHASE_ORDER.length - 1) return 'operative';
  return PHASE_ORDER[index + 1];
}

/**
 * Indica si al avanzar de fase debe incrementarse el número de ronda.
 */
export function isNewRoundTransition(current: GamePhase): boolean {
  return current === 'resolution';
}

/**
 * Retorna true si la fase actual permite que los jugadores actúen.
 */
export function isActionPhase(phase: GamePhase): boolean {
  return phase === 'operative' || phase === 'vote';
}

/**
 * Retorna true si la fase es de solo lectura (sin input de jugadores).
 */
export function isDisplayPhase(phase: GamePhase): boolean {
  return phase === 'news' || phase === 'resolution';
}

/**
 * Calcula cuántos jugadores de un determinado rol deben actuar en el operativo.
 * Útil para saber cuándo están completas las acciones (modo mesa).
 */
export function getOperativeSteps(state: GameState): {
  role: GameState['players'][number]['role'];
  label: string;
  done: boolean;
}[] {
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const hasKiller = alivePlayers.some((p) => p.role === 'killer');
  const hasDoctor = alivePlayers.some((p) => p.role === 'doctor');
  const hasCop = alivePlayers.some((p) => p.role === 'cop');

  return [
    {
      role: 'killer' as const,
      label: 'Asesinos',
      done: state.operativeActions.killTargetId !== null,
    },
    {
      role: 'doctor' as const,
      label: 'Doctor',
      done: state.operativeActions.saveTargetId !== null || !hasDoctor,
    },
    {
      role: 'cop' as const,
      label: 'Policía',
      done: state.operativeActions.inspectTargetId !== null || !hasCop,
    },
  ].filter((step) => {
    // Solo mostrar pasos para roles presentes en el juego
    if (step.role === 'killer') return hasKiller;
    if (step.role === 'doctor') return hasDoctor;
    if (step.role === 'cop') return hasCop;
    return false;
  });
}

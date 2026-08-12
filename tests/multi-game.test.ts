import { describe, expect, it } from 'vitest';
import {
  allActionsSubmitted,
  checkMultiWinCondition,
  createInitialGameState,
  deriveTeamOperativeSelection,
  generateRoomId,
  getNextMultiPhase,
  isTeamSelectionConfirmed,
  resolveMultiOperative,
  resolveMultiVote,
} from '@/lib/multi/gameLogic';
import type { MultiPlayer, PlayerSecret } from '@/lib/multi/types';

function multiPlayer(deviceId: string, name = deviceId): MultiPlayer {
  return {
    deviceId,
    name,
    joinedAt: 1,
    isAlive: true,
    isRevealed: false,
    readyForOperative: false,
  };
}

const players = ['k', 'd', 'c', 't'].map((id) => multiPlayer(id));
const secrets: Record<string, PlayerSecret> = {
  k: { deviceId: 'k', role: 'killer', teammateIds: [] },
  d: { deviceId: 'd', role: 'doctor', teammateIds: [] },
  c: { deviceId: 'c', role: 'cop', teammateIds: [] },
  t: { deviceId: 't', role: 'town', teammateIds: [] },
};

describe('Modo Multidispositivo: comportamiento existente', () => {
  it('empieza revelando roles y conserva el orden de fases', () => {
    const game = createInitialGameState(players);
    expect(game).toMatchObject({ phase: 'reveal', round: 1, isOver: false });
    expect(Object.keys(game.pendingActions)).toEqual(['k', 'd', 'c', 't']);
    expect(getNextMultiPhase('operative')).toBe('news');
    expect(getNextMultiPhase('news')).toBe('trial');
    expect(getNextMultiPhase('trial')).toBe('vote');
    expect(getNextMultiPhase('vote')).toBe('resolution');
    expect(getNextMultiPhase('resolution')).toBe('operative');
  });

  it('espera las acciones de todos los jugadores vivos', () => {
    const game = createInitialGameState(players);
    expect(allActionsSubmitted(game, players)).toBe(false);
    for (const id of Object.keys(game.pendingActions)) {
      game.pendingActions[id] = { type: 'neutral', targetId: null, submittedAt: 1 };
    }
    expect(allActionsSubmitted(game, players)).toBe(true);
  });

  it('resuelve el operativo igual que Modo Mesa', () => {
    const result = resolveMultiOperative(players, secrets, {
      k: { type: 'kill', targetId: 't', submittedAt: 1 },
      d: { type: 'save', targetId: 't', submittedAt: 1 },
      c: { type: 'inspect', targetId: 'k', submittedAt: 1 },
      t: { type: 'neutral', targetId: null, submittedAt: 1 },
    }, 1, 1);

    expect(result.report).toMatchObject({ saved: true, victim: null, inspectedRole: 'killer' });
    expect(result.updatedPlayers.find((p) => p.deviceId === 't')?.isAlive).toBe(true);
  });

  it('sincroniza una selección solo cuando todo el equipo confirma lo mismo', () => {
    const selection = deriveTeamOperativeSelection('killers', [
      { deviceId: 'k1', actionType: 'kill', targetPlayerId: 't', submittedAt: 10, round: 1 },
      { deviceId: 'k2', actionType: 'kill', targetPlayerId: 't', submittedAt: 11, round: 1 },
    ]);
    expect(selection?.confirmedBy).toEqual(['k1', 'k2']);
    expect(isTeamSelectionConfirmed(selection, ['k1', 'k2'])).toBe(true);
    expect(isTeamSelectionConfirmed(selection, ['k1', 'k2', 'k3'])).toBe(false);
  });

  it('mantiene empate, expulsión y victoria actuales', () => {
    const tie = resolveMultiVote(players, { k: 'd', d: 'k', c: 'd', t: 'k' }, secrets);
    expect(tie.expelled).toBeNull();

    const expelled = resolveMultiVote(players, { k: 't', d: 't', c: 't', t: 'k' }, secrets);
    expect(expelled.expelled).toBe('t');
    expect(expelled.expelledWasKiller).toBe(false);
    expect(checkMultiWinCondition([
      players[0],
      { ...players[1], isAlive: false },
      { ...players[2], isAlive: false },
      players[3],
    ], secrets, 1)).toBe('killers');
  });

  it('genera códigos de sala con el formato ya utilizado', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRoomId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

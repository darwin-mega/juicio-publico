import { describe, expect, it } from 'vitest';
import {
  buildPlayer,
  checkWinCondition,
  getRecommendedBalance,
  resolveOperative,
  resolveVote,
} from '@/lib/game/rules';
import { getNextPhase, isActionPhase, isDisplayPhase, isNewRoundTransition } from '@/lib/game/phases';
import type { Player } from '@/lib/game/state';

function player(id: string, name: string, role: Player['role']): Player {
  return { ...buildPlayer(id, name), role };
}

describe('Modo Mesa: comportamiento existente', () => {
  it('mantiene el orden actual de las fases', () => {
    expect(getNextPhase('lobby')).toBe('operative');
    expect(getNextPhase('operative')).toBe('news');
    expect(getNextPhase('news')).toBe('trial');
    expect(getNextPhase('trial')).toBe('vote');
    expect(getNextPhase('vote')).toBe('resolution');
    expect(getNextPhase('resolution')).toBe('operative');
    expect(isNewRoundTransition('resolution')).toBe(true);
    expect(isActionPhase('operative')).toBe(true);
    expect(isActionPhase('vote')).toBe(true);
    expect(isDisplayPhase('news')).toBe(true);
    expect(isDisplayPhase('resolution')).toBe(true);
  });

  it('el doctor salva al objetivo de los asesinos', () => {
    const players = [
      player('k', 'Killer', 'killer'),
      player('d', 'Doctor', 'doctor'),
      player('c', 'Policia', 'cop'),
      player('t', 'Pueblo', 'town'),
    ];

    const result = resolveOperative(players, {
      killTargetId: 't',
      saveTargetId: 't',
      inspectTargetId: 'k',
    }, 1);

    expect(result.report).toMatchObject({
      round: 1,
      victim: null,
      victimRole: null,
      saved: true,
      inspectedRole: 'killer',
    });
    expect(result.updatedPlayers.find((p) => p.id === 't')?.isAlive).toBe(true);
  });

  it('elimina y revela a una víctima no protegida', () => {
    const players = [
      player('k', 'Killer', 'killer'),
      player('d', 'Doctor', 'doctor'),
      player('c', 'Policia', 'cop'),
      player('t', 'Pueblo', 'town'),
    ];

    const result = resolveOperative(players, {
      killTargetId: 't',
      saveTargetId: 'd',
      inspectTargetId: 'k',
    }, 2);

    expect(result.report.victim).toBe('Pueblo');
    expect(result.report.victimRole).toBe('town');
    expect(result.updatedPlayers.find((p) => p.id === 't')).toMatchObject({
      isAlive: false,
      isRevealed: true,
    });
    expect(players.find((p) => p.id === 't')?.isAlive).toBe(true);
  });

  it('no expulsa a nadie cuando la votación termina empatada', () => {
    const players = [
      player('a', 'A', 'killer'),
      player('b', 'B', 'doctor'),
      player('c', 'C', 'cop'),
      player('d', 'D', 'town'),
    ];

    const result = resolveVote(players, { a: 'b', b: 'a', c: 'b', d: 'a' });
    expect(result.expelled).toBeNull();
    expect(result.updatedPlayers).toBe(players);
  });

  it('conserva las condiciones actuales de victoria', () => {
    expect(checkWinCondition([
      player('k', 'K', 'killer'),
      player('t', 'T', 'town'),
    ], 1)).toBe('killers');

    expect(checkWinCondition([
      { ...player('k', 'K', 'killer'), isAlive: false },
      player('t', 'T', 'town'),
    ], 1)).toBe('town');

    expect(checkWinCondition([
      player('k', 'K', 'killer'),
      player('t1', 'T1', 'town'),
      player('t2', 'T2', 'town'),
    ], 1)).toBe('killers');

    expect(checkWinCondition([
      player('k', 'K', 'killer'),
      player('d', 'D', 'doctor'),
      player('t1', 'T1', 'town'),
      player('t2', 'T2', 'town'),
    ], 1)).toBeNull();
  });

  it('conserva la tabla de balance de roles', () => {
    expect(getRecommendedBalance(4)).toEqual({ killers: 1, cops: 1, doctor: 1, town: 1, total: 4 });
    expect(getRecommendedBalance(8)).toEqual({ killers: 2, cops: 2, doctor: 1, town: 3, total: 8 });
    expect(getRecommendedBalance(12)).toEqual({ killers: 3, cops: 2, doctor: 1, town: 6, total: 12 });
    expect(getRecommendedBalance(20)).toEqual({ killers: 5, cops: 2, doctor: 1, town: 12, total: 20 });
  });
});

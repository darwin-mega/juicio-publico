import type { Role } from '@/lib/game/state';
import {
  PlayerProgressStats,
  ProgressEvent,
  ProgressGameResult,
  ProgressPlayerDelta,
} from './types';

export const PRESTIGE_POINTS = {
  playGame: 10,
  winGame: 20,
  surviveToEnd: 10,
  killerKill: 15,
  killerKilledCop: 20,
  killerKilledDoctor: 20,
  killerWin: 30,
  killerSurviveToEnd: 20,
  copCorrectInvestigation: 15,
  copCorrectAccusation: 15,
  copWin: 25,
  doctorCorrectSave: 20,
  doctorWin: 25,
  townCorrectKillerVote: 15,
  townWin: 20,
} as const;

export function createEmptyProgressStats(): PlayerProgressStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    survivedToEnd: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    winsByRole: { killer: 0, cop: 0, doctor: 0, town: 0 },
    publicPrestige: 0,
    killer: {
      kills: 0,
      wins: 0,
      killedCops: 0,
      killedDoctors: 0,
      survivedAsKiller: 0,
    },
    cop: {
      correctInvestigations: 0,
      correctAccusations: 0,
      wins: 0,
    },
    doctor: {
      correctSaves: 0,
      wins: 0,
    },
    town: {
      correctKillerVotes: 0,
      wins: 0,
    },
  };
}

function getWinnerRoleFaction(role: Role): 'killers' | 'town' {
  return role === 'killer' ? 'killers' : 'town';
}

function addPoints(delta: ProgressPlayerDelta, reason: string, points: number) {
  if (points <= 0) return;
  delta.prestigeDelta += points;
  delta.breakdown.push({ reason, points });
}

function ensureDelta(deltas: Map<string, ProgressPlayerDelta>, result: ProgressGameResult) {
  for (const player of result.players) {
    const won = getWinnerRoleFaction(player.role) === result.winnerFaction;
    const delta: ProgressPlayerDelta = {
      playerId: player.playerId,
      displayName: player.displayName,
      role: player.role,
      prestigeDelta: 0,
      won,
      survivedToEnd: player.isAliveAtEnd,
      breakdown: [],
      statIncrements: createEmptyProgressStats(),
    };

    delta.statIncrements.gamesPlayed = 1;
    addPoints(delta, 'Jugar una partida', PRESTIGE_POINTS.playGame);

    if (won) {
      delta.statIncrements.gamesWon = 1;
      delta.statIncrements.winsByRole = {
        killer: player.role === 'killer' ? 1 : 0,
        cop: player.role === 'cop' ? 1 : 0,
        doctor: player.role === 'doctor' ? 1 : 0,
        town: player.role === 'town' ? 1 : 0,
      };
      addPoints(delta, 'Ganar una partida', PRESTIGE_POINTS.winGame);

      if (player.role === 'killer') {
        delta.statIncrements.killer = { ...delta.statIncrements.killer!, wins: 1 };
        addPoints(delta, 'Ganar como asesino', PRESTIGE_POINTS.killerWin);
      } else if (player.role === 'cop') {
        delta.statIncrements.cop = { ...delta.statIncrements.cop!, wins: 1 };
        addPoints(delta, 'Ganar como policia', PRESTIGE_POINTS.copWin);
      } else if (player.role === 'doctor') {
        delta.statIncrements.doctor = { ...delta.statIncrements.doctor!, wins: 1 };
        addPoints(delta, 'Ganar como doctor', PRESTIGE_POINTS.doctorWin);
      } else {
        delta.statIncrements.town = { ...delta.statIncrements.town!, wins: 1 };
        addPoints(delta, 'Ganar como pueblo', PRESTIGE_POINTS.townWin);
      }
    }

    if (player.isAliveAtEnd) {
      delta.statIncrements.survivedToEnd = 1;
      addPoints(delta, 'Sobrevivir hasta el final', PRESTIGE_POINTS.surviveToEnd);

      if (player.role === 'killer') {
        delta.statIncrements.killer = { ...delta.statIncrements.killer!, survivedAsKiller: 1 };
        addPoints(delta, 'Sobrevivir como asesino', PRESTIGE_POINTS.killerSurviveToEnd);
      }
    }

    deltas.set(player.playerId, delta);
  }
}

function applyOperativeEvent(delta: ProgressPlayerDelta, event: ProgressEvent) {
  if (!event.success) return;

  if (event.actorRole === 'killer' && event.actionType === 'kill') {
    delta.statIncrements.killer = {
      ...delta.statIncrements.killer!,
      kills: (delta.statIncrements.killer?.kills ?? 0) + 1,
      killedCops: (delta.statIncrements.killer?.killedCops ?? 0) + (event.targetRole === 'cop' ? 1 : 0),
      killedDoctors: (delta.statIncrements.killer?.killedDoctors ?? 0) + (event.targetRole === 'doctor' ? 1 : 0),
    };
    addPoints(delta, 'Muerte lograda', PRESTIGE_POINTS.killerKill);
    if (event.targetRole === 'cop') addPoints(delta, 'Matar a un policia', PRESTIGE_POINTS.killerKilledCop);
    if (event.targetRole === 'doctor') addPoints(delta, 'Matar al doctor', PRESTIGE_POINTS.killerKilledDoctor);
  }

  if (event.actorRole === 'cop' && event.actionType === 'inspect') {
    delta.statIncrements.cop = {
      ...delta.statIncrements.cop!,
      correctInvestigations: (delta.statIncrements.cop?.correctInvestigations ?? 0) + 1,
    };
    addPoints(delta, 'Investigacion correcta', PRESTIGE_POINTS.copCorrectInvestigation);
  }

  if (event.actorRole === 'doctor' && event.actionType === 'save') {
    delta.statIncrements.doctor = {
      ...delta.statIncrements.doctor!,
      correctSaves: (delta.statIncrements.doctor?.correctSaves ?? 0) + 1,
    };
    addPoints(delta, 'Salvada correcta', PRESTIGE_POINTS.doctorCorrectSave);
  }
}

function applyVoteEvent(delta: ProgressPlayerDelta, event: ProgressEvent) {
  if (!event.success || event.targetRole !== 'killer') return;

  if (event.actorRole === 'cop') {
    delta.statIncrements.cop = {
      ...delta.statIncrements.cop!,
      correctAccusations: (delta.statIncrements.cop?.correctAccusations ?? 0) + 1,
    };
    addPoints(delta, 'Acusacion correcta', PRESTIGE_POINTS.copCorrectAccusation);
  }

  if (event.actorRole === 'town') {
    delta.statIncrements.town = {
      ...delta.statIncrements.town!,
      correctKillerVotes: (delta.statIncrements.town?.correctKillerVotes ?? 0) + 1,
    };
    addPoints(delta, 'Voto correcto a un asesino', PRESTIGE_POINTS.townCorrectKillerVote);
  }
}

export function calculateProgressDeltas(result: ProgressGameResult): ProgressPlayerDelta[] {
  const deltas = new Map<string, ProgressPlayerDelta>();
  ensureDelta(deltas, result);

  for (const event of result.events) {
    const delta = deltas.get(event.actorId);
    if (!delta) continue;

    if (event.type === 'operative_action') {
      applyOperativeEvent(delta, event);
    } else {
      applyVoteEvent(delta, event);
    }
  }

  return Array.from(deltas.values()).map((delta) => ({
    ...delta,
    statIncrements: {
      ...delta.statIncrements,
      publicPrestige: delta.prestigeDelta,
    },
  }));
}

export function mergeStats(base: PlayerProgressStats, increment: Partial<PlayerProgressStats>, won: boolean): PlayerProgressStats {
  const currentWinStreak = won ? base.currentWinStreak + 1 : 0;

  return {
    gamesPlayed: base.gamesPlayed + (increment.gamesPlayed ?? 0),
    gamesWon: base.gamesWon + (increment.gamesWon ?? 0),
    survivedToEnd: base.survivedToEnd + (increment.survivedToEnd ?? 0),
    currentWinStreak,
    bestWinStreak: Math.max(base.bestWinStreak, currentWinStreak),
    winsByRole: {
      killer: base.winsByRole.killer + (increment.winsByRole?.killer ?? 0),
      cop: base.winsByRole.cop + (increment.winsByRole?.cop ?? 0),
      doctor: base.winsByRole.doctor + (increment.winsByRole?.doctor ?? 0),
      town: base.winsByRole.town + (increment.winsByRole?.town ?? 0),
    },
    publicPrestige: base.publicPrestige + (increment.publicPrestige ?? 0),
    killer: {
      kills: base.killer.kills + (increment.killer?.kills ?? 0),
      wins: base.killer.wins + (increment.killer?.wins ?? 0),
      killedCops: base.killer.killedCops + (increment.killer?.killedCops ?? 0),
      killedDoctors: base.killer.killedDoctors + (increment.killer?.killedDoctors ?? 0),
      survivedAsKiller: base.killer.survivedAsKiller + (increment.killer?.survivedAsKiller ?? 0),
    },
    cop: {
      correctInvestigations: base.cop.correctInvestigations + (increment.cop?.correctInvestigations ?? 0),
      correctAccusations: base.cop.correctAccusations + (increment.cop?.correctAccusations ?? 0),
      wins: base.cop.wins + (increment.cop?.wins ?? 0),
    },
    doctor: {
      correctSaves: base.doctor.correctSaves + (increment.doctor?.correctSaves ?? 0),
      wins: base.doctor.wins + (increment.doctor?.wins ?? 0),
    },
    town: {
      correctKillerVotes: base.town.correctKillerVotes + (increment.town?.correctKillerVotes ?? 0),
      wins: base.town.wins + (increment.town?.wins ?? 0),
    },
  };
}


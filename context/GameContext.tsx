'use client';

// ============================================================
// context/GameContext.tsx
// Provider global del estado de la partida usando useReducer.
// Persistencia básica en localStorage para sobrevivir recargas.
// Todas las pantallas consumen este contexto con useGame().
// ============================================================

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import {
  GameState,
  GameConfig,
  GamePhase,
  Player,
  createInitialState,
} from '@/lib/game/state';
import {
  assignRoles,
  resolveOperative,
  resolveVote,
  checkWinCondition,
  buildPlayer,
  generateFixedPassOrder,
} from '@/lib/game/rules';
import { getNextPhase } from '@/lib/game/phases';


const STORAGE_KEY = 'juicio-publico-state';

// --- Acciones del reducer ---

export type GameAction =
  | { type: 'CONFIGURE_GAME'; config: Partial<GameConfig> }
  | { type: 'SET_PLAYERS'; names: string[] }
  | { type: 'START_GAME' }
  | { type: 'SET_KILL_TARGET'; targetId: string }
  | { type: 'SET_SAVE_TARGET'; targetId: string }
  | { type: 'SET_INSPECT_TARGET'; targetId: string }
  | { type: 'NEXT_PHASE' }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  | { type: 'RESET' }
  | { type: 'LOAD_SAVED'; state: GameState };

// --- Reducer ---

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'LOAD_SAVED':
      return action.state;

    case 'CONFIGURE_GAME':
      return {
        ...state,
        config: { ...state.config, ...action.config },
      };

    case 'SET_PLAYERS': {
      const players: Player[] = action.names.map((name, i) =>
        buildPlayer(`player-${i}`, name)
      );
      return { ...state, players };
    }

    case 'START_GAME': {
      const players = assignRoles(state.players, state.config);
      const fixedPassOrder = generateFixedPassOrder(players);
      return {
        ...state,
        players,
        fixedPassOrder,
        phase: 'operative',
        round: 1,
        operativeActions: { killTargetId: null, saveTargetId: null, inspectTargetId: null },
        votes: {},
        reports: [],
        winnerFaction: null,
        isOver: false,
      };
    }

    case 'SET_KILL_TARGET':
      return {
        ...state,
        operativeActions: { ...state.operativeActions, killTargetId: action.targetId },
      };

    case 'SET_SAVE_TARGET':
      return {
        ...state,
        operativeActions: { ...state.operativeActions, saveTargetId: action.targetId },
      };

    case 'SET_INSPECT_TARGET':
      return {
        ...state,
        operativeActions: { ...state.operativeActions, inspectTargetId: action.targetId },
      };

    case 'CAST_VOTE':
      return {
        ...state,
        votes: { ...state.votes, [action.voterId]: action.targetId },
      };

    case 'NEXT_PHASE': {
      const current = state.phase;

      // Al salir de operative: resolver las acciones y generar reporte
      if (current === 'operative') {
        const { updatedPlayers, report } = resolveOperative(
          state.players,
          state.operativeActions,
          state.round
        );
        // Verificar condición de victoria tras muerte nocturna
        const winnerAfterNight = checkWinCondition(updatedPlayers, state.config.killerCount);
        return {
          ...state,
          players: updatedPlayers,
          phase: 'news',
          reports: [...state.reports, report],
          operativeActions: { killTargetId: null, saveTargetId: null, inspectTargetId: null },
          winnerFaction: winnerAfterNight,
          isOver: winnerAfterNight !== null,
        };
      }

      // Al salir de news → trial
      if (current === 'news') {
        if (state.isOver) return state; // partida terminada
        return { ...state, phase: 'trial' };
      }

      // Al salir de trial → vote
      if (current === 'trial') {
        return { ...state, phase: 'vote' };
      }

      // Al salir de vote: resolver la votación
      if (current === 'vote') {
        const { updatedPlayers, expelled, expelledWasKiller } = resolveVote(
          state.players,
          state.votes
        );
        const lastReport = state.reports[state.reports.length - 1];
        const updatedReport = lastReport
          ? { ...lastReport, expelled, expelledWasKiller }
          : null;
        const reports = updatedReport
          ? [...state.reports.slice(0, -1), updatedReport]
          : state.reports;

        const winner = checkWinCondition(updatedPlayers, state.config.killerCount);

        return {
          ...state,
          players: updatedPlayers,
          phase: 'resolution',
          reports,
          votes: {},
          winnerFaction: winner,
          isOver: winner !== null,
        };
      }

      // Al salir de resolution: nueva ronda
      if (current === 'resolution') {
        if (state.isOver) return state; // no avanzar si hay ganador
        return {
          ...state,
          phase: 'operative',
          round: state.round + 1,
          operativeActions: { killTargetId: null, saveTargetId: null, inspectTargetId: null },
          votes: {},
        };
      }

      // Transición simple (lobby → operative, etc.)
      return { ...state, phase: getNextPhase(current) };
    }

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

// --- Contexto ---

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  clearSave: () => void;
  hasSave: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

// --- Provider con persistencia ---

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [hasSave, setHasSave] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  // Hidratar desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as GameState;
        // Solo cargar si hay una partida real en curso
        if (saved.players.length > 0 && saved.phase !== 'lobby') {
          dispatch({ type: 'LOAD_SAVED', state: saved });
          setHasSave(true);
        }
      }
    } catch {
      // Estado corrupto: ignorar
    }
    setHydrated(true);
  }, []);

  // Guardar en localStorage cada vez que cambia el estado
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (state.players.length > 0 && state.phase !== 'lobby') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setHasSave(true);
      } else if (state.phase === 'lobby' && state.players.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        setHasSave(false);
      }
    } catch {
      // Quota exceeded u otro error: ignorar
    }
  }, [state, hydrated]);

  function clearSave() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('juicio-player-id');
    setHasSave(false);
    dispatch({ type: 'RESET' });
  }

  return (
    <GameContext.Provider value={{ state, dispatch, clearSave, hasSave }}>
      {children}
    </GameContext.Provider>
  );
}

// --- Hook de consumo ---

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame debe usarse dentro de <GameProvider>');
  return ctx;
}

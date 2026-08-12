import type { PlayerProgressStats, ProgressMetricPath, ProgressTitleDefinition } from './types';

export const PROGRESSION_THRESHOLDS = [10, 25, 50, 100, 250, 500] as const;

export const PROGRESS_TITLES: ProgressTitleDefinition[] = [
  { id: 'killer_10', group: 'killer', metric: 'killer.kills', threshold: 10, title: 'Operador Sombra' },
  { id: 'killer_25', group: 'killer', metric: 'killer.kills', threshold: 25, title: 'Verdugo Silencioso' },
  { id: 'killer_50', group: 'killer', metric: 'killer.kills', threshold: 50, title: 'Sospecha Cero' },
  { id: 'killer_100', group: 'killer', metric: 'killer.kills', threshold: 100, title: 'Asesino Serial' },
  { id: 'killer_250', group: 'killer', metric: 'killer.kills', threshold: 250, title: 'Fantasma PÃºblico' },
  { id: 'killer_500', group: 'killer', metric: 'killer.kills', threshold: 500, title: 'Arquitecto del Caos' },

  { id: 'cop_10', group: 'cop', metric: 'cop.correctInvestigations', threshold: 10, title: 'Rastreador' },
  { id: 'cop_25', group: 'cop', metric: 'cop.correctInvestigations', threshold: 25, title: 'Sabueso Judicial' },
  { id: 'cop_50', group: 'cop', metric: 'cop.correctInvestigations', threshold: 50, title: 'Gran Detective' },
  { id: 'cop_100', group: 'cop', metric: 'cop.correctInvestigations', threshold: 100, title: 'Fiscal de Hierro' },
  { id: 'cop_250', group: 'cop', metric: 'cop.correctInvestigations', threshold: 250, title: 'Ojo Implacable' },
  { id: 'cop_500', group: 'cop', metric: 'cop.correctInvestigations', threshold: 500, title: 'Cazador de Sombras' },

  { id: 'doctor_10', group: 'doctor', metric: 'doctor.correctSaves', threshold: 10, title: 'Primer Respondiente' },
  { id: 'doctor_25', group: 'doctor', metric: 'doctor.correctSaves', threshold: 25, title: 'Protector de Guardia' },
  { id: 'doctor_50', group: 'doctor', metric: 'doctor.correctSaves', threshold: 50, title: 'Doctor de Hierro' },
  { id: 'doctor_100', group: 'doctor', metric: 'doctor.correctSaves', threshold: 100, title: 'Doctor Grado 5' },
  { id: 'doctor_250', group: 'doctor', metric: 'doctor.correctSaves', threshold: 250, title: 'Ãngel de Guardia' },
  { id: 'doctor_500', group: 'doctor', metric: 'doctor.correctSaves', threshold: 500, title: 'Milagro PÃºblico' },

  { id: 'town_10', group: 'town', metric: 'town.correctKillerVotes', threshold: 10, title: 'Testigo Clave' },
  { id: 'town_25', group: 'town', metric: 'town.correctKillerVotes', threshold: 25, title: 'Voz del Pueblo' },
  { id: 'town_50', group: 'town', metric: 'town.correctKillerVotes', threshold: 50, title: 'Ciudadano Ejemplar' },
  { id: 'town_100', group: 'town', metric: 'town.correctKillerVotes', threshold: 100, title: 'Jurado de Acero' },
  { id: 'town_250', group: 'town', metric: 'town.correctKillerVotes', threshold: 250, title: 'Veredicto Vivo' },
  { id: 'town_500', group: 'town', metric: 'town.correctKillerVotes', threshold: 500, title: 'Tribunal Popular' },

  { id: 'games_10', group: 'general_games', metric: 'gamesPlayed', threshold: 10, title: 'Primer Caso' },
  { id: 'games_25', group: 'general_games', metric: 'gamesPlayed', threshold: 25, title: 'Habitual del Juicio' },
  { id: 'games_50', group: 'general_games', metric: 'gamesPlayed', threshold: 50, title: 'Operador PÃºblico' },
  { id: 'games_100', group: 'general_games', metric: 'gamesPlayed', threshold: 100, title: 'Figura del Caso' },
  { id: 'games_250', group: 'general_games', metric: 'gamesPlayed', threshold: 250, title: 'Maestro del Veredicto' },
  { id: 'games_500', group: 'general_games', metric: 'gamesPlayed', threshold: 500, title: 'Leyenda PÃºblica' },

  { id: 'wins_10', group: 'general_wins', metric: 'gamesWon', threshold: 10, title: 'Competidor Serio' },
  { id: 'wins_25', group: 'general_wins', metric: 'gamesWon', threshold: 25, title: 'Estratega PÃºblico' },
  { id: 'wins_50', group: 'general_wins', metric: 'gamesWon', threshold: 50, title: 'Veredicto Firme' },
  { id: 'wins_100', group: 'general_wins', metric: 'gamesWon', threshold: 100, title: 'Imparable' },
  { id: 'wins_250', group: 'general_wins', metric: 'gamesWon', threshold: 250, title: 'Dominio Total' },

  { id: 'survival_10', group: 'general_survival', metric: 'survivedToEnd', threshold: 10, title: 'Superviviente' },
  { id: 'survival_25', group: 'general_survival', metric: 'survivedToEnd', threshold: 25, title: 'Piel Dura' },
  { id: 'survival_50', group: 'general_survival', metric: 'survivedToEnd', threshold: 50, title: 'Intocable' },
  { id: 'survival_100', group: 'general_survival', metric: 'survivedToEnd', threshold: 100, title: 'Ãšltimo en Pie' },
  { id: 'survival_250', group: 'general_survival', metric: 'survivedToEnd', threshold: 250, title: 'Inquebrantable' },
];

export function getMetricValue(stats: PlayerProgressStats, metric: ProgressMetricPath): number {
  switch (metric) {
    case 'gamesPlayed': return stats.gamesPlayed;
    case 'gamesWon': return stats.gamesWon;
    case 'survivedToEnd': return stats.survivedToEnd;
    case 'killer.kills': return stats.killer.kills;
    case 'cop.correctInvestigations': return stats.cop.correctInvestigations;
    case 'doctor.correctSaves': return stats.doctor.correctSaves;
    case 'town.correctKillerVotes': return stats.town.correctKillerVotes;
  }
}

export function getUnlockedTitles(stats: PlayerProgressStats): ProgressTitleDefinition[] {
  return PROGRESS_TITLES.filter((definition) =>
    getMetricValue(stats, definition.metric) >= definition.threshold
  );
}

export function getTitleById(id: string | null | undefined): ProgressTitleDefinition | null {
  if (!id) return null;
  return PROGRESS_TITLES.find((definition) => definition.id === id) ?? null;
}

export function chooseHighlightedTitle(stats: PlayerProgressStats): string | null {
  const unlocked = getUnlockedTitles(stats);
  if (unlocked.length === 0) return null;

  const groupWeight: Record<ProgressTitleDefinition['group'], number> = {
    killer: 7,
    cop: 7,
    doctor: 7,
    town: 7,
    general_wins: 6,
    general_survival: 5,
    general_games: 4,
  };

  return [...unlocked].sort((a, b) => {
    if (b.threshold !== a.threshold) return b.threshold - a.threshold;
    return groupWeight[b.group] - groupWeight[a.group];
  })[0].id;
}

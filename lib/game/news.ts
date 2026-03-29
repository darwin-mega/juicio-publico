// ============================================================
// lib/game/news.ts
// Helpers puros para derivar el reporte narrativo de la ronda
// a partir del RoundReport ya resuelto por el operativo.
// Tono dramático y útil para la dinámica del juego.
// ============================================================

import { RoundReport, ROLE_LABELS, Role } from './state';

export type NewsEventType = 'death' | 'saved' | 'calm' | 'cop_success' | 'cop_fail';

export interface NewsEvent {
  type: NewsEventType;
  headline: string;
  detail: string;
  victimName: string | null;
  victimRole: Role | null;
  cop: {
    investigated: boolean;
    isKiller: boolean;
    message: string;
  } | null;
}

/**
 * Deriva el evento principal de la ronda a partir del RoundReport.
 * El tono es dramático, narrativo y útil para el juego.
 */
export function deriveNewsEvent(report: RoundReport): NewsEvent {
  let mainEvent: Omit<NewsEvent, 'cop'>;

  // 1. Evento de muerte / salvamento / calma
  if (report.victim !== null && !report.saved) {
    const rolLabel = report.victimRole ? ROLE_LABELS[report.victimRole] : 'ciudadano';
    mainEvent = {
      type: 'death',
      headline: `¡Último momento: se confirmó una muerte!`,
      detail: `Lamentablemente, ${report.victim} fue encontrado sin vida. Se confirmó que era ${rolLabel}.`,
      victimName: report.victim,
      victimRole: report.victimRole,
    };
  } else if (report.saved) {
    mainEvent = {
      type: 'saved',
      headline: 'Hubo un intento de asesinato, pero la víctima sobrevivió.',
      detail:
        'Esta noche se registró un ataque mortal, pero la intervención a tiempo evitó lo peor. Alguien en la ciudad sigue vivo gracias a eso.',
      victimName: null,
      victimRole: null,
    };
  } else {
    mainEvent = {
      type: 'calm',
      headline: 'No se registraron víctimas esta noche.',
      detail:
        'La ciudad amaneció en calma. Sin muertes, sin ataques visibles. Aunque eso no significa que los asesinos hayan descansado.',
      victimName: null,
      victimRole: null,
    };
  }

  // 2. Información policial (si hubo investigación)
  let cop: NewsEvent['cop'] = null;
  if (report.inspectedRole !== null) {
    const isKiller = report.inspectedRole === 'killer';
    cop = {
      investigated: true,
      isKiller,
      message: isKiller
        ? 'La policía tiene un sospechoso. La acusación es CORRECTA.'
        : 'La policía tiene un sospechoso. La acusación es INCORRECTA.',
    };
  }

  return { ...mainEvent, cop };
}

export const NEWS_ICONS: Record<NewsEventType, string> = {
  death:       '💀',
  saved:       '🛡️',
  calm:        '🌙',
  cop_success: '🔍',
  cop_fail:    '🚫',
};

export const NEWS_COLORS: Record<NewsEventType, string> = {
  death:       'var(--danger)',
  saved:       'var(--success)',
  calm:        'var(--accent)',
  cop_success: 'var(--role-cop)',
  cop_fail:    'var(--text-muted)',
};

import { describe, expect, it } from 'vitest';
import {
  buildAccusationAnnouncement,
  buildDeathAnnouncement,
  buildGameOutcomeAnnouncement,
  buildResolutionAnnouncement,
  buildSavedAnnouncement,
  estimateSpeechDurationMs,
  normalizeSpokenName,
} from '@/lib/audio/speech';

describe('anuncios de voz', () => {
  it('anuncia el nombre de la victima', () => {
    expect(buildDeathAnnouncement('Pepito')).toBe('Hubo una muerte. El asesinado fue Pepito.');
  });

  it('anuncia un intento de asesinato frustrado', () => {
    expect(buildSavedAnnouncement()).toBe('Hubo un intento de asesinato, pero la víctima fue salvada.');
  });

  it('distingue una acusacion correcta de una incorrecta', () => {
    expect(buildAccusationAnnouncement('Pepito', true)).toBe(
      'La acusación fue correcta. Pepito era uno de los asesinos.',
    );
    expect(buildAccusationAnnouncement('Ana', false)).toBe(
      'La acusación fue incorrecta. Ana era inocente.',
    );
  });

  it('anuncia el ganador al terminar la partida', () => {
    expect(buildGameOutcomeAnnouncement('town')).toBe('El pueblo gana. Felicitaciones.');
    expect(buildGameOutcomeAnnouncement('killers')).toBe(
      'El pueblo cae en manos de los asesinos, quienes ganaron.',
    );
  });

  it('combina el veredicto con el cierre final', () => {
    expect(buildResolutionAnnouncement('Ana', true, 'town')).toBe(
      'La acusación fue correcta. Ana era uno de los asesinos. El pueblo gana. Felicitaciones.',
    );
    expect(buildResolutionAnnouncement(null, null, 'killers')).toBe(
      'El pueblo cae en manos de los asesinos, quienes ganaron.',
    );
  });

  it('normaliza nombres antes de pronunciarlos', () => {
    expect(normalizeSpokenName('  Ana\n\tMaria  ')).toBe('Ana Maria');
    expect(normalizeSpokenName('   ')).toBe('una persona');
  });

  it('limita el temporizador de respaldo', () => {
    expect(estimateSpeechDurationMs('Hola', 1)).toBeGreaterThanOrEqual(2_500);
    expect(estimateSpeechDurationMs('palabra '.repeat(500), 0.5)).toBeLessThanOrEqual(10_000);
  });
});

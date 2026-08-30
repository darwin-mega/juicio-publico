import { describe, expect, it } from 'vitest';
import {
  buildDeathAnnouncement,
  estimateSpeechDurationMs,
  normalizeSpokenName,
} from '@/lib/audio/speech';

describe('anuncios de voz', () => {
  it('anuncia el nombre de la victima', () => {
    expect(buildDeathAnnouncement('Pepito')).toBe('Hubo una muerte. El asesinado fue Pepito.');
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

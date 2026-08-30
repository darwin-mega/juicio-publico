const FALLBACK_NAME = 'una persona';

export function normalizeSpokenName(name: string) {
  const normalized = name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  return normalized || FALLBACK_NAME;
}

export function buildDeathAnnouncement(name: string) {
  return `Hubo una muerte. El asesinado fue ${normalizeSpokenName(name)}.`;
}

export function buildSavedAnnouncement() {
  return 'Hubo un intento de asesinato, pero la víctima fue salvada.';
}

export function buildAccusationAnnouncement(name: string, wasKiller: boolean) {
  const accusedName = normalizeSpokenName(name);
  return wasKiller
    ? `La acusación fue correcta. ${accusedName} era uno de los asesinos.`
    : `La acusación fue incorrecta. ${accusedName} era inocente.`;
}

export function selectSpanishVoice(voices: SpeechSynthesisVoice[]) {
  const preferredLocales = ['es-UY', 'es-AR', 'es-419', 'es-ES', 'es-MX'];

  for (const locale of preferredLocales) {
    const voice = voices.find((candidate) => candidate.lang.toLowerCase() === locale.toLowerCase());
    if (voice) return voice;
  }

  return voices.find((voice) => voice.lang.toLowerCase().startsWith('es')) ?? null;
}

export function estimateSpeechDurationMs(text: string, rate: number) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 155 * Math.max(0.5, Math.min(2, rate));
  return Math.max(2_500, Math.min(10_000, (words / wordsPerMinute) * 60_000 + 1_500));
}

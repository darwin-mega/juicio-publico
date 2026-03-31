'use client';

import { useSyncExternalStore } from 'react';
import { audioManager } from './manager';

export function useAudioState() {
  return useSyncExternalStore(audioManager.subscribe, audioManager.getSnapshot, audioManager.getSnapshot);
}

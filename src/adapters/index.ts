import { isTauri } from '@tauri-apps/api/core';
import type { Storage } from '../core/ports';
import { tauriStorage } from './tauriStorage';
import { webStorage } from './webStorage';

/** Único punto donde se decide la plataforma. El resto de la app solo conoce el puerto Storage. */
export function createStorage(): Storage {
  return isTauri() ? tauriStorage : webStorage;
}

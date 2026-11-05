import type { TaskyData } from '../core/model';
import type { Storage } from '../core/ports';

const KEY = 'tasky:data';

/** Almacenamiento en el navegador (desarrollo). En la Fase 8 (PWA) se sustituirá por IndexedDB. */
export const webStorage: Storage = {
  async load() {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : JSON.parse(raw);
  },

  async save(data: TaskyData) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};

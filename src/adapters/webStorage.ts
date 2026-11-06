import type { TaskyData } from '../core/model';
import type { Storage } from '../core/ports';

const DB_NAME = 'tasky';
const STORE = 'documents';
const DOC_KEY = 'data';
/** Clave usada antes de la Fase 8; sus datos se migran a IndexedDB una sola vez. */
const LEGACY_KEY = 'tasky:data';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = op(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error ?? request.error);
      }),
  );
}

/**
 * Navegador y PWA: el mismo documento JSON que en escritorio, guardado en IndexedDB
 * (más capacidad y persistencia que localStorage; cada escritura es una transacción).
 */
export const webStorage: Storage = {
  async load() {
    // Pide al navegador que no borre los datos por falta de espacio o inactividad (si lo admite).
    void navigator.storage?.persist?.().catch(() => undefined);
    const stored = await run('readonly', (s) => s.get(DOC_KEY));
    if (stored !== undefined) return stored;
    const legacy = localStorage.getItem(LEGACY_KEY);
    return legacy === null ? null : JSON.parse(legacy);
  },

  async save(data: TaskyData) {
    await run('readwrite', (s) => s.put(data, DOC_KEY));
    localStorage.removeItem(LEGACY_KEY);
  },
};

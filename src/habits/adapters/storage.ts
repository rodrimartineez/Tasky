import { isTauri } from '@tauri-apps/api/core';
import { BaseDirectory, exists, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { HabitsData } from '../core/model';
import type { HabitsStorage } from '../core/ports';

/** Escritorio: %APPDATA%\com.tasky.app\habits.json, junto a tasky.json pero independiente. Escritura atómica. */
const FILE = 'habits.json';
const TMP = 'habits.json.tmp';
const inAppData = { baseDir: BaseDirectory.AppData };

const tauriHabitsStorage: HabitsStorage = {
  async load() {
    // La carpeta ya la crea el almacenamiento de Proyectos al arrancar.
    if (!(await exists(FILE, inAppData))) return null;
    return JSON.parse(await readTextFile(FILE, inAppData));
  },
  async save(data: HabitsData) {
    await writeTextFile(TMP, JSON.stringify(data), inAppData);
    await rename(TMP, FILE, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  },
};

/** Navegador y PWA: base de IndexedDB propia ("tasky-habits"), sin tocar la de Proyectos. */
const DB_NAME = 'tasky-habits';
const STORE = 'documents';
const DOC_KEY = 'data';
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

const webHabitsStorage: HabitsStorage = {
  async load() {
    const stored = await run('readonly', (s) => s.get(DOC_KEY));
    return stored === undefined ? null : stored;
  },
  async save(data: HabitsData) {
    await run('readwrite', (s) => s.put(data, DOC_KEY));
  },
};

export const createHabitsStorage = (): HabitsStorage => (isTauri() ? tauriHabitsStorage : webHabitsStorage);

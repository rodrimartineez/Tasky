import { appDataDir } from '@tauri-apps/api/path';
import {
  BaseDirectory,
  copyFile,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { today } from '../core/clock';
import type { TaskyData } from '../core/model';
import type { Backup, Storage } from '../core/ports';

const FILE = 'tasky.json';
const TMP = 'tasky.json.tmp';
const BACKUPS = 'backups';
const DAILY = /^tasky-(\d{4}-\d{2}-\d{2})\.json$/;
const KEEP_DAILY = 14;
const inAppData = { baseDir: BaseDirectory.AppData };
const appDataToAppData = { fromPathBaseDir: BaseDirectory.AppData, toPathBaseDir: BaseDirectory.AppData };

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Copia diaria: antes del primer guardado de cada día se copia el archivo tal y como estaba,
 * así siempre hay una versión de «antes de hoy». Se conservan las últimas 14.
 */
async function dailyBackup() {
  const target = `${BACKUPS}/tasky-${today()}.json`;
  if (!(await exists(FILE, inAppData)) || (await exists(target, inAppData))) return;
  await copyFile(FILE, target, appDataToAppData);
  const daily = (await readDir(BACKUPS, inAppData)).map((e) => e.name).filter((n) => DAILY.test(n)).sort().reverse();
  for (const old of daily.slice(KEEP_DAILY)) await remove(`${BACKUPS}/${old}`, inAppData);
}

/** Documento JSON en %APPDATA%\com.tasky.app\tasky.json con escritura atómica y copias automáticas. */
export const tauriStorage: Storage = {
  async load() {
    await mkdir(`${await appDataDir()}/${BACKUPS}`, { recursive: true });
    if (!(await exists(FILE, inAppData))) return null;
    return JSON.parse(await readTextFile(FILE, inAppData));
  },

  async save(data: TaskyData) {
    try {
      await dailyBackup();
    } catch (e) {
      console.error('No se pudo crear la copia diaria', e); // nunca impide guardar
    }
    // Se escribe a un temporal y se renombra: un corte nunca deja el archivo a medias.
    await writeTextFile(TMP, JSON.stringify(data, null, 2), inAppData);
    await rename(TMP, FILE, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  },

  async listBackups() {
    const names = (await readDir(BACKUPS, inAppData)).map((e) => e.name).filter((n) => n.endsWith('.json'));
    const backups: Backup[] = [];
    for (const name of names) {
      const date = DAILY.exec(name)?.[1] ?? name.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
      try {
        backups.push({ name, date, raw: JSON.parse(await readTextFile(`${BACKUPS}/${name}`, inAppData)) });
      } catch {
        // Una copia ilegible simplemente no se ofrece.
      }
    }
    return backups.sort((a, b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name));
  },

  async snapshot(label: string) {
    if (await exists(FILE, inAppData)) await copyFile(FILE, `${BACKUPS}/tasky-${label}-${stamp()}.json`, appDataToAppData);
  },

  async quarantine() {
    if (await exists(FILE, inAppData)) {
      await rename(FILE, `tasky.ilegible-${stamp()}.json`, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
    }
  },
};

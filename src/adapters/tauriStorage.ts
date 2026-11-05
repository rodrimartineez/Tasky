import { appDataDir } from '@tauri-apps/api/path';
import { BaseDirectory, exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { TaskyData } from '../core/model';
import type { Storage } from '../core/ports';

const FILE = 'tasky.json';
const TMP = 'tasky.json.tmp';
const inAppData = { baseDir: BaseDirectory.AppData };

/** Documento JSON en %APPDATA%\com.tasky.app\tasky.json con escritura atómica. */
export const tauriStorage: Storage = {
  async load() {
    await mkdir(await appDataDir(), { recursive: true });
    if (!(await exists(FILE, inAppData))) return null;
    return JSON.parse(await readTextFile(FILE, inAppData));
  },

  async save(data: TaskyData) {
    // Se escribe a un temporal y se renombra: un corte nunca deja el archivo a medias.
    await writeTextFile(TMP, JSON.stringify(data, null, 2), inAppData);
    await rename(TMP, FILE, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  },
};

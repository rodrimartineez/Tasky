import { isTauri } from '@tauri-apps/api/core';
import { BaseDirectory, writeTextFile } from '@tauri-apps/plugin-fs';
import type { FileExport, Storage } from '../core/ports';
import { tauriStorage } from './tauriStorage';
import { webStorage } from './webStorage';

export interface Platform {
  storage: Storage;
  fileExport: FileExport;
}

/** Escritorio: el archivo se guarda directamente en la carpeta Descargas. */
const tauriExport: FileExport = {
  async exportText(fileName, text) {
    await writeTextFile(fileName, text, { baseDir: BaseDirectory.Download });
    return `Descargas\\${fileName}`;
  },
};

/** Navegador: descarga normal. */
const webExport: FileExport = {
  async exportText(fileName, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `la carpeta de descargas (${fileName})`;
  },
};

/** Único punto donde se decide la plataforma. El resto de la app solo conoce los puertos. */
export function createPlatform(): Platform {
  return isTauri() ? { storage: tauriStorage, fileExport: tauriExport } : { storage: webStorage, fileExport: webExport };
}

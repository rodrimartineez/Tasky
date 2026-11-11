import { isTauri } from '@tauri-apps/api/core';
import { BaseDirectory, writeTextFile } from '@tauri-apps/plugin-fs';
import { registerSW } from 'virtual:pwa-register';
import type { FileExport, Storage, SyncBackend } from '../core/ports';
import { createSupabaseSync } from './supabaseSync';
import { tauriStorage } from './tauriStorage';
import { webStorage } from './webStorage';

export interface Platform {
  storage: Storage;
  fileExport: FileExport;
  /** Servidor de sincronización, o null si este build no tiene Supabase configurado. */
  sync: SyncBackend | null;
  /** Web/PWA: sin sesión no se muestra ningún dato. En escritorio la sesión es opcional (activa la sync). */
  requireAuth: boolean;
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

/** URL y clave pública de Supabase (públicas por diseño: la protección son las políticas RLS). */
function createSync(): SyncBackend | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_KEY;
  return url && key ? createSupabaseSync(url, key) : null;
}

/**
 * Tras publicar una versión nueva, una app que siguiera abierta con la anterior pediría archivos que ya no
 * existen al cargar algo en diferido (p. ej. el motor del juego). En ese caso se recarga una vez para pasar
 * a la versión nueva, en lugar de fallar.
 */
function reloadOnStaleChunks() {
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (sessionStorage.getItem('tasky-reloaded') === '1') return;
      sessionStorage.setItem('tasky-reloaded', '1');
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
  // Si la recarga funcionó, se permite otra en el futuro.
  window.addEventListener('load', () =>
    setTimeout(() => {
      try {
        sessionStorage.removeItem('tasky-reloaded');
      } catch {
        // Sin almacenamiento de sesión no hay nada que limpiar.
      }
    }, 10_000),
  );
}

/** Único punto donde se decide la plataforma. El resto de la app solo conoce los puertos. */
export function createPlatform(): Platform {
  const sync = createSync();
  if (isTauri()) return { storage: tauriStorage, fileExport: tauriExport, sync, requireAuth: false };
  // Navegador/PWA: service worker para funcionar sin conexión (solo en el build; en desarrollo no hay).
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
    reloadOnStaleChunks();
  }
  return { storage: webStorage, fileExport: webExport, sync, requireAuth: sync !== null };
}

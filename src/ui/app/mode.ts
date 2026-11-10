/**
 * Modo de la app (Proyectos · Hábitos). El modo es la ruta: Hábitos vive bajo `#/habits`.
 * Se recuerda el último por dispositivo para abrir la app donde se dejó.
 */
export type AppMode = 'projects' | 'habits';

const KEY = 'tasky:mode';
export const HABITS_PATH = '/habits';

export const modeOfPath = (pathname: string): AppMode =>
  pathname === HABITS_PATH || pathname.startsWith(`${HABITS_PATH}/`) ? 'habits' : 'projects';

export function rememberMode(mode: AppMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Sin almacenamiento disponible simplemente no se recuerda.
  }
}

/** Al arrancar en la pantalla inicial, vuelve al último modo usado. */
export function restoreMode() {
  let saved: string | null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    return;
  }
  const atStart = window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#';
  if (saved === 'habits' && atStart && window.location.pathname.replace(/\/$/, '') !== '/oauth/consent') {
    window.location.hash = `#${HABITS_PATH}`;
  }
}

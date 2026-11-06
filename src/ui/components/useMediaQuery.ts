import { useSyncExternalStore } from 'react';

/** Interfaz móvil (barra inferior y botón «+»): mismo corte que el CSS (`max-width: 640px`). */
export const MOBILE_QUERY = '(max-width: 640px)';
/** Pantalla táctil sin ratón: no hay teclado físico, así que no se mencionan atajos. */
export const TOUCH_QUERY = '(pointer: coarse)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

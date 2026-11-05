import { useEffect, useRef } from 'react';
import { isOverlayOpen } from './overlays';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function matches(e: KeyboardEvent, key: string): boolean {
  if (key === '?' || key === 'Escape') return e.key === key;
  return !e.shiftKey && e.key.toLowerCase() === key.toLowerCase();
}

/**
 * Atajo global de la pantalla actual. Se ignora mientras se escribe en un campo, con
 * modificadores (Ctrl/Alt/Win) o con un diálogo o menú abierto, para no interferir
 * con Windows, el navegador ni la escritura.
 */
export function useShortcut(key: string, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isOverlayOpen() || isEditable(e.target) || !matches(e, key)) return;
      e.preventDefault();
      handlerRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, enabled]);
}

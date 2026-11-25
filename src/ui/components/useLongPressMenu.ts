import { useRef, useState, type PointerEvent, type MouseEvent } from 'react';

/** Tiempo que hay que mantener pulsado y lo que puede moverse el dedo o el ratón antes de contarse como arrastre/scroll. */
const HOLD_MS = 500;
const MOVE_TOLERANCE = 10;
/** Controles propios (el menú, el asa de arrastre…) no inician la pulsación larga. */
const IGNORE = 'input, textarea, [aria-haspopup], [role="menu"], [data-swipe-ignore]';

/**
 * Abre un `Menu` también al mantener pulsado un elemento (dedo o ratón). `menu` va al `Menu` (props `open` y `onOpenChange`)
 * y `press` al elemento que se mantiene pulsado. Mover más de unos píxeles (scroll, arrastre) o soltar antes cancela;
 * al abrirse, el clic de soltar no activa la navegación ni otras acciones, y en táctil no se selecciona texto.
 */
export function useLongPressMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    origin.current = null;
  };

  const press = {
    'data-longpress': true,
    onPointerDown(e: PointerEvent) {
      fired.current = false;
      if (e.button !== 0 || (e.target as Element).closest(IGNORE)) return;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        origin.current = null;
        setOpen(true);
      }, HOLD_MS);
    },
    onPointerMove(e: PointerEvent) {
      if (origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    /** El clic que sigue a soltar tras una pulsación larga no debe abrir ni activar nada. */
    onClickCapture(e: MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    /** Evita el menú nativo del móvil (copiar, etc.) mientras se mantiene pulsado. */
    onContextMenu(e: MouseEvent) {
      if (fired.current || origin.current) e.preventDefault();
    },
  };

  return { menu: { open, onOpenChange: setOpen }, press };
}

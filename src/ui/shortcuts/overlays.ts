import { useEffect } from 'react';

// Cuenta los diálogos y menús abiertos: mientras haya alguno, los atajos globales se desactivan.
let openOverlays = 0;

export const isOverlayOpen = () => openOverlays > 0;

export function useOverlay(open: boolean) {
  useEffect(() => {
    if (!open) return;
    openOverlays++;
    return () => {
      openOverlays--;
    };
  }, [open]);
}

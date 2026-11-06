import { useRef, useState, type ReactNode } from 'react';
import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, type PanInfo } from 'motion/react';
import { Trash2 } from 'lucide-react';
import styles from './SwipeToDelete.module.css';

/** Ancho de la franja roja cuando se queda abierta. */
const REVEAL = 72;
/** A partir de esta fracción del ancho, soltar borra directamente. */
const DELETE_FRACTION = 0.5;

interface SwipeToDeleteProps {
  /** Texto accesible del botón de la papelera, p. ej. «Eliminar «Comprar pan»». */
  label: string;
  onDelete: () => void;
  /** Redondeo de las esquinas, igual que el elemento envuelto. */
  className?: string;
  children: ReactNode;
}

/**
 * Deslizar a la izquierda con el dedo: un poco deja ver la papelera (pulsarla borra);
 * más de la mitad del ancho borra al soltar. Con ratón no hace nada (allí se arrastra para ordenar).
 * Los elementos con `data-swipe-ignore` (p. ej. el asa de arrastre) no inician el gesto.
 */
export function SwipeToDelete({ label, onDelete, className, children }: SwipeToDeleteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const x = useMotionValue(0);
  const [visible, setVisible] = useState(false);
  const [armed, setArmed] = useState(false);
  const width = () => ref.current?.offsetWidth ?? 320;

  useMotionValueEvent(x, 'change', (v) => {
    setVisible(v < -1);
    setArmed(v < -width() * DELETE_FRACTION);
  });

  const settle = (to: number) => animate(x, to, { type: 'spring', stiffness: 500, damping: 40 });
  const remove = () => {
    void animate(x, -width(), { duration: 0.16, ease: 'easeIn' }).then(onDelete);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const offset = x.get();
    if (offset < -width() * DELETE_FRACTION || (info.velocity.x < -900 && offset < -REVEAL)) remove();
    else settle(offset < -REVEAL / 2 ? -REVEAL : 0);
  };

  return (
    <div ref={ref} className={`${styles.wrap} ${visible ? styles.swiping : ''} ${className ?? ''}`}>
      {visible && (
        <div className={`${styles.action} ${armed ? styles.armed : ''}`}>
          <button type="button" className={styles.trash} aria-label={label} onClick={remove}>
            <Trash2 />
          </button>
        </div>
      )}
      <motion.div
        className={styles.content}
        style={{ x }}
        drag="x"
        dragListener={false}
        dragControls={controls}
        dragDirectionLock
        dragConstraints={{ right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch' && !(e.target as Element).closest('[data-swipe-ignore]')) controls.start(e);
        }}
        // Abierta, un toque en el contenido la cierra en lugar de abrir el elemento.
        onClickCapture={(e) => {
          if (x.get() < 0) {
            e.preventDefault();
            e.stopPropagation();
            settle(0);
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

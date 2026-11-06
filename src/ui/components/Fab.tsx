import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import styles from './Fab.module.css';

interface FabProps {
  label: string;
  onClick: () => void;
  /** Hay barra inferior debajo: el botón se coloca encima de ella. */
  aboveBar?: boolean;
}

/**
 * Botón flotante «+» de la interfaz móvil: sustituye a los atajos de teclado.
 * Se monta en `body` para que ninguna transformación de la página altere su posición fija.
 */
export function Fab({ label, onClick, aboveBar = false }: FabProps) {
  return createPortal(
    <motion.button
      type="button"
      className={`${styles.fab} ${aboveBar ? styles.aboveBar : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Plus />
    </motion.button>,
    document.body,
  );
}

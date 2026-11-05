import { motion } from 'motion/react';
import styles from './TaskCheckbox.module.css';

interface TaskCheckboxProps {
  checked: boolean;
  inProgress?: boolean;
  label: string;
  onToggle: () => void;
}

/** Casilla circular: el check se dibuja al completar. «En curso» se indica con un semicírculo. */
export function TaskCheckbox({ checked, inProgress, label, onToggle }: TaskCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.box} ${checked ? styles.checked : ''} ${inProgress && !checked ? styles.progress : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden>
        {inProgress && !checked && <path className={styles.half} d="M10 4 A6 6 0 0 1 10 16 Z" />}
        <motion.path
          d="M6 10.4 L8.8 13 L14 7.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
    </button>
  );
}

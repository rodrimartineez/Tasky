import { useId, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Color del punto indicador (variable CSS o color). */
  color: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** Selector de una opción entre pocas, con un solo clic (estados de proyecto y de tarea). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  const pillId = useId();
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={`${styles.option} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(option.value)}
          >
            {selected && (
              <motion.span layoutId={pillId} className={styles.pill} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} />
            )}
            <span className={styles.dot} style={{ '--dot': option.color } as CSSProperties} />
            <span className={styles.label}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

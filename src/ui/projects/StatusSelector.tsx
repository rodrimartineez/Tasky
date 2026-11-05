import { motion } from 'motion/react';
import type { ProjectStatus } from '../../core/model';
import { PROJECT_STATUS_LABEL } from '../components/StatusBadge';
import styles from './StatusSelector.module.css';

const STATUSES: ProjectStatus[] = ['active', 'on_hold', 'done'];

/** Cambio de estado del proyecto con un solo clic. */
export function StatusSelector({ value, onChange }: { value: ProjectStatus; onChange: (s: ProjectStatus) => void }) {
  return (
    <div className={styles.group} role="group" aria-label="Estado del proyecto">
      {STATUSES.map((status) => {
        const selected = status === value;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={selected}
            className={`${styles.option} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(status)}
          >
            {selected && (
              <motion.span layoutId="status-pill" className={styles.pill} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} />
            )}
            <span className={`${styles.dot} ${styles[status]}`} />
            <span className={styles.label}>{PROJECT_STATUS_LABEL[status]}</span>
          </button>
        );
      })}
    </div>
  );
}

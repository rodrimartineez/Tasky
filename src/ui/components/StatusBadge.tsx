import type { ProjectStatus } from '../../core/model';
import styles from './StatusBadge.module.css';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Activo',
  on_hold: 'En espera',
  done: 'Finalizado',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

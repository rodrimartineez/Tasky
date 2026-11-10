import type { ProjectStatus } from '../../core/model';
import type { SegmentedOption } from './Segmented';
import styles from './StatusBadge.module.css';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Activo',
  on_hold: 'En espera',
  upcoming: 'Próximo',
  done: 'Finalizado',
};

/** Selector de estado, en el orden de las secciones de Inicio. */
export const PROJECT_STATUS_OPTIONS: SegmentedOption<ProjectStatus>[] = [
  { value: 'active', label: PROJECT_STATUS_LABEL.active, color: 'var(--status-active)' },
  { value: 'on_hold', label: PROJECT_STATUS_LABEL.on_hold, color: 'var(--status-on-hold)' },
  { value: 'upcoming', label: PROJECT_STATUS_LABEL.upcoming, color: 'var(--status-upcoming)' },
  { value: 'done', label: PROJECT_STATUS_LABEL.done, color: 'var(--status-done)' },
];

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

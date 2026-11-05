import { Link } from 'react-router-dom';
import { Circle, CircleCheck } from 'lucide-react';
import type { ProjectSummary } from '../../core/selectors';
import { StatusBadge } from '../components/StatusBadge';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  summary: ProjectSummary;
  variant: 'featured' | 'compact';
}

export function ProjectCard({ summary, variant }: ProjectCardProps) {
  const { project, pending, completed } = summary;
  const total = pending + completed;
  const progress = total === 0 ? 0 : completed / total;

  return (
    <Link to={`/project/${project.id}`} className={`${styles.card} ${styles[variant]} ${styles[project.status]}`}>
      <div className={styles.head}>
        <h3 className={styles.name}>{project.name}</h3>
        <StatusBadge status={project.status} />
      </div>

      {project.description && <p className={styles.description}>{project.description}</p>}

      <div className={styles.footer}>
        {variant === 'featured' && (
          <div className={styles.progress} aria-label={`${Math.round(progress * 100)} % completado`}>
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
        <div className={styles.counts}>
          <span title="Tareas pendientes">
            <Circle /> {pending} <span className={styles.countLabel}>pendientes</span>
          </span>
          <span title="Tareas completadas">
            <CircleCheck /> {completed} <span className={styles.countLabel}>completadas</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

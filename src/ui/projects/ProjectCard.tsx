import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Circle, CircleAlert, CircleCheck } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import type { ProjectSummary } from '../../core/selectors';
import { usePeople } from '../../state/people';
import { AvatarStack } from '../collab/Avatar';
import { StatusBadge } from '../components/StatusBadge';
import { previewText } from '../components/RichText';
import { DueBadge } from '../tasks/DueBadge';
import { projectColor } from './projectColor';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  summary: ProjectSummary;
  variant: 'featured' | 'compact';
}

export function ProjectCard({ summary, variant }: ProjectCardProps) {
  const { project, pending, completed, nextDue, overdue, nextTask } = summary;
  const people = usePeople((s) => s.shares.project[project.id]);
  const total = pending + completed;
  const progress = total === 0 ? 0 : completed / total;

  return (
    <Link
      to={`/project/${project.id}`}
      draggable={false}
      className={`${styles.card} ${styles[variant]} ${styles[project.status]}`}
      style={{ '--project': projectColor(project.id) } as CSSProperties}
    >
      <div className={styles.head}>
        <h3 className={styles.name}>
          <span className={styles.dot} aria-hidden />
          {project.name}
        </h3>
        <StatusBadge status={project.status} />
      </div>
      {people && people.length > 1 && (
        <div>
          <AvatarStack userIds={people} size={20} />
        </div>
      )}

      {project.description && <p className={styles.description}>{previewText(project.description)}</p>}

      {nextTask && (
        <p className={styles.next} title={`Siguiente tarea: ${nextTask.title}`}>
          <ArrowRight />
          <span className={styles.nextLabel}>Siguiente</span>
          <span className={styles.nextTitle}>{nextTask.title}</span>
        </p>
      )}

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
          <span className={styles.due}>
            {overdue > 0 ? (
              <span className={styles.overdue} title="Tareas con la fecha límite vencida">
                <CircleAlert /> {overdue} {overdue === 1 ? 'vencida' : 'vencidas'}
              </span>
            ) : (
              nextDue && <DueBadge due={nextDue} today={getToday()} />
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

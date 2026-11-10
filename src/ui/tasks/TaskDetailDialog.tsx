import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import type { Project, Task, TaskStatus } from '../../core/model';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { projectColor } from '../projects/projectColor';
import { DueBadge } from './DueBadge';
import { scheduleSummary } from './schedule';
import { TIME_SLOT_INFO } from './timeSlot';
import styles from '../components/Details.module.css';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: 'Pendiente', in_progress: 'En curso', done: 'Completada' };

const dateTimeFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });
const longDateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

interface TaskDetailDialogProps {
  /** Tarea mostrada; sin tarea, el diálogo está cerrado. */
  task?: Task;
  project: Project;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

/** Vista de solo lectura de una tarea. Editar y eliminar están en su menú «···» (y aquí, «Editar»). */
export function TaskDetailDialog({ task, project, onClose, onEdit }: TaskDetailDialogProps) {
  return (
    <Dialog
      open={!!task}
      onClose={onClose}
      title={task?.title ?? ''}
      footer={
        task && (
          <>
            <Button variant="ghost" onClick={onClose} shortcut="Esc">
              Cerrar
            </Button>
            <Button variant="primary" icon={<Pencil />} data-autofocus onClick={() => onEdit(task)}>
              Editar
            </Button>
          </>
        )
      }
    >
      {task && <TaskDetails task={task} project={project} />}
    </Dialog>
  );
}

function TaskDetails({ task, project }: { task: Task; project: Project }) {
  const today = getToday();
  const schedule = scheduleSummary(task, today);
  const slot = TIME_SLOT_INFO[task.timeSlot];
  const rows: [string, ReactNode][] = [
    [
      'Proyecto',
      <>
        <span className={styles.dot} style={{ '--project': projectColor(project.id) } as CSSProperties} aria-hidden />
        {project.name}
      </>,
    ],
    ['Estado', TASK_STATUS_LABEL[task.status]],
    ['Cuándo', schedule ?? <span className={styles.muted}>Sin programar</span>],
    [
      'Franja',
      <>
        {slot.icon}
        {slot.label}
      </>,
    ],
    [
      'Fecha límite',
      task.dueDate ? (
        <>
          <DueBadge due={task.dueDate} today={today} muted={task.status === 'done'} />
          <span className={styles.muted}>{longDateFmt.format(new Date(`${task.dueDate}T00:00:00Z`))}</span>
        </>
      ) : (
        <span className={styles.muted}>Sin fecha límite</span>
      ),
    ],
    ['Creada', dateTimeFmt.format(new Date(task.createdAt))],
  ];
  if (task.completedAt) rows.push(['Completada', dateTimeFmt.format(new Date(task.completedAt))]);

  return (
    <>
      {task.description && <p className={styles.description}>{task.description}</p>}
      <dl className={styles.list}>
        {rows.map(([term, value]) => (
          <Fragment key={term}>
            <dt className={styles.term}>{term}</dt>
            <dd className={styles.value}>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </>
  );
}

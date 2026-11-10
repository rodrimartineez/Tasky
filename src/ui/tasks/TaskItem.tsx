import { useState, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ellipsis, GripVertical, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import type { LocalDate, Task } from '../../core/model';
import { useTasky } from '../../state/store';
import { Menu } from '../components/Menu';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { toast } from '../components/Toaster';
import { DueBadge } from './DueBadge';
import { ScheduleBadge } from './schedule';
import { TaskCheckbox } from './TaskCheckbox';
import { TIME_SLOT_INFO } from './timeSlot';
import styles from './TaskItem.module.css';

/** Tocar la tarea abre su detalle; el menú «···» edita o elimina. */
export interface TaskActions {
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

interface TaskItemProps extends TaskActions {
  task: Task;
  today: LocalDate;
}

/** Tiempo para ver el check dibujarse antes de que la tarea pase a «Completadas». */
const COMPLETE_DELAY_MS = 260;

/** Fila de una tarea abierta: se arrastra desde cualquier punto (ratón) o desde el asa (teclado y táctil). */
export function SortableTaskItem({ task, today, ...actions }: TaskItemProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? styles.lifted : undefined}>
      <SwipeToDeleteTask task={task}>
        <div
          className={`${styles.row} ${isDragging ? styles.dragging : ''}`}
          onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
        >
          <button
            ref={setActivatorNodeRef}
            type="button"
            className={styles.handle}
            aria-label={`Mover «${task.title}»`}
            data-swipe-ignore
            {...attributes}
            {...listeners}
          >
            <GripVertical />
          </button>
          <TaskBody task={task} today={today} {...actions} />
        </div>
      </SwipeToDeleteTask>
    </div>
  );
}

/** Fila de una tarea completada (sin arrastre). */
export function DoneTaskItem({ task, today, ...actions }: TaskItemProps) {
  return (
    <SwipeToDeleteTask task={task}>
      <div className={`${styles.row} ${styles.done}`}>
        <span className={styles.handleSpacer} />
        <TaskBody task={task} today={today} {...actions} />
      </div>
    </SwipeToDeleteTask>
  );
}

/** En táctil, deslizar la fila a la izquierda la elimina. */
function SwipeToDeleteTask({ task, children }: { task: Task; children: React.ReactNode }) {
  const deleteTask = useTasky((s) => s.deleteTask);
  return (
    <SwipeToDelete
      label={`Eliminar «${task.title}»`}
      className={styles.swipe}
      onDelete={() => {
        deleteTask(task.id);
        toast('Tarea eliminada.');
      }}
    >
      {children}
    </SwipeToDelete>
  );
}

function TaskBody({ task, today, onOpen, onEdit, onDelete }: TaskItemProps) {
  const updateTask = useTasky((s) => s.updateTask);
  const [completing, setCompleting] = useState(false);
  const done = task.status === 'done';
  const inProgress = task.status === 'in_progress';

  const toggleDone = () => {
    if (done) {
      updateTask(task.id, { status: 'todo' });
      return;
    }
    setCompleting(true);
    setTimeout(() => updateTask(task.id, { status: 'done' }), COMPLETE_DELAY_MS);
  };

  return (
    <>
      <TaskCheckbox
        checked={done || completing}
        inProgress={inProgress}
        label={done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`}
        onToggle={toggleDone}
      />
      <button type="button" className={`${styles.content} ${completing ? styles.completing : ''}`} onClick={() => onOpen(task)}>
        <span className={styles.title}>{task.title}</span>
        {task.description && <span className={styles.description}>{task.description}</span>}
      </button>
      <span className={styles.meta}>
        <span className={styles.badges}>
          {inProgress && <span className={styles.progressChip}>En curso</span>}
          {!done && task.timeSlot !== 'all_day' && (
            <span className={styles.slot} title={`Franja: ${TIME_SLOT_INFO[task.timeSlot].label.toLowerCase()}`}>
              {TIME_SLOT_INFO[task.timeSlot].icon}
              <span className={styles.slotLabel}>{TIME_SLOT_INFO[task.timeSlot].label}</span>
            </span>
          )}
          <ScheduleBadge task={task} today={today} muted={done} />
          {task.dueDate && <DueBadge due={task.dueDate} today={today} muted={done} />}
        </span>
        <span className={styles.actions}>
          {!done && (
            <button
              type="button"
              className={styles.quickAction}
              title={inProgress ? 'Volver a pendiente' : 'Marcar en curso'}
              aria-label={inProgress ? `Volver «${task.title}» a pendiente` : `Marcar «${task.title}» en curso`}
              onClick={() => updateTask(task.id, { status: inProgress ? 'todo' : 'in_progress' })}
            >
              {inProgress ? <Pause /> : <Play />}
            </button>
          )}
          <Menu
            label={`Acciones de «${task.title}»`}
            trigger={<Ellipsis />}
            triggerClassName={styles.menuTrigger}
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: () => onEdit(task) },
              { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => onDelete(task) },
            ]}
          />
        </span>
      </span>
    </>
  );
}

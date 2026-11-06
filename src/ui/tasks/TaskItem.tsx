import { useState, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pause, Play } from 'lucide-react';
import type { LocalDate, Task } from '../../core/model';
import { useTasky } from '../../state/store';
import { DueBadge } from './DueBadge';
import { TaskCheckbox } from './TaskCheckbox';
import { TIME_SLOT_INFO } from './timeSlot';
import styles from './TaskItem.module.css';

interface TaskItemProps {
  task: Task;
  today: LocalDate;
  onOpen: (task: Task) => void;
}

/** Tiempo para ver el check dibujarse antes de que la tarea pase a «Completadas». */
const COMPLETE_DELAY_MS = 260;

/** Fila de una tarea abierta: se arrastra desde cualquier punto (ratón) o desde el asa (teclado y táctil). */
export function SortableTaskItem({ task, today, onOpen }: TaskItemProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.row} ${isDragging ? styles.dragging : ''}`}
      onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={`Mover «${task.title}»`}
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </button>
      <TaskBody task={task} today={today} onOpen={onOpen} />
    </div>
  );
}

/** Fila de una tarea completada (sin arrastre). */
export function DoneTaskItem({ task, today, onOpen }: TaskItemProps) {
  return (
    <div className={`${styles.row} ${styles.done}`}>
      <span className={styles.handleSpacer} />
      <TaskBody task={task} today={today} onOpen={onOpen} />
    </div>
  );
}

function TaskBody({ task, today, onOpen }: TaskItemProps) {
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
        {inProgress && <span className={styles.progressChip}>En curso</span>}
        {!done && task.timeSlot !== 'all_day' && (
          <span className={styles.slot} title={`Franja: ${TIME_SLOT_INFO[task.timeSlot].label.toLowerCase()}`}>
            {TIME_SLOT_INFO[task.timeSlot].icon}
            <span className={styles.slotLabel}>{TIME_SLOT_INFO[task.timeSlot].label}</span>
          </span>
        )}
        {task.dueDate && <DueBadge due={task.dueDate} today={today} muted={done} />}
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
      </span>
    </>
  );
}

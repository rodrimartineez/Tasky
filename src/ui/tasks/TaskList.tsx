import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { ChevronRight, CircleCheckBig, Layers, ListTodo, Plus } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import { findProjectGroup, outlineOf, phaseTasks, type OutlineEntry } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { DoneContainerItem, SortableContainerItem, type ContainerActions } from '../phases/PhaseItem';
import { DoneTaskItem, SortableTaskItem, type TaskActions } from './TaskItem';
import styles from './TaskList.module.css';

interface TaskListProps extends TaskActions, ContainerActions {
  projectId: string;
  /**
   * Con `phaseId` se muestran las tareas de esta fase; con `groupId`, las fases de este grupo; sin ninguno, el primer
   * nivel del proyecto (grupos, fases y tareas sueltas).
   */
  phaseId?: string;
  groupId?: string;
  /** Crear el primer elemento desde la lista vacía. */
  onCreate: () => void;
  /** En un grupo vacío, crear su primera fase. */
  onCreatePhase?: () => void;
}

const entryId = (e: OutlineEntry) => (e.kind === 'phase' ? e.phase.id : e.kind === 'group' ? e.group.id : e.task.id);

const itemMotion = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] as const },
};

export function TaskList({
  projectId,
  phaseId,
  groupId,
  onCreate,
  onCreatePhase,
  onEditPhase,
  onDeletePhase,
  onEditGroup,
  onDeleteGroup,
  ...actions
}: TaskListProps) {
  const containerActions = { onEditPhase, onDeletePhase, onEditGroup, onDeleteGroup };
  const data = useTasky((s) => s.data);
  const moveTask = useTasky((s) => s.moveTask);
  const movePhase = useTasky((s) => s.movePhase);
  const moveProjectGroup = useTasky((s) => s.moveProjectGroup);
  const { entries: open, done, doneContainers } = useMemo(() => {
    if (phaseId) {
      const tasks = phaseTasks(data, phaseId);
      return { entries: tasks.open.map((task): OutlineEntry => ({ kind: 'task', task })), done: tasks.done, doneContainers: [] };
    }
    return outlineOf(data, projectId, groupId && findProjectGroup(data, groupId) ? groupId : null);
  }, [data, projectId, phaseId, groupId]);
  const place = phaseId ? 'esta fase' : groupId ? 'este grupo' : 'este proyecto';
  const [showDone, setShowDone] = useState(false);
  const today = getToday();

  const sensors = useSensors(
    // Ratón: desde cualquier punto de la fila. Táctil: solo desde el asa y con pulsación breve, para no interferir con el scroll.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = open.map(entryId);
    const id = String(active.id);
    const reordered = arrayMove(ids, ids.indexOf(id), ids.indexOf(String(over.id)));
    const index = reordered.indexOf(id);
    const kind = open.find((e) => entryId(e) === id)?.kind;
    const move = kind === 'phase' ? movePhase : kind === 'group' ? moveProjectGroup : moveTask;
    move(id, reordered[index - 1] ?? null, reordered[index + 1] ?? null);
  };

  if (open.length === 0 && done.length === 0 && doneContainers.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo />}
        title="Sin tareas todavía"
        description={
          phaseId
            ? 'Añade las tareas de esta fase y ordénalas arrastrándolas: lo primero, arriba.'
            : groupId
              ? 'Añade las fases y tareas de este grupo y ordénalas arrastrándolas: lo primero, arriba.'
              : 'Añade los pasos de este proyecto y ordénalos arrastrándolos: lo primero, arriba.'
        }
        action={
          <>
            {onCreatePhase && (
              <Button icon={<Layers />} shortcut="F" onClick={onCreatePhase}>
                Nueva fase
              </Button>
            )}
            <Button icon={<Plus />} shortcut="T" onClick={onCreate}>
              Nueva tarea
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      {open.length === 0 ? (
        <EmptyState
          compact
          icon={<CircleCheckBig />}
          title="Todo completado"
          description={`No quedan tareas pendientes en ${place}.`}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={open.map(entryId)} strategy={verticalListSortingStrategy}>
            <ol className={styles.list} aria-label="Tareas pendientes, en orden de trabajo">
              <AnimatePresence initial={false}>
                {open.map((entry) => (
                  <motion.li key={entryId(entry)} {...itemMotion}>
                    {entry.kind !== 'task' ? (
                      <SortableContainerItem entry={entry} {...containerActions} />
                    ) : (
                      <SortableTaskItem task={entry.task} today={today} {...actions} />
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {done.length + doneContainers.length > 0 && (
        <section className={styles.doneSection}>
          <button type="button" className={styles.doneToggle} aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            <motion.span className={styles.chevron} animate={{ rotate: showDone ? 90 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronRight />
            </motion.span>
            Completadas
            <span className={styles.count}>{done.length + doneContainers.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.div
                className={styles.doneBody}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <ul className={styles.list} aria-label="Tareas completadas">
                  <AnimatePresence initial={false}>
                    {doneContainers.map((entry) => (
                      <motion.li key={entryId(entry)} {...itemMotion}>
                        <DoneContainerItem entry={entry} />
                      </motion.li>
                    ))}
                    {done.map((task) => (
                      <motion.li key={task.id} {...itemMotion}>
                        <DoneTaskItem task={task} today={today} {...actions} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

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
import { ChevronRight, CircleCheckBig, ListTodo, Plus } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import type { Task } from '../../core/model';
import { projectTasks } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { DoneTaskItem, SortableTaskItem } from './TaskItem';
import styles from './TaskList.module.css';

interface TaskListProps {
  projectId: string;
  onCreate: () => void;
  onOpen: (task: Task) => void;
}

const itemMotion = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] as const },
};

export function TaskList({ projectId, onCreate, onOpen }: TaskListProps) {
  const data = useTasky((s) => s.data);
  const moveTask = useTasky((s) => s.moveTask);
  const { open, done } = useMemo(() => projectTasks(data, projectId), [data, projectId]);
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
    const ids = open.map((t) => t.id);
    const reordered = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const index = reordered.indexOf(String(active.id));
    moveTask(String(active.id), reordered[index - 1] ?? null, reordered[index + 1] ?? null);
  };

  if (open.length === 0 && done.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo />}
        title="Sin tareas todavía"
        description="Añade los pasos de este proyecto y ordénalos arrastrándolos: lo primero, arriba."
        action={
          <Button icon={<Plus />} shortcut="T" onClick={onCreate}>
            Nueva tarea
          </Button>
        }
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      {open.length === 0 ? (
        <EmptyState compact icon={<CircleCheckBig />} title="Todo completado" description="No quedan tareas pendientes en este proyecto." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={open.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles.list} aria-label="Tareas pendientes, en orden de trabajo">
              <AnimatePresence initial={false}>
                {open.map((task) => (
                  <motion.li key={task.id} {...itemMotion}>
                    <SortableTaskItem task={task} today={today} onOpen={onOpen} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {done.length > 0 && (
        <section className={styles.doneSection}>
          <button type="button" className={styles.doneToggle} aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            <motion.span className={styles.chevron} animate={{ rotate: showDone ? 90 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronRight />
            </motion.span>
            Completadas
            <span className={styles.count}>{done.length}</span>
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
                    {done.map((task) => (
                      <motion.li key={task.id} {...itemMotion}>
                        <DoneTaskItem task={task} today={today} onOpen={onOpen} />
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

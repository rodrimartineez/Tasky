import { useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProjectSummary } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { ProjectCard } from './ProjectCard';
import styles from './ProjectGrid.module.css';

/** Mantener pulsado este tiempo (ratón o dedo) para coger una tarjeta; un clic normal sigue abriendo el proyecto. */
const HOLD = { delay: 250, tolerance: 6 };

interface ProjectGridProps {
  summaries: ProjectSummary[];
  variant: 'featured' | 'compact';
  className: string;
}

/** Tarjetas de una sección de Inicio, reordenables manteniendo pulsado y arrastrando. */
export function ProjectGrid({ summaries, variant, className }: ProjectGridProps) {
  const reorderProject = useTasky((s) => s.reorderProject);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: HOLD }), useSensor(TouchSensor, { activationConstraint: HOLD }));
  // Mientras se arrastra (y en el render en que se suelta) la animación de diseño de motion se apaga:
  // el movimiento lo hace dnd-kit y las dos a la vez harían saltar la tarjeta.
  const [dragging, setDragging] = useState(false);
  const ids = summaries.map((s) => s.project.id);

  const start = () => {
    window.addEventListener('click', preventClick, true);
    setDragging(true);
  };
  const finish = () => {
    setTimeout(() => window.removeEventListener('click', preventClick, true), 150);
    requestAnimationFrame(() => setDragging(false));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const moved = String(active.id);
      reorderProject(arrayMove(ids, ids.indexOf(moved), ids.indexOf(String(over.id))), moved);
    }
    finish();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={start}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          <AnimatePresence initial={false} mode="popLayout">
            {summaries.map((summary) => (
              <motion.div
                key={summary.project.id}
                layout={!dragging}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <SortableItem id={summary.project.id}>
                  <ProjectCard summary={summary} variant={variant} />
                </SortableItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * Al soltar, el navegador envía un clic sobre la tarjeta. dnd-kit lo detiene antes de React, pero el enlace
 * navegaría igualmente por su href: se cancela desde que se coge la tarjeta hasta poco después de soltarla.
 */
const preventClick = (e: MouseEvent) => e.preventDefault();

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
      {...attributes}
      {...listeners}
      // La tarjeta es un enlace: el tabulador ya llega a él, este envoltorio no necesita foco propio.
      tabIndex={-1}
      role="presentation"
    >
      {children}
    </div>
  );
}

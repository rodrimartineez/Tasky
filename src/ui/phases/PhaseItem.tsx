import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, Ellipsis, GripVertical, Layers, Pencil, Trash2 } from 'lucide-react';
import type { Phase } from '../../core/model';
import { Menu } from '../components/Menu';
import row from '../tasks/TaskItem.module.css';
import styles from './PhaseItem.module.css';

interface PhaseItemProps {
  phase: Phase;
  open: number;
  done: number;
  onEdit: (phase: Phase) => void;
  onDelete: (phase: Phase) => void;
}

/** Fila de una fase en el primer nivel del proyecto: se ordena como una tarea más y al tocarla se entra en ella. */
export function SortablePhaseItem({ phase, open, done, onEdit, onDelete }: PhaseItemProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: phase.id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const total = open + done;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? row.lifted : undefined}>
      <div
        className={`${row.row} ${styles.phase} ${isDragging ? row.dragging : ''}`}
        onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={row.handle}
          aria-label={`Mover la fase «${phase.name}»`}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
        <span className={styles.icon} aria-hidden>
          <Layers />
        </span>
        <Link to={`/project/${phase.projectId}/phase/${phase.id}`} className={row.content} draggable={false}>
          <span className={`${row.title} ${styles.name}`}>{phase.name}</span>
          {phase.description && <span className={row.description}>{phase.description}</span>}
        </Link>
        <span className={row.actions}>
          <span className={styles.count} title={`${done} de ${total} tareas completadas`}>
            {done}/{total}
          </span>
          <Menu
            label={`Acciones de la fase «${phase.name}»`}
            trigger={<Ellipsis />}
            triggerClassName={row.menuTrigger}
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: () => onEdit(phase) },
              { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => onDelete(phase) },
            ]}
          />
          <ChevronRight className={styles.chevron} aria-hidden />
        </span>
      </div>
    </div>
  );
}

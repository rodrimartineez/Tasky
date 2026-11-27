import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, Ellipsis, FolderOpen, GripVertical, Layers, Pencil, Trash2 } from 'lucide-react';
import type { Phase, ProjectGroup } from '../../core/model';
import type { GroupEntry, PhaseEntry } from '../../core/selectors';
import { Menu } from '../components/Menu';
import { previewText } from '../components/RichText';
import { useLongPressMenu } from '../components/useLongPressMenu';
import row from '../tasks/TaskItem.module.css';
import styles from './PhaseItem.module.css';

/** Grupo o fase: lo que se muestra como una fila en la que se entra. */
type ContainerEntry = GroupEntry | PhaseEntry;

export interface ContainerActions {
  onEditPhase: (phase: Phase) => void;
  onDeletePhase: (phase: Phase) => void;
  onEditGroup: (group: ProjectGroup) => void;
  onDeleteGroup: (group: ProjectGroup) => void;
}

function describe(entry: ContainerEntry) {
  if (entry.kind === 'group') {
    const { group } = entry;
    return {
      item: group,
      noun: 'el grupo',
      ofNoun: 'del grupo',
      icon: <FolderOpen />,
      href: `/project/${group.projectId}/group/${group.id}`,
      detail: `${entry.phases} ${entry.phases === 1 ? 'fase' : 'fases'}`,
    };
  }
  const { phase } = entry;
  return { item: phase, noun: 'la fase', ofNoun: 'de la fase', icon: <Layers />, href: `/project/${phase.projectId}/phase/${phase.id}`, detail: null };
}

function Count({ open, done, detail, allDone }: { open: number; done: number; detail: string | null; allDone: boolean }) {
  const total = open + done;
  return (
    <span className={styles.count} title={`${detail ? `${detail} · ` : ''}${done} de ${total} tareas completadas`}>
      {allDone ? 'Todo completado' : `${done}/${total}`}
    </span>
  );
}

/** Fila de un grupo o una fase: se ordena como una tarea más y al tocarla se entra en ella. */
export function SortableContainerItem({ entry, ...actions }: { entry: ContainerEntry } & ContainerActions) {
  const { item, noun, ofNoun, icon, href, detail } = describe(entry);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const { menu, press } = useLongPressMenu();
  const onEdit = () => (entry.kind === 'group' ? actions.onEditGroup(entry.group) : actions.onEditPhase(entry.phase));
  const onDelete = () => (entry.kind === 'group' ? actions.onDeleteGroup(entry.group) : actions.onDeletePhase(entry.phase));

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? row.lifted : undefined}>
      <div
        className={`${row.row} ${styles.phase} ${isDragging ? row.dragging : ''}`}
        onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
        {...press}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={row.handle}
          aria-label={`Mover ${noun} «${item.name}»`}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
        <Icon>{icon}</Icon>
        <Link to={href} className={row.content} draggable={false}>
          <span className={`${row.title} ${styles.name}`}>{item.name}</span>
          {item.description && <span className={row.description}>{previewText(item.description)}</span>}
        </Link>
        <span className={row.actions}>
          <Count open={entry.open} done={entry.done} detail={detail} allDone={entry.kind === 'group' && entry.open === 0 && entry.done > 0} />
          <Menu
            label={`Acciones ${ofNoun} «${item.name}»`}
            trigger={<Ellipsis />}
            triggerClassName={row.menuTrigger}
            {...menu}
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: onEdit },
              { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: onDelete },
            ]}
          />
          <ChevronRight className={styles.chevron} aria-hidden />
        </span>
      </div>
    </div>
  );
}

/** Grupo o fase completados (todas sus tareas hechas): sin acciones de orden; al tocarlos se consulta su contenido. */
export function DoneContainerItem({ entry }: { entry: ContainerEntry }) {
  const { item, icon, href, detail } = describe(entry);
  return (
    <div className={`${row.row} ${styles.phase}`}>
      <Icon>{icon}</Icon>
      <Link to={href} className={row.content} draggable={false}>
        <span className={`${row.title} ${styles.name}`}>{item.name}</span>
      </Link>
      <span className={row.actions}>
        <Count open={0} done={entry.done} detail={detail} allDone={false} />
        <ChevronRight className={styles.chevron} aria-hidden />
      </span>
    </div>
  );
}

const Icon = ({ children }: { children: ReactNode }) => (
  <span className={styles.icon} aria-hidden>
    {children}
  </span>
);

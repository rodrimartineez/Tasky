import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ellipsis, Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import { daysBetween } from '../../core/dueDates';
import type { Idea, Timestamp } from '../../core/model';
import { projectIdeas } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Menu } from '../components/Menu';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { toast } from '../components/Toaster';
import styles from './IdeaGrid.module.css';

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const dateYearFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' });

/** «Hoy», «Ayer», «Hace 3 días» o la fecha corta, según la fecha local de creación. */
function createdLabel(createdAt: Timestamp, todayDate: string): string {
  const created = new Date(createdAt);
  const diff = daysBetween(getToday(created), todayDate);
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return `Hace ${diff} días`;
  const fmt = created.getFullYear() === new Date().getFullYear() ? dateFmt : dateYearFmt;
  return fmt.format(created).replace('.', '');
}

interface IdeaGridProps {
  projectId: string;
  onCreate: () => void;
  /** Tocar la idea abre su detalle; el menú «···» edita o elimina. */
  onOpen: (idea: Idea) => void;
  onEdit: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
}

export function IdeaGrid({ projectId, onCreate, onOpen, onEdit, onDelete }: IdeaGridProps) {
  const data = useTasky((s) => s.data);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const ideas = useMemo(() => projectIdeas(data, projectId), [data, projectId]);
  const today = getToday();

  if (ideas.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb />}
        title="Sin ideas todavía"
        description="Apunta aquí conceptos, funcionalidades o posibilidades para más adelante, sin compromiso."
        action={
          <Button icon={<Plus />} shortcut="I" onClick={onCreate}>
            Nueva idea
          </Button>
        }
      />
    );
  }

  return (
    <ul className={styles.grid} aria-label="Ideas del proyecto">
      <AnimatePresence initial={false} mode="popLayout">
        {ideas.map((idea) => (
          <motion.li
            key={idea.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SwipeToDelete
              label={`Eliminar «${idea.title}»`}
              className={styles.swipe}
              onDelete={() => {
                deleteIdea(idea.id);
                toast('Idea eliminada.');
              }}
            >
              <div className={styles.cardWrap}>
                <button type="button" className={styles.card} onClick={() => onOpen(idea)}>
                  <span className={styles.icon}>
                    <Lightbulb />
                  </span>
                  <span className={styles.title}>{idea.title}</span>
                  {idea.description && <span className={styles.description}>{idea.description}</span>}
                  <time className={styles.date} dateTime={idea.createdAt} title={fullFmt.format(new Date(idea.createdAt))}>
                    {createdLabel(idea.createdAt, today)}
                  </time>
                </button>
                <div className={styles.cardMenu}>
                  <Menu
                    label={`Acciones de «${idea.title}»`}
                    trigger={<Ellipsis />}
                    triggerClassName={styles.menuTrigger}
                    items={[
                      { label: 'Editar', icon: <Pencil />, onSelect: () => onEdit(idea) },
                      { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => onDelete(idea) },
                    ]}
                  />
                </div>
              </div>
            </SwipeToDelete>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

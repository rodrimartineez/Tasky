import type { CSSProperties } from 'react';
import { Pencil } from 'lucide-react';
import type { Idea, Project } from '../../core/model';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { projectColor } from '../projects/projectColor';
import styles from '../components/Details.module.css';

const dateTimeFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });

interface IdeaDetailDialogProps {
  /** Idea mostrada; sin idea, el diálogo está cerrado. */
  idea?: Idea;
  project: Project;
  onClose: () => void;
  onEdit: (idea: Idea) => void;
}

/** Vista de solo lectura de una idea. */
export function IdeaDetailDialog({ idea, project, onClose, onEdit }: IdeaDetailDialogProps) {
  return (
    <Dialog
      open={!!idea}
      onClose={onClose}
      title={idea?.title ?? ''}
      footer={
        idea && (
          <>
            <Button variant="ghost" onClick={onClose} shortcut="Esc">
              Cerrar
            </Button>
            <Button variant="primary" icon={<Pencil />} data-autofocus onClick={() => onEdit(idea)}>
              Editar
            </Button>
          </>
        )
      }
    >
      {idea && (
        <>
          {idea.description ? (
            <p className={styles.description}>{idea.description}</p>
          ) : (
            <p className={`${styles.description} ${styles.muted}`}>Sin descripción.</p>
          )}
          <dl className={styles.list}>
            <dt className={styles.term}>Proyecto</dt>
            <dd className={styles.value}>
              <span className={styles.dot} style={{ '--project': projectColor(project.id) } as CSSProperties} aria-hidden />
              {project.name}
            </dd>
            <dt className={styles.term}>Creada</dt>
            <dd className={styles.value}>{dateTimeFmt.format(new Date(idea.createdAt))}</dd>
            {idea.updatedAt !== idea.createdAt && (
              <>
                <dt className={styles.term}>Modificada</dt>
                <dd className={styles.value}>{dateTimeFmt.format(new Date(idea.updatedAt))}</dd>
              </>
            )}
          </dl>
        </>
      )}
    </Dialog>
  );
}

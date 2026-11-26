import type { CSSProperties } from 'react';
import { Pencil, Share2 } from 'lucide-react';
import type { Idea, Project } from '../../core/model';
import { authorsOf, usePeople } from '../../state/people';
import { Person, useIsShared } from '../collab/Authorship';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { projectColor } from '../projects/projectColor';
import { RichText } from '../components/RichText';
import styles from '../components/Details.module.css';

const dateTimeFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });

interface IdeaDetailDialogProps {
  /** Idea mostrada; sin idea, el diálogo está cerrado. */
  idea?: Idea;
  /** Proyecto de la idea; sin proyecto es una idea general. */
  project?: Project;
  onClose: () => void;
  onEdit: (idea: Idea) => void;
  /** Solo en ideas generales: compartir con otra persona. */
  onShare?: (idea: Idea) => void;
}

/** Vista de solo lectura de una idea. */
export function IdeaDetailDialog({ idea, project, onClose, onEdit, onShare }: IdeaDetailDialogProps) {
  const shared = useIsShared({ projectId: project?.id, ideaId: idea?.id });
  const createdBy = usePeople((s) => (idea ? authorsOf(s, idea).createdBy : null));
  const updatedBy = usePeople((s) => (idea ? authorsOf(s, idea).updatedBy : null));
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
            {onShare && (
              <Button icon={<Share2 />} onClick={() => onShare(idea)}>
                Compartir
              </Button>
            )}
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
            <p className={styles.description}><RichText text={idea.description} /></p>
          ) : (
            <p className={`${styles.description} ${styles.muted}`}>Sin descripción.</p>
          )}
          <dl className={styles.list}>
            {project && (
              <>
                <dt className={styles.term}>Proyecto</dt>
                <dd className={styles.value}>
                  <span className={styles.dot} style={{ '--project': projectColor(project.id) } as CSSProperties} aria-hidden />
                  {project.name}
                </dd>
              </>
            )}
            <dt className={styles.term}>Creada</dt>
            <dd className={styles.value}>{dateTimeFmt.format(new Date(idea.createdAt))}</dd>
            {shared && (
              <>
                <dt className={styles.term}>Creada por</dt>
                <dd className={styles.value}>
                  <Person userId={createdBy} />
                </dd>
                {updatedBy && updatedBy !== createdBy && (
                  <>
                    <dt className={styles.term}>Modificada por</dt>
                    <dd className={styles.value}>
                      <Person userId={updatedBy} />
                    </dd>
                  </>
                )}
              </>
            )}
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

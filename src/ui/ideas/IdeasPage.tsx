import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Plus } from 'lucide-react';
import { GENERAL_IDEAS_ID } from '../../core/ideas';
import type { Idea } from '../../core/model';
import { projectIdeas } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Fab } from '../components/Fab';
import { Kbd } from '../components/Kbd';
import { MOBILE_QUERY, TOUCH_QUERY, useMediaQuery } from '../components/useMediaQuery';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { useShortcut } from '../shortcuts/useShortcut';
import styles from '../projects/ProjectPage.module.css';
import { IdeaDetailDialog } from './IdeaDetailDialog';
import { IdeaFormDialog } from './IdeaFormDialog';
import { IdeaGrid } from './IdeaGrid';

/** Ideas generales: notas para futuros proyectos, sin pertenecer a ninguno. */
export function IdeasPage() {
  const navigate = useNavigate();
  const data = useTasky((s) => s.data);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTouch = useMediaQuery(TOUCH_QUERY);
  const count = projectIdeas(data, GENERAL_IDEAS_ID).length;
  const [dialog, setDialog] = useState<{ idea?: Idea } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = data.ideas.find((i) => i.id === detailId && !i.deletedAt);
  const [deleting, setDeleting] = useState<Idea | null>(null);
  const newIdea = () => setDialog({});

  useShortcut('Escape', () => navigate('/'));
  useShortcut('i', newIdea);

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        <ArrowLeft /> Proyectos <Kbd>Esc</Kbd>
      </Link>

      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>
            <Lightbulb /> Ideas generales
          </p>
          <h1 className={styles.title}>Ideas</h1>
          <p className={styles.description}>
            {count === 0 ? 'Para futuros proyectos y cosas que no encajan todavía en uno.' : `${count} ${count === 1 ? 'idea guardada' : 'ideas guardadas'}`}
            {count === 0 && !isTouch ? ' Pulsa I para añadir la primera.' : ''}
          </p>
        </div>
        {!isMobile && (
          <div className={styles.actions}>
            <Button variant="primary" icon={<Plus />} shortcut="I" onClick={newIdea}>
              Nueva idea
            </Button>
          </div>
        )}
      </header>

      <IdeaGrid
        projectId={GENERAL_IDEAS_ID}
        general
        onCreate={newIdea}
        onOpen={(idea) => setDetailId(idea.id)}
        onEdit={(idea) => {
          setDetailId(null);
          setDialog({ idea });
        }}
        onDelete={setDeleting}
      />

      {isMobile && <Fab label="Nueva idea" onClick={newIdea} />}
      <IdeaDetailDialog
        idea={detail}
        onClose={() => setDetailId(null)}
        onEdit={(idea) => {
          setDetailId(null);
          setDialog({ idea });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="¿Eliminar esta idea?"
        description={`«${deleting?.title ?? ''}» se eliminará definitivamente.`}
        confirmLabel="Eliminar idea"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteIdea(deleting.id);
          setDeleting(null);
          toast('Idea eliminada.');
        }}
      />
      <IdeaFormDialog open={dialog !== null} onClose={() => setDialog(null)} projectId={GENERAL_IDEAS_ID} idea={dialog?.idea} />
    </div>
  );
}

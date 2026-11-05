import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Idea } from '../../core/model';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import styles from '../components/Form.module.css';

interface IdeaFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Si se pasa, se edita esta idea; si no, se crea una nueva. */
  idea?: Idea;
}

export function IdeaFormDialog({ open, onClose, projectId, idea }: IdeaFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={idea ? 'Editar idea' : 'Nueva idea'}>
      {open && <IdeaForm projectId={projectId} idea={idea} onDone={onClose} />}
    </Dialog>
  );
}

function IdeaForm({ projectId, idea, onDone }: { projectId: string; idea?: Idea; onDone: () => void }) {
  const [title, setTitle] = useState(idea?.title ?? '');
  const [description, setDescription] = useState(idea?.description ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const createIdea = useTasky((s) => s.createIdea);
  const updateIdea = useTasky((s) => s.updateIdea);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const canSubmit = title.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (idea) updateIdea(idea.id, { title, description });
    else createIdea(projectId, { title, description });
    onDone();
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Idea"
        data-autofocus
        placeholder="¿Qué se te ha ocurrido?"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextArea
        label="Descripción"
        optional
        placeholder="Desarróllala un poco, si quieres"
        value={description}
        maxLength={4000}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />

      <div className={styles.footer}>
        {idea && (
          <Button variant="ghost" icon={<Trash2 />} className={styles.delete} onClick={() => setConfirmingDelete(true)}>
            Eliminar
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onDone} shortcut="Esc">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} shortcut="Enter">
          {idea ? 'Guardar' : 'Guardar idea'}
        </Button>
      </div>

      {idea && (
        <ConfirmDialog
          open={confirmingDelete}
          title="¿Eliminar esta idea?"
          description={`«${idea.title}» se eliminará definitivamente.`}
          confirmLabel="Eliminar idea"
          onClose={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            deleteIdea(idea.id);
            onDone();
          }}
        />
      )}
    </form>
  );
}

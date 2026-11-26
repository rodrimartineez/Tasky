import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GENERAL_IDEAS_ID } from '../../core/ideas';
import type { Idea } from '../../core/model';
import { ideaGroups } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import styles from '../components/Form.module.css';
import chips from '../tasks/TaskFormDialog.module.css';

interface IdeaFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Si se pasa, se edita esta idea; si no, se crea una nueva. */
  idea?: Idea;
  /** Ideas generales: grupo donde se crea la idea nueva (null = suelta). */
  groupId?: string | null;
}

export function IdeaFormDialog({ open, onClose, projectId, idea, groupId = null }: IdeaFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={idea ? 'Editar idea' : 'Nueva idea'}>
      {open && <IdeaForm projectId={projectId} idea={idea} initialGroupId={groupId} onDone={onClose} />}
    </Dialog>
  );
}

function IdeaForm({
  projectId,
  idea,
  initialGroupId,
  onDone,
}: {
  projectId: string;
  idea?: Idea;
  initialGroupId: string | null;
  onDone: () => void;
}) {
  const data = useTasky((s) => s.data);
  /** Solo las ideas generales van en grupos. */
  const groups = projectId === GENERAL_IDEAS_ID ? ideaGroups(data) : [];
  const [title, setTitle] = useState(idea?.title ?? '');
  const [groupId, setGroupId] = useState<string | null>(() => {
    const current = idea ? idea.groupId : initialGroupId;
    return groups.some((g) => g.id === current) ? current : null;
  });
  const [description, setDescription] = useState(idea?.description ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const createIdea = useTasky((s) => s.createIdea);
  const updateIdea = useTasky((s) => s.updateIdea);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const setIdeaGroup = useTasky((s) => s.setIdeaGroup);
  const canSubmit = title.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (idea) {
      updateIdea(idea.id, { title, description });
      if (groups.length > 0) setIdeaGroup(idea.id, groupId);
    } else createIdea(projectId, { title, description }, groupId);
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

      {groups.length > 0 && (
        <fieldset className={chips.group}>
          <legend className={chips.legend}>
            Grupo
            <span className={styles.hint}>Opcional</span>
          </legend>
          <div className={chips.chips} role="group" aria-label="Grupo">
            {[{ id: null, name: 'Sin grupo' }, ...groups].map((g) => (
              <button
                key={g.id ?? 'none'}
                type="button"
                aria-pressed={groupId === g.id}
                className={`${chips.chip} ${groupId === g.id ? chips.chipSelected : ''}`}
                onClick={() => setGroupId(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

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

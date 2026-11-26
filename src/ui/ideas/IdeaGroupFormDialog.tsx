import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IdeaGroup } from '../../core/model';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import form from '../components/Form.module.css';

interface IdeaGroupFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Si se pasa, se edita este grupo; si no, se crea uno nuevo y se abre. */
  group?: IdeaGroup;
}

export function IdeaGroupFormDialog({ open, onClose, group }: IdeaGroupFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={group ? 'Editar grupo' : 'Nuevo grupo de ideas'}>
      {open && <IdeaGroupForm group={group} onDone={onClose} />}
    </Dialog>
  );
}

function IdeaGroupForm({ group, onDone }: { group?: IdeaGroup; onDone: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const createIdeaGroup = useTasky((s) => s.createIdeaGroup);
  const updateIdeaGroup = useTasky((s) => s.updateIdeaGroup);
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (group) {
      updateIdeaGroup(group.id, { name, description });
      onDone();
    } else {
      const id = createIdeaGroup({ name, description });
      onDone();
      navigate(`/ideas/${id}`);
    }
  };

  return (
    <form
      className={form.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Nombre"
        data-autofocus
        placeholder="p. ej. Viajes, Negocios, Libros…"
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label="Descripción"
        optional
        placeholder="Qué tipo de ideas guardarás aquí"
        value={description}
        maxLength={1000}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />

      <div className={form.footer}>
        <span className={form.spacer} />
        <Button variant="ghost" onClick={onDone} shortcut="Esc">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} shortcut="Enter">
          {group ? 'Guardar' : 'Crear grupo'}
        </Button>
      </div>
    </form>
  );
}

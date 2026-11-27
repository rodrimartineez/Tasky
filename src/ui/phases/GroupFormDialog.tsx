import { useMemo, useState } from 'react';
import type { ProjectGroup } from '../../core/model';
import { phaseGroup, projectPhases } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import form from '../components/Form.module.css';
import styles from './PhaseFormDialog.module.css';

interface GroupFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Si se pasa, se edita este grupo; si no, se crea uno nuevo. */
  group?: ProjectGroup;
}

/** Grupo de un proyecto: reúne fases (p. ej. una asignatura dentro de «Universidad»). */
export function GroupFormDialog({ open, onClose, projectId, group }: GroupFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={group ? 'Editar grupo' : 'Nuevo grupo'}>
      {open && <GroupForm projectId={projectId} group={group} onDone={onClose} />}
    </Dialog>
  );
}

function GroupForm({ projectId, group, onDone }: { projectId: string; group?: ProjectGroup; onDone: () => void }) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const data = useTasky((s) => s.data);
  const createProjectGroup = useTasky((s) => s.createProjectGroup);
  const updateProjectGroup = useTasky((s) => s.updateProjectGroup);
  /** Al crear: fases del proyecto que se pueden incorporar (solo las que no están en otro grupo). */
  const candidates = useMemo(
    () => (group ? [] : projectPhases(data, projectId).filter((f) => !phaseGroup(data, f))),
    [data, projectId, group],
  );
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (group) updateProjectGroup(group.id, { name, description });
    else createProjectGroup(projectId, { name, description }, selected);
    onDone();
  };

  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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
        placeholder="p. ej. Matemáticas, Frontend…"
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label="Descripción"
        optional
        placeholder="Qué reúne este grupo"
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

      {candidates.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={form.label}>
            Añadir fases existentes
            <span className={form.hint}>{selected.length > 0 ? `${selected.length} seleccionadas` : 'Opcional'}</span>
          </legend>
          <ul className={styles.list}>
            {candidates.map((phase) => (
              <li key={phase.id}>
                <label className={styles.option}>
                  <input type="checkbox" checked={selected.includes(phase.id)} onChange={() => toggle(phase.id)} />
                  <span className={styles.optionTitle}>{phase.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

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

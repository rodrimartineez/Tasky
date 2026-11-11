import { useMemo, useState } from 'react';
import type { Phase } from '../../core/model';
import { findPhase, projectTasks } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import form from '../components/Form.module.css';
import styles from './PhaseFormDialog.module.css';

interface PhaseFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Si se pasa, se edita esta fase; si no, se crea una nueva. */
  phase?: Phase;
}

export function PhaseFormDialog({ open, onClose, projectId, phase }: PhaseFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={phase ? 'Editar fase' : 'Nueva fase'}>
      {open && <PhaseForm projectId={projectId} phase={phase} onDone={onClose} />}
    </Dialog>
  );
}

function PhaseForm({ projectId, phase, onDone }: { projectId: string; phase?: Phase; onDone: () => void }) {
  const [name, setName] = useState(phase?.name ?? '');
  const [description, setDescription] = useState(phase?.description ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const data = useTasky((s) => s.data);
  const createPhase = useTasky((s) => s.createPhase);
  const updatePhase = useTasky((s) => s.updatePhase);
  /** Al crear: tareas abiertas del proyecto que se pueden incorporar (también las de otra fase, que cambian de fase). */
  const candidates = useMemo(() => (phase ? [] : projectTasks(data, projectId).open), [data, projectId, phase]);
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (phase) updatePhase(phase.id, { name, description });
    else createPhase(projectId, { name, description }, selected);
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
        placeholder="p. ej. Diseño, Lanzamiento…"
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label="Descripción"
        optional
        placeholder="Qué abarca esta fase"
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
            Añadir tareas existentes
            <span className={form.hint}>{selected.length > 0 ? `${selected.length} seleccionadas` : 'Opcional'}</span>
          </legend>
          <ul className={styles.list}>
            {candidates.map((task) => {
              const current = task.phaseId ? findPhase(data, task.phaseId) : undefined;
              return (
                <li key={task.id}>
                  <label className={styles.option}>
                    <input type="checkbox" checked={selected.includes(task.id)} onChange={() => toggle(task.id)} />
                    <span className={styles.optionTitle}>{task.title}</span>
                    {current && <span className={styles.optionPhase}>{current.name}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <div className={form.footer}>
        <span className={form.spacer} />
        <Button variant="ghost" onClick={onDone} shortcut="Esc">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} shortcut="Enter">
          {phase ? 'Guardar' : 'Crear fase'}
        </Button>
      </div>
    </form>
  );
}

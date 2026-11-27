import { useMemo, useState } from 'react';
import type { Phase } from '../../core/model';
import { findPhase, phaseGroup, projectGroups, projectTasks } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import form from '../components/Form.module.css';
import chips from '../tasks/TaskFormDialog.module.css';
import styles from './PhaseFormDialog.module.css';

interface PhaseFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Si se pasa, se edita esta fase; si no, se crea una nueva. */
  phase?: Phase;
  /** Grupo propuesto para una fase nueva (p. ej. al crearla desde un grupo). */
  groupId?: string;
}

export function PhaseFormDialog({ open, onClose, projectId, phase, groupId }: PhaseFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={phase ? 'Editar fase' : 'Nueva fase'}>
      {open && <PhaseForm projectId={projectId} phase={phase} initialGroupId={groupId ?? null} onDone={onClose} />}
    </Dialog>
  );
}

function PhaseForm({
  projectId,
  phase,
  initialGroupId,
  onDone,
}: {
  projectId: string;
  phase?: Phase;
  initialGroupId: string | null;
  onDone: () => void;
}) {
  const data = useTasky((s) => s.data);
  const [name, setName] = useState(phase?.name ?? '');
  const [description, setDescription] = useState(phase?.description ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const groups = useMemo(() => projectGroups(data, projectId), [data, projectId]);
  const currentGroupId = phase ? (phaseGroup(data, phase)?.id ?? null) : initialGroupId;
  const [groupId, setGroupId] = useState<string | null>(() => (groups.some((g) => g.id === currentGroupId) ? currentGroupId : null));
  const createPhase = useTasky((s) => s.createPhase);
  const updatePhase = useTasky((s) => s.updatePhase);
  const setPhaseGroup = useTasky((s) => s.setPhaseGroup);
  /** Al crear: tareas abiertas del proyecto que se pueden incorporar (también las de otra fase, que cambian de fase). */
  const candidates = useMemo(() => (phase ? [] : projectTasks(data, projectId).open), [data, projectId, phase]);
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (phase) {
      updatePhase(phase.id, { name, description });
      if (groupId !== currentGroupId) setPhaseGroup(phase.id, groupId);
    } else createPhase(projectId, { name, description }, selected, groupId);
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

      {groups.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={form.label}>
            Grupo
            <span className={form.hint}>Opcional</span>
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

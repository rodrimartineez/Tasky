import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import { addDays } from '../../core/dueDates';
import type { LocalDate, Task, TaskStatus } from '../../core/model';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import { Segmented, type SegmentedOption } from '../components/Segmented';
import { dueLabel } from './DueBadge';
import styles from './TaskFormDialog.module.css';

const STATUS_OPTIONS: SegmentedOption<TaskStatus>[] = [
  { value: 'todo', label: 'Pendiente', color: 'var(--text-faint)' },
  { value: 'in_progress', label: 'En curso', color: 'var(--orange-400)' },
  { value: 'done', label: 'Completada', color: 'var(--success)' },
];

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Si se pasa, se edita esta tarea; si no, se crea una nueva al final de la lista. */
  task?: Task;
}

export function TaskFormDialog({ open, onClose, projectId, task }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={task ? 'Editar tarea' : 'Nueva tarea'}>
      {open && <TaskForm projectId={projectId} task={task} onDone={onClose} />}
    </Dialog>
  );
}

function TaskForm({ projectId, task, onDone }: { projectId: string; task?: Task; onDone: () => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [dueDate, setDueDate] = useState<LocalDate | null>(task?.dueDate ?? null);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const createTask = useTasky((s) => s.createTask);
  const updateTask = useTasky((s) => s.updateTask);
  const deleteTask = useTasky((s) => s.deleteTask);
  const canSubmit = title.trim().length > 0;
  const today = getToday();

  const quickDates: { label: string; value: LocalDate }[] = [
    { label: 'Hoy', value: today },
    { label: 'Mañana', value: addDays(today, 1) },
    { label: 'En una semana', value: addDays(today, 7) },
  ];

  const submit = () => {
    if (!canSubmit) return;
    if (task) updateTask(task.id, { title, description, dueDate, status });
    else createTask(projectId, { title, description, dueDate });
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
        label="Título"
        data-autofocus
        placeholder="¿Qué hay que hacer?"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextArea
        label="Descripción"
        optional
        placeholder="Detalles, enlaces, notas…"
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

      <div className={styles.field}>
        <span className={styles.label}>
          Fecha límite
          <span className={styles.hint}>{dueDate ? dueLabel(dueDate, today) : 'Opcional'}</span>
        </span>
        <div className={styles.dateRow}>
          <input
            type="date"
            aria-label="Fecha límite"
            className={styles.date}
            value={dueDate ?? ''}
            onChange={(e) => setDueDate(e.target.value || null)}
          />
          {quickDates.map((q) => (
            <button
              key={q.label}
              type="button"
              className={`${styles.chip} ${dueDate === q.value ? styles.chipSelected : ''}`}
              onClick={() => setDueDate(q.value)}
            >
              {q.label}
            </button>
          ))}
          {dueDate && (
            <button type="button" className={styles.chip} onClick={() => setDueDate(null)}>
              Quitar
            </button>
          )}
        </div>
      </div>

      {task && (
        <div className={styles.field}>
          <span className={styles.label}>Estado</span>
          <Segmented label="Estado de la tarea" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        </div>
      )}

      <div className={styles.footer}>
        {task && (
          <Button variant="ghost" icon={<Trash2 />} className={styles.delete} onClick={() => setConfirmingDelete(true)}>
            Eliminar
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onDone} shortcut="Esc">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} shortcut="Enter">
          {task ? 'Guardar' : 'Crear tarea'}
        </Button>
      </div>

      {task && (
        <ConfirmDialog
          open={confirmingDelete}
          title="¿Eliminar esta tarea?"
          description={`«${task.title}» se eliminará definitivamente.`}
          confirmLabel="Eliminar tarea"
          onClose={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            deleteTask(task.id);
            onDone();
          }}
        />
      )}
    </form>
  );
}

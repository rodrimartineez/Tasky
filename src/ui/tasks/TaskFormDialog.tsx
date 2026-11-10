import { useState } from 'react';
import { CalendarPlus, Trash2, X } from 'lucide-react';
import { today as getToday } from '../../core/clock';
import { addDays, endOfWeek, isScheduledOn, weekday } from '../../core/dueDates';
import type { LocalDate, Task, TaskStatus, TimeSlot } from '../../core/model';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import { Segmented, type SegmentedOption } from '../components/Segmented';
import { dueLabel } from './DueBadge';
import { dayLabel, scheduleSummary } from './schedule';
import { TASK_STATUS_LABEL } from './TaskDetailDialog';
import { TIME_SLOT_OPTIONS } from './timeSlot';
import form from '../components/Form.module.css';
import styles from './TaskFormDialog.module.css';

const STATUS_OPTIONS: SegmentedOption<TaskStatus>[] = [
  { value: 'todo', label: TASK_STATUS_LABEL.todo, color: 'var(--text-faint)' },
  { value: 'in_progress', label: TASK_STATUS_LABEL.in_progress, color: 'var(--orange-400)' },
  { value: 'done', label: TASK_STATUS_LABEL.done, color: 'var(--success)' },
];

/** Ventana en la que se buscan las próximas apariciones de una tarea semanal (una semana desde hoy). */
const SCHEDULE_WINDOW = 7;

const weekFrom = (today: LocalDate) => Array.from({ length: SCHEDULE_WINDOW }, (_, i) => addDays(today, i));
const weekdaysOf = (days: LocalDate[]) => [...new Set(days.map(weekday))].sort().join();

/**
 * Días marcados al abrir el formulario. Con repetición semanal importan los días de la semana:
 * se marcan sus próximas apariciones (desde hoy) en lugar de las fechas de origen ya pasadas.
 */
function initialDays(task: Task | undefined, today: LocalDate): LocalDate[] {
  if (!task) return [];
  if (!task.repeatWeekly) return task.scheduledDays;
  const upcoming = weekFrom(today).filter((d) => isScheduledOn(task, d));
  return [...new Set([...upcoming, ...task.scheduledDays.filter((d) => d >= today)])].sort();
}

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
  const [scheduledDays, setScheduledDays] = useState<LocalDate[]>(() => initialDays(task, getToday()));
  const [repeatWeekly, setRepeatWeekly] = useState(task?.repeatWeekly ?? false);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(task?.timeSlot ?? 'all_day');
  const [dueDate, setDueDate] = useState<LocalDate | null>(task?.dueDate ?? null);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const createTask = useTasky((s) => s.createTask);
  const updateTask = useTasky((s) => s.updateTask);
  const deleteTask = useTasky((s) => s.deleteTask);
  const canSubmit = title.trim().length > 0;
  const today = getToday();

  const addDay = (day: LocalDate) => setScheduledDays((days) => (days.includes(day) ? days : [...days, day].sort()));
  const removeDay = (day: LocalDate) => setScheduledDays((days) => days.filter((d) => d !== day));
  const repeats = repeatWeekly && scheduledDays.length > 0;
  const schedule = scheduleSummary({ scheduledDays, repeatWeekly: repeats }, today);

  const quickDates: { label: string; value: LocalDate }[] = [
    { label: 'Hoy', value: today },
    { label: 'Mañana', value: addDays(today, 1) },
    { label: 'Esta semana', value: endOfWeek(today) },
  ];

  const submit = () => {
    if (!canSubmit) return;
    // Misma repetición semanal que antes: se conservan las fechas originales (no cuenta como cambio).
    const keepDays = task?.repeatWeekly && repeats && weekdaysOf(task.scheduledDays) === weekdaysOf(scheduledDays);
    const fields = { title, description, dueDate, timeSlot, scheduledDays: keepDays ? task.scheduledDays : scheduledDays, repeatWeekly: repeats };
    if (task) updateTask(task.id, { ...fields, status });
    else createTask(projectId, fields);
    onDone();
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

      {/* Programación: cuándo se va a hacer. */}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          ¿Cuándo lo harás?
          <span className={form.hint}>{schedule ?? 'Sin programar'}</span>
        </legend>

        <div className={styles.chips} role="group" aria-label="Días programados">
          {scheduledDays.map((day) => (
            <button
              key={day}
              type="button"
              className={`${styles.chip} ${styles.chipSelected} ${styles.removable}`}
              aria-label={`Quitar ${dayLabel(day, today)}`}
              title="Quitar"
              onClick={() => removeDay(day)}
            >
              {dayLabel(day, today)}
              <X />
            </button>
          ))}
          {/* Botón que abre el calendario del sistema: el campo de fecha nativo, invisible, ocupa todo el botón. */}
          <label className={styles.pickDay}>
            <CalendarPlus />
            {scheduledDays.length === 0 ? 'Elegir día' : 'Añadir otro día'}
            <input
              type="date"
              className={styles.pickInput}
              aria-label="Elegir día en el calendario"
              min={today}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  // Sin showPicker (o ya abierto), el navegador abre el calendario por sí mismo.
                }
              }}
              onChange={(e) => {
                if (e.target.value) addDay(e.target.value);
              }}
              // Vacío al cerrar el calendario, para poder elegir de nuevo cualquier día.
              onBlur={(e) => (e.target.value = '')}
            />
          </label>
        </div>

        <div className={form.field}>
          <span className={form.label}>Franja horaria</span>
          <Segmented label="Franja horaria" value={timeSlot} options={TIME_SLOT_OPTIONS} onChange={setTimeSlot} />
        </div>

        <label className={`${styles.toggle} ${scheduledDays.length === 0 ? styles.toggleDisabled : ''}`}>
          <input
            type="checkbox"
            role="switch"
            className={styles.toggleInput}
            checked={repeats}
            disabled={scheduledDays.length === 0}
            onChange={(e) => setRepeatWeekly(e.target.checked)}
          />
          <span className={styles.switch} aria-hidden />
          <span className={styles.toggleText}>
            Repetir cada semana
            <span className={form.hint}>{scheduledDays.length === 0 ? 'Elige antes algún día' : 'Los mismos días de la semana'}</span>
          </span>
        </label>
      </fieldset>

      {/* Fecha límite: cuándo debe estar terminada. Independiente de la programación. */}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          Fecha límite
          <span className={form.hint}>{dueDate ? dueLabel(dueDate, today) : 'Opcional'}</span>
        </legend>
        <div className={styles.chips}>
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
              aria-pressed={dueDate === q.value}
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
      </fieldset>

      {task && (
        <div className={form.field}>
          <span className={form.label}>Estado</span>
          <Segmented label="Estado de la tarea" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        </div>
      )}

      <div className={form.footer}>
        {task && (
          <Button variant="ghost" icon={<Trash2 />} className={form.delete} onClick={() => setConfirmingDelete(true)}>
            Eliminar
          </Button>
        )}
        <span className={form.spacer} />
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

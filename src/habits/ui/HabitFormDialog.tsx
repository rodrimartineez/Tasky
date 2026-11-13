import { useState } from 'react';
import { Button } from '../../ui/components/Button';
import { Dialog } from '../../ui/components/Dialog';
import { TextField } from '../../ui/components/Field';
import { Segmented, type SegmentedOption } from '../../ui/components/Segmented';
import { toast } from '../../ui/components/Toaster';
import formStyles from '../../ui/components/Form.module.css';
import { WEEKLY_REWARD } from '../core/rewards';
import type { Habit, HabitKind, HabitPeriod } from '../core/model';
import { useHabits } from '../state/store';
import { formatAmount } from './view';
import styles from './HabitFormDialog.module.css';

const KIND_OPTIONS: SegmentedOption<HabitKind>[] = [
  { value: 'build', label: 'Hacer más', color: 'var(--hb-build)' },
  { value: 'reduce', label: 'Hacer menos', color: 'var(--hb-reduce)' },
];
const PERIOD_OPTIONS: SegmentedOption<HabitPeriod>[] = [
  { value: 'daily', label: 'Cada día', color: 'var(--hb-gold)' },
  { value: 'weekly', label: 'Cada semana', color: 'var(--hb-gem)' },
];

/** Acepta coma o punto decimal ("0,25"). NaN si no es un número. */
const parseNumber = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')));
/** Valor inicial de un campo numérico (sin separador de miles, que se confundiría con el decimal). */
const toInput = (n: number) => String(n).replace('.', ',');

interface HabitFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Si se pasa, edita este hábito; si no, crea uno nuevo. */
  habit?: Habit;
  /** Objetivo vigente del hábito que se edita. */
  currentTarget?: number;
}

export function HabitFormDialog({ open, onClose, habit, currentTarget }: HabitFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={habit ? 'Editar hábito' : 'Nuevo hábito'}>
      {open && <HabitForm habit={habit} currentTarget={currentTarget} onDone={onClose} />}
    </Dialog>
  );
}

function HabitForm({ habit, currentTarget, onDone }: { habit?: Habit; currentTarget?: number; onDone: () => void }) {
  const [name, setName] = useState(habit?.name ?? '');
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'build');
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? 'daily');
  const [target, setTarget] = useState(habit ? toInput(currentTarget ?? 1) : '1');
  const [unit, setUnit] = useState(habit?.unit ?? '');
  const [step, setStep] = useState(habit ? toInput(habit.step) : '1');
  const createHabit = useHabits((s) => s.createHabit);
  const updateHabit = useHabits((s) => s.updateHabit);

  const targetValue = parseNumber(target);
  const stepValue = parseNumber(step);
  const validTarget = targetValue > 0;
  const valid = name.trim().length > 0 && validTarget && stepValue > 0;
  const build = kind === 'build';

  const submit = () => {
    if (!valid) return;
    try {
      if (habit) updateHabit(habit.id, { name, unit, step: stepValue, target: targetValue });
      else createHabit({ name, kind, period, unit, step: stepValue, target: targetValue });
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar el hábito.', 'error');
    }
  };

  return (
    <form
      className={formStyles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Nombre"
        data-autofocus
        placeholder={build ? 'Leer, beber agua, caminar…' : 'Tocarse la cara, mirar el móvil…'}
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />

      {habit ? (
        <p className={styles.fixed}>
          {build ? 'Hacer más' : 'Hacer menos'} · {period === 'daily' ? 'cada día' : 'cada semana'}
          <span> (el tipo y la periodicidad no se cambian para no alterar el historial)</span>
        </p>
      ) : (
        <>
          <div className={formStyles.field}>
            <span className={formStyles.label}>Tipo</span>
            <Segmented label="Tipo de hábito" value={kind} options={KIND_OPTIONS} onChange={setKind} />
          </div>
          <div className={formStyles.field}>
            <span className={formStyles.label}>Periodicidad</span>
            <Segmented label="Periodicidad" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
          </div>
        </>
      )}

      <div className={styles.row}>
        <TextField
          label={build ? 'Objetivo' : 'Límite máximo'}
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <TextField label="Unidad" optional placeholder="min, vasos, veces…" value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} />
        <TextField label={build ? 'Cada registro suma' : 'Cada registro resta'} inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
      </div>

      <p className={styles.hint}>
        {build
          ? `Se cumple al llegar a ${validTarget ? formatAmount(targetValue) : '…'}${unit ? ` ${unit}` : ''} ${period === 'daily' ? 'en el día' : 'en la semana'}.`
          : `Es lo máximo que puedes hacerlo ${period === 'daily' ? 'al día' : 'a la semana'}: empiezas con ${validTarget ? formatAmount(targetValue) : '…'} disponibles y cada registro resta. Se cumple si no te pasas del límite.`}{' '}
        {!build && period === 'daily' ? (
          <>
            Si al cerrar el día (00:00) no te has pasado, recibes <strong>1 punto y 1 intento</strong>; si te pasas, nada.
          </>
        ) : period === 'daily' ? (
          <>
            Cumplirlo da <strong>1 punto y 1 intento</strong> al cerrar el día (00:00), y más puntos cuanto más larga sea la racha (2 a los 3 días, 3 a los 7…).
          </>
        ) : (
          <>
            Cada porción da <strong>1 intento al cerrar el día</strong>; cumplirlo da <strong>{WEEKLY_REWARD} puntos</strong> al cerrar la semana (domingo a las 24:00).
          </>
        )}
        {habit && ' Un objetivo nuevo vale desde el periodo actual.'}
      </p>

      <div className={formStyles.footer}>
        <span className={formStyles.spacer} />
        <Button variant="ghost" onClick={onDone} shortcut="Esc">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!valid} shortcut="Enter">
          {habit ? 'Guardar' : 'Crear hábito'}
        </Button>
      </div>
    </form>
  );
}

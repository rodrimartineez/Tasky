import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Menu, type MenuItem } from '../../ui/components/Menu';
import type { PeriodResult } from '../core/habits';
import { addDays, mondayOf, periodKey, periodStart } from '../core/periods';
import { nextMilestone, SHIELD_EVERY } from '../core/rewards';
import { useHabits } from '../state/store';
import { HabitCard } from './HabitCard';
import { HabitFormDialog } from './HabitFormDialog';
import { FlameIcon, ShieldIcon, SwordIcon } from './icons';
import { useHabitViews, withUnit } from './view';
import styles from './HabitPage.module.css';

const WEEKS_SHOWN = 12;

export function HabitPage() {
  const { habitId } = useParams();
  const navigate = useNavigate();
  const view = useHabitViews().find((v) => v.habit.id === habitId);
  const today = useHabits((s) => s.today);
  const archiveHabit = useHabits((s) => s.archiveHabit);
  const deleteHabit = useHabits((s) => s.deleteHabit);
  const earned = useHabits((s) => s.data.ledger.reduce((sum, e) => (e.habitId === habitId ? sum + e.points : sum), 0));
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!view) return <Navigate to="/habits" replace />;
  const { habit, results, streak, best, target, shield, charge } = view;
  const build = habit.kind === 'build';
  const archived = habit.archivedAt !== null;
  const closed = results.filter((r) => r.closed);
  const metCount = closed.filter((r) => r.met).length;
  const unitWord = habit.period === 'daily' ? 'días' : 'semanas';

  const items: MenuItem[] = [
    { label: 'Editar', icon: <Pencil />, onSelect: () => setEditing(true) },
    archived
      ? { label: 'Restaurar', icon: <ArchiveRestore />, onSelect: () => archiveHabit(habit.id, false) }
      : { label: 'Archivar', icon: <Archive />, onSelect: () => archiveHabit(habit.id, true) },
    { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Link to="/habits" className={styles.back}>
          <ArrowLeft /> Hábitos
        </Link>
        <Menu label="Acciones del hábito" trigger={<Ellipsis />} items={items} triggerClassName={styles.menu} />
      </div>

      <header className={styles.header}>
        <span className={styles.kind}>
          {build ? <SwordIcon size={18} /> : <ShieldIcon size={18} />}
          {build ? 'Hacer más' : 'Hacer menos'} · {habit.period === 'daily' ? 'cada día' : 'cada semana'} ·{' '}
          {build ? 'objetivo' : 'límite'} {withUnit(target, habit.unit)}
        </span>
        <h1 className={styles.title}>{habit.name}</h1>
        {archived && <p className={styles.archived}>Archivado: no se registra ni da puntos hasta que lo restaures.</p>}
      </header>

      <HabitCard view={view} />

      <div className={styles.stats}>
        <Stat label="Racha actual" value={streak} unit={unitWord} icon={<FlameIcon size={16} />} />
        <Stat label="Mejor racha" value={best} unit={unitWord} />
        <Stat label="Cumplidos" value={metCount} unit={`de ${closed.length}`} />
        <Stat label="Puntos ganados" value={earned} unit="" />
      </div>
      {habit.period === 'daily' && !archived && (
        <p className={styles.milestone}>
          <FlameIcon size={14} /> Próximo hito de racha: {nextMilestone(streak).days} días → {nextMilestone(streak).points} puntos por día cumplido.{' '}
          {shield
            ? 'Tienes un escudo: si fallas un día, tu racha no se romperá.'
            : `Escudo de racha en ${SHIELD_EVERY - charge} ${SHIELD_EVERY - charge === 1 ? 'día cumplido' : 'días cumplidos'}.`}
        </p>
      )}

      <section className={styles.historySection}>
        <h2 className={styles.sectionTitle}>Historial</h2>
        {habit.period === 'daily' ? <DailyHistory results={results} today={today} /> : <WeeklyHistory results={results} today={today} />}
        <div className={styles.legend}>
          <span><i className={styles.met} /> Cumplido</span>
          <span><i className={styles.missed} /> No cumplido</span>
          {habit.period === 'daily' && <span><i className={styles.shielded} /> Salvado por un escudo</span>}
          <span><i className={styles.open} /> En curso</span>
        </div>
      </section>

      <Evolution results={results} build={build} daily={habit.period === 'daily'} unit={habit.unit} />

      <HabitFormDialog open={editing} onClose={() => setEditing(false)} habit={habit} currentTarget={target} />
      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar hábito"
        description={
          <>
            Se eliminará «{habit.name}» y su historial. Los puntos que ya ganaste <strong>se conservan</strong>. Si solo quieres dejarlo en
            pausa, archívalo.
          </>
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          deleteHabit(habit.id);
          navigate('/habits', { replace: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

const monthFormat = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const MONTHS_SHOWN = 6;

/**
 * Evolución mes a mes (últimos 6 meses con datos): porcentaje de periodos cumplidos y media registrada por día o por
 * semana frente al objetivo (o al límite). Cada periodo cuenta en el mes en que empieza; solo periodos cerrados.
 */
function Evolution({ results, build, daily, unit }: { results: PeriodResult[]; build: boolean; daily: boolean; unit: string }) {
  const byMonth = new Map<string, PeriodResult[]>();
  for (const r of results) {
    if (!r.closed) continue;
    const month = periodStart(r.key).slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), r]);
  }
  const months = [...byMonth.entries()].slice(-MONTHS_SHOWN);
  if (months.length === 0) return null;
  const per = daily ? 'día' : 'semana';
  return (
    <section className={styles.historySection}>
      <h2 className={styles.sectionTitle}>Evolución</h2>
      <ul className={styles.evolution}>
        {months.map(([month, list]) => {
          const met = list.filter((r) => r.met).length;
          const share = met / list.length;
          const average = list.reduce((sum, r) => sum + r.amount, 0) / list.length;
          const target = list[list.length - 1].target;
          return (
            <li key={month}>
              <span className={styles.evoMonth}>{monthFormat.format(new Date(`${month}-15T12:00:00Z`))}</span>
              <span className={styles.evoBar} aria-hidden>
                <span style={{ width: `${share * 100}%` }} />
              </span>
              <span className={styles.evoText}>
                <b>{Math.round(share * 100)} %</b> cumplido · media {average.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                {unit ? ` ${unit}` : ''} por {per} ({build ? 'objetivo' : 'límite'} {target.toLocaleString('es-ES')})
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value, unit, icon }: { label: string; value: number; unit: string; icon?: React.ReactNode }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {icon}
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}

const dayFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatDay = (d: string) => dayFormat.format(new Date(`${d}T12:00:00Z`));

function cellClass(r: PeriodResult | undefined) {
  if (!r) return styles.none;
  if (!r.closed) return styles.open;
  return r.met ? styles.met : r.shielded ? styles.shielded : styles.missed;
}

function cellTitle(r: PeriodResult | undefined, label: string) {
  if (!r) return `${label}: sin hábito`;
  return `${label}: ${r.amount} de ${r.target}${r.closed ? (r.met ? ' · cumplido' : r.shielded ? ' · salvado por un escudo' : ' · no cumplido') : ' · en curso'}`;
}

/** Calendario de las últimas semanas: columnas = semanas, filas = lunes…domingo. */
function DailyHistory({ results, today }: { results: PeriodResult[]; today: string }) {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const firstMonday = addDays(mondayOf(today), -7 * (WEEKS_SHOWN - 1));
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)));
  return (
    <div className={styles.calendar} role="img" aria-label={`Historial de las últimas ${WEEKS_SHOWN} semanas`}>
      {weeks.map((days) => (
        <div key={days[0]} className={styles.week}>
          {days.map((day) =>
            day > today ? (
              <span key={day} className={`${styles.cell} ${styles.future}`} />
            ) : (
              <span key={day} className={`${styles.cell} ${cellClass(byKey.get(day))}`} title={cellTitle(byKey.get(day), formatDay(day))} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function WeeklyHistory({ results, today }: { results: PeriodResult[]; today: string }) {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const current = periodKey('weekly', today);
  const keys = Array.from({ length: 26 }, (_, i) => `W${addDays(periodStart(current), -7 * (25 - i))}`);
  return (
    <div className={styles.weeks} role="img" aria-label="Historial de las últimas 26 semanas">
      {keys.map((key) => (
        <span key={key} className={`${styles.cell} ${cellClass(byKey.get(key))}`} title={cellTitle(byKey.get(key), `Semana del ${formatDay(periodStart(key))}`)} />
      ))}
    </div>
  );
}

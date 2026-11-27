import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Menu, type MenuItem } from '../../ui/components/Menu';
import type { PeriodResult } from '../core/habits';
import { addDays, mondayOf, periodKey, periodStart } from '../core/periods';
import { SHIELD_EVERY } from '../core/rewards';
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
        {archived && <p className={styles.archived}>Archivado: no se registra ni da intentos hasta que lo restaures.</p>}
      </header>

      <HabitCard view={view} />

      <div className={styles.stats}>
        <Stat label="Racha actual" value={streak} unit={unitWord} icon={<FlameIcon size={16} />} />
        <Stat label="Mejor racha" value={best} unit={unitWord} />
        <Stat label="Cumplidos" value={metCount} unit={`de ${closed.length}`} />
      </div>
      {habit.period === 'daily' && !archived && (
        <p className={styles.milestone}>
          <FlameIcon size={14} />{' '}
          {shield
            ? 'Tienes un día libre: si fallas un día, tu racha no se romperá.'
            : `Día libre en ${SHIELD_EVERY - charge} ${SHIELD_EVERY - charge === 1 ? 'día cumplido' : 'días cumplidos'} seguidos.`}
        </p>
      )}

      <section className={styles.historySection}>
        <h2 className={styles.sectionTitle}>Historial</h2>
        {habit.period === 'daily' ? <DailyHistory results={results} today={today} /> : <WeeklyHistory results={results} today={today} />}
        <div className={styles.legend}>
          <span><i className={styles.met} /> Cumplido</span>
          <span><i className={styles.missed} /> No cumplido</span>
          {habit.period === 'daily' && <span><i className={styles.shielded} /> Día libre usado</span>}
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
  return `${label}: ${r.amount} de ${r.target}${r.closed ? (r.met ? ' · cumplido' : r.shielded ? ' · día libre usado' : ' · no cumplido') : ' · en curso'}`;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const monthShort = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' });
/** Día que mantiene la racha (cumplido o salvado por el día libre): se une con sus vecinos. */
const keepsStreak = (r: PeriodResult | undefined) => !!r && (r.met || r.shielded);

/**
 * Calendario de las últimas semanas como un calendario de pared: filas = semanas (lunes…domingo) con el número del
 * día. Los cumplidos brillan y los seguidos se unen en una tira, para ver las rachas de un vistazo; encima, el
 * porcentaje cumplido del periodo mostrado.
 */
function DailyHistory({ results, today }: { results: PeriodResult[]; today: string }) {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const firstMonday = addDays(mondayOf(today), -7 * (WEEKS_SHOWN - 1));
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)));
  const shown = weeks.flat().map((day) => byKey.get(day)).filter((r): r is PeriodResult => !!r && r.closed);
  const met = shown.filter((r) => r.met).length;
  return (
    <div className={styles.calWrap}>
      <HistorySummary met={met} total={shown.length} what="días cumplidos" span={`las últimas ${WEEKS_SHOWN} semanas`} />
      <div className={styles.cal} role="img" aria-label={`Historial de las últimas ${WEEKS_SHOWN} semanas: ${met} días cumplidos`}>
        <span />
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.calHead}>
            {d}
          </span>
        ))}
        {weeks.map((days, w) => {
          const newMonth = days.find((d) => d.endsWith('-01'));
          const label = w === 0 ? days[0] : newMonth;
          return [
            <span key={`m${days[0]}`} className={styles.calMonth}>
              {label ? monthShort.format(new Date(`${label}T12:00:00Z`)).replace('.', '') : ''}
            </span>,
            ...days.map((day, i) => {
              const r = byKey.get(day);
              if (day > today) return <span key={day} className={`${styles.day} ${styles.future}`} />;
              const chain = keepsStreak(r) || (!!r && !r.closed && r.met);
              const joinNext = chain && i < 6 && days[i + 1] <= today && (keepsStreak(byKey.get(days[i + 1])) || !!byKey.get(days[i + 1])?.met);
              return (
                <span
                  key={day}
                  className={`${styles.day} ${cellClass(r)} ${joinNext ? styles.joinNext : ''} ${day === today ? styles.today : ''}`}
                  title={cellTitle(r, formatDay(day))}
                >
                  {Number(day.slice(8))}
                  {r?.shielded && (
                    <span className={styles.dayBadge}>
                      <ShieldIcon size={10} />
                    </span>
                  )}
                </span>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

/** Resumen encima del historial: cumplidos del periodo mostrado, con barra y porcentaje. */
function HistorySummary({ met, total, what, span }: { met: number; total: number; what: string; span: string }) {
  if (total === 0) return null;
  const share = met / total;
  return (
    <div className={styles.calSummary}>
      <span>
        <b>{met}</b> de {total} {what} en {span}
      </span>
      <span className={styles.calBar} aria-hidden>
        <span style={{ width: `${share * 100}%` }} />
      </span>
      <b className={styles.calPct}>{Math.round(share * 100)} %</b>
    </div>
  );
}

const WEEKS_SHOWN_WEEKLY = 26;

/**
 * Historial semanal con el mismo estilo que el diario: una fila por mes con sus semanas (día en que empiezan y lo
 * registrado frente al objetivo); las cumplidas brillan y las seguidas se unen en una tira.
 */
function WeeklyHistory({ results, today }: { results: PeriodResult[]; today: string }) {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const current = periodKey('weekly', today);
  const keys = Array.from({ length: WEEKS_SHOWN_WEEKLY }, (_, i) => `W${addDays(periodStart(current), -7 * (WEEKS_SHOWN_WEEKLY - 1 - i))}`);
  const months: { month: string; keys: string[] }[] = [];
  for (const key of keys) {
    const month = periodStart(key).slice(0, 7);
    if (months.at(-1)?.month === month) months.at(-1)!.keys.push(key);
    else months.push({ month, keys: [key] });
  }
  const shown = keys.map((k) => byKey.get(k)).filter((r): r is PeriodResult => !!r && r.closed);
  const met = shown.filter((r) => r.met).length;
  return (
    <div className={styles.calWrap}>
      <HistorySummary met={met} total={shown.length} what="semanas cumplidas" span={`las últimas ${WEEKS_SHOWN_WEEKLY} semanas`} />
      <div className={styles.weekCal} role="img" aria-label={`Historial de las últimas ${WEEKS_SHOWN_WEEKLY} semanas: ${met} cumplidas`}>
        {months.map(({ month, keys: row }) => [
          <span key={month} className={styles.calMonth}>
            {monthShort.format(new Date(`${month}-15T12:00:00Z`)).replace('.', '')}
          </span>,
          <span key={`${month}-weeks`} className={styles.weekRow}>
            {row.map((key, i) => {
              const r = byKey.get(key);
              const next = row[i + 1] && byKey.get(row[i + 1]);
              const joinNext = (keepsStreak(r) || (!!r && r.met)) && !!next && (keepsStreak(next) || next.met);
              return (
                <span
                  key={key}
                  className={`${styles.day} ${styles.weekCell} ${cellClass(r)} ${joinNext ? styles.joinNext : ''} ${key === current ? styles.today : ''}`}
                  title={cellTitle(r, `Semana del ${formatDay(periodStart(key))}`)}
                >
                  <b>{Number(periodStart(key).slice(8))}</b>
                  {r && <small>{`${r.amount}/${r.target}`}</small>}
                </span>
              );
            })}
          </span>,
        ])}
      </div>
    </div>
  );
}

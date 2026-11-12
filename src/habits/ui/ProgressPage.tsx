import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trophy } from 'lucide-react';
import { ATTEMPTS } from '../core/economy';
import type { PeriodResult } from '../core/habits';
import { addDays, mondayOf, periodEnd, periodOfKey, periodStart } from '../core/periods';
import { useEconomy, useHabits } from '../state/store';
import { FlameIcon, ShieldIcon, SwordIcon } from './icons';
import { GemIcon } from './PointsBadge';
import { useHabitViews, type HabitView } from './view';
import styles from './ProgressPage.module.css';

const dayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);
const percent = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)} %` : '—');

const streakText = (streak: unknown) => (typeof streak === 'number' && streak > 1 ? `Racha de ${streak} días` : 'Diario');

type Tab = 'summary' | 'history';

/** Periodos que se muestran en la tira de cada hábito: 14 días o 8 semanas. */
const STRIP = { daily: 14, weekly: 8 };

/**
 * Progreso (antes «Recompensas»): cómo van los hábitos. El resumen da lo ganado esta semana y este mes, el
 * cumplimiento de los últimos 30 días y cada hábito con su racha y sus últimos periodos (tocarlo abre su ficha con el
 * calendario y la evolución). «Movimientos» conserva el historial de puntos, día a día.
 */
export function ProgressPage() {
  const [tab, setTab] = useState<Tab>('summary');
  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist" aria-label="Secciones de progreso">
        {(
          [
            ['summary', 'Resumen'],
            ['history', 'Movimientos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'summary' ? <Summary /> : <Movements />}
    </div>
  );
}

function Summary() {
  const data = useHabits((s) => s.data);
  const today = useHabits((s) => s.today);
  const views = useHabitViews();

  const totals = useMemo(() => {
    const weekFrom = mondayOf(today);
    const monthFrom = `${today.slice(0, 7)}-01`;
    const t = { weekPoints: 0, weekAttempts: 0, monthPoints: 0, monthAttempts: 0 };
    for (const e of data.ledger) {
      if (e.kind !== 'habit_reward' || !e.period || e.deletedAt) continue;
      const end = periodEnd(e.period);
      const attempts = periodOfKey(e.period) === 'weekly' ? ATTEMPTS.weekly : ATTEMPTS.daily;
      if (end >= weekFrom) {
        t.weekPoints += e.points;
        t.weekAttempts += attempts;
      }
      if (end >= monthFrom) {
        t.monthPoints += e.points;
        t.monthAttempts += attempts;
      }
    }
    return t;
  }, [data, today]);

  const active = views.filter((v) => v.habit.archivedAt === null);
  // Cumplimiento de los últimos 30 días cerrados (solo diarios: los semanales se ven en su tira).
  const since = addDays(today, -30);
  const last30 = active.flatMap((v) => (v.habit.period === 'daily' ? v.results.filter((r) => r.closed && r.key >= since) : []));
  const met30 = last30.filter((r) => r.met).length;
  const bestStreak = active.reduce<HabitView | null>((best, v) => (!best || v.streak > best.streak ? v : best), null);
  const sorted = [...active].sort((a, b) => b.streak - a.streak || a.habit.name.localeCompare(b.habit.name));

  return (
    <>
      <section className={styles.summary} aria-label="Resumen">
        <div>
          <b>+{totals.weekPoints}</b>
          <span>puntos esta semana</span>
          <small>+{totals.weekAttempts} intentos</small>
        </div>
        <div>
          <b>+{totals.monthPoints}</b>
          <span>puntos este mes</span>
          <small>+{totals.monthAttempts} intentos</small>
        </div>
        <div>
          <b>{percent(met30, last30.length)}</b>
          <span>días cumplidos</span>
          <small>últimos 30 días</small>
        </div>
        <div>
          <b>{bestStreak?.streak ?? 0}</b>
          <span>mejor racha actual</span>
          <small>{bestStreak && bestStreak.streak > 0 ? bestStreak.habit.name : '—'}</small>
        </div>
      </section>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <Trophy />
          <p>Crea tu primer hábito y aquí verás cómo evoluciona cada uno.</p>
        </div>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.heading}>Tus hábitos</h2>
          <ul className={styles.habits}>
            {sorted.map((v) => (
              <HabitRow key={v.habit.id} view={v} since={since} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function HabitRow({ view, since }: { view: HabitView; since: string }) {
  const { habit, results, streak, best } = view;
  const daily = habit.period === 'daily';
  const recent = results.filter((r) => r.closed && (daily ? r.key >= since : true)).slice(daily ? 0 : -12);
  const strip: (PeriodResult | null)[] = results.slice(-STRIP[habit.period]);
  while (strip.length < STRIP[habit.period]) strip.unshift(null);
  const unit = daily ? 'días' : 'semanas';
  return (
    <li>
      <Link to={`/habits/habit/${habit.id}`} className={styles.habit}>
        <span className={`${styles.kind} ${habit.kind === 'build' ? styles.build : styles.reduce}`} aria-hidden>
          {habit.kind === 'build' ? <SwordIcon size={16} /> : <ShieldIcon size={16} />}
        </span>
        <span className={styles.habitBody}>
          <b>{habit.name}</b>
          <small>
            <FlameIcon size={12} /> {streak} {unit} · mejor {best} · {percent(recent.filter((r) => r.met).length, recent.length)} cumplido
            {daily ? ' (30 días)' : ' (12 semanas)'}
          </small>
          <span className={styles.strip} aria-label={daily ? 'Últimos 14 días' : 'Últimas 8 semanas'}>
            {strip.map((r, i) => (
              <i
                key={r?.key ?? `empty-${i}`}
                className={!r ? styles.none : !r.closed ? styles.open : r.met ? styles.met : r.shielded ? styles.shielded : styles.missed}
                title={r ? `${shortFormat.format(asDate(periodStart(r.key)))}: ${r.amount} de ${r.target}` : undefined}
              />
            ))}
          </span>
        </span>
        <ChevronRight className={styles.chevron} />
      </Link>
    </li>
  );
}

/** Historial de puntos (ledger): de dónde sale cada punto, agrupado por el día en que se entregó. */
function Movements() {
  const data = useHabits((s) => s.data);
  const balance = useEconomy().points;

  const groups = useMemo(() => {
    const names = new Map(data.habits.map((h) => [h.id, h.name]));
    const rewards = data.ledger
      .filter((e) => e.kind === 'habit_reward' && e.period)
      .map((e) => {
        const key = e.period as string;
        const weekly = periodOfKey(key) === 'weekly';
        return {
          id: e.id,
          points: e.points,
          name: (e.habitId && names.get(e.habitId)) ?? 'Hábito eliminado',
          detail: weekly ? `Semana del ${shortFormat.format(asDate(periodStart(key)))}` : streakText(e.details?.streak),
          // Las recompensas de un día y las de la semana que termina ese domingo se agrupan juntas.
          closedOn: periodEnd(key),
        };
      })
      .sort((a, b) => b.closedOn.localeCompare(a.closedOn) || b.points - a.points);
    const byDay = new Map<string, typeof rewards>();
    for (const r of rewards) byDay.set(r.closedOn, [...(byDay.get(r.closedOn) ?? []), r]);
    return [...byDay.entries()];
  }, [data]);

  return (
    <>
      <div className={styles.balance}>
        <GemIcon size={40} />
        <div>
          <p className={styles.balanceValue}>{balance}</p>
          <p className={styles.balanceLabel}>puntos de hábito disponibles</p>
        </div>
      </div>
      <p className={styles.note}>
        Los puntos se consiguen solo cumpliendo hábitos y se gastan en mejoras permanentes del personaje. Se entregan una sola vez, al
        cerrar cada día a las 00:00 y cada semana el domingo a las 24:00. Un hábito diario positivo da 1 punto, y uno más al llegar a cada
        hito de racha (3, 7, 14, 30, 60, 100, 180 y 365 días, y luego cada año). Uno diario de reducción da 1 punto si no te pasas del
        límite. Un hábito semanal da 3 puntos. La mejora Constancia suma más a los positivos.
      </p>

      {groups.length === 0 ? (
        <div className={styles.empty}>
          <Trophy />
          <p>Aún no hay recompensas. La primera llegará al cerrar el día en que cumplas un hábito.</p>
        </div>
      ) : (
        groups.map(([day, rewards]) => (
          <section key={day} className={styles.group}>
            <header className={styles.groupHeader}>
              <h2>{dayFormat.format(asDate(day))}</h2>
              <span>+{rewards.reduce((s, r) => s + r.points, 0)}</span>
            </header>
            <ul className={styles.list}>
              {rewards.map((r) => (
                <li key={r.id} className={styles.item}>
                  <span className={styles.itemName}>{r.name}</span>
                  <span className={styles.itemDetail}>{r.detail}</span>
                  <span className={styles.itemPoints}>
                    +{r.points} <GemIcon size={12} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

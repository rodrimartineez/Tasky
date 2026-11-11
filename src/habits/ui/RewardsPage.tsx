import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { periodEnd, periodOfKey, periodStart } from '../core/periods';
import { useEconomy, useHabits } from '../state/store';
import { GemIcon } from './PointsBadge';
import styles from './RewardsPage.module.css';

const dayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);

const streakText = (streak: unknown) => (typeof streak === 'number' && streak > 1 ? `Racha de ${streak} días` : 'Diario');

/** Historial de recompensas (ledger): de dónde sale cada punto. */
export function RewardsPage() {
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
    <div className={styles.page}>
      <div className={styles.balance}>
        <GemIcon size={40} />
        <div>
          <p className={styles.balanceValue}>{balance}</p>
          <p className={styles.balanceLabel}>puntos de hábito disponibles</p>
        </div>
      </div>
      <p className={styles.note}>
        Los puntos se consiguen solo cumpliendo hábitos y se gastan en mejoras permanentes del personaje. Se entregan una sola vez, al
        cerrar cada día a las 00:00 y cada semana el domingo a las 24:00. Un hábito diario da 1 punto, y uno más al llegar a cada hito de
        racha (3, 7, 14, 30, 60, 100, 180 y 365 días, y luego cada año). Un hábito semanal da siempre 3 puntos.
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
    </div>
  );
}


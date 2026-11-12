import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { SKINS } from '../../game/content/skins';
import { achievementsOf, recordsOf, type GroupStats } from '../core/records';
import { useEconomy, useHabits } from '../state/store';
import styles from './RecordsPage.module.css';

const n = (x: number) => Math.round(x).toLocaleString('es-ES');
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const hours = (seconds: number) =>
  seconds >= 3600 ? `${(seconds / 3600).toLocaleString('es-ES', { maximumFractionDigits: 1 })} h` : `${Math.round(seconds / 60)} min`;

function GroupTable({ title, rows }: { title: string; rows: GroupStats[] }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Partidas</th>
            <th scope="col">Superadas</th>
            <th scope="col">Mejor tiempo</th>
            <th scope="col">Más bajas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              <td>{n(r.runs)}</td>
              <td>{n(r.wins)}</td>
              <td>{clock(r.bestTime)}</td>
              <td>{n(r.bestKills)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Logros y estadísticas (Fase 10, C2 y E2): todo se deduce de tus hábitos y partidas. Los logros no dan puntos ni
 * poder; algunos regalan un aspecto para el personaje.
 */
export function RecordsPage() {
  const eco = useEconomy();
  const data = useHabits((s) => s.data);
  const records = useMemo(() => recordsOf(eco, data), [eco, data]);
  const achievements = useMemo(() => achievementsOf(records), [records]);
  const done = achievements.filter((a) => a.done).length;
  const t = records.totals;

  const groups: { id: 'habits' | 'game'; title: string }[] = [
    { id: 'habits', title: 'Hábitos' },
    { id: 'game', title: 'Juego' },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.summary} aria-label="Resumen">
        <div>
          <b>{n(records.bestStreak)}</b>
          <span>mejor racha</span>
        </div>
        <div>
          <b>{n(records.habitsMet)}</b>
          <span>hábitos cumplidos</span>
        </div>
        <div>
          <b>{n(records.passedLevel)}</b>
          <span>niveles superados</span>
        </div>
        <div>
          <b>
            {done}/{achievements.length}
          </b>
          <span>logros</span>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.id} className={styles.section}>
          <h2 className={styles.heading}>Logros · {g.title}</h2>
          <ul className={styles.achievements}>
            {achievements
              .filter((a) => a.def.group === g.id)
              .map((a) => {
                const reward = SKINS.find((s) => s.achievement === a.def.id);
                return (
                  <li key={a.def.id} className={`${styles.achievement} ${a.done ? styles.done : ''}`}>
                    <span className={styles.badge} aria-hidden>
                      {a.done ? <Check /> : `${Math.floor((a.value / a.def.goal) * 100)}%`}
                    </span>
                    <span className={styles.body}>
                      <b>{a.def.name}</b>
                      <small>{a.def.text}</small>
                      {reward && <small className={styles.reward}>Recompensa: aspecto {reward.name}</small>}
                      {!a.done && (
                        <span className={styles.bar} aria-label={`${n(a.value)} de ${n(a.def.goal)}`}>
                          <span style={{ width: `${(a.value / a.def.goal) * 100}%` }} />
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section className={styles.section}>
        <h2 className={styles.heading}>Estadísticas</h2>
        <dl className={styles.stats}>
          <div>
            <dt>Partidas</dt>
            <dd>{n(t.runs)}</dd>
          </div>
          <div>
            <dt>Niveles superados</dt>
            <dd>{n(t.wins)}</dd>
          </div>
          <div>
            <dt>Tiempo jugado</dt>
            <dd>{hours(t.time)}</dd>
          </div>
          <div>
            <dt>Enemigos derrotados</dt>
            <dd>{n(t.kills)}</dd>
          </div>
          <div>
            <dt>Oro ganado</dt>
            <dd>{n(t.gold)}</dd>
          </div>
          <div>
            <dt>Mejor tiempo</dt>
            <dd>{clock(t.bestTime)}</dd>
          </div>
          <div>
            <dt>Nivel de personaje más alto</dt>
            <dd>{n(t.bestXpLevel)}</dd>
          </div>
          <div>
            <dt>Puntos de hábito ganados</dt>
            <dd>{n(records.pointsEarned)}</dd>
          </div>
          <div>
            <dt>Mejoras compradas</dt>
            <dd>{n(records.upgradesBought)}</dd>
          </div>
        </dl>
        {t.runs === 0 && (
          <p className={styles.empty}>Aún no has jugado ninguna partida: aquí verás tus récords por personaje y escenario.</p>
        )}
        <GroupTable title="Por personaje" rows={records.characters} />
        <GroupTable title="Por escenario" rows={records.stages} />
      </section>
    </div>
  );
}

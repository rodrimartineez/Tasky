import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { UPGRADES } from '../../game/content/upgrades';
import { useEconomy, useHabits } from '../state/store';
import { GemIcon } from './PointsBadge';
import styles from './HabitBridge.module.css';

const n = (v: number) => v.toLocaleString('es-ES');

/**
 * Puente hábitos/pasos → juego (M1): los hábitos dan intentos y los pasos, puntos de habilidad (1 por paso) para las
 * mejoras permanentes. Se muestra en «Hábitos» y en el campamento para que el vínculo se vea cada día.
 */
export function HabitBridge() {
  const eco = useEconomy();
  const today = useHabits((s) => s.today);
  const stepsToday = eco.steps.get(today);

  // La mejora más barata de comprar ahora mismo.
  const next = UPGRADES.map((u) => {
    const level = (eco.upgrades[u.id] ?? 0) + 1;
    return { name: u.name, level, cost: u.cost(level) };
  }).reduce((a, b) => (b.cost < a.cost ? b : a));
  const missing = next.cost - eco.points;

  return (
    <Link to="/habits/upgrades" className={styles.bridge}>
      <GemIcon size={28} />
      <span className={styles.body}>
        <span className={styles.today}>
          {stepsToday === undefined ? (
            'Hoy aún no se han recibido pasos del iPhone.'
          ) : (
            <>
              Hoy: <b>{n(stepsToday)}</b> pasos → <b>+{n(stepsToday)}</b> puntos de habilidad
            </>
          )}
        </span>
        <span className={styles.goal}>
          {missing <= 0
            ? `Ya puedes mejorar ${next.name} a nivel ${next.level}.`
            : `Te faltan ${n(missing)} puntos (pasos) para mejorar ${next.name} a nivel ${next.level}.`}
        </span>
        {!eco.testMode && (
          <span className={styles.goal}>
            Intentos para jugar: <b>{n(eco.available)}</b> · cada hábito diario cumplido da +1 al cerrar el día.
          </span>
        )}
      </span>
      <ChevronRight className={styles.arrow} />
    </Link>
  );
}

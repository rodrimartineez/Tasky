import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { UPGRADES } from '../../game/content/upgrades';
import { useEconomy } from '../state/store';
import { GemIcon } from './PointsBadge';
import { useOutlook } from './view';
import styles from './HabitBridge.module.css';

const pts = (n: number) => `${n.toLocaleString('es-ES')} ${n === 1 ? 'punto' : 'puntos'}`;

/**
 * Puente hábito → juego (M1): lo que darán hoy los hábitos y qué mejora permanente se podrá comprar con ello.
 * Se muestra en «Hábitos» y en el campamento para que el vínculo se vea cada día.
 */
export function HabitBridge() {
  const { secured, pending } = useOutlook();
  const eco = useEconomy();

  // La mejora más barata de comprar ahora mismo.
  const next = UPGRADES.map((u) => {
    const level = (eco.upgrades[u.id] ?? 0) + 1;
    return { name: u.name, level, cost: u.cost(level) };
  }).reduce((a, b) => (b.cost < a.cost ? b : a));

  const affordableNow = next.cost <= eco.points;
  const missingNow = next.cost - eco.points;
  const missingAfterToday = next.cost - eco.points - secured - pending;

  let goal: string;
  if (affordableNow) goal = `Ya puedes mejorar ${next.name} a nivel ${next.level}.`;
  else if (missingNow <= secured) goal = `Con lo que ya has cumplido, al cerrar el día podrás mejorar ${next.name} a nivel ${next.level}.`;
  else if (missingAfterToday <= 0) goal = `Si cumples todo, mañana podrás mejorar ${next.name} a nivel ${next.level}.`;
  else goal = `Te faltan ${pts(missingNow)} para mejorar ${next.name} a nivel ${next.level}.`;

  return (
    <Link to="/habits/upgrades" className={styles.bridge}>
      <GemIcon size={28} />
      <span className={styles.body}>
        <span className={styles.today}>
          {secured + pending === 0 ? (
            'Crea hábitos para conseguir puntos de mejora.'
          ) : (
            <>
              Hoy: <b>+{secured}</b> asegurados{pending > 0 && <> · <b>+{pending}</b> más si cumples el resto</>}
            </>
          )}
        </span>
        <span className={styles.goal}>{goal}</span>
      </span>
      <ChevronRight className={styles.arrow} />
    </Link>
  );
}

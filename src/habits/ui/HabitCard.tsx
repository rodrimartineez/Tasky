import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Minus, Plus, Undo2 } from 'lucide-react';
import { useHabits } from '../state/store';
import { FlameIcon } from './icons';
import { GemIcon } from './PointsBadge';
import { formatAmount, withUnit, type HabitView } from './view';
import styles from './HabitCard.module.css';

/** Tarjeta de un hábito con su registro rápido. Tocar el nombre abre el detalle. */
export function HabitCard({ view }: { view: HabitView }) {
  const log = useHabits((s) => s.log);
  const { habit, amount, target, met, remaining, over, fill, streak, reward } = view;
  const build = habit.kind === 'build';
  const single = build && target === habit.step; // un solo toque completa el periodo
  const archived = habit.archivedAt !== null;

  const status = build
    ? met
      ? '¡Cumplido!'
      : `${formatAmount(amount)} / ${withUnit(target, habit.unit)}`
    : over > 0
      ? `Límite superado (+${withUnit(over, habit.unit)})`
      : `Quedan ${withUnit(remaining, habit.unit)} de ${formatAmount(target)}`;

  return (
    <motion.article
      layout
      className={`${styles.card} ${build ? styles.build : styles.reduce} ${met ? styles.met : ''} ${over > 0 ? styles.over : ''}`}
      style={{ '--fill': fill } as CSSProperties}
    >
      <Link to={`/habits/habit/${habit.id}`} className={styles.main}>
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{habit.name}</h3>
          {streak > 0 && (
            <span className={styles.streak} title={`Racha: ${streak} ${habit.period === 'daily' ? 'días' : 'semanas'}`}>
              <FlameIcon /> {streak}
            </span>
          )}
          {!archived && reward > 0 && (
            <span
              className={`${styles.reward} ${met ? styles.rewardSecured : ''}`}
              title={met ? `Asegurado: +${reward} al cerrar el periodo` : `Cumplirlo da +${reward}`}
            >
              +{reward} <GemIcon size={12} />
            </span>
          )}
        </div>
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} />
        </div>
        <p className={styles.status}>{status}</p>
      </Link>

      {!archived && (
        <div className={styles.actions}>
          {single ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              className={`${styles.big} ${met ? styles.bigDone : ''}`}
              onClick={() => log(habit.id, met ? -1 : 1)}
              aria-label={met ? `Deshacer «${habit.name}»` : `Completar «${habit.name}»`}
            >
              {met ? <Undo2 /> : <Check />}
            </motion.button>
          ) : (
            <>
              <button
                type="button"
                className={styles.small}
                onClick={() => log(habit.id, -1)}
                disabled={amount <= 0}
                aria-label={`Deshacer un registro de «${habit.name}»`}
              >
                <Minus />
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className={styles.big}
                onClick={() => log(habit.id, 1)}
                aria-label={`Registrar ${withUnit(habit.step, habit.unit)} en «${habit.name}»`}
              >
                <Plus />
                <span className={styles.step}>{formatAmount(habit.step)}</span>
              </motion.button>
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

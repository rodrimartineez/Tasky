import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Minus, Plus, Undo2 } from 'lucide-react';
import { useHabits } from '../state/store';
import { FlameIcon } from './icons';
import { formatAmount, withUnit, type HabitView } from './view';
import styles from './HabitCard.module.css';

/** Tarjeta de un hábito con su registro rápido. Tocar el nombre abre el detalle. */
export function HabitCard({ view, handle }: { view: HabitView; handle?: ReactNode }) {
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
      : `${formatAmount(remaining)} / ${withUnit(target, habit.unit)} disponibles`;

  return (
    <motion.article
      layout={!handle}
      className={`${styles.card} ${build ? styles.build : styles.reduce} ${met ? styles.met : ''} ${over > 0 ? styles.over : ''}`}
      style={{ '--fill': fill } as CSSProperties}
    >
      {handle}
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
              title={
                build
                  ? met
                    ? `Asegurado: +${reward} intento al cerrar el periodo`
                    : `Cumplirlo da +${reward} intento`
                  : `+${reward} intento al cerrar el periodo si no pasas del límite`
              }
            >
              +{reward} {reward === 1 ? 'intento' : 'intentos'}
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
              {/* Deshacer: en los de reducción devuelve una unidad al límite disponible (+), en los positivos resta (−). */}
              <button
                type="button"
                className={styles.small}
                onClick={() => log(habit.id, -1)}
                disabled={amount <= 0}
                aria-label={build ? `Deshacer un registro de «${habit.name}»` : `Devolver ${withUnit(habit.step, habit.unit)} al límite de «${habit.name}»`}
              >
                {build ? <Minus /> : <Plus />}
              </button>
              {/* Registrar: en los de reducción cada ocurrencia gasta límite disponible (−). */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className={styles.big}
                onClick={() => log(habit.id, 1)}
                aria-label={
                  build ? `Registrar ${withUnit(habit.step, habit.unit)} en «${habit.name}»` : `Registrar una vez «${habit.name}» (resta ${withUnit(habit.step, habit.unit)})`
                }
              >
                {build ? <Plus /> : <Minus />}
                <span className={styles.step}>{formatAmount(habit.step)}</span>
              </motion.button>
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

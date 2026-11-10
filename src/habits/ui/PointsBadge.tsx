import { AnimatePresence, motion } from 'motion/react';
import styles from './PointsBadge.module.css';

/** Gema de píxeles: icono original de los puntos de hábito. */
export function GemIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#5b3fd6" d="M2 1h4v1h1v2H6v1H5v1H3V5H2V4H1V2h1z" />
      <path fill="#9d7bff" d="M2 2h4v2H5v1H3V4H2z" />
      <path fill="#d9ccff" d="M2 2h2v1H2z" />
      <path fill="#2a1c73" d="M3 6h2v1H3z" />
    </svg>
  );
}

/** Saldo de puntos de hábito (solo se gastan en mejoras permanentes del personaje). */
export function PointsBadge({ points }: { points: number }) {
  return (
    <div className={styles.badge} title="Puntos de hábito: se consiguen cumpliendo hábitos" aria-label={`${points} ${points === 1 ? 'punto' : 'puntos'} de hábito`}>
      <GemIcon />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={points}
          className={styles.value}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {points}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

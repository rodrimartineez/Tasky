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

/** Moneda de píxeles: icono del oro (se gana jugando). */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#8a5a12" d="M2 0h4v1h1v1h1v4H7v1H6v1H2V7H1V6H0V2h1V1h1z" />
      <path fill="#f6c945" d="M2 1h4v1h1v4H6v1H2V6H1V2h1z" />
      <path fill="#fff1a8" d="M2 2h1v3H2zM3 1h2v1H3z" />
      <path fill="#c9901f" d="M4 3h1v2H4z" />
    </svg>
  );
}

const CURRENCIES = {
  points: { icon: GemIcon, one: 'punto de hábito', many: 'puntos de hábito', title: 'Puntos de hábito: se consiguen cumpliendo hábitos' },
  gold: { icon: CoinIcon, one: 'moneda de oro', many: 'monedas de oro', title: 'Oro: se consigue jugando partidas' },
};

/** Saldo de una moneda: puntos (mejoras permanentes) u oro (personajes y escenarios). */
export function PointsBadge({ value, currency = 'points' }: { value: number; currency?: keyof typeof CURRENCIES }) {
  const c = CURRENCIES[currency];
  const Icon = c.icon;
  return (
    <div className={`${styles.badge} ${styles[currency]}`} title={c.title} aria-label={`${value} ${value === 1 ? c.one : c.many}`}>
      <Icon />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className={styles.value}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {value.toLocaleString('es-ES')}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

import { NavLink, useLocation, useOutlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { ListChecks, Swords, TriangleAlert, Trophy } from 'lucide-react';
import { ModeSwitch } from '../../ui/app/ModeSwitch';
import { Toaster } from '../../ui/components/Toaster';
import { SyncButton } from '../../ui/sync/SyncButton';
import { pointsBalance } from '../core/habits';
import { useHabits } from '../state/store';
import { useHabitsSync } from '../state/sync';
import { PointsBadge } from './PointsBadge';
import styles from './HabitsLayout.module.css';

const TABS = [
  { to: '/habits', label: 'Hábitos', icon: <ListChecks />, end: true },
  { to: '/habits/play', label: 'Jugar', icon: <Swords />, end: false },
  { to: '/habits/rewards', label: 'Recompensas', icon: <Trophy />, end: false },
];

export function HabitsLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const status = useHabits((s) => s.status);
  const loadError = useHabits((s) => s.loadError);
  const saveError = useHabits((s) => s.saveError);
  const points = useHabits((s) => pointsBalance(s.data));
  const syncError = useHabitsSync((s) => s.error);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <ModeSwitch />
          <div className={styles.actions}>
            <PointsBadge points={points} />
            <SyncButton />
          </div>
        </div>
        <nav className={styles.tabs} aria-label="Secciones de Hábitos">
          <div className={styles.tabsInner}>
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
                {t.icon}
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {saveError && (
        <div className={styles.banner} role="alert">
          <TriangleAlert /> {saveError} Se reintentará con el próximo cambio.
        </div>
      )}
      {syncError && syncError !== 'Sin conexión.' && (
        <div className={styles.banner} role="status">
          <TriangleAlert /> No se pudieron sincronizar los hábitos ({syncError}). Siguen guardados en este dispositivo.
        </div>
      )}

      <main className={styles.main}>
        {status === 'error' ? (
          <p className={styles.loadError} role="alert">
            <TriangleAlert /> {loadError} Tus datos no se han modificado.
          </p>
        ) : (
          status === 'ready' && (
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {outlet}
            </motion.div>
          )
        )}
      </main>
      <Toaster />
    </div>
  );
}

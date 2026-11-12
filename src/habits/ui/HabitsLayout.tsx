import { useEffect } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, ChartColumn, ListChecks, Medal, Sparkles, Swords, TriangleAlert } from 'lucide-react';
import { ModeSwitch } from '../../ui/app/ModeSwitch';
import { toast, Toaster } from '../../ui/components/Toaster';
import { UPGRADES } from '../../game/content/upgrades';
import { SyncButton } from '../../ui/sync/SyncButton';
import { useEconomy, useHabits } from '../state/store';
import { useHabitsSync } from '../state/sync';
import { PointsBadge } from './PointsBadge';
import styles from './HabitsLayout.module.css';

const TABS = [
  { to: '/habits', label: 'Hábitos', icon: <ListChecks />, end: true },
  { to: '/habits/play', label: 'Jugar', icon: <Swords />, end: false },
  { to: '/habits/upgrades', label: 'Mejoras', icon: <Sparkles />, end: false },
  { to: '/habits/progress', label: 'Progreso', icon: <ChartColumn />, end: false },
  { to: '/habits/records', label: 'Logros', icon: <Medal />, end: false },
  { to: '/habits/catalog', label: 'Catálogo', icon: <BookOpen />, end: false },
];

const SEEN_KEY = 'tasky-habits-seen-points';

/**
 * Aviso de puntos nuevos (M1): al cerrar el día, o al volver a la app tras cerrarse uno o varios, dice cuántos
 * puntos se han ganado y si ya alcanzan para una mejora. Lo ya avisado se recuerda en este dispositivo.
 */
function usePointsNotice(ready: boolean, earned: number, points: number, upgrades: Record<string, number>) {
  useEffect(() => {
    if (!ready) return;
    let seen: number | null;
    try {
      const stored = localStorage.getItem(SEEN_KEY);
      seen = stored === null ? null : Number(stored);
      localStorage.setItem(SEEN_KEY, String(earned));
    } catch {
      return;
    }
    // La primera vez solo se toma la referencia; si el saldo baja (otro perfil, datos borrados) también.
    if (seen === null || !Number.isFinite(seen) || earned <= seen) return;
    const affordable = UPGRADES.filter((u) => u.cost((upgrades[u.id] ?? 0) + 1) <= points).map((u) => u.name);
    const gained = earned - seen;
    toast(
      `+${gained} ${gained === 1 ? 'punto' : 'puntos'} por tus hábitos.` +
        (affordable.length > 0 ? ` Ya puedes mejorar ${affordable.slice(0, 2).join(' o ')}.` : ''),
    );
  }, [ready, earned, points, upgrades]);
}

export function HabitsLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const status = useHabits((s) => s.status);
  const loadError = useHabits((s) => s.loadError);
  const saveError = useHabits((s) => s.saveError);
  const economy = useEconomy();
  const syncError = useHabitsSync((s) => s.error);
  usePointsNotice(status === 'ready', economy.totalPointsEarned, economy.points, economy.upgrades);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <ModeSwitch />
          <div className={styles.actions}>
            <PointsBadge value={economy.points} />
            <PointsBadge value={economy.gold} currency="gold" />
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

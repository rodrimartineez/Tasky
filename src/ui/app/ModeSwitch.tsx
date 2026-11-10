import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { FolderKanban, Swords } from 'lucide-react';
import { HABITS_PATH, modeOfPath, rememberMode, type AppMode } from './mode';
import styles from './ModeSwitch.module.css';

const MODES: { mode: AppMode; to: string; label: string; icon: React.ReactNode }[] = [
  { mode: 'projects', to: '/', label: 'Proyectos', icon: <FolderKanban /> },
  { mode: 'habits', to: HABITS_PATH, label: 'Hábitos', icon: <Swords /> },
];

/** Selector principal entre los dos modos. Cambiar de modo solo cambia la ruta: nunca toca datos. */
export function ModeSwitch() {
  const current = modeOfPath(useLocation().pathname);
  useEffect(() => rememberMode(current), [current]);

  return (
    <nav className={`${styles.switch} ${current === 'habits' ? styles.habits : ''}`} aria-label="Modo">
      {MODES.map(({ mode, to, label, icon }) => {
        const selected = mode === current;
        return (
          <Link key={mode} to={to} className={`${styles.option} ${selected ? styles.selected : ''}`} aria-current={selected ? 'page' : undefined}>
            {selected && <motion.span layoutId="mode-pill" className={styles.pill} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} />}
            {icon}
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

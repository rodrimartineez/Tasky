import { useState } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { Keyboard, TriangleAlert } from 'lucide-react';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { ShortcutsHelp } from '../shortcuts/ShortcutsHelp';
import { useShortcut } from '../shortcuts/useShortcut';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const saveError = useTasky((s) => s.saveError);
  const [helpOpen, setHelpOpen] = useState(false);
  useShortcut('?', () => setHelpOpen(true));

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand} aria-label="Tasky — inicio">
            <Logo size={34} withWordmark />
          </Link>
          <Button variant="ghost" icon={<Keyboard />} shortcut="?" className={styles.help} onClick={() => setHelpOpen(true)}>
            Atajos
          </Button>
        </div>
      </header>

      {saveError && (
        <div className={styles.banner} role="alert">
          <TriangleAlert /> {saveError} Se reintentará con el próximo cambio.
        </div>
      )}

      <main className={styles.main}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {outlet}
        </motion.div>
      </main>

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

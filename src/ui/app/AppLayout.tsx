import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { TriangleAlert } from 'lucide-react';
import { useTasky } from '../../state/store';
import { Toaster } from '../components/Toaster';
import { ShortcutsHelp } from '../shortcuts/ShortcutsHelp';
import { TopBar } from './TopBar';
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
        <TopBar onHelp={() => setHelpOpen(true)} />
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
      <Toaster />
    </div>
  );
}

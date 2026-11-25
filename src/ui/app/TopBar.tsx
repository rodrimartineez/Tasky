import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Keyboard } from 'lucide-react';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Notifications } from '../collab/Notifications';
import { SyncButton } from '../sync/SyncButton';
import { DataMenu } from './DataMenu';
import { ModeSwitch } from './ModeSwitch';
import styles from './TopBar.module.css';

/**
 * Fila superior común a Proyectos y Hábitos: logo y selector de modo a la izquierda; sincronización y copias a la
 * derecha. `extra` va entre ambos (en móvil, en una fila propia debajo) y `onHelp` añade el botón de atajos.
 */
export function TopBar({ extra, onHelp }: { extra?: ReactNode; onHelp?: () => void }) {
  return (
    <div className={styles.bar}>
      <div className={styles.start}>
        <Link to="/" className={styles.brand} aria-label="Tasky — inicio">
          <Logo size={34} withWordmark />
        </Link>
        <ModeSwitch />
      </div>
      {extra && <div className={styles.extra}>{extra}</div>}
      <div className={styles.actions}>
        {onHelp && (
          <Button variant="ghost" icon={<Keyboard />} shortcut="?" className={styles.help} onClick={onHelp}>
            Atajos
          </Button>
        )}
        <Notifications />
        <SyncButton />
        <DataMenu />
      </div>
    </div>
  );
}

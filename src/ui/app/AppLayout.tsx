import { Outlet, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand} aria-label="Tasky — inicio">
            <Logo size={34} withWordmark />
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

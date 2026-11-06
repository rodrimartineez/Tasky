import { Logo } from '../components/Logo';
import { LoginForm } from './LoginForm';
import styles from './Sync.module.css';

/** Web/PWA sin sesión: solo esta pantalla, sin ningún dato. */
export function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={48} />
        <div className={styles.heading}>
          <h1>Tasky</h1>
          <p>Inicia sesión para ver tus proyectos.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

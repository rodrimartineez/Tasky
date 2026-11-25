import { signOut } from '../../state/sync';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { ChangePasswordForm } from './ChangePasswordForm';
import styles from './Sync.module.css';

/** Cuenta con contraseña provisional: solo esta pantalla hasta que elija la suya (el servidor tampoco da datos antes). */
export function PasswordPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={48} />
        <div className={styles.heading}>
          <h1>Elige tu contraseña</h1>
          <p>Tu contraseña es provisional. Para continuar, establece una propia.</p>
        </div>
        <ChangePasswordForm forced />
        <Button variant="ghost" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}

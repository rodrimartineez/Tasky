import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { signIn } from '../../state/sync';
import { Button } from '../components/Button';
import { TextField } from '../components/Field';
import styles from './Sync.module.css';

/** Acceso con email y contraseña. No hay registro: la única cuenta se crea en el panel de Supabase. */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="Email"
        type="email"
        data-autofocus
        autoComplete="email"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        spellCheck={false}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className={styles.error} role="alert">
          <TriangleAlert /> {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={!canSubmit} className={styles.submit}>
        {busy ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

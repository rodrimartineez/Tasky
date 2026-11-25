import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { USERNAME_PATTERN } from '../../core/collab';
import { createAccount } from '../../state/sync';
import { Button } from '../components/Button';
import { TextField } from '../components/Field';
import styles from '../sync/Sync.module.css';

/** Solo el administrador: crea la cuenta de otra persona. Su sesión no cambia; la otra persona entra con estos datos. */
export function CreateAccountForm({ onDone }: { onDone: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = username.trim().toLowerCase();
  const validName = USERNAME_PATTERN.test(name);
  const validPassword = password.length >= 8;
  const hint =
    username.trim() && !validName
      ? 'Usuario: de 3 a 20 caracteres (letras sin tilde, números o «_»).'
      : password && !validPassword
        ? 'La contraseña necesita al menos 8 caracteres.'
        : null;

  const submit = async () => {
    if (!validName || !validPassword || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createAccount(name, password);
      onDone(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
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
        label="Nombre de usuario"
        data-autofocus
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {(error ?? hint) && (
        <p className={styles.error} role="alert">
          <TriangleAlert /> {error ?? hint}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={!validName || !validPassword || busy} className={styles.submit}>
        {busy ? 'Creando…' : 'Crear cuenta'}
      </Button>
    </form>
  );
}

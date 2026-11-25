import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { changePassword } from '../../state/sync';
import { Button } from '../components/Button';
import { TextField } from '../components/Field';
import styles from './Sync.module.css';

const MIN_LENGTH = 10;

/**
 * Cambio de contraseña. Con `forced` (contraseña provisional) no pide la actual: el servidor solo lo admite para esa
 * situación y con la sesión de la propia cuenta.
 */
export function ChangePasswordForm({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const validNext = next.length >= MIN_LENGTH;
  const hint = next && !validNext ? `La contraseña necesita al menos ${MIN_LENGTH} caracteres.` : confirm && confirm !== next ? 'Las contraseñas no coinciden.' : null;
  const canSubmit = (forced || current.length > 0) && validNext && confirm === next && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(forced ? null : current, next);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
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
      {!forced && (
        <TextField
          label="Contraseña actual"
          type="password"
          data-autofocus
          autoComplete="current-password"
          spellCheck={false}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      <TextField
        label="Nueva contraseña"
        type="password"
        data-autofocus={forced || undefined}
        autoComplete="new-password"
        spellCheck={false}
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <TextField
        label="Confirmar nueva contraseña"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {(error ?? hint) && (
        <p className={styles.error} role="alert">
          <TriangleAlert /> {error ?? hint}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={!canSubmit} className={styles.submit}>
        {busy ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}

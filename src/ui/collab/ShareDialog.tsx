import { useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { usePeople } from '../../state/people';
import { share, unshare, useSync } from '../../state/sync';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { TextField } from '../components/Field';
import { toast } from '../components/Toaster';
import { Avatar } from './Avatar';
import styles from './ShareDialog.module.css';

const NONE: string[] = [];

interface ShareDialogProps {
  kind: 'project' | 'idea';
  /** Elemento a compartir; sin él, el diálogo está cerrado. */
  target?: { id: string; name: string };
  onClose: () => void;
}

/** Comparte un proyecto o una idea con otra persona por su nombre de usuario. Todos los participantes pueden editarlo. */
export function ShareDialog({ kind, target, onClose }: ShareDialogProps) {
  const signedIn = useSync((s) => s.userId !== null);
  // Sin lista se devuelve siempre la misma vacía: una nueva en cada lectura haría re-renderizar sin fin.
  const participants = usePeople((s) => (target ? s.shares[kind][target.id] : undefined)) ?? NONE;
  const names = usePeople((s) => s.profiles);
  const me = usePeople((s) => s.me);
  const owner = usePeople((s) => (target ? s.owners[target.id] : undefined));
  /** Persona a quitar, pendiente de confirmar. */
  const [removing, setRemoving] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noun = kind === 'project' ? 'proyecto' : 'idea';

  const submit = async () => {
    if (!target || !username.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await share(kind, target.id, username.trim());
      toast(`Compartido con ${username.trim().toLowerCase()}.`);
      setUsername('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir.');
    }
    setBusy(false);
  };

  const remove = async (userId: string) => {
    if (!target) return;
    setRemoving(null);
    setError(null);
    try {
      await unshare(kind, target.id, userId);
      if (userId === me) {
        toast(`Has dejado de participar en «${target.name}».`);
        onClose();
      } else toast(`${names[userId] ?? 'Esa persona'} ya no tiene acceso.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dejar de compartir.');
    }
  };

  return (
    <>
    <Dialog open={!!target} onClose={onClose} title={target ? `Compartir «${target.name}»` : ''}>
      {target &&
        (signedIn ? (
          <div className={styles.body}>
            {participants.length > 0 && (
              <div className={styles.people}>
                {participants.map((id) => (
                  <span key={id} className={styles.person}>
                    <Avatar userId={id} size={24} /> {names[id]}
                    {id === me ? ' (tú)' : ''}
                    {id === owner ? ' · creador' : ''}
                    {id !== owner && (me === owner || id === me) && (
                      <Button variant="ghost" icon={<UserMinus />} className={styles.remove} onClick={() => setRemoving(id)}>
                        {id === me ? 'Salir' : 'Quitar'}
                      </Button>
                    )}
                  </span>
                ))}
              </div>
            )}
            <p className={styles.hint}>
              La otra persona verá este {noun} en su cuenta y podrá editarlo igual que tú. Solo se comparte esto: el resto de tus datos sigue
              siendo privado.
            </p>
            <form
              className={styles.row}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <TextField
                label="Nombre de usuario"
                data-autofocus
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button type="submit" variant="primary" icon={<UserPlus />} disabled={!username.trim() || busy}>
                Compartir
              </Button>
            </form>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <p className={`${styles.hint} ${styles.body}`}>Activa la sincronización (inicia sesión) para compartir.</p>
        ))}
    </Dialog>
    <ConfirmDialog
      open={removing !== null}
      title={removing === me ? `¿Dejar de participar en este ${noun}?` : `¿Dejar de compartir con ${removing ? (names[removing] ?? '') : ''}?`}
      description={
        removing === me
          ? `Desaparecerá de tu cuenta y de tus dispositivos. Para volver a verlo, alguien tendrá que compartirlo otra vez contigo.`
          : `Dejará de verlo y de poder editarlo, y desaparecerá de sus dispositivos. Lo que haya hecho en él se conserva.`
      }
      confirmLabel={removing === me ? 'Salir' : 'Dejar de compartir'}
      onClose={() => setRemoving(null)}
      onConfirm={() => removing && void remove(removing)}
    />
    </>
  );
}

import { useState } from 'react';
import { Cloud, CloudAlert, CloudCheck, CloudOff, KeyRound, LogIn, LogOut, RefreshCw, UserPlus } from 'lucide-react';
import { hasPendingChanges, signOut, syncNow, useSync, type SyncStatus } from '../../state/sync';
import { usePeople } from '../../state/people';
import { CreateAccountForm } from '../collab/CreateAccountForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { Menu, type MenuItem } from '../components/Menu';
import { toast } from '../components/Toaster';
import { ChangePasswordForm } from './ChangePasswordForm';
import { useBackupMenu } from '../app/DataMenu';
import { LoginForm } from './LoginForm';
import styles from './Sync.module.css';

function ago(iso: string | null) {
  if (!iso) return '';
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}

const ICON: Record<Exclude<SyncStatus, 'disabled'>, { icon: React.ReactNode; className?: string }> = {
  checking: { icon: <Cloud />, className: styles.offline },
  signed_out: { icon: <CloudOff />, className: styles.offline },
  syncing: { icon: <RefreshCw />, className: styles.syncing },
  synced: { icon: <CloudCheck /> },
  offline: { icon: <CloudOff />, className: styles.offline },
  error: { icon: <CloudAlert />, className: styles.problem },
};

/** Estado de la sincronización en la cabecera, con sus acciones. No aparece si no hay Supabase configurado. */
export function SyncButton() {
  const { status, email, lastSyncedAt, error, requireAuth } = useSync();
  const [loggingIn, setLoggingIn] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const backup = useBackupMenu();
  const isAdmin = usePeople((s) => s.isAdmin);
  const username = usePeople((s) => (s.me ? s.profiles[s.me] : undefined));
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  if (status === 'disabled') return null;

  const label = {
    checking: 'Comprobando sesión…',
    signed_out: 'Sincronización desactivada',
    syncing: 'Sincronizando…',
    synced: `Sincronizado ${ago(lastSyncedAt)}`,
    offline: 'Sin conexión: los cambios se enviarán al volver la red',
    error: `No se pudo sincronizar: ${error ?? ''}`,
  }[status];

  const doSignOut = async () => {
    setConfirmingSignOut(false);
    await signOut();
    toast('Sesión cerrada.');
  };

  const syncItems: MenuItem[] =
    status === 'signed_out'
      ? [{ label: 'Activar sincronización…', icon: <LogIn />, onSelect: () => setLoggingIn(true) }]
      : [
          { label: 'Sincronizar ahora', icon: <RefreshCw />, onSelect: () => void syncNow() },
          ...(isAdmin ? [{ label: 'Crear cuenta para otra persona…', icon: <UserPlus />, onSelect: () => setCreatingAccount(true) }] : []),
          { label: 'Cambiar contraseña…', icon: <KeyRound />, onSelect: () => setChangingPassword(true) },
          {
            label: `Cerrar sesión (${username ?? email})`,
            icon: <LogOut />,
            onSelect: async () => {
              // En la web, cerrar sesión borra los datos del dispositivo: antes se intenta enviar lo pendiente.
              if (requireAuth) await syncNow();
              if (requireAuth && hasPendingChanges()) setConfirmingSignOut(true);
              else void doSignOut();
            },
          },
        ];

  const items = [...syncItems, ...backup.items];
  const { icon, className } = ICON[status];
  return (
    <>
      <Menu label={label} trigger={<span className={`${styles.indicator} ${className ?? ''}`}>{icon}</span>} items={items} />
      {backup.extra}
      <Dialog open={loggingIn} onClose={() => setLoggingIn(false)} title="Activar sincronización">
        {loggingIn && (
          <div className={styles.dialogBody}>
            <LoginForm
              onDone={() => {
                setLoggingIn(false);
                toast('Sincronización activada.');
              }}
            />
          </div>
        )}
      </Dialog>
      <Dialog
        open={creatingAccount}
        onClose={() => setCreatingAccount(false)}
        title="Crear cuenta"
        description="Para otra persona: tendrá sus propios datos, privados. Dale su usuario y una contraseña provisional: tendrá que cambiarla al entrar."
      >
        {creatingAccount && (
          <div className={styles.dialogBody}>
            <CreateAccountForm
              onDone={(name) => {
                setCreatingAccount(false);
                toast(`Cuenta «${name}» creada.`);
              }}
            />
          </div>
        )}
      </Dialog>
      <Dialog open={changingPassword} onClose={() => setChangingPassword(false)} title="Cambiar contraseña">
        {changingPassword && (
          <div className={styles.dialogBody}>
            <ChangePasswordForm
              onDone={() => {
                setChangingPassword(false);
                toast('Contraseña cambiada. Se han cerrado las demás sesiones.');
              }}
            />
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmingSignOut}
        title="¿Cerrar sesión con cambios sin enviar?"
        description="Hay cambios que aún no han llegado al servidor (¿sin conexión?). Si cierras sesión ahora, se perderán."
        confirmLabel="Cerrar sesión"
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => void doSignOut()}
      />
    </>
  );
}

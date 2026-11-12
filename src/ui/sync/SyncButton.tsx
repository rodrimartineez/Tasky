import { useState } from 'react';
import { Cloud, CloudAlert, CloudCheck, CloudOff, LogIn, LogOut, RefreshCw, ShieldOff } from 'lucide-react';
import { hasPendingChanges, signOut, syncNow, useSync, type SyncStatus } from '../../state/sync';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { Menu, type MenuItem } from '../components/Menu';
import { toast } from '../components/Toaster';
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
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingEverywhere, setConfirmingEverywhere] = useState<{ pending: boolean } | null>(null);
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

  const doSignOutEverywhere = async () => {
    setConfirmingEverywhere(null);
    try {
      await signOut(true);
      toast('Sesión cerrada en todos los dispositivos.');
    } catch (e) {
      toast(`No se pudo cerrar la sesión: ${e instanceof Error ? e.message : 'error desconocido'}`, 'error');
    }
  };

  const items: MenuItem[] =
    status === 'signed_out'
      ? [{ label: 'Activar sincronización…', icon: <LogIn />, onSelect: () => setLoggingIn(true) }]
      : [
          { label: 'Sincronizar ahora', icon: <RefreshCw />, onSelect: () => void syncNow() },
          {
            label: `Cerrar sesión (${email})`,
            icon: <LogOut />,
            onSelect: async () => {
              // En la web, cerrar sesión borra los datos del dispositivo: antes se intenta enviar lo pendiente.
              if (requireAuth) await syncNow();
              if (requireAuth && hasPendingChanges()) setConfirmingSignOut(true);
              else void doSignOut();
            },
          },
          {
            label: 'Cerrar sesión en todos los dispositivos…',
            icon: <ShieldOff />,
            onSelect: async () => {
              if (requireAuth) await syncNow();
              setConfirmingEverywhere({ pending: requireAuth && hasPendingChanges() });
            },
          },
        ];

  const { icon, className } = ICON[status];
  return (
    <>
      <Menu label={label} trigger={<span className={className}>{icon}</span>} items={items} />
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
      <ConfirmDialog
        open={confirmingSignOut}
        title="¿Cerrar sesión con cambios sin enviar?"
        description="Hay cambios que aún no han llegado al servidor (¿sin conexión?). Si cierras sesión ahora, se perderán."
        confirmLabel="Cerrar sesión"
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => void doSignOut()}
      />
      <ConfirmDialog
        open={confirmingEverywhere !== null}
        title="¿Cerrar sesión en todos los dispositivos?"
        description={`Se revocan todas las sesiones de tu cuenta: este dispositivo, los demás (cuando caduque su acceso actual, normalmente en menos de una hora) y los asistentes conectados como Claude. Úsalo si pierdes un dispositivo o sospechas que alguien conoce tu contraseña (cámbiala también).${
          confirmingEverywhere?.pending ? ' Hay cambios que aún no han llegado al servidor: se perderán.' : ''
        }`}
        confirmLabel="Cerrar todas"
        onClose={() => setConfirmingEverywhere(null)}
        onConfirm={() => void doSignOutEverywhere()}
      />
    </>
  );
}

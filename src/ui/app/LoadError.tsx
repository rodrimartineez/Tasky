import { useState } from 'react';
import { History, TriangleAlert } from 'lucide-react';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Logo } from '../components/Logo';

/** Pantalla mostrada si los datos no se pueden leer. Tasky no escribe nada hasta que el usuario decide. */
export function LoadError() {
  const message = useTasky((s) => s.loadError);
  const [restoring, setRestoring] = useState(false);
  const [noBackup, setNoBackup] = useState(false);

  const restore = async () => {
    setRestoring(true);
    const restored = await useTasky.getState().restoreLatestBackup();
    setRestoring(false);
    if (!restored) setNoBackup(true);
  };

  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <Logo size={56} />
        <EmptyState
          icon={<TriangleAlert />}
          title={message ?? 'No se pudieron leer los datos.'}
          description={
            noBackup
              ? 'No hay ninguna copia de seguridad válida. Tus datos no se han modificado: el archivo está en %APPDATA%\\com.tasky.app\\tasky.json.'
              : 'Tus datos no se han modificado. Puedes restaurar la copia automática más reciente; el archivo actual se conservará aparte (tasky.ilegible-….json) por si quieres recuperarlo.'
          }
          action={
            !noBackup && (
              <Button variant="primary" icon={<History />} disabled={restoring} onClick={restore}>
                Restaurar la última copia
              </Button>
            )
          }
        />
      </div>
    </div>
  );
}

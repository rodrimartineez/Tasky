import { TriangleAlert } from 'lucide-react';
import { useTasky } from '../../state/store';
import { EmptyState } from '../components/EmptyState';
import { Logo } from '../components/Logo';

/** Pantalla mostrada si los datos no se pueden leer. Tasky no escribe nada en este estado. */
export function LoadError() {
  const message = useTasky((s) => s.loadError);
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <Logo size={56} />
        <EmptyState
          icon={<TriangleAlert />}
          title={message ?? 'No se pudieron leer los datos.'}
          description="Tus datos no se han modificado. El archivo está en %APPDATA%\com.tasky.app\tasky.json; guarda una copia antes de hacer cambios."
        />
      </div>
    </div>
  );
}

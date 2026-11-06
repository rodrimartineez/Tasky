import { useEffect, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AuthorizationRequest } from '../../core/ports';
import { authorizationBackend } from '../../state/sync';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import styles from './Sync.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ask'; request: AuthorizationRequest }
  | { kind: 'redirecting' }
  | { kind: 'error'; message: string };

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * Pantalla de autorización OAuth (ruta /oauth/consent, configurada en Supabase Auth → OAuth Server).
 * Un asistente como Claude llega aquí para pedir acceso; solo se ve con la sesión iniciada.
 */
export function ConsentPage({ authorizationId }: { authorizationId: string | null }) {
  const [state, setState] = useState<State>(() =>
    authorizationId ? { kind: 'loading' } : { kind: 'error', message: 'Falta el identificador de la autorización.' },
  );

  useEffect(() => {
    if (!authorizationId) return;
    let cancelled = false;
    authorizationBackend()
      .getAuthorizationRequest(authorizationId)
      .then((result) => {
        if (cancelled) return;
        if ('redirectUrl' in result) {
          setState({ kind: 'redirecting' });
          window.location.href = result.redirectUrl;
        } else setState({ kind: 'ask', request: result });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : 'No se pudo cargar la autorización.' });
      });
    return () => {
      cancelled = true;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    if (!authorizationId) return;
    setState({ kind: 'redirecting' });
    try {
      window.location.href = await authorizationBackend().decideAuthorization(authorizationId, approve);
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'No se pudo completar la autorización.' });
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={48} />
        {state.kind === 'ask' ? (
          <>
            <div className={styles.heading}>
              <h1>{state.request.clientName || 'Una aplicación'} quiere acceder a Tasky</h1>
              <p>
                Podrá ver, crear y modificar tus proyectos, tareas e ideas en nombre de <strong>{state.request.email}</strong>.
              </p>
            </div>
            <ul className={styles.consentList}>
              <li>
                <ShieldCheck /> Al terminar volverás a <strong>{host(state.request.redirectUri)}</strong>
              </li>
              <li>
                <ShieldCheck /> Puedes revocar el acceso cuando quieras desconectando el conector en Claude.
              </li>
            </ul>
            <div className={styles.consentActions}>
              <Button variant="ghost" onClick={() => void decide(false)}>
                Denegar
              </Button>
              <Button variant="primary" data-autofocus onClick={() => void decide(true)}>
                Autorizar
              </Button>
            </div>
          </>
        ) : state.kind === 'error' ? (
          <p className={styles.error} role="alert">
            <TriangleAlert /> {state.message}
          </p>
        ) : (
          <p className={styles.heading}>{state.kind === 'loading' ? 'Cargando la autorización…' : 'Volviendo a la aplicación…'}</p>
        )}
      </div>
    </main>
  );
}

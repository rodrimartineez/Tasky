import { create } from 'zustand';
import { now } from '../core/clock';
import type { SyncBackend } from '../core/ports';
import { countRecords, pendingChanges, rememberVersions, type ServerVersions, type SyncRecords } from '../core/sync';
import { useTasky } from './store';

/**
 * - disabled: este build no tiene Supabase configurado (solo local).
 * - checking: comprobando si hay sesión guardada.
 * - signed_out: sin sesión (en la web se muestra la pantalla de acceso).
 */
export type SyncStatus = 'disabled' | 'checking' | 'signed_out' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  /** En la web no se muestra ningún dato sin sesión. */
  requireAuth: boolean;
  email: string | null;
  lastSyncedAt: string | null;
  error: string | null;
}

export const useSync = create<SyncState>()(() => ({
  status: 'disabled',
  requireAuth: false,
  email: null,
  lastSyncedAt: null,
  error: null,
}));

/** Espera tras un cambio local antes de enviarlo (agrupa ráfagas de cambios). */
const PUSH_DELAY_MS = 1500;
/** Comprobación periódica de cambios de otros dispositivos mientras la app está visible. */
const POLL_MS = 60_000;

let backend: SyncBackend | null = null;
/** Lo que el servidor tiene de cada registro; se reconstruye con la descarga completa de cada sesión. */
let versions: ServerVersions = new Map();
let cursor = 0;
let running: Promise<void> | null = null;
let again = false;
let stopSession: (() => void) | null = null;

/** Quita lo que ya se conoce (p. ej. el eco de nuestros propios envíos) para no tocar datos sin motivo. */
function onlyNew(records: SyncRecords): SyncRecords {
  const unknown = <T extends { id: string; updatedAt: string }>(list: T[]) =>
    list.filter((r) => versions.get(r.id) !== r.updatedAt);
  return { projects: unknown(records.projects), tasks: unknown(records.tasks), ideas: unknown(records.ideas) };
}

async function cycle(b: SyncBackend) {
  // Hasta que los datos locales se hayan cargado bien no se mezcla ni se envía nada.
  if (useTasky.getState().status !== 'ready') return;
  const tasky = useTasky.getState();

  const pulled = await b.pull(cursor);
  const incoming = onlyNew(pulled.records);
  tasky.applyRemote(incoming);
  rememberVersions(versions, incoming);
  cursor = pulled.cursor;

  const pending = pendingChanges(useTasky.getState().data, versions);
  if (countRecords(pending) === 0) return;
  const newerOnServer = await b.push(pending);
  rememberVersions(versions, pending);
  tasky.applyRemote(newerOnServer);
  rememberVersions(versions, newerOnServer);
}

/** Descarga lo nuevo y envía lo pendiente. Si ya hay una pasada en curso, se repite al terminar. */
export function syncNow(): Promise<void> {
  const b = backend;
  if (!b || !useSync.getState().email) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  useSync.setState({ status: 'syncing' });
  running = (async () => {
    try {
      do {
        again = false;
        await cycle(b);
      } while (again);
      useSync.setState({ status: 'synced', lastSyncedAt: now(), error: null });
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Error de sincronización.';
      useSync.setState({ status: message === 'Sin conexión.' ? 'offline' : 'error', error: message });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sesión iniciada: descarga completa y, a partir de ahí, sincronización automática. */
function startSession(email: string) {
  if (useSync.getState().email === email && stopSession) return;
  stopSession?.();
  versions = new Map();
  cursor = 0;
  useSync.setState({ email, error: null });

  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeData = useTasky.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      // Cambios que solo vienen del servidor no necesitan otra pasada.
      if (countRecords(pendingChanges(useTasky.getState().data, versions)) > 0) void syncNow();
    }, PUSH_DELAY_MS);
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  const onOnline = () => void syncNow();
  const poll = setInterval(() => document.visibilityState === 'visible' && void syncNow(), POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  // Escritorio: la ventana sigue «visible» detrás de otras; al volver a ella también se sincroniza.
  window.addEventListener('focus', onOnline);

  stopSession = () => {
    clearTimeout(pushTimer);
    clearInterval(poll);
    unsubscribeData();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onOnline);
    stopSession = null;
  };
  void syncNow();
}

function endSession() {
  stopSession?.();
  const wasSignedIn = useSync.getState().email !== null;
  useSync.setState({ status: 'signed_out', email: null, lastSyncedAt: null, error: null });
  // Web: al cerrar sesión no quedan datos en el dispositivo.
  if (wasSignedIn && useSync.getState().requireAuth) useTasky.getState().clearLocalData();
}

/**
 * Se llama al arrancar, antes de que terminen de cargarse los datos locales: así la web
 * sabe desde el primer instante que no debe mostrar nada sin sesión.
 */
export async function initSync(b: SyncBackend | null, requireAuth: boolean, localDataLoaded: Promise<void>) {
  backend = b;
  if (!b) return;
  useSync.setState({ status: 'checking', requireAuth });
  await localDataLoaded;
  b.onSessionChange((session) => (session ? startSession(session.email) : endSession()));
  const session = await b.getSession();
  if (session) startSession(session.email);
  else useSync.setState({ status: 'signed_out' });
}

export async function signIn(email: string, password: string) {
  if (!backend) throw new Error('La sincronización no está configurada.');
  await backend.signIn(email, password);
  // onSessionChange arranca la sesión; por si el aviso llega tarde:
  const session = await backend.getSession();
  if (session) startSession(session.email);
}

export async function signOut() {
  await backend?.signOut();
  endSession();
}

/** ¿Hay cambios locales que el servidor aún no tiene? */
export const hasPendingChanges = () => countRecords(pendingChanges(useTasky.getState().data, versions)) > 0;

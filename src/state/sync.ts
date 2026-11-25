import { create } from 'zustand';
import { now } from '../core/clock';
import type { SyncBackend, SyncSession } from '../core/ports';
import { countRecords, pendingChanges, rememberVersions, type ServerVersions, type SyncRecords } from '../core/sync';
import { lostAccess } from '../core/collab';
import { addAuthors, resetPeople, setCollab, usePeople } from './people';
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
  userId: string | null;
  /** La sesión que acaba de empezar es de otra cuenta que la de los datos guardados en este dispositivo (se han vaciado). */
  accountSwitched: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

export const useSync = create<SyncState>()(() => ({
  status: 'disabled',
  requireAuth: false,
  email: null,
  userId: null,
  accountSwitched: false,
  lastSyncedAt: null,
  error: null,
}));

/** Espera tras un cambio local antes de enviarlo (agrupa ráfagas de cambios). */
/** Cuenta propietaria de los datos guardados en este dispositivo. */
const OWNER_KEY = 'tasky-data-owner';

const PUSH_DELAY_MS = 1500;
/** Espera tras un aviso de Realtime: agrupa los avisos de una misma operación (p. ej. 15 tareas creadas a la vez). */
const REMOTE_DELAY_MS = 300;
/** Comprobación periódica de respaldo (por si se pierde algún aviso de Realtime) mientras la app está visible. */
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
  const unknown = <T extends { id: string; updatedAt: string }>(list: T[]) => list.filter((r) => versions.get(r.id) !== r.updatedAt);
  return {
    projects: unknown(records.projects),
    phases: unknown(records.phases),
    tasks: unknown(records.tasks),
    ideas: unknown(records.ideas),
  };
}

async function cycle(b: SyncBackend) {
  // Hasta que los datos locales se hayan cargado bien no se mezcla ni se envía nada.
  if (useTasky.getState().status !== 'ready') return;
  const tasky = useTasky.getState();

  const pulled = await b.pull(cursor);
  if (pulled.authors) addAuthors(pulled.authors);
  const incoming = onlyNew(pulled.records);
  tasky.applyRemote(incoming);
  rememberVersions(versions, incoming);
  cursor = pulled.cursor;

  // Antes de enviar: lo que han dejado de compartir conmigo sale de este dispositivo (y no se intenta enviar).
  await refreshCollab(b);
  const me = usePeople.getState().me;
  if (me) {
    const lost = lostAccess(usePeople.getState().activity, me);
    if (lost.projects.size + lost.ideas.size > 0) useTasky.getState().purge(lost.projects, lost.ideas);
  }

  const pending = pendingChanges(useTasky.getState().data, versions);
  if (countRecords(pending) > 0) {
    const newerOnServer = await b.push(pending);
    rememberVersions(versions, pending);
    tasky.applyRemote(newerOnServer);
    rememberVersions(versions, newerOnServer);
  }
}

/** Personas y avisos. Si falla (p. ej. servidor sin la parte de colaboración) la app sigue funcionando sin ellos. */
async function refreshCollab(b: SyncBackend) {
  try {
    setCollab(await b.fetchCollab());
  } catch (e) {
    console.warn('No se pudieron descargar los datos de colaboración', e);
  }
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
function startSession(session: SyncSession) {
  const b = backend;
  const { email, userId } = session;
  if (!b || (useSync.getState().userId === userId && stopSession)) return;
  stopSession?.();
  versions = new Map();
  cursor = 0;
  resetPeople(userId);
  // Los datos de este dispositivo pertenecen a la última cuenta que los usó: otra cuenta nunca los hereda ni los envía.
  let accountSwitched = false;
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    accountSwitched = owner !== null && owner !== userId;
    if (accountSwitched) useTasky.getState().clearLocalData();
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Sin almacenamiento local no hay datos de otra cuenta que proteger.
  }
  useSync.setState({ email, userId, accountSwitched, error: null });

  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeData = useTasky.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      // Cambios que solo vienen del servidor no necesitan otra pasada.
      if (countRecords(pendingChanges(useTasky.getState().data, versions)) > 0) void syncNow();
    }, PUSH_DELAY_MS);
  });
  // Cambios de otros dispositivos o de Claude (MCP): llegan al momento por Realtime.
  let remoteTimer: ReturnType<typeof setTimeout> | undefined;
  const stopRemote = b.onRemoteChange(() => {
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(() => void syncNow(), REMOTE_DELAY_MS);
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
    clearTimeout(remoteTimer);
    stopRemote();
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
  useSync.setState({ status: 'signed_out', email: null, userId: null, lastSyncedAt: null, error: null });
  resetPeople(null);
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
  b.onSessionChange((session) => (session ? startSession(session) : endSession()));
  const session = await b.getSession();
  if (session) startSession(session);
  else useSync.setState({ status: 'signed_out' });
}

export async function signIn(email: string, password: string) {
  if (!backend) throw new Error('La sincronización no está configurada.');
  await backend.signIn(email, password);
  // onSessionChange arranca la sesión; por si el aviso llega tarde:
  const session = await backend.getSession();
  if (session) startSession(session);
}

/** Solo el administrador: crea una cuenta para otra persona (la sesión actual no cambia). */
export async function createAccount(username: string, password: string) {
  if (!backend) throw new Error('La sincronización no está configurada.');
  await backend.signUp(username, password);
}

/** Comparte un proyecto o una idea y descarga el nuevo reparto de participantes. */
export async function share(kind: 'project' | 'idea', id: string, username: string) {
  if (!backend) throw new Error('La sincronización no está configurada.');
  await backend.share(kind, id, username);
  await refreshCollab(backend);
}

/** Quita a una persona de lo compartido (o a uno mismo). Al salir, se quita de este dispositivo en la siguiente pasada. */
export async function unshare(kind: 'project' | 'idea', id: string, userId: string) {
  if (!backend) throw new Error('La sincronización no está configurada.');
  await backend.unshare(kind, id, userId);
  await syncNow();
}

/** Avisa al servidor de que se han visto los avisos actuales. */
export const markNotificationsSeen = async () => backend?.markNotificationsSeen();

/** Con `everywhere` se cierran también las demás sesiones de la cuenta; si falla, lanza y no cierra nada. */
export async function signOut(everywhere = false) {
  await backend?.signOut(everywhere);
  endSession();
}

/** ¿Hay cambios locales que el servidor aún no tiene? */
export const hasPendingChanges = () => countRecords(pendingChanges(useTasky.getState().data, versions)) > 0;

/** Página de autorización de asistentes (OAuth). Solo disponible con Supabase configurado. */
export function authorizationBackend() {
  if (!backend) throw new Error('La sincronización no está configurada.');
  return backend;
}

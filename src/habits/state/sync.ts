import { create } from 'zustand';
import { useSync } from '../../state/sync';
import type { HabitsSyncBackend } from '../core/ports';
import {
  countHabitsRecords,
  onlyNewHabits,
  pendingHabitsChanges,
  rememberHabitsVersions,
  type HabitsVersions,
} from '../core/sync';
import { useHabits } from './store';

/**
 * Sincronización de Hábitos: mismo funcionamiento que la de Proyectos (state/sync.ts) y misma sesión,
 * pero sus propias tablas, cursor y estado. Un fallo aquí nunca afecta a la sincronización de Proyectos.
 */
export const useHabitsSync = create<{ error: string | null }>()(() => ({ error: null }));

const PUSH_DELAY_MS = 1500;
const REMOTE_DELAY_MS = 300;
const POLL_MS = 60_000;

let backend: HabitsSyncBackend | null = null;
let versions: HabitsVersions = new Map();
let cursor = 0;
let running: Promise<void> | null = null;
let again = false;
let stopSession: (() => void) | null = null;

async function cycle(b: HabitsSyncBackend) {
  if (useHabits.getState().status !== 'ready') return;
  const pulled = await b.pull(cursor);
  const incoming = onlyNewHabits(pulled.records, versions);
  useHabits.getState().applyRemote(incoming);
  rememberHabitsVersions(versions, incoming);
  cursor = pulled.cursor;

  const pending = pendingHabitsChanges(useHabits.getState().data, versions);
  if (countHabitsRecords(pending) === 0) return;
  const fromServer = await b.push(pending);
  rememberHabitsVersions(versions, pending);
  useHabits.getState().applyRemote(fromServer);
  rememberHabitsVersions(versions, fromServer);
}

function syncHabitsNow(): Promise<void> {
  const b = backend;
  if (!b || !stopSession) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await cycle(b);
      } while (again);
      useHabitsSync.setState({ error: null });
    } catch (e) {
      console.error(e);
      useHabitsSync.setState({ error: e instanceof Error ? e.message : 'Error de sincronización.' });
    } finally {
      running = null;
    }
  })();
  return running;
}

function startSession(b: HabitsSyncBackend) {
  versions = new Map();
  cursor = 0;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeData = useHabits.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (countHabitsRecords(pendingHabitsChanges(useHabits.getState().data, versions)) > 0) void syncHabitsNow();
    }, PUSH_DELAY_MS);
  });
  let remoteTimer: ReturnType<typeof setTimeout> | undefined;
  const stopRemote = b.onRemoteChange(() => {
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(() => void syncHabitsNow(), REMOTE_DELAY_MS);
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncHabitsNow();
  const onOnline = () => void syncHabitsNow();
  const poll = setInterval(() => document.visibilityState === 'visible' && void syncHabitsNow(), POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
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
  void syncHabitsNow();
}

/** Sigue la sesión de Proyectos: con sesión sincroniza; al cerrarla en la web, borra los hábitos del dispositivo. */
export function initHabitsSync(b: HabitsSyncBackend | null, localDataLoaded: Promise<void>) {
  backend = b;
  if (!b) return;
  void localDataLoaded.then(() => {
    const follow = (email: string | null, prevEmail: string | null) => {
      if (email === prevEmail) return;
      stopSession?.();
      if (email) startSession(b);
      else if (prevEmail && useSync.getState().requireAuth) useHabits.getState().clearLocalData();
    };
    useSync.subscribe((state, prev) => follow(state.email, prev.email));
    follow(useSync.getState().email, null);
  });
}

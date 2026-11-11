import { useMemo } from 'react';
import { create } from 'zustand';
import { now } from '../../core/clock';
import { newId } from '../../core/ids';
import type { LocalDate } from '../../core/model';
import { emptyHabitsData, HabitsDataError, parseHabitsData } from '../core/data';
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  ensureProfile,
  evaluateRewards,
  logHabit,
  updateHabit,
  type HabitInput,
  type HabitPatch,
} from '../core/habits';
import { buyUpgrade, economyOf, finishRun, setLoadout, startRun, unlock, type Economy, type RunOutcome } from '../core/economy';
import type { HabitsData } from '../core/model';
import { dateInZone, deviceTimeZone } from '../core/periods';
import type { HabitsStorage, RunSnapshot } from '../core/ports';
import { countHabitsRecords, mergeHabitsRemote, type HabitsRecords } from '../core/sync';

type Status = 'loading' | 'ready' | 'error';

interface HabitsState {
  status: Status;
  loadError: string | null;
  saveError: string | null;
  data: HabitsData;
  /** Día actual en la zona horaria del perfil (cambia a las 00:00). */
  today: LocalDate;

  load(storage: HabitsStorage): Promise<void>;
  /** Comprueba si ha cambiado el día y cierra los periodos pendientes. */
  tick(): void;
  applyRemote(records: HabitsRecords): void;
  clearLocalData(): void;
  createHabit(input: HabitInput): string;
  updateHabit(id: string, patch: HabitPatch): void;
  archiveHabit(id: string, archived: boolean): void;
  deleteHabit(id: string): void;
  log(id: string, direction: 1 | -1): void;

  // Juego (lanzan EconomyError con un mensaje para el usuario si no se puede).
  buyUpgrade(id: string): void;
  unlock(key: string): void;
  setLoadout(character: string, stage: string): void;
  /** Consume una partida y devuelve su nivel. */
  startRun(): number;
  finishRun(level: number, outcome: RunOutcome): void;
}

const zoneOf = (data: HabitsData) => data.profile?.timeZone ?? deviceTimeZone();
const todayIn = (data: HabitsData) => dateInZone(new Date(), zoneOf(data));

let storage: HabitsStorage | null = null;
let saving: Promise<void> | null = null;
let queued: HabitsData | null = null;

/** Guardado inmediato y serializado, como en Proyectos (state/store.ts). */
function persist(data: HabitsData) {
  queued = data;
  if (saving || !storage) return;
  const target = storage;
  saving = (async () => {
    try {
      while (queued) {
        const next = queued;
        queued = null;
        await target.save(next);
      }
      useHabits.setState({ saveError: null });
    } catch (e) {
      console.error(e);
      useHabits.setState({ saveError: 'No se pudieron guardar los últimos cambios de hábitos.' });
    } finally {
      saving = null;
    }
  })();
}

export const useHabits = create<HabitsState>()((set, get) => {
  /**
   * Aplica un cambio puro de habits/core y después cierra los periodos pendientes:
   * las recompensas se conceden en cuanto se detectan, con independencia de qué provocó el cambio.
   */
  const commit = (change: (data: HabitsData) => HabitsData) => {
    if (get().status !== 'ready') return;
    const changed = change(get().data);
    const today = todayIn(changed);
    const data = evaluateRewards(changed, today, now());
    if (today !== get().today) set({ today });
    if (data === get().data) return;
    set({ data });
    persist(data);
  };

  return {
    status: 'loading',
    loadError: null,
    saveError: null,
    data: emptyHabitsData(),
    today: todayIn(emptyHabitsData()),

    async load(s) {
      storage = s;
      try {
        const loaded = parseHabitsData(await s.load(), now());
        set({ status: 'ready', data: loaded });
        commit((d) => ensureProfile(d, deviceTimeZone(), todayIn(d)));
      } catch (e) {
        console.error(e);
        // Sin estado 'ready' no se guarda nada: el archivo existente nunca se sobrescribe.
        set({ status: 'error', loadError: e instanceof HabitsDataError ? e.message : 'No se pudieron leer los datos de hábitos.' });
      }
    },

    tick: () => commit((d) => d),

    applyRemote(records) {
      if (countHabitsRecords(records) > 0) commit((d) => mergeHabitsRemote(d, records));
    },

    clearLocalData() {
      if (get().status !== 'ready') return;
      const data = ensureProfile(emptyHabitsData(), deviceTimeZone(), todayIn(emptyHabitsData()));
      set({ data });
      persist(data);
    },

    createHabit(input) {
      const id = newId();
      commit((d) => createHabit(d, input, id, now(), todayIn(d)));
      return id;
    },
    updateHabit: (id, patch) => commit((d) => updateHabit(d, id, patch, now(), todayIn(d))),
    archiveHabit: (id, archived) => commit((d) => archiveHabit(d, id, archived, now())),
    deleteHabit: (id) => commit((d) => deleteHabit(d, id, now())),
    log: (id, direction) => commit((d) => logHabit(d, id, direction, newId(), now(), todayIn(d))),

    buyUpgrade: (id) => commit((d) => buyUpgrade(d, id, todayIn(d), now())),
    unlock: (key) => commit((d) => unlock(d, key, todayIn(d), now())),
    setLoadout: (character, stage) => commit((d) => setLoadout(d, character, stage, now())),
    startRun() {
      let level = 0;
      commit((d) => {
        const started = startRun(d, d.profile?.character ?? 'wanderer', d.profile?.stage ?? 'withered_woods', todayIn(d), now());
        level = started.level;
        return started.data;
      });
      return level;
    },
    finishRun: (level, outcome) => commit((d) => finishRun(d, level, outcome, now())),
  };
});

/** Economía del juego (puntos, oro, partidas, mejoras) recalculada solo cuando cambian los datos o el día. */
export function useEconomy(): Economy {
  const data = useHabits((s) => s.data);
  const today = useHabits((s) => s.today);
  return useMemo(() => economyOf(data, today), [data, today]);
}

/**
 * Partida interrumpida guardada en este dispositivo. Lecturas y escrituras van en cola:
 * al salir de una partida, el campamento lee la copia después de que se haya terminado de guardar.
 */
let runQueue: Promise<unknown> = Promise.resolve();
const queueRun = <T>(op: () => Promise<T>): Promise<T> => {
  const next = runQueue.then(op);
  runQueue = next.catch((e) => console.error(e));
  return next;
};
export const loadRunSnapshot = (): Promise<RunSnapshot | null> => queueRun(async () => (storage ? storage.loadRun() : null));
export const saveRunSnapshot = (snapshot: RunSnapshot | null): Promise<void> => queueRun(async () => storage?.saveRun(snapshot)).catch(() => undefined);

/** Cambio de día con la app abierta (00:00) y al volver a ella. */
const TICK_MS = 30_000;

export async function initHabits(s: HabitsStorage) {
  await useHabits.getState().load(s);
  setInterval(() => useHabits.getState().tick(), TICK_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && useHabits.getState().tick());
}

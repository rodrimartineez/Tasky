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
import type { HabitsData } from '../core/model';
import { dateInZone, deviceTimeZone } from '../core/periods';
import type { HabitsStorage } from '../core/ports';
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
  };
});

/** Cambio de día con la app abierta (00:00) y al volver a ella. */
const TICK_MS = 30_000;

export async function initHabits(s: HabitsStorage) {
  await useHabits.getState().load(s);
  setInterval(() => useHabits.getState().tick(), TICK_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && useHabits.getState().tick());
}

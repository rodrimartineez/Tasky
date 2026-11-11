import { useMemo } from 'react';
import { create } from 'zustand';
import { now } from '../../core/clock';
import { newId } from '../../core/ids';
import type { LocalDate } from '../../core/model';
import type { RunMode } from '../../game/sim/types';
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
import { comebackFor, type Comeback } from '../core/comeback';
import { GAME_BUILD, releaseFor } from '../core/release';
import {
  buyUpgrade,
  EconomyError,
  economyOf,
  finishRun,
  setLoadout,
  startRun,
  unlock,
  type Economy,
  type RunOutcome,
} from '../core/economy';
import type { HabitsData } from '../core/model';
import { dateInZone, deviceTimeZone } from '../core/periods';
import type { HabitsStorage, RunSnapshot } from '../core/ports';
import { countHabitsRecords, mergeHabitsRemote, type HabitsRecords } from '../core/sync';
import { UPGRADE_BY_ID } from '../../game/content/upgrades';

type Status = 'loading' | 'ready' | 'error';

interface HabitsState {
  status: Status;
  loadError: string | null;
  saveError: string | null;
  data: HabitsData;
  /** Día actual en la zona horaria del perfil (cambia a las 00:00). */
  today: LocalDate;
  /** Modo de pruebas del juego en este dispositivo (solo con GAME_BUILD.devTools; release.ts). */
  testMode: boolean;
  /** Mejoras compradas en el modo de pruebas (con cristales infinitos). Solo en este dispositivo; se borran al salir. */
  testUpgrades: Record<string, number>;

  load(storage: HabitsStorage): Promise<void>;
  /** Comprueba si ha cambiado el día y cierra los periodos pendientes. */
  tick(): void;
  applyRemote(records: HabitsRecords): void;
  clearLocalData(): void;
  /**
   * Herramienta de desarrollo: activa o desactiva el modo de pruebas en este dispositivo. No toca los datos reales:
   * al desactivarlo, las mejoras y los cristales de prueba vuelven a 0.
   */
  setTestMode(on: boolean): void;
  createHabit(input: HabitInput): string;
  updateHabit(id: string, patch: HabitPatch): void;
  archiveHabit(id: string, archived: boolean): void;
  deleteHabit(id: string): void;
  log(id: string, direction: 1 | -1): void;

  // Juego (lanzan EconomyError con un mensaje para el usuario si no se puede).
  buyUpgrade(id: string): void;
  unlock(key: string): void;
  setLoadout(character: string, stage: string): void;
  /**
   * Gasta un intento y devuelve el número de intento, el nivel (0 si no se pudo) y la ayuda de vuelta.
   * En el modo de pruebas no gasta nada ni se registra, y se juega el nivel elegido (`testLevel`).
   */
  startRun(mode: RunMode, testLevel?: number): { attempt: number; level: number; comeback: Comeback | null; test: boolean };
  /** Registra el resultado de una partida real (las de prueba no se registran). */
  finishRun(attempt: number, outcome: RunOutcome): void;
}

/**
 * El modo elegido se recuerda en este dispositivo (no es un dato de Hábitos: no se sincroniza ni entra en el ledger).
 * Mientras no se elija, el juego en desarrollo empieza en modo de pruebas.
 */
const TEST_MODE_KEY = 'tasky-game-test-mode';
const TEST_UPGRADES_KEY = 'tasky-game-test-upgrades';

function readTestUpgrades(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEST_UPGRADES_KEY) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveTestUpgrades(levels: Record<string, number>) {
  try {
    if (Object.keys(levels).length === 0) localStorage.removeItem(TEST_UPGRADES_KEY);
    else localStorage.setItem(TEST_UPGRADES_KEY, JSON.stringify(levels));
  } catch {
    // Sin almacenamiento las mejoras de prueba duran hasta recargar.
  }
}

function readTestMode(): boolean {
  if (!GAME_BUILD.devTools) return false;
  try {
    return localStorage.getItem(TEST_MODE_KEY) !== 'off';
  } catch {
    return true;
  }
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
    testMode: readTestMode(),
    testUpgrades: readTestMode() ? readTestUpgrades() : {},

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

    setTestMode(on) {
      if (!GAME_BUILD.devTools) return;
      try {
        localStorage.setItem(TEST_MODE_KEY, on ? 'on' : 'off');
      } catch {
        // Sin almacenamiento el cambio dura hasta recargar.
      }
      // Las mejoras de prueba empiezan y terminan en 0.
      saveTestUpgrades({});
      set({ testMode: on, testUpgrades: {} });
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

    buyUpgrade: (id) => {
      if (get().testMode) {
        // Modo de pruebas: cristales infinitos y nada se guarda en los datos reales.
        if (!UPGRADE_BY_ID.has(id)) throw new EconomyError('Mejora desconocida.');
        const testUpgrades = { ...get().testUpgrades, [id]: (get().testUpgrades[id] ?? 0) + 1 };
        saveTestUpgrades(testUpgrades);
        set({ testUpgrades });
        return;
      }
      commit((d) => buyUpgrade(d, id, todayIn(d), now()));
    },
    unlock: (key) => commit((d) => unlock(d, key, todayIn(d), now(), releaseFor(get().testMode))),
    setLoadout: (character, stage) => commit((d) => setLoadout(d, character, stage, now())),
    startRun(mode, testLevel = 1) {
      const release = releaseFor(get().testMode);
      if (release.testMode) return { attempt: 0, level: Math.max(1, Math.floor(testLevel)), comeback: null, test: true };
      let level = 0;
      let attempt = 0;
      let comeback: Comeback | null = null;
      commit((d) => {
        const today = todayIn(d);
        comeback = comebackFor(d, today, economyOf(d, today, release).runs, release);
        const started = startRun(
          d,
          d.profile?.character ?? 'wanderer',
          d.profile?.stage ?? 'withered_woods',
          mode,
          today,
          now(),
          comeback?.strength ?? 0,
          release,
        );
        level = started.level;
        attempt = started.attempt;
        return started.data;
      });
      return { attempt, level, comeback, test: false };
    },
    finishRun: (attempt, outcome) => commit((d) => finishRun(d, attempt, outcome, now(), releaseFor(false))),
  };
});

/** Economía del juego (puntos, oro, partidas, mejoras) recalculada solo cuando cambian los datos o el día. */
export function useEconomy(): Economy {
  const data = useHabits((s) => s.data);
  const today = useHabits((s) => s.today);
  const testMode = useHabits((s) => s.testMode);
  const testUpgrades = useHabits((s) => s.testUpgrades);
  return useMemo(() => {
    const eco = economyOf(data, today, releaseFor(testMode));
    // Modo de pruebas: cristales infinitos y sus propias mejoras (las reales no se tocan).
    return testMode ? { ...eco, points: Infinity, upgrades: testUpgrades } : eco;
  }, [data, today, testMode, testUpgrades]);
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
/** Cada modo tiene su propia copia: una partida de prueba nunca pisa la partida real en curso, ni al revés. */
export const loadRunSnapshot = (test: boolean): Promise<RunSnapshot | null> =>
  queueRun(async () => (storage ? storage.loadRun(test ? 'test' : 'run') : null));
export const saveRunSnapshot = (snapshot: RunSnapshot | null, test: boolean): Promise<void> =>
  queueRun(async () => storage?.saveRun(snapshot, test ? 'test' : 'run')).catch(() => undefined);

/** Cambio de día con la app abierta (00:00) y al volver a ella. */
const TICK_MS = 30_000;

export async function initHabits(s: HabitsStorage) {
  await useHabits.getState().load(s);
  setInterval(() => useHabits.getState().tick(), TICK_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && useHabits.getState().tick());
}

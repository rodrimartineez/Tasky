import type { Timestamp } from '../../core/model';
import type { HabitsData } from './model';

/**
 * Partida interrumpida guardada en este dispositivo (no se sincroniza: pesa mucho y cambia cada pocos segundos).
 * Si la partida en curso no tiene copia aquí, se cierra con el oro que se haya guardado (HABITS_GUIDE §8, D-G2).
 */
export interface RunSnapshot {
  level: number;
  /** Intento al que pertenece (las copias anteriores a los intentos no lo tienen y no se reanudan). */
  attempt?: number;
  savedAt: Timestamp;
  /** Estado completo de la simulación (game/sim World), JSON puro. */
  world: unknown;
  /** Partida del modo de pruebas (no está en el ledger; nunca se reanuda como partida real). */
  test?: boolean;
}
import type { HabitsRecords } from './sync';

export type RunSlot = 'run' | 'test';

/** Almacenamiento local del documento de Hábitos (independiente del de Proyectos). */
export interface HabitsStorage {
  /** Contenido guardado sin validar, o null si todavía no existe. */
  load(): Promise<unknown | null>;
  save(data: HabitsData): Promise<void>;
  /** `slot`: partida real (`run`) o del modo de pruebas (`test`), guardadas por separado. */
  loadRun(slot: RunSlot): Promise<RunSnapshot | null>;
  /** null borra la copia guardada. */
  saveRun(snapshot: RunSnapshot | null, slot: RunSlot): Promise<void>;
}

/** Tablas de Hábitos en el servidor. La sesión es la misma que la de Proyectos. */
export interface HabitsSyncBackend {
  onRemoteChange(listener: () => void): () => void;
  pull(since: number): Promise<{ records: HabitsRecords; cursor: number }>;
  /** Envía cambios y devuelve la versión del servidor de los que no se aceptaron (más recientes allí o ya existentes). */
  push(records: HabitsRecords): Promise<HabitsRecords>;
}

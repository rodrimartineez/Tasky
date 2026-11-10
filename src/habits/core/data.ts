import type { Timestamp } from '../../core/model';
import { HABITS_SCHEMA_VERSION, habitsDataSchema, type HabitsData } from './model';

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const emptyHabitsData = (): HabitsData => ({ schemaVersion: HABITS_SCHEMA_VERSION, profile: null, habits: [], logs: [], ledger: [] });

export class HabitsDataError extends Error {}

/**
 * Valida lo leído del almacenamiento (null = aún no hay datos). Lanza HabitsDataError si no se entiende,
 * para que nunca se sobrescriba un archivo que no se ha podido leer.
 */
export function parseHabitsData(raw: unknown, now: Timestamp): HabitsData {
  if (raw === null || raw === undefined) return emptyHabitsData();
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number') throw new HabitsDataError('Los datos de hábitos no tienen versión.');
  if (version > HABITS_SCHEMA_VERSION) {
    throw new HabitsDataError('Los hábitos se guardaron con una versión más reciente de Tasky. Actualiza la aplicación.');
  }
  const result = habitsDataSchema.safeParse(raw);
  if (!result.success) throw new HabitsDataError('Los datos de hábitos están dañados o incompletos.');
  return purgeTombstones(result.data, now);
}

/**
 * Elimina los hábitos borrados hace más de 30 días y sus registros de actividad.
 * El ledger nunca se purga: es el historial de la economía.
 */
function purgeTombstones(data: HabitsData, now: Timestamp): HabitsData {
  const limit = Date.parse(now) - TOMBSTONE_TTL_MS;
  const purged = new Set(data.habits.filter((h) => h.deletedAt !== null && Date.parse(h.deletedAt) <= limit).map((h) => h.id));
  if (purged.size === 0) return data;
  return { ...data, habits: data.habits.filter((h) => !purged.has(h.id)), logs: data.logs.filter((l) => !purged.has(l.habitId)) };
}

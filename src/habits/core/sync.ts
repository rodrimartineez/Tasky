import type { Timestamp } from '../../core/model';
import type { Habit, HabitLog, HabitsData, HabitsProfile, LedgerEntry } from './model';

/** Registros de Hábitos que se envían o reciben del servidor. */
export interface HabitsRecords {
  habits: Habit[];
  logs: HabitLog[];
  ledger: LedgerEntry[];
  profile: HabitsProfile[];
}

export type HabitsTable = keyof HabitsRecords;
export const HABITS_TABLES: HabitsTable[] = ['profile', 'habits', 'logs', 'ledger'];

export const noHabitsRecords = (): HabitsRecords => ({ habits: [], logs: [], ledger: [], profile: [] });
export const countHabitsRecords = (r: HabitsRecords) => r.habits.length + r.logs.length + r.ledger.length + r.profile.length;

type AnyRecord = { id: string; updatedAt: Timestamp };

/** Versión que el servidor tiene de cada registro, por tabla e id. Solo vive en memoria. */
export type HabitsVersions = Map<string, Timestamp>;
const versionKey = (table: HabitsTable, id: string) => `${table}:${id}`;

/**
 * Última escritura gana por registro; en empate se queda la del servidor.
 * Registros y asientos son inmutables: para ellos esto equivale a la unión por id (mismo id = mismo hecho).
 */
function mergeList<T extends AnyRecord>(local: T[], remote: T[]): T[] {
  if (remote.length === 0) return local;
  const byId = new Map(remote.map((r) => [r.id, r]));
  const merged = local.map((l) => {
    const r = byId.get(l.id);
    if (!r) return l;
    byId.delete(l.id);
    return Date.parse(l.updatedAt) > Date.parse(r.updatedAt) ? l : r;
  });
  return [...merged, ...byId.values()];
}

export function mergeHabitsRemote(local: HabitsData, remote: HabitsRecords): HabitsData {
  const profile = mergeList(local.profile ? [local.profile] : [], remote.profile)[0] ?? null;
  return {
    ...local,
    profile,
    habits: mergeList(local.habits, remote.habits),
    logs: mergeList(local.logs, remote.logs),
    ledger: mergeList(local.ledger, remote.ledger),
  };
}

const recordsOf = (data: HabitsData): HabitsRecords => ({
  habits: data.habits,
  logs: data.logs,
  ledger: data.ledger,
  profile: data.profile ? [data.profile] : [],
});

export function rememberHabitsVersions(versions: HabitsVersions, records: HabitsRecords) {
  for (const table of HABITS_TABLES) for (const r of records[table]) versions.set(versionKey(table, r.id), r.updatedAt);
}

/** Registros que el servidor aún no tiene en su versión actual. */
export function pendingHabitsChanges(data: HabitsData, versions: HabitsVersions): HabitsRecords {
  const all = recordsOf(data);
  const pending = noHabitsRecords();
  for (const table of HABITS_TABLES) {
    (pending[table] as AnyRecord[]) = (all[table] as AnyRecord[]).filter((r) => versions.get(versionKey(table, r.id)) !== r.updatedAt);
  }
  return pending;
}

/** Quita lo ya conocido (p. ej. el eco de nuestros propios envíos). */
export function onlyNewHabits(records: HabitsRecords, versions: HabitsVersions): HabitsRecords {
  const fresh = noHabitsRecords();
  for (const table of HABITS_TABLES) {
    (fresh[table] as AnyRecord[]) = (records[table] as AnyRecord[]).filter((r) => versions.get(versionKey(table, r.id)) !== r.updatedAt);
  }
  return fresh;
}

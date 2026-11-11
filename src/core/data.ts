import { SCHEMA_VERSION, taskyDataSchema, type TaskyData, type Timestamp } from './model';

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const emptyData = (): TaskyData => ({ schemaVersion: SCHEMA_VERSION, projects: [], phases: [], tasks: [], ideas: [] });

export class DataError extends Error {}

/**
 * Convierte lo leído del almacenamiento en datos válidos: aplica migraciones, valida
 * y purga lápidas antiguas. Lanza DataError si el contenido no es utilizable,
 * para que nunca se sobrescriba un archivo que no se ha entendido.
 */
export function parseData(raw: unknown, now: Timestamp): TaskyData {
  if (raw === null || raw === undefined) return emptyData();

  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number') throw new DataError('El archivo de datos no tiene versión.');
  if (version > SCHEMA_VERSION) {
    throw new DataError('Los datos se guardaron con una versión más reciente de Tasky. Actualiza la aplicación.');
  }
  // Las migraciones de versiones anteriores se añadirán aquí cuando cambie SCHEMA_VERSION.

  const result = taskyDataSchema.safeParse(raw);
  if (!result.success) throw new DataError('El archivo de datos está dañado o incompleto.');
  return purgeTombstones(result.data, now);
}

/** Elimina definitivamente los registros borrados hace más de 30 días. */
function purgeTombstones(data: TaskyData, now: Timestamp): TaskyData {
  const limit = Date.parse(now) - TOMBSTONE_TTL_MS;
  const keep = (r: { deletedAt: Timestamp | null }) => r.deletedAt === null || Date.parse(r.deletedAt) > limit;
  return {
    ...data,
    projects: data.projects.filter(keep),
    phases: data.phases.filter(keep),
    tasks: data.tasks.filter(keep),
    ideas: data.ideas.filter(keep),
  };
}

import type { Idea, Project, Task, TaskyData, Timestamp } from './model';

/** Registros que se envían o se reciben del servidor (incluye lápidas). */
export interface SyncRecords {
  projects: Project[];
  tasks: Task[];
  ideas: Idea[];
}

/** Versión (`updatedAt`) que el servidor tiene de cada registro, por id. Solo vive en memoria. */
export type ServerVersions = Map<string, Timestamp>;

type SyncRecord = Project | Task | Idea;

export const noRecords = (): SyncRecords => ({ projects: [], tasks: [], ideas: [] });

export const countRecords = (r: SyncRecords) => r.projects.length + r.tasks.length + r.ideas.length;

const newer = (a: Timestamp, b: Timestamp) => Date.parse(a) > Date.parse(b);

/** Última escritura gana por registro; en empate se queda la versión del servidor. */
function mergeList<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  if (remote.length === 0) return local;
  const byId = new Map(remote.map((r) => [r.id, r]));
  const merged = local.map((l) => {
    const r = byId.get(l.id);
    if (!r) return l;
    byId.delete(l.id);
    return newer(l.updatedAt, r.updatedAt) ? l : r;
  });
  return [...merged, ...byId.values()];
}

/**
 * Incorpora los cambios del servidor a los datos locales. Después reaplica la cascada de borrado:
 * una tarea o idea viva cuyo proyecto se borró en otro dispositivo queda borrada también.
 */
export function mergeRemote(local: TaskyData, remote: SyncRecords, now: Timestamp): TaskyData {
  const projects = mergeList(local.projects, remote.projects);
  const deleted = new Set(projects.filter((p) => p.deletedAt).map((p) => p.id));
  const cascade = <T extends Task | Idea>(r: T): T =>
    !r.deletedAt && deleted.has(r.projectId) ? { ...r, deletedAt: now, updatedAt: now } : r;
  return {
    ...local,
    projects,
    tasks: mergeList(local.tasks, remote.tasks).map(cascade),
    ideas: mergeList(local.ideas, remote.ideas).map(cascade),
  };
}

/** Anota qué versión de cada registro tiene ya el servidor. */
export function rememberVersions(versions: ServerVersions, records: SyncRecords) {
  for (const r of [...records.projects, ...records.tasks, ...records.ideas]) versions.set(r.id, r.updatedAt);
}

/** Registros locales que el servidor aún no tiene en su versión actual (nuevos o modificados). */
export function pendingChanges(data: TaskyData, versions: ServerVersions): SyncRecords {
  const pending = <T extends SyncRecord>(list: T[]) => list.filter((r) => versions.get(r.id) !== r.updatedAt);
  return { projects: pending(data.projects), tasks: pending(data.tasks), ideas: pending(data.ideas) };
}

import type { Idea, IdeaGroup, Phase, Project, ProjectGroup, Task, TaskyData, Timestamp } from './model';

/** Registros que se envían o se reciben del servidor (incluye lápidas). */
export interface SyncRecords {
  projects: Project[];
  projectGroups: ProjectGroup[];
  phases: Phase[];
  tasks: Task[];
  ideas: Idea[];
  ideaGroups: IdeaGroup[];
}

/** Versión (`updatedAt`) que el servidor tiene de cada registro, por id. Solo vive en memoria. */
export type ServerVersions = Map<string, Timestamp>;

type SyncRecord = Project | ProjectGroup | Phase | Task | Idea | IdeaGroup;

export const noRecords = (): SyncRecords => ({ projects: [], projectGroups: [], phases: [], tasks: [], ideas: [], ideaGroups: [] });

export const countRecords = (r: SyncRecords) => r.projects.length + r.projectGroups.length + r.phases.length + r.tasks.length + r.ideas.length + r.ideaGroups.length;

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
 * un grupo, fase, tarea o idea viva cuyo proyecto se borró en otro dispositivo queda borrada también.
 * (Las tareas de una fase borrada y las fases de un grupo borrado no se borran: cuentan como sueltas.)
 */
export function mergeRemote(local: TaskyData, remote: SyncRecords, now: Timestamp): TaskyData {
  const projects = mergeList(local.projects, remote.projects);
  const deleted = new Set(projects.filter((p) => p.deletedAt).map((p) => p.id));
  const cascade = <T extends ProjectGroup | Phase | Task | Idea>(r: T): T =>
    !r.deletedAt && deleted.has(r.projectId) ? { ...r, deletedAt: now, updatedAt: now } : r;
  return {
    ...local,
    projects,
    projectGroups: mergeList(local.projectGroups, remote.projectGroups).map(cascade),
    phases: mergeList(local.phases, remote.phases).map(cascade),
    tasks: mergeList(local.tasks, remote.tasks).map(cascade),
    ideas: mergeList(local.ideas, remote.ideas).map(cascade),
    ideaGroups: mergeList(local.ideaGroups, remote.ideaGroups),
  };
}

/** Anota qué versión de cada registro tiene ya el servidor. */
export function rememberVersions(versions: ServerVersions, records: SyncRecords) {
  for (const r of [...records.projects, ...records.projectGroups, ...records.phases, ...records.tasks, ...records.ideas, ...records.ideaGroups])
    versions.set(r.id, r.updatedAt);
}

/** Registros locales que el servidor aún no tiene en su versión actual (nuevos o modificados). */
export function pendingChanges(data: TaskyData, versions: ServerVersions): SyncRecords {
  const pending = <T extends SyncRecord>(list: T[]) => list.filter((r) => versions.get(r.id) !== r.updatedAt);
  return {
    projects: pending(data.projects),
    projectGroups: pending(data.projectGroups),
    phases: pending(data.phases),
    tasks: pending(data.tasks),
    ideas: pending(data.ideas),
    ideaGroups: pending(data.ideaGroups),
  };
}

/**
 * Quita del dispositivo (sin lápidas: no se envía nada al servidor) los proyectos, con sus grupos, fases, tareas e ideas, y las
 * ideas a los que se ha perdido el acceso. Devuelve los mismos datos si no hay nada que quitar.
 */
export function purgeRecords(data: TaskyData, projectIds: Set<string>, ideaIds: Set<string>): TaskyData {
  const inLost = (r: { projectId: string }) => projectIds.has(r.projectId);
  const found =
    data.projects.some((p) => projectIds.has(p.id)) || data.ideas.some((i) => ideaIds.has(i.id) || inLost(i)) || data.tasks.some(inLost);
  if (!found) return data;
  return {
    ...data,
    projects: data.projects.filter((p) => !projectIds.has(p.id)),
    projectGroups: data.projectGroups.filter((g) => !inLost(g)),
    phases: data.phases.filter((f) => !inLost(f)),
    tasks: data.tasks.filter((t) => !inLost(t)),
    ideas: data.ideas.filter((i) => !inLost(i) && !ideaIds.has(i.id)),
  };
}

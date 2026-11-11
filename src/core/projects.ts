import type { Project, ProjectStatus, TaskyData, Timestamp } from './model';
import { rankBetween, ranksFor } from './rank';

export interface ProjectInput {
  name: string;
  description: string;
  /** Por defecto, activo. */
  status?: ProjectStatus;
}

export interface ProjectPatch {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre del proyecto es obligatorio.');
  return trimmed;
}

/** Orden de Inicio: primero los ordenados a mano (por rank); después el resto, del más reciente al más antiguo. */
export function compareProjects(a: Project, b: Project): number {
  if (a.rank !== null && b.rank !== null) return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id.localeCompare(b.id);
  if (a.rank !== null) return -1;
  if (b.rank !== null) return 1;
  return b.updatedAt.localeCompare(a.updatedAt);
}

/** Los proyectos nuevos aparecen los primeros. */
export function createProject(data: TaskyData, input: ProjectInput, id: string, now: Timestamp): TaskyData {
  const first = data.projects
    .filter((p) => !p.deletedAt && p.rank !== null)
    .reduce<string | null>((min, p) => (min === null || p.rank! < min ? p.rank : min), null);
  const project: Project = {
    id,
    name: cleanName(input.name),
    description: input.description.trim(),
    status: input.status ?? 'active',
    rank: rankBetween(null, first),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return { ...data, projects: [...data.projects, project] };
}

/** Aplica cambios a un proyecto. Solo actualiza `updatedAt` si algo cambia de verdad. */
export function updateProject(data: TaskyData, id: string, patch: ProjectPatch, now: Timestamp): TaskyData {
  return {
    ...data,
    projects: data.projects.map((p) => {
      if (p.id !== id || p.deletedAt) return p;
      const next: Project = {
        ...p,
        name: patch.name !== undefined ? cleanName(patch.name) : p.name,
        description: patch.description !== undefined ? patch.description.trim() : p.description,
        status: patch.status ?? p.status,
      };
      const changed = next.name !== p.name || next.description !== p.description || next.status !== p.status;
      return changed ? { ...next, updatedAt: now } : p;
    }),
  };
}

/**
 * Coloca un proyecto en su sección. `orderedIds` es el orden de la sección tras soltarlo.
 * Si la sección ya estaba ordenada a mano solo cambia el proyecto movido; si no, se fija el orden de toda la sección.
 */
export function reorderProject(data: TaskyData, orderedIds: string[], movedId: string, now: Timestamp): TaskyData {
  const byId = new Map(data.projects.map((p) => [p.id, p]));
  const list = orderedIds.map((id) => byId.get(id)).filter((p): p is Project => p !== undefined);
  const ranks = new Map<string, string>();
  if (list.some((p) => p.rank === null)) {
    ranksFor(list.length).forEach((rank, i) => ranks.set(list[i].id, rank));
  } else {
    const i = list.findIndex((p) => p.id === movedId);
    if (i < 0) return data;
    ranks.set(movedId, rankBetween(list[i - 1]?.rank ?? null, list[i + 1]?.rank ?? null));
  }
  return {
    ...data,
    projects: data.projects.map((p) => {
      const rank = ranks.get(p.id);
      return rank !== undefined && rank !== p.rank ? { ...p, rank, updatedAt: now } : p;
    }),
  };
}

/** Borrado lógico en cascada: el proyecto y todas sus fases, tareas e ideas. */
export function deleteProject(data: TaskyData, id: string, now: Timestamp): TaskyData {
  const tomb = <T extends { deletedAt: Timestamp | null; updatedAt: Timestamp }>(r: T): T =>
    r.deletedAt ? r : { ...r, deletedAt: now, updatedAt: now };
  return {
    ...data,
    projects: data.projects.map((p) => (p.id === id ? tomb(p) : p)),
    phases: data.phases.map((f) => (f.projectId === id ? tomb(f) : f)),
    tasks: data.tasks.map((t) => (t.projectId === id ? tomb(t) : t)),
    ideas: data.ideas.map((i) => (i.projectId === id ? tomb(i) : i)),
  };
}

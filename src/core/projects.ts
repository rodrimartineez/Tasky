import type { Project, ProjectStatus, TaskyData, Timestamp } from './model';

export interface ProjectInput {
  name: string;
  description: string;
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

export function createProject(data: TaskyData, input: ProjectInput, id: string, now: Timestamp): TaskyData {
  const project: Project = {
    id,
    name: cleanName(input.name),
    description: input.description.trim(),
    status: 'active',
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

/** Borrado lógico en cascada: el proyecto y todas sus tareas e ideas. */
export function deleteProject(data: TaskyData, id: string, now: Timestamp): TaskyData {
  const tomb = <T extends { deletedAt: Timestamp | null; updatedAt: Timestamp }>(r: T): T =>
    r.deletedAt ? r : { ...r, deletedAt: now, updatedAt: now };
  return {
    ...data,
    projects: data.projects.map((p) => (p.id === id ? tomb(p) : p)),
    tasks: data.tasks.map((t) => (t.projectId === id ? tomb(t) : t)),
    ideas: data.ideas.map((i) => (i.projectId === id ? tomb(i) : i)),
  };
}

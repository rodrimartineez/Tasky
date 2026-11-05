import type { Project, ProjectStatus, TaskyData } from './model';

export interface ProjectSummary {
  project: Project;
  pending: number;
  completed: number;
}

/** Proyectos visibles de un estado, más recientes primero, con sus contadores de tareas. */
export function projectSummariesByStatus(data: TaskyData, status: ProjectStatus): ProjectSummary[] {
  const counts = new Map<string, { pending: number; completed: number }>();
  for (const task of data.tasks) {
    if (task.deletedAt) continue;
    const c = counts.get(task.projectId) ?? { pending: 0, completed: 0 };
    if (task.status === 'done') c.completed++;
    else c.pending++;
    counts.set(task.projectId, c);
  }

  return data.projects
    .filter((p) => !p.deletedAt && p.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((project) => ({ project, ...(counts.get(project.id) ?? { pending: 0, completed: 0 }) }));
}

export function findProject(data: TaskyData, id: string): Project | undefined {
  return data.projects.find((p) => p.id === id && !p.deletedAt);
}

export function countProjectItems(data: TaskyData, projectId: string): { tasks: number; ideas: number } {
  return {
    tasks: data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt).length,
    ideas: data.ideas.filter((i) => i.projectId === projectId && !i.deletedAt).length,
  };
}

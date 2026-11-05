import type { Idea, LocalDate, Project, ProjectStatus, Task, TaskyData } from './model';
import { compareRank } from './rank';

export interface ProjectSummary {
  project: Project;
  pending: number;
  completed: number;
  /** Fecha límite más cercana entre las tareas no completadas (puede estar vencida). */
  nextDue: LocalDate | null;
  overdue: number;
}

/** Proyectos visibles de un estado, más recientes primero, con contadores y fechas de sus tareas. */
export function projectSummariesByStatus(data: TaskyData, status: ProjectStatus, today: LocalDate): ProjectSummary[] {
  const stats = new Map<string, Omit<ProjectSummary, 'project'>>();
  for (const task of data.tasks) {
    if (task.deletedAt) continue;
    const s = stats.get(task.projectId) ?? { pending: 0, completed: 0, nextDue: null, overdue: 0 };
    if (task.status === 'done') {
      s.completed++;
    } else {
      s.pending++;
      if (task.dueDate) {
        if (task.dueDate < today) s.overdue++;
        if (!s.nextDue || task.dueDate < s.nextDue) s.nextDue = task.dueDate;
      }
    }
    stats.set(task.projectId, s);
  }

  return data.projects
    .filter((p) => !p.deletedAt && p.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((project) => ({ project, ...(stats.get(project.id) ?? { pending: 0, completed: 0, nextDue: null, overdue: 0 }) }));
}

export function findProject(data: TaskyData, id: string): Project | undefined {
  return data.projects.find((p) => p.id === id && !p.deletedAt);
}

/** Tareas de un proyecto: abiertas en su secuencia y completadas de la más reciente a la más antigua. */
export function projectTasks(data: TaskyData, projectId: string): { open: Task[]; done: Task[] } {
  const live = data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt);
  return {
    open: live.filter((t) => t.status !== 'done').sort(compareRank),
    done: live.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
  };
}

/** Ideas de un proyecto, de la más reciente a la más antigua. */
export function projectIdeas(data: TaskyData, projectId: string): Idea[] {
  return data.ideas
    .filter((i) => i.projectId === projectId && !i.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function countProjectItems(data: TaskyData, projectId: string): { tasks: number; ideas: number } {
  return {
    tasks: data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt).length,
    ideas: data.ideas.filter((i) => i.projectId === projectId && !i.deletedAt).length,
  };
}

import type { Idea, LocalDate, Project, ProjectStatus, Task, TaskyData, TimeSlot } from './model';
import { compareProjects } from './projects';
import { compareRank } from './rank';

export interface ProjectSummary {
  project: Project;
  pending: number;
  completed: number;
  /** Fecha límite más cercana entre las tareas no completadas (puede estar vencida). */
  nextDue: LocalDate | null;
  overdue: number;
  /** Primera tarea no completada según el orden manual del proyecto. */
  nextTask: Task | null;
}

const emptyStats = (): Omit<ProjectSummary, 'project'> => ({ pending: 0, completed: 0, nextDue: null, overdue: 0, nextTask: null });

/** Proyectos visibles de un estado, en el orden de Inicio, con contadores y fechas de sus tareas. */
export function projectSummariesByStatus(data: TaskyData, status: ProjectStatus, today: LocalDate): ProjectSummary[] {
  const stats = new Map<string, Omit<ProjectSummary, 'project'>>();
  for (const task of data.tasks) {
    if (task.deletedAt) continue;
    const s = stats.get(task.projectId) ?? emptyStats();
    if (task.status === 'done') {
      s.completed++;
    } else {
      s.pending++;
      if (!s.nextTask || compareRank(task, s.nextTask) < 0) s.nextTask = task;
      if (task.dueDate) {
        if (task.dueDate < today) s.overdue++;
        if (!s.nextDue || task.dueDate < s.nextDue) s.nextDue = task.dueDate;
      }
    }
    stats.set(task.projectId, s);
  }

  return data.projects
    .filter((p) => !p.deletedAt && p.status === status)
    .sort(compareProjects)
    .map((project) => ({ project, ...(stats.get(project.id) ?? emptyStats()) }));
}

/** Orden de las franjas del día. */
export const TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening', 'all_day'];

export interface TodayGroup {
  slot: TimeSlot;
  items: { task: Task; project: Project }[];
}

/**
 * Tareas no completadas con fecha de hoy, agrupadas por franja (solo las franjas con tareas).
 * Dentro de cada franja, por proyecto y en el orden manual de cada proyecto.
 */
export function todayTasks(data: TaskyData, today: LocalDate): TodayGroup[] {
  const projects = new Map(data.projects.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  const items = data.tasks
    .filter((t) => !t.deletedAt && t.status !== 'done' && t.dueDate === today && projects.has(t.projectId))
    .map((task) => ({ task, project: projects.get(task.projectId)! }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name, 'es') || a.project.id.localeCompare(b.project.id) || compareRank(a.task, b.task));
  return TIME_SLOTS.map((slot) => ({ slot, items: items.filter((i) => i.task.timeSlot === slot) })).filter((g) => g.items.length > 0);
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

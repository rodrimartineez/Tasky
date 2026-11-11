import type { Idea, LocalDate, Phase, Project, ProjectStatus, Task, TaskyData, TimeSlot } from './model';
import { isScheduledOn } from './dueDates';
import { compareProjects } from './projects';
import { compareRank } from './rank';
import { taskOrder } from './tasks';

export interface ProjectSummary {
  project: Project;
  pending: number;
  completed: number;
  /** Fecha límite más cercana entre las tareas no completadas (puede estar vencida). */
  nextDue: LocalDate | null;
  overdue: number;
  /** Primera tarea no completada según el orden manual del proyecto (con fases, el de la fase dentro del proyecto). */
  nextTask: Task | null;
}

const emptyStats = (): Omit<ProjectSummary, 'project'> => ({ pending: 0, completed: 0, nextDue: null, overdue: 0, nextTask: null });

/** Proyectos visibles de un estado, en el orden de Inicio, con contadores y fechas de sus tareas. */
export function projectSummariesByStatus(data: TaskyData, status: ProjectStatus, today: LocalDate): ProjectSummary[] {
  const stats = new Map<string, Omit<ProjectSummary, 'project'>>();
  const order = taskOrder(data);
  for (const task of data.tasks) {
    if (task.deletedAt) continue;
    const s = stats.get(task.projectId) ?? emptyStats();
    if (task.status === 'done') {
      s.completed++;
    } else {
      s.pending++;
      if (!s.nextTask || order(task, s.nextTask) < 0) s.nextTask = task;
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
 * Tareas no completadas para hoy: programadas para hoy (incluida la repetición semanal) o que vencen hoy.
 * Agrupadas por franja (solo las franjas con tareas); dentro de cada una, por proyecto y en su orden manual.
 */
export function todayTasks(data: TaskyData, today: LocalDate): TodayGroup[] {
  const projects = new Map(data.projects.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  const order = taskOrder(data);
  const items = data.tasks
    .filter((t) => !t.deletedAt && t.status !== 'done' && projects.has(t.projectId) && (t.dueDate === today || isScheduledOn(t, today)))
    .map((task) => ({ task, project: projects.get(task.projectId)! }))
    .sort(
      (a, b) => a.project.name.localeCompare(b.project.name, 'es') || a.project.id.localeCompare(b.project.id) || order(a.task, b.task),
    );
  return TIME_SLOTS.map((slot) => ({ slot, items: items.filter((i) => i.task.timeSlot === slot) })).filter((g) => g.items.length > 0);
}

export function findProject(data: TaskyData, id: string): Project | undefined {
  return data.projects.find((p) => p.id === id && !p.deletedAt);
}

const byCompletion = (a: Task, b: Task) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '');

/** Tareas de un proyecto: abiertas en su secuencia (fases incluidas) y completadas de la más reciente a la más antigua. */
export function projectTasks(data: TaskyData, projectId: string): { open: Task[]; done: Task[] } {
  const live = data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt);
  return {
    open: live.filter((t) => t.status !== 'done').sort(taskOrder(data)),
    done: live.filter((t) => t.status === 'done').sort(byCompletion),
  };
}

export function findPhase(data: TaskyData, id: string): Phase | undefined {
  return data.phases.find((f) => f.id === id && !f.deletedAt);
}

/** Fases vivas de un proyecto, en su orden. */
export function projectPhases(data: TaskyData, projectId: string): Phase[] {
  return data.phases.filter((f) => f.projectId === projectId && !f.deletedAt).sort(compareRank);
}

/** Elemento del primer nivel de un proyecto: una fase (con sus contadores) o una tarea suelta abierta. */
export type OutlineEntry = { kind: 'phase'; phase: Phase; open: number; done: number } | { kind: 'task'; task: Task };

/**
 * Primer nivel de un proyecto: fases y tareas sueltas abiertas intercaladas en su orden;
 * aparte, las tareas sueltas completadas. Las tareas cuya fase ya no existe cuentan como sueltas.
 */
export function projectOutline(data: TaskyData, projectId: string): { entries: OutlineEntry[]; done: Task[] } {
  const phases = projectPhases(data, projectId);
  const counts = new Map(phases.map((f) => [f.id, { open: 0, done: 0 }]));
  const loose: Task[] = [];
  for (const t of data.tasks) {
    if (t.projectId !== projectId || t.deletedAt) continue;
    const c = t.phaseId ? counts.get(t.phaseId) : undefined;
    if (c) c[t.status === 'done' ? 'done' : 'open']++;
    else loose.push(t);
  }
  const entries: OutlineEntry[] = [
    ...phases.map((phase) => ({ kind: 'phase' as const, phase, ...counts.get(phase.id)! })),
    ...loose.filter((t) => t.status !== 'done').map((task) => ({ kind: 'task' as const, task })),
  ];
  const item = (e: OutlineEntry) => (e.kind === 'phase' ? e.phase : e.task);
  return {
    entries: entries.sort((a, b) => compareRank(item(a), item(b))),
    done: loose.filter((t) => t.status === 'done').sort(byCompletion),
  };
}

/** Tareas de una fase: abiertas en su orden y completadas de la más reciente a la más antigua. */
export function phaseTasks(data: TaskyData, phaseId: string): { open: Task[]; done: Task[] } {
  const live = data.tasks.filter((t) => t.phaseId === phaseId && !t.deletedAt);
  return {
    open: live.filter((t) => t.status !== 'done').sort(compareRank),
    done: live.filter((t) => t.status === 'done').sort(byCompletion),
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

import type { Idea, IdeaGroup, LocalDate, Phase, Project, ProjectGroup, ProjectStatus, Task, TaskyData, TimeSlot } from './model';
import { isScheduledOn } from './dueDates';
import { compareProjects } from './projects';
import { compareRank } from './rank';
import { groupOfPhase, looseTasksIn, phasesIn, taskOrder, taskPlace } from './tasks';
import { GENERAL_IDEAS_ID } from './ideas';

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

/** Fases vivas de un proyecto en su orden de trabajo: las de cada grupo, en el lugar del grupo. */
export function projectPhases(data: TaskyData, projectId: string): Phase[] {
  const groups = projectGroups(data, projectId).map((g) => ({ rank: g.rank, id: g.id, phases: phasesIn(data, projectId, g.id) }));
  const loose = phasesIn(data, projectId, null).map((f) => ({ rank: f.rank, id: f.id, phases: [f] }));
  return [...groups, ...loose].sort(compareRank).flatMap((r) => r.phases);
}

export function findProjectGroup(data: TaskyData, id: string): ProjectGroup | undefined {
  return data.projectGroups.find((g) => g.id === id && !g.deletedAt);
}

/** Grupos vivos de un proyecto, en su orden. */
export function projectGroups(data: TaskyData, projectId: string): ProjectGroup[] {
  return data.projectGroups.filter((g) => g.projectId === projectId && !g.deletedAt).sort(compareRank);
}

/** Grupo vivo de una fase (undefined = en el primer nivel del proyecto). */
export const phaseGroup = (data: TaskyData, phase: Phase): ProjectGroup | undefined => {
  const id = groupOfPhase(data, phase);
  return id ? findProjectGroup(data, id) : undefined;
};

/** Grupo vivo de una tarea: el de su fase o, si no tiene fase, el grupo donde está suelta (undefined = ninguno). */
export function taskGroup(data: TaskyData, task: Task): ProjectGroup | undefined {
  const place = taskPlace(data, task);
  const phase = place.phaseId ? findPhase(data, place.phaseId) : undefined;
  const id = phase ? groupOfPhase(data, phase) : place.groupId;
  return id ? findProjectGroup(data, id) : undefined;
}

type Counts = { open: number; done: number };
export type PhaseEntry = { kind: 'phase'; phase: Phase } & Counts;
export type GroupEntry = { kind: 'group'; group: ProjectGroup; phases: number } & Counts;
/** Elemento de una lista del proyecto: un grupo o una fase (con sus contadores de tareas) o una tarea suelta abierta. */
export type OutlineEntry = GroupEntry | PhaseEntry | { kind: 'task'; task: Task };
export interface Outline {
  /** Abiertos, intercalados en su orden. */
  entries: OutlineEntry[];
  /** Tareas sueltas completadas, de la más reciente a la más antigua. */
  done: Task[];
  /** Fases completadas (todas sus tareas hechas), en su orden. */
  doneContainers: PhaseEntry[];
}

/** Una fase se completa cuando todas sus tareas lo están; un grupo nunca se completa (sigue activo aunque todo lo esté). */
const isComplete = (e: GroupEntry | PhaseEntry) => e.kind === 'phase' && e.open === 0 && e.done > 0;
const count = (tasks: Task[]): Counts => ({
  open: tasks.filter((t) => t.status !== 'done').length,
  done: tasks.filter((t) => t.status === 'done').length,
});

const entryItem = (e: OutlineEntry) => (e.kind === 'phase' ? e.phase : e.kind === 'group' ? e.group : e.task);

/**
 * Contenido de un lugar del proyecto: con null, su primer nivel (grupos, fases sin grupo y tareas sueltas); con un grupo,
 * sus fases y tareas sueltas. Las tareas cuya fase (o grupo) ya no existe cuentan como sueltas del lugar de arriba.
 */
export function outlineOf(data: TaskyData, projectId: string, groupId: string | null): Outline {
  const tasksOfPhase = (phaseId: string) => data.tasks.filter((t) => t.phaseId === phaseId && !t.deletedAt);
  const phaseEntry = (phase: Phase): PhaseEntry => ({ kind: 'phase', phase, ...count(tasksOfPhase(phase.id)) });
  const groups: GroupEntry[] = groupId
    ? []
    : projectGroups(data, projectId).map((group) => {
        const phases = phasesIn(data, projectId, group.id);
        const tasks = [...phases.flatMap((f) => tasksOfPhase(f.id)), ...looseTasksIn(data, projectId, group.id)];
        return { kind: 'group', group, phases: phases.length, ...count(tasks) };
      });
  const containers = [...groups, ...phasesIn(data, projectId, groupId).map(phaseEntry)];
  const loose = looseTasksIn(data, projectId, groupId);
  const byRank = (a: OutlineEntry, b: OutlineEntry) => compareRank(entryItem(a), entryItem(b));
  return {
    entries: [
      ...containers.filter((e) => !isComplete(e)),
      ...loose.filter((t) => t.status !== 'done').map((task) => ({ kind: 'task' as const, task })),
    ].sort(byRank),
    done: loose.filter((t) => t.status === 'done').sort(byCompletion),
    doneContainers: containers.filter((e): e is PhaseEntry => isComplete(e)).sort(byRank),
  };
}

/** Primer nivel de un proyecto: grupos, fases sin grupo y tareas sueltas. */
export const projectOutline = (data: TaskyData, projectId: string): Outline => outlineOf(data, projectId, null);

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

/** Grupos de ideas generales, en su orden. */
export function ideaGroups(data: TaskyData): IdeaGroup[] {
  return data.ideaGroups.filter((g) => !g.deletedAt).sort(compareRank);
}

/**
 * Ideas generales de un grupo (null = sueltas), de la más reciente a la más antigua. Una idea cuyo grupo no existe
 * aquí (borrado, o de otra persona que la comparte) cuenta como suelta.
 */
export function groupIdeas(data: TaskyData, groupId: string | null): Idea[] {
  const live = new Set(data.ideaGroups.filter((g) => !g.deletedAt).map((g) => g.id));
  return projectIdeas(data, GENERAL_IDEAS_ID).filter((i) => (i.groupId && live.has(i.groupId) ? i.groupId : null) === groupId);
}

export function countProjectItems(data: TaskyData, projectId: string): { tasks: number; ideas: number } {
  return {
    tasks: data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt).length,
    ideas: data.ideas.filter((i) => i.projectId === projectId && !i.deletedAt).length,
  };
}

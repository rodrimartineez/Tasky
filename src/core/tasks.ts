import type { LocalDate, Task, TaskStatus, TaskyData, TimeSlot, Timestamp } from './model';
import { compareRank, rankBetween } from './rank';

export interface TaskInput {
  title: string;
  description: string;
  dueDate: LocalDate | null;
  /** Por defecto, «Día completo». */
  timeSlot?: TimeSlot;
  /** Por defecto, sin programar. */
  scheduledDays?: LocalDate[];
  repeatWeekly?: boolean;
  /** Fase del mismo proyecto; por defecto, ninguna (tarea suelta). */
  phaseId?: string | null;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  dueDate?: LocalDate | null;
  timeSlot?: TimeSlot;
  scheduledDays?: LocalDate[];
  repeatWeekly?: boolean;
  status?: TaskStatus;
  /** Cambiar de fase (o sacarla con null) la lleva al final de su nuevo lugar. */
  phaseId?: string | null;
}

/** Días ordenados y sin repetir; sin días no hay nada que repetir. */
function cleanSchedule(days: LocalDate[], repeatWeekly: boolean): { scheduledDays: LocalDate[]; repeatWeekly: boolean } {
  const scheduledDays = [...new Set(days)].sort();
  return { scheduledDays, repeatWeekly: repeatWeekly && scheduledDays.length > 0 };
}

const sameDays = (a: LocalDate[], b: LocalDate[]) => a.length === b.length && a.every((d, i) => d === b[i]);

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('El título de la tarea es obligatorio.');
  return trimmed;
}

const livePhaseRanks = (data: TaskyData) => new Map(data.phases.filter((f) => !f.deletedAt).map((f) => [f.id, f.rank]));

/** Fase viva de la tarea, o null si es suelta (también si su fase se borró, p. ej. en otro dispositivo). */
const phaseOf = (task: Task, phaseRanks: Map<string, string>) => (task.phaseId && phaseRanks.has(task.phaseId) ? task.phaseId : null);

/** Elementos del primer nivel de un proyecto (fases y tareas sueltas, también completadas), en su orden. */
export function topLevelOf(data: TaskyData, projectId: string): { id: string; rank: string }[] {
  const phaseRanks = livePhaseRanks(data);
  return [
    ...data.phases.filter((f) => f.projectId === projectId && !f.deletedAt),
    ...data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt && phaseOf(t, phaseRanks) === null),
  ].sort(compareRank);
}

/** Último rank de un lugar del proyecto: dentro de una fase o, con null, el primer nivel. */
function lastRankIn(data: TaskyData, projectId: string, phaseId: string | null): string | null {
  const list = phaseId ? data.tasks.filter((t) => t.phaseId === phaseId && !t.deletedAt) : topLevelOf(data, projectId);
  return list.reduce<string | null>((max, r) => (max === null || r.rank > max ? r.rank : max), null);
}

/**
 * Orden de trabajo de las tareas de un proyecto: el del primer nivel y, dentro de cada fase, el de la fase.
 * Sin fases es el orden por rank de siempre.
 */
export function taskOrder(data: TaskyData): (a: Task, b: Task) => number {
  const phaseRanks = livePhaseRanks(data);
  const top = (t: Task) => (t.phaseId ? phaseRanks.get(t.phaseId) : undefined) ?? t.rank;
  return (a, b) => {
    const ta = top(a);
    const tb = top(b);
    return ta < tb ? -1 : ta > tb ? 1 : compareRank(a, b);
  };
}

function checkPhase(data: TaskyData, projectId: string, phaseId: string | null): string | null {
  if (phaseId && !data.phases.some((f) => f.id === phaseId && f.projectId === projectId && !f.deletedAt)) {
    throw new Error('La fase no existe en este proyecto.');
  }
  return phaseId;
}

/** Crea la tarea al final de la secuencia del proyecto o, si se indica, de su fase. */
export function createTask(data: TaskyData, projectId: string, input: TaskInput, id: string, now: Timestamp): TaskyData {
  const phaseId = checkPhase(data, projectId, input.phaseId ?? null);
  const task: Task = {
    id,
    projectId,
    phaseId,
    title: cleanTitle(input.title),
    description: input.description.trim(),
    status: 'todo',
    dueDate: input.dueDate,
    timeSlot: input.timeSlot ?? 'all_day',
    ...cleanSchedule(input.scheduledDays ?? [], input.repeatWeekly ?? false),
    rank: rankBetween(lastRankIn(data, projectId, phaseId), null),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return { ...data, tasks: [...data.tasks, task] };
}

/** Aplica cambios. Al completar se fija `completedAt`; al reabrir se limpia. Solo toca `updatedAt` si algo cambia. */
export function updateTask(data: TaskyData, id: string, patch: TaskPatch, now: Timestamp): TaskyData {
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id !== id || t.deletedAt) return t;
      const status = patch.status ?? t.status;
      const moved = patch.phaseId !== undefined && patch.phaseId !== t.phaseId;
      const phaseId = moved ? checkPhase(data, t.projectId, patch.phaseId!) : t.phaseId;
      const next: Task = {
        ...t,
        phaseId,
        rank: moved ? rankBetween(lastRankIn(data, t.projectId, phaseId), null) : t.rank,
        title: patch.title !== undefined ? cleanTitle(patch.title) : t.title,
        description: patch.description !== undefined ? patch.description.trim() : t.description,
        dueDate: patch.dueDate !== undefined ? patch.dueDate : t.dueDate,
        timeSlot: patch.timeSlot ?? t.timeSlot,
        ...cleanSchedule(patch.scheduledDays ?? t.scheduledDays, patch.repeatWeekly ?? t.repeatWeekly),
        status,
        completedAt: status === 'done' ? (t.status === 'done' ? t.completedAt : now) : null,
      };
      const changed =
        next.title !== t.title ||
        next.description !== t.description ||
        next.dueDate !== t.dueDate ||
        next.timeSlot !== t.timeSlot ||
        !sameDays(next.scheduledDays, t.scheduledDays) ||
        next.repeatWeekly !== t.repeatWeekly ||
        next.status !== t.status ||
        moved;
      return changed ? { ...next, updatedAt: now } : t;
    }),
  };
}

/** Rank de una tarea o fase (null = extremo o desconocida). */
export const rankOf = (data: TaskyData, id: string | null): string | null =>
  id ? ((data.tasks.find((t) => t.id === id) ?? data.phases.find((f) => f.id === id))?.rank ?? null) : null;

/**
 * Coloca la tarea entre dos vecinas de su mismo lugar (ids de tareas o, en el primer nivel, también de fases;
 * null = extremo). Solo cambia el `rank` de la tarea movida.
 */
export function moveTask(data: TaskyData, id: string, beforeId: string | null, afterId: string | null, now: Timestamp): TaskyData {
  const rank = rankBetween(rankOf(data, beforeId), rankOf(data, afterId));
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, rank, updatedAt: now } : t)) };
}

export function deleteTask(data: TaskyData, id: string, now: Timestamp): TaskyData {
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id && !t.deletedAt ? { ...t, deletedAt: now, updatedAt: now } : t)),
  };
}

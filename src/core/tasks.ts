import type { LocalDate, Phase, Task, TaskStatus, TaskyData, TimeSlot, Timestamp } from './model';
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
  /** Sin fase: grupo del mismo proyecto donde queda suelta; por defecto, el primer nivel del proyecto. */
  groupId?: string | null;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  dueDate?: LocalDate | null;
  timeSlot?: TimeSlot;
  scheduledDays?: LocalDate[];
  repeatWeekly?: boolean;
  status?: TaskStatus;
  /**
   * Cambiar de fase la lleva al final de su nuevo lugar. Con null sale de la fase y queda suelta en el grupo de esa fase
   * (o en el primer nivel), salvo que se indique `groupId`.
   */
  phaseId?: string | null;
  /** Sin fase: la deja suelta en ese grupo (null = primer nivel del proyecto), al final. */
  groupId?: string | null;
}

/** Lugar de una tarea dentro de su proyecto: una fase, suelta en un grupo o suelta en el primer nivel. */
export interface TaskPlace {
  phaseId: string | null;
  groupId: string | null;
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

const livePhaseIds = (data: TaskyData) => new Set(data.phases.filter((f) => !f.deletedAt).map((f) => f.id));
const liveGroupIds = (data: TaskyData) => new Set(data.projectGroups.filter((g) => !g.deletedAt).map((g) => g.id));

/**
 * Lugar vivo de la tarea: su fase; si no tiene (o se borró, p. ej. en otro dispositivo), su grupo; si tampoco, el primer
 * nivel. Lo que se borra en otro dispositivo nunca deja tareas ocultas.
 */
function placeIn(task: Task, phases: Set<string>, groups: Set<string>): TaskPlace {
  if (task.phaseId && phases.has(task.phaseId)) return { phaseId: task.phaseId, groupId: null };
  return { phaseId: null, groupId: task.groupId && groups.has(task.groupId) ? task.groupId : null };
}
export const taskPlace = (data: TaskyData, task: Task): TaskPlace => placeIn(task, livePhaseIds(data), liveGroupIds(data));

/** Grupo vivo de la fase, o null si está en el primer nivel (también si su grupo se borró en otro dispositivo). */
export const groupOfPhase = (data: TaskyData, phase: Phase): string | null =>
  phase.groupId && data.projectGroups.some((g) => g.id === phase.groupId && !g.deletedAt) ? phase.groupId : null;

/** Fases vivas de un lugar del proyecto (un grupo o, con null, el primer nivel), en su orden. */
export function phasesIn(data: TaskyData, projectId: string, groupId: string | null): Phase[] {
  const groups = liveGroupIds(data);
  return data.phases
    .filter((f) => f.projectId === projectId && !f.deletedAt && (f.groupId && groups.has(f.groupId) ? f.groupId : null) === groupId)
    .sort(compareRank);
}

/** Tareas sueltas (sin fase) de un lugar del proyecto: un grupo o, con null, el primer nivel. También las completadas. */
export function looseTasksIn(data: TaskyData, projectId: string, groupId: string | null): Task[] {
  const phases = livePhaseIds(data);
  const groups = liveGroupIds(data);
  return data.tasks.filter((t) => {
    if (t.projectId !== projectId || t.deletedAt) return false;
    const place = placeIn(t, phases, groups);
    return place.phaseId === null && place.groupId === groupId;
  });
}

/** Elementos de un grupo (fases y tareas sueltas, también completadas), en su orden. */
export const groupItemsOf = (data: TaskyData, projectId: string, groupId: string): { id: string; rank: string }[] =>
  [...phasesIn(data, projectId, groupId), ...looseTasksIn(data, projectId, groupId)].sort(compareRank);

/** Elementos del primer nivel de un proyecto (grupos, fases sin grupo y tareas sueltas, también completadas), en su orden. */
export function topLevelOf(data: TaskyData, projectId: string): { id: string; rank: string }[] {
  return [
    ...data.projectGroups.filter((g) => g.projectId === projectId && !g.deletedAt),
    ...phasesIn(data, projectId, null),
    ...looseTasksIn(data, projectId, null),
  ].sort(compareRank);
}

/** Último rank de un lugar del proyecto: una fase, un grupo o el primer nivel. */
function lastRankIn(data: TaskyData, projectId: string, place: TaskPlace): string | null {
  const list = place.phaseId
    ? data.tasks.filter((t) => t.phaseId === place.phaseId && !t.deletedAt)
    : place.groupId
      ? groupItemsOf(data, projectId, place.groupId)
      : topLevelOf(data, projectId);
  return list.reduce<string | null>((max, r) => (max === null || r.rank > max ? r.rank : max), null);
}

/**
 * Orden de trabajo de las tareas de un proyecto: el del primer nivel y, dentro de cada grupo y de cada fase, el suyo.
 * Sin fases ni grupos es el orden por rank de siempre.
 */
export function taskOrder(data: TaskyData): (a: Task, b: Task) => number {
  const groupRanks = new Map(data.projectGroups.filter((g) => !g.deletedAt).map((g) => [g.id, g.rank]));
  const phaseById = new Map(data.phases.filter((f) => !f.deletedAt).map((f) => [f.id, f]));
  const phases = new Set(phaseById.keys());
  const groups = new Set(groupRanks.keys());
  /** Ranks desde el primer nivel hasta la tarea: [grupo, fase, tarea], [grupo, tarea], [fase, tarea] o [tarea]. */
  const path = (t: Task): string[] => {
    const place = placeIn(t, phases, groups);
    if (place.phaseId) {
      const phase = phaseById.get(place.phaseId)!;
      const groupRank = phase.groupId ? groupRanks.get(phase.groupId) : undefined;
      return groupRank === undefined ? [phase.rank, t.rank] : [groupRank, phase.rank, t.rank];
    }
    return place.groupId ? [groupRanks.get(place.groupId)!, t.rank] : [t.rank];
  };
  return (a, b) => {
    const pa = path(a);
    const pb = path(b);
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
      if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
    }
    return compareRank(a, b);
  };
}

/** Grupo vivo al que pertenece un lugar: el suyo o, dentro de una fase, el de la fase (null = ninguno). */
export function groupOfPlace(data: TaskyData, place: TaskPlace): string | null {
  const phase = place.phaseId ? data.phases.find((f) => f.id === place.phaseId && !f.deletedAt) : undefined;
  return phase ? groupOfPhase(data, phase) : place.groupId;
}

function checkPlace(data: TaskyData, projectId: string, place: TaskPlace): TaskPlace {
  if (place.phaseId && !data.phases.some((f) => f.id === place.phaseId && f.projectId === projectId && !f.deletedAt)) {
    throw new Error('La fase no existe en este proyecto.');
  }
  if (place.groupId && !data.projectGroups.some((g) => g.id === place.groupId && g.projectId === projectId && !g.deletedAt)) {
    throw new Error('El grupo no existe en este proyecto.');
  }
  // Dentro de una fase el grupo lo da la fase.
  return place.phaseId ? { phaseId: place.phaseId, groupId: null } : place;
}

/** Crea la tarea al final de su lugar: su fase, su grupo o, por defecto, el primer nivel del proyecto. */
export function createTask(data: TaskyData, projectId: string, input: TaskInput, id: string, now: Timestamp): TaskyData {
  const place = checkPlace(data, projectId, { phaseId: input.phaseId ?? null, groupId: input.groupId ?? null });
  const task: Task = {
    id,
    projectId,
    ...place,
    title: cleanTitle(input.title),
    description: input.description.trim(),
    status: 'todo',
    dueDate: input.dueDate,
    timeSlot: input.timeSlot ?? 'all_day',
    ...cleanSchedule(input.scheduledDays ?? [], input.repeatWeekly ?? false),
    rank: rankBetween(lastRankIn(data, projectId, place), null),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return { ...data, tasks: [...data.tasks, task] };
}

/** Nuevo lugar pedido por un cambio (o null si no pide moverla). */
function requestedPlace(data: TaskyData, t: Task, patch: TaskPatch): TaskPlace | null {
  if (patch.phaseId === undefined && patch.groupId === undefined) return null;
  const current = taskPlace(data, t);
  if (patch.phaseId) return { phaseId: patch.phaseId, groupId: null };
  if (patch.groupId !== undefined) return { phaseId: null, groupId: patch.groupId };
  // Sale de su fase: queda suelta en el grupo de esa fase (o en el primer nivel).
  const phase = current.phaseId ? data.phases.find((f) => f.id === current.phaseId) : undefined;
  return { phaseId: null, groupId: phase ? groupOfPhase(data, phase) : current.groupId };
}

/** Aplica cambios. Al completar se fija `completedAt`; al reabrir se limpia. Solo toca `updatedAt` si algo cambia. */
export function updateTask(data: TaskyData, id: string, patch: TaskPatch, now: Timestamp): TaskyData {
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id !== id || t.deletedAt) return t;
      const status = patch.status ?? t.status;
      const current = taskPlace(data, t);
      const wanted = requestedPlace(data, t, patch);
      const moved = wanted !== null && (wanted.phaseId !== current.phaseId || wanted.groupId !== current.groupId);
      const place = moved ? checkPlace(data, t.projectId, wanted) : { phaseId: t.phaseId, groupId: t.groupId };
      if (moved) {
        const from = groupOfPlace(data, current);
        const to = groupOfPlace(data, place);
        if (from && to && from !== to) throw new Error('La tarea ya pertenece a otro grupo: sácala de él antes de moverla a otro.');
      }
      const next: Task = {
        ...t,
        ...place,
        rank: moved ? rankBetween(lastRankIn(data, t.projectId, place), null) : t.rank,
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

/** Rank de una tarea, fase o grupo (null = extremo o desconocido). */
export const rankOf = (data: TaskyData, id: string | null): string | null =>
  id
    ? ((data.tasks.find((t) => t.id === id) ?? data.phases.find((f) => f.id === id) ?? data.projectGroups.find((g) => g.id === id))
        ?.rank ?? null)
    : null;

/**
 * Coloca la tarea entre dos vecinas de su mismo lugar (ids de tareas o, en el primer nivel y en los grupos, también de
 * fases y grupos; null = extremo). Solo cambia el `rank` de la tarea movida.
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

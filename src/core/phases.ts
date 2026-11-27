import type { Phase, TaskyData, Timestamp } from './model';
import { rankBetween, ranksBetween } from './rank';
import { groupItemsOf, groupOfPhase, rankOf, taskOrder, topLevelOf, updateTask } from './tasks';

export interface PhaseInput {
  name: string;
  description: string;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre de la fase es obligatorio.');
  return trimmed;
}

function checkGroup(data: TaskyData, projectId: string, groupId: string | null): string | null {
  if (groupId && !data.projectGroups.some((g) => g.id === groupId && g.projectId === projectId && !g.deletedAt)) {
    throw new Error('El grupo no existe en este proyecto.');
  }
  return groupId;
}

/** Elementos de un lugar del proyecto, en su orden: un grupo o, con null, el primer nivel. */
const itemsIn = (data: TaskyData, projectId: string, groupId: string | null) =>
  groupId ? groupItemsOf(data, projectId, groupId) : topLevelOf(data, projectId);

/** Rank para ir al final de un lugar del proyecto. */
const endOf = (data: TaskyData, projectId: string, groupId: string | null) =>
  rankBetween(itemsIn(data, projectId, groupId).at(-1)?.rank ?? null, null);

/**
 * Crea una fase (en un grupo o, con null, en el primer nivel) e incorpora las tareas indicadas (en su orden de trabajo,
 * al final de la fase). Ocupa el lugar de la primera de esas tareas si está en ese mismo lugar (o en una fase de él);
 * si no, va al final.
 */
export function createPhase(
  data: TaskyData,
  projectId: string,
  input: PhaseInput,
  id: string,
  now: Timestamp,
  taskIds: string[] = [],
  groupId: string | null = null,
): TaskyData {
  checkGroup(data, projectId, groupId);
  const chosen = data.tasks.filter((t) => taskIds.includes(t.id) && t.projectId === projectId && !t.deletedAt).sort(taskOrder(data));
  const items = itemsIn(data, projectId, groupId);
  const at = chosen.length > 0 ? items.findIndex((r) => r.id === chosen[0].id || r.id === chosen[0].phaseId) : -1;
  const rank = at >= 0 ? rankBetween(items[at - 1]?.rank ?? null, items[at].rank) : endOf(data, projectId, groupId);
  const phase: Phase = {
    id,
    projectId,
    groupId,
    name: cleanName(input.name),
    description: input.description.trim(),
    rank,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return chosen.reduce((d, t) => updateTask(d, t.id, { phaseId: id }, now), { ...data, phases: [...data.phases, phase] });
}

/** Solo actualiza `updatedAt` si algo cambia de verdad. */
export function updatePhase(data: TaskyData, id: string, input: PhaseInput, now: Timestamp): TaskyData {
  return {
    ...data,
    phases: data.phases.map((f) => {
      if (f.id !== id || f.deletedAt) return f;
      const name = cleanName(input.name);
      const description = input.description.trim();
      return name === f.name && description === f.description ? f : { ...f, name, description, updatedAt: now };
    }),
  };
}

/** Mete la fase en un grupo del proyecto (null = la saca al primer nivel), al final de su nuevo lugar. */
export function setPhaseGroup(data: TaskyData, id: string, groupId: string | null, now: Timestamp): TaskyData {
  const phase = data.phases.find((f) => f.id === id && !f.deletedAt);
  if (!phase || groupOfPhase(data, phase) === groupId) return data;
  checkGroup(data, phase.projectId, groupId);
  if (groupId && groupOfPhase(data, phase)) throw new Error('La fase ya pertenece a otro grupo: sácala de él antes de moverla a otro.');
  const rank = endOf(data, phase.projectId, groupId);
  return { ...data, phases: data.phases.map((f) => (f.id === id ? { ...f, groupId, rank, updatedAt: now } : f)) };
}

/** Coloca la fase entre dos elementos de su mismo lugar (grupos, fases o tareas sueltas; null = extremo). */
export function movePhase(data: TaskyData, id: string, beforeId: string | null, afterId: string | null, now: Timestamp): TaskyData {
  const rank = rankBetween(rankOf(data, beforeId), rankOf(data, afterId));
  return { ...data, phases: data.phases.map((f) => (f.id === id ? { ...f, rank, updatedAt: now } : f)) };
}

/** Borra la fase sin borrar sus tareas: quedan sueltas en su mismo orden, en el lugar que ocupaba la fase (en su grupo, si tenía). */
export function deletePhase(data: TaskyData, id: string, now: Timestamp): TaskyData {
  const phase = data.phases.find((f) => f.id === id && !f.deletedAt);
  if (!phase) return data;
  const groupId = groupOfPhase(data, phase);
  const items = itemsIn(data, phase.projectId, groupId);
  const at = items.findIndex((r) => r.id === id);
  const members = data.tasks.filter((t) => t.phaseId === id && !t.deletedAt).sort(taskOrder(data));
  const ranks = ranksBetween(items[at - 1]?.rank ?? null, items[at + 1]?.rank ?? null, members.length);
  const newRank = new Map(members.map((t, i) => [t.id, ranks[i]]));
  return {
    ...data,
    phases: data.phases.map((f) => (f.id === id ? { ...f, deletedAt: now, updatedAt: now } : f)),
    tasks: data.tasks.map((t) => (newRank.has(t.id) ? { ...t, phaseId: null, groupId, rank: newRank.get(t.id)!, updatedAt: now } : t)),
  };
}

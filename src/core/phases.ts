import type { Phase, TaskyData, Timestamp } from './model';
import { rankBetween, ranksBetween } from './rank';
import { rankOf, taskOrder, topLevelOf, updateTask } from './tasks';

export interface PhaseInput {
  name: string;
  description: string;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre de la fase es obligatorio.');
  return trimmed;
}

/**
 * Crea una fase e incorpora las tareas indicadas (en su orden de trabajo, al final de la fase).
 * La fase ocupa el lugar de la primera de esas tareas en el primer nivel; sin tareas, va al final.
 */
export function createPhase(
  data: TaskyData,
  projectId: string,
  input: PhaseInput,
  id: string,
  now: Timestamp,
  taskIds: string[] = [],
): TaskyData {
  const chosen = data.tasks.filter((t) => taskIds.includes(t.id) && t.projectId === projectId && !t.deletedAt).sort(taskOrder(data));
  const top = topLevelOf(data, projectId);
  // Lugar en el primer nivel de la primera tarea elegida (o de la fase que la contiene).
  const at = chosen.length > 0 ? top.findIndex((r) => r.id === chosen[0].id || r.id === chosen[0].phaseId) : -1;
  const rank = at >= 0 ? rankBetween(top[at - 1]?.rank ?? null, top[at].rank) : rankBetween(top.at(-1)?.rank ?? null, null);
  const phase: Phase = {
    id,
    projectId,
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

/** Coloca la fase entre dos elementos del primer nivel del proyecto (fases o tareas sueltas; null = extremo). */
export function movePhase(data: TaskyData, id: string, beforeId: string | null, afterId: string | null, now: Timestamp): TaskyData {
  const rank = rankBetween(rankOf(data, beforeId), rankOf(data, afterId));
  return { ...data, phases: data.phases.map((f) => (f.id === id ? { ...f, rank, updatedAt: now } : f)) };
}

/** Borra la fase sin borrar sus tareas: quedan sueltas, en el lugar que ocupaba la fase y en su mismo orden. */
export function deletePhase(data: TaskyData, id: string, now: Timestamp): TaskyData {
  const phase = data.phases.find((f) => f.id === id && !f.deletedAt);
  if (!phase) return data;
  const top = topLevelOf(data, phase.projectId);
  const at = top.findIndex((r) => r.id === id);
  const members = data.tasks.filter((t) => t.phaseId === id && !t.deletedAt).sort(taskOrder(data));
  const ranks = ranksBetween(top[at - 1]?.rank ?? null, top[at + 1]?.rank ?? null, members.length);
  const newRank = new Map(members.map((t, i) => [t.id, ranks[i]]));
  return {
    ...data,
    phases: data.phases.map((f) => (f.id === id ? { ...f, deletedAt: now, updatedAt: now } : f)),
    tasks: data.tasks.map((t) => (newRank.has(t.id) ? { ...t, phaseId: null, rank: newRank.get(t.id)!, updatedAt: now } : t)),
  };
}

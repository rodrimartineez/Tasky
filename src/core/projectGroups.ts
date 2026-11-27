import type { ProjectGroup, TaskyData, Timestamp } from './model';
import { compareRank, rankBetween, ranksBetween, ranksFor } from './rank';
import { deleteProject } from './projects';
import { groupItemsOf, groupOfPhase, looseTasksIn, rankOf, topLevelOf } from './tasks';

export interface ProjectGroupInput {
  name: string;
  description: string;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre del grupo es obligatorio.');
  return trimmed;
}

/**
 * Crea un grupo en el primer nivel del proyecto e incorpora las fases indicadas (en su orden; primero las del primer
 * nivel). El grupo ocupa el lugar de la primera de esas fases que esté en el primer nivel; si no, va al final.
 */
export function createProjectGroup(
  data: TaskyData,
  projectId: string,
  input: ProjectGroupInput,
  id: string,
  now: Timestamp,
  phaseIds: string[] = [],
): TaskyData {
  const top = topLevelOf(data, projectId);
  if (data.phases.some((f) => phaseIds.includes(f.id) && !f.deletedAt && groupOfPhase(data, f))) {
    throw new Error('Alguna fase ya pertenece a un grupo y no puede estar en dos.');
  }
  const topIndex = new Map(top.map((r, i) => [r.id, i]));
  const chosen = data.phases
    .filter((f) => phaseIds.includes(f.id) && f.projectId === projectId && !f.deletedAt)
    .sort((a, b) => (topIndex.get(a.id) ?? Infinity) - (topIndex.get(b.id) ?? Infinity) || compareRank(a, b));
  const at = chosen.length > 0 ? (topIndex.get(chosen[0].id) ?? -1) : -1;
  const rank = at >= 0 ? rankBetween(top[at - 1]?.rank ?? null, top[at].rank) : rankBetween(top.at(-1)?.rank ?? null, null);
  const group: ProjectGroup = {
    id,
    projectId,
    name: cleanName(input.name),
    description: input.description.trim(),
    rank,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const ranks = ranksFor(chosen.length);
  const phaseRank = new Map(chosen.map((f, i) => [f.id, ranks[i]]));
  return {
    ...data,
    projectGroups: [...data.projectGroups, group],
    phases: data.phases.map((f) => (phaseRank.has(f.id) ? { ...f, groupId: id, rank: phaseRank.get(f.id)!, updatedAt: now } : f)),
  };
}

/** Solo actualiza `updatedAt` si algo cambia de verdad. */
export function updateProjectGroup(data: TaskyData, id: string, input: ProjectGroupInput, now: Timestamp): TaskyData {
  return {
    ...data,
    projectGroups: data.projectGroups.map((g) => {
      if (g.id !== id || g.deletedAt) return g;
      const name = cleanName(input.name);
      const description = input.description.trim();
      return name === g.name && description === g.description ? g : { ...g, name, description, updatedAt: now };
    }),
  };
}

/**
 * Borra el grupo sin borrar su contenido: sus fases y tareas sueltas quedan en el primer nivel, en el lugar que ocupaba
 * el grupo y en su mismo orden.
 */
export function deleteProjectGroup(data: TaskyData, id: string, now: Timestamp): TaskyData {
  const group = data.projectGroups.find((g) => g.id === id && !g.deletedAt);
  if (!group) return data;
  const top = topLevelOf(data, group.projectId);
  const at = top.findIndex((r) => r.id === id);
  const members = groupItemsOf(data, group.projectId, id);
  const ranks = ranksBetween(top[at - 1]?.rank ?? null, top[at + 1]?.rank ?? null, members.length);
  const newRank = new Map(members.map((r, i) => [r.id, ranks[i]]));
  const out = <T extends { id: string }>(r: T): T =>
    newRank.has(r.id) ? { ...r, groupId: null, rank: newRank.get(r.id)!, updatedAt: now } : r;
  return {
    ...data,
    projectGroups: data.projectGroups.map((g) => (g.id === id ? { ...g, deletedAt: now, updatedAt: now } : g)),
    phases: data.phases.map(out),
    tasks: data.tasks.map(out),
  };
}

/**
 * Convierte un proyecto en un grupo de otro: crea el grupo (con el nombre y la descripción del proyecto, al final del
 * destino) y mueve a él todo el contenido tal cual (fases, tareas también completadas, e ideas al proyecto destino),
 * con los mismos ids, estados, fechas y orden. Después borra el proyecto de origen, ya vacío.
 */
export function moveProjectIntoGroup(data: TaskyData, sourceId: string, targetId: string, groupId: string, now: Timestamp): TaskyData {
  const source = data.projects.find((p) => p.id === sourceId && !p.deletedAt);
  if (!source) throw new Error('El proyecto de origen no existe.');
  if (!data.projects.some((p) => p.id === targetId && !p.deletedAt)) throw new Error('El proyecto de destino no existe.');
  if (sourceId === targetId) throw new Error('El proyecto de origen y el de destino son el mismo.');
  if (data.projectGroups.some((g) => g.projectId === sourceId && !g.deletedAt)) {
    throw new Error('El proyecto de origen ya tiene grupos y no se pueden anidar: elimínalos antes.');
  }
  const looseIds = new Set(looseTasksIn(data, sourceId, null).map((t) => t.id));
  const group: ProjectGroup = {
    id: groupId,
    projectId: targetId,
    name: source.name,
    description: source.description,
    rank: rankBetween(topLevelOf(data, targetId).at(-1)?.rank ?? null, null),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const live = (r: { projectId: string; deletedAt: string | null }) => r.projectId === sourceId && !r.deletedAt;
  const moved: TaskyData = {
    ...data,
    projectGroups: [...data.projectGroups, group],
    phases: data.phases.map((f) => (live(f) ? { ...f, projectId: targetId, groupId, updatedAt: now } : f)),
    tasks: data.tasks.map((t) =>
      live(t) ? { ...t, projectId: targetId, groupId: looseIds.has(t.id) ? groupId : null, updatedAt: now } : t,
    ),
    ideas: data.ideas.map((i) => (live(i) ? { ...i, projectId: targetId, updatedAt: now } : i)),
  };
  return deleteProject(moved, sourceId, now);
}

/** Coloca el grupo entre dos elementos del primer nivel del proyecto (grupos, fases o tareas sueltas; null = extremo). */
export function moveProjectGroup(data: TaskyData, id: string, beforeId: string | null, afterId: string | null, now: Timestamp): TaskyData {
  const rank = rankBetween(rankOf(data, beforeId), rankOf(data, afterId));
  return { ...data, projectGroups: data.projectGroups.map((g) => (g.id === id ? { ...g, rank, updatedAt: now } : g)) };
}

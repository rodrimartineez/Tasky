import type { Idea, IdeaGroup, TaskyData, Timestamp } from './model';
import { rankBetween } from './rank';

/**
 * `projectId` reservado para las ideas generales (sin proyecto). Es un uuid válido y la tabla de Supabase no
 * tiene clave foránea, así que se sincronizan como cualquier idea y la cascada de borrado nunca las alcanza.
 */
export const GENERAL_IDEAS_ID = '00000000-0000-0000-0000-000000000000';

export interface IdeaInput {
  title: string;
  description: string;
}

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('El título de la idea es obligatorio.');
  return trimmed;
}

/** `groupId` solo vale para ideas generales: en un proyecto se ignora. */
export function createIdea(
  data: TaskyData,
  projectId: string,
  input: IdeaInput,
  id: string,
  now: Timestamp,
  groupId: string | null = null,
): TaskyData {
  const idea: Idea = {
    id,
    projectId,
    groupId: projectId === GENERAL_IDEAS_ID && groupId && findIdeaGroup(data, groupId) ? groupId : null,
    title: cleanTitle(input.title),
    description: input.description.trim(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return { ...data, ideas: [...data.ideas, idea] };
}

/** Solo actualiza `updatedAt` si algo cambia de verdad. */
export function updateIdea(data: TaskyData, id: string, input: IdeaInput, now: Timestamp): TaskyData {
  return {
    ...data,
    ideas: data.ideas.map((i) => {
      if (i.id !== id || i.deletedAt) return i;
      const title = cleanTitle(input.title);
      const description = input.description.trim();
      return title === i.title && description === i.description ? i : { ...i, title, description, updatedAt: now };
    }),
  };
}

export function deleteIdea(data: TaskyData, id: string, now: Timestamp): TaskyData {
  return {
    ...data,
    ideas: data.ideas.map((i) => (i.id === id && !i.deletedAt ? { ...i, deletedAt: now, updatedAt: now } : i)),
  };
}

/** Mueve una idea general a un grupo (null = suelta). */
export function setIdeaGroup(data: TaskyData, id: string, groupId: string | null, now: Timestamp): TaskyData {
  if (groupId && !findIdeaGroup(data, groupId)) throw new Error('Ese grupo de ideas no existe.');
  return {
    ...data,
    ideas: data.ideas.map((i) => {
      if (i.id !== id || i.deletedAt || i.projectId !== GENERAL_IDEAS_ID || i.groupId === groupId) return i;
      return { ...i, groupId, updatedAt: now };
    }),
  };
}

// ── Grupos de ideas generales ──

export interface IdeaGroupInput {
  name: string;
  description: string;
}

function cleanGroupName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre del grupo es obligatorio.');
  return trimmed;
}

export function findIdeaGroup(data: TaskyData, id: string): IdeaGroup | undefined {
  return data.ideaGroups.find((g) => g.id === id && !g.deletedAt);
}

/** El grupo nuevo va al final. */
export function createIdeaGroup(data: TaskyData, input: IdeaGroupInput, id: string, now: Timestamp): TaskyData {
  const last = data.ideaGroups
    .filter((g) => !g.deletedAt)
    .reduce<string | null>((max, g) => (max === null || g.rank > max ? g.rank : max), null);
  const group: IdeaGroup = {
    id,
    name: cleanGroupName(input.name),
    description: input.description.trim(),
    rank: rankBetween(last, null),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return { ...data, ideaGroups: [...data.ideaGroups, group] };
}

/** Solo actualiza `updatedAt` si algo cambia de verdad. */
export function updateIdeaGroup(data: TaskyData, id: string, input: IdeaGroupInput, now: Timestamp): TaskyData {
  return {
    ...data,
    ideaGroups: data.ideaGroups.map((g) => {
      if (g.id !== id || g.deletedAt) return g;
      const name = cleanGroupName(input.name);
      const description = input.description.trim();
      return name === g.name && description === g.description ? g : { ...g, name, description, updatedAt: now };
    }),
  };
}

/** Borra el grupo sin borrar sus ideas: quedan sueltas. */
export function deleteIdeaGroup(data: TaskyData, id: string, now: Timestamp): TaskyData {
  if (!findIdeaGroup(data, id)) return data;
  return {
    ...data,
    ideaGroups: data.ideaGroups.map((g) => (g.id === id ? { ...g, deletedAt: now, updatedAt: now } : g)),
    ideas: data.ideas.map((i) => (i.groupId === id && !i.deletedAt ? { ...i, groupId: null, updatedAt: now } : i)),
  };
}

import type { Idea, TaskyData, Timestamp } from './model';

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

export function createIdea(data: TaskyData, projectId: string, input: IdeaInput, id: string, now: Timestamp): TaskyData {
  const idea: Idea = {
    id,
    projectId,
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

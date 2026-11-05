import type { LocalDate, Task, TaskStatus, TaskyData, Timestamp } from './model';
import { compareRank, rankBetween } from './rank';

export interface TaskInput {
  title: string;
  description: string;
  dueDate: LocalDate | null;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  dueDate?: LocalDate | null;
  status?: TaskStatus;
}

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('El título de la tarea es obligatorio.');
  return trimmed;
}

const liveTasksOf = (data: TaskyData, projectId: string) =>
  data.tasks.filter((t) => t.projectId === projectId && !t.deletedAt);

/** Crea la tarea al final de la secuencia del proyecto. */
export function createTask(data: TaskyData, projectId: string, input: TaskInput, id: string, now: Timestamp): TaskyData {
  const last = liveTasksOf(data, projectId).sort(compareRank).at(-1);
  const task: Task = {
    id,
    projectId,
    title: cleanTitle(input.title),
    description: input.description.trim(),
    status: 'todo',
    dueDate: input.dueDate,
    rank: rankBetween(last?.rank ?? null, null),
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
      const next: Task = {
        ...t,
        title: patch.title !== undefined ? cleanTitle(patch.title) : t.title,
        description: patch.description !== undefined ? patch.description.trim() : t.description,
        dueDate: patch.dueDate !== undefined ? patch.dueDate : t.dueDate,
        status,
        completedAt: status === 'done' ? (t.status === 'done' ? t.completedAt : now) : null,
      };
      const changed =
        next.title !== t.title || next.description !== t.description || next.dueDate !== t.dueDate || next.status !== t.status;
      return changed ? { ...next, updatedAt: now } : t;
    }),
  };
}

/** Coloca la tarea entre dos vecinas (ids; null = extremo). Solo cambia el `rank` de la tarea movida. */
export function moveTask(data: TaskyData, id: string, beforeId: string | null, afterId: string | null, now: Timestamp): TaskyData {
  const rankOf = (taskId: string | null) => (taskId ? (data.tasks.find((t) => t.id === taskId)?.rank ?? null) : null);
  const rank = rankBetween(rankOf(beforeId), rankOf(afterId));
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, rank, updatedAt: now } : t)) };
}

export function deleteTask(data: TaskyData, id: string, now: Timestamp): TaskyData {
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id && !t.deletedAt ? { ...t, deletedAt: now, updatedAt: now } : t)),
  };
}

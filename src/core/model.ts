import { z } from 'zod';

export const SCHEMA_VERSION = 1;

/** Marca temporal ISO 8601 en UTC con milisegundos, p. ej. "2026-11-05T18:04:12.345Z". */
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
/** Día del calendario sin hora ni zona horaria, p. ej. "2026-11-13". */
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const baseRecord = {
  id: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
};

export const projectStatusSchema = z.enum(['active', 'on_hold', 'done']);
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);

export const projectSchema = z.object({
  ...baseRecord,
  name: z.string().min(1),
  description: z.string(),
  status: projectStatusSchema,
});

export const taskSchema = z.object({
  ...baseRecord,
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: taskStatusSchema,
  dueDate: localDate.nullable(),
  rank: z.string().min(1),
  completedAt: timestamp.nullable(),
});

export const ideaSchema = z.object({
  ...baseRecord,
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
});

export const taskyDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  ideas: z.array(ideaSchema),
});

export type Timestamp = string;
export type LocalDate = string;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type TaskyData = z.infer<typeof taskyDataSchema>;

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

/** upcoming = «Próximos»: aún no empezado, previsto para más adelante. */
export const projectStatusSchema = z.enum(['active', 'on_hold', 'upcoming', 'done']);
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
/** Cuándo está previsto hacer la tarea dentro de su día. Los datos anteriores a este campo pasan a «Día completo». */
export const timeSlotSchema = z.enum(['morning', 'afternoon', 'evening', 'all_day']);

export const projectSchema = z.object({
  ...baseRecord,
  name: z.string().min(1),
  description: z.string(),
  status: projectStatusSchema,
  /** Orden manual en Inicio. null = aún no se ha ordenado a mano (va detrás, por actualización reciente). */
  rank: z.string().min(1).nullable().default(null),
});

/**
 * Fase de un proyecto: agrupa tareas. Su `rank` comparte el orden del proyecto con las tareas sueltas,
 * así fases y tareas sin fase se intercalan.
 */
export const phaseSchema = z.object({
  ...baseRecord,
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  rank: z.string().min(1),
});

export const taskSchema = z.object({
  ...baseRecord,
  projectId: z.string().min(1),
  /** Fase a la que pertenece. null = tarea suelta del proyecto (los datos anteriores a las fases quedan así). */
  phaseId: z.string().min(1).nullable().default(null),
  title: z.string().min(1),
  description: z.string(),
  status: taskStatusSchema,
  /** Fecha límite: cuándo debe estar terminada (independiente de la programación). */
  dueDate: localDate.nullable(),
  timeSlot: timeSlotSchema.default('all_day'),
  /** Programación: días en que se prevé hacerla (ordenados, sin repetir). Los datos anteriores quedan sin programar. */
  scheduledDays: z.array(localDate).default([]),
  /** Si está activa, se repite cada semana en los días de la semana de `scheduledDays`, desde el primero. */
  repeatWeekly: z.boolean().default(false),
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
  /** Los datos anteriores a las fases no tienen ninguna. */
  phases: z.array(phaseSchema).default([]),
  tasks: z.array(taskSchema),
  ideas: z.array(ideaSchema),
});

export type Timestamp = string;
export type LocalDate = string;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type TaskyData = z.infer<typeof taskyDataSchema>;

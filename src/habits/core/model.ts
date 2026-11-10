import { z } from 'zod';

/**
 * Datos del modo Hábitos: un documento independiente del de Proyectos (TaskyData), con su propia versión.
 * Ver HABITS_GUIDE.md §3–§4.
 */
export const HABITS_SCHEMA_VERSION = 1;

const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** "2026-11-10" (diario) o "W2026-11-09" (semanal, lunes de la semana). */
const periodKey = z.string().regex(/^W?\d{4}-\d{2}-\d{2}$/);

const baseRecord = {
  id: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
};

/** build = hábito positivo (llegar al objetivo); reduce = hábito de reducción (no pasar del límite). */
export const habitKindSchema = z.enum(['build', 'reduce']);
export const habitPeriodSchema = z.enum(['daily', 'weekly']);

/** Objetivo (o límite) vigente desde el periodo que empieza en `since`. Cambiarlo nunca reescribe el pasado. */
const targetSchema = z.object({ since: localDate, value: z.number().positive() });

export const habitSchema = z.object({
  ...baseRecord,
  name: z.string().min(1),
  kind: habitKindSchema,
  period: habitPeriodSchema,
  /** Unidad libre: «min», «vasos», «veces»… */
  unit: z.string(),
  /** Cantidad que suma cada pulsación del botón de registro. */
  step: z.number().positive(),
  targets: z.array(targetSchema).min(1),
  archivedAt: timestamp.nullable(),
});

/**
 * Registro de actividad: solo se añade, nunca se modifica. La cantidad de un periodo es la suma de sus `delta`,
 * así dos dispositivos que registran a la vez suman en lugar de pisarse. Deshacer = un registro negativo.
 */
export const habitLogSchema = z.object({
  ...baseRecord,
  habitId: z.string().min(1),
  period: periodKey,
  delta: z.number(),
});

/**
 * Asiento del ledger (economía). Inmutable y con id determinista (p. ej. `reward:<hábito>:<periodo>`):
 * si dos dispositivos generan el mismo asiento, es el mismo registro y solo cuenta una vez.
 */
export const ledgerKindSchema = z.enum(['habit_reward']);
export const ledgerEntrySchema = z.object({
  ...baseRecord,
  kind: ledgerKindSchema,
  /** Puntos de hábitos (mejoras permanentes). */
  points: z.number().int(),
  /** Oro (contenido del juego). */
  gold: z.number().int(),
  habitId: z.string().nullable(),
  period: periodKey.nullable(),
});

/** Ajustes comunes a todos los dispositivos. Un único registro por usuario (id fijo `profile`). */
export const habitsProfileSchema = z.object({
  ...baseRecord,
  /** Zona horaria IANA con la que se calculan los periodos en todos los dispositivos. */
  timeZone: z.string().min(1),
  /** Día en que se empezó a usar el modo Hábitos. */
  startedOn: localDate,
});

export const habitsDataSchema = z.object({
  schemaVersion: z.literal(HABITS_SCHEMA_VERSION),
  profile: habitsProfileSchema.nullable(),
  habits: z.array(habitSchema),
  logs: z.array(habitLogSchema),
  ledger: z.array(ledgerEntrySchema),
});

export const PROFILE_ID = 'profile';

export type HabitKind = z.infer<typeof habitKindSchema>;
export type HabitPeriod = z.infer<typeof habitPeriodSchema>;
export type Habit = z.infer<typeof habitSchema>;
export type HabitLog = z.infer<typeof habitLogSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type HabitsProfile = z.infer<typeof habitsProfileSchema>;
export type HabitsData = z.infer<typeof habitsDataSchema>;

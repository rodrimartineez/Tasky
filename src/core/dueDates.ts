import type { LocalDate } from './model';

export type DueState = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later';

const SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcMs = (d: LocalDate) => {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
};

/** Días de calendario desde `from` hasta `to` (negativo si `to` ya pasó). */
export const daysBetween = (from: LocalDate, to: LocalDate) => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);

/** Desplaza una fecha de calendario n días. */
export function addDays(date: LocalDate, n: number): LocalDate {
  return new Date(toUtcMs(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Día de la semana de una fecha: 0 = domingo … 6 = sábado. */
export const weekday = (d: LocalDate) => new Date(toUtcMs(d)).getUTCDay();

/** Último día (domingo) de la semana de `today`, con semanas de lunes a domingo. */
export const endOfWeek = (today: LocalDate) => addDays(today, (7 - weekday(today)) % 7);

/** ¿Está programada para ese día? Con repetición semanal, cualquier día de la semana elegido desde el primero. */
export function isScheduledOn(task: { scheduledDays: LocalDate[]; repeatWeekly: boolean }, day: LocalDate): boolean {
  if (task.scheduledDays.includes(day)) return true;
  if (!task.repeatWeekly || task.scheduledDays.length === 0 || day < task.scheduledDays[0]) return false;
  const wd = weekday(day);
  return task.scheduledDays.some((d) => weekday(d) === wd);
}

/** Próximo día programado a partir de hoy (incluido), o null si no queda ninguno. */
export function nextScheduledDay(task: { scheduledDays: LocalDate[]; repeatWeekly: boolean }, today: LocalDate): LocalDate | null {
  if (task.repeatWeekly && task.scheduledDays.length > 0) {
    for (let i = 0; i < 7; i++) {
      const day = addDays(today, i);
      if (isScheduledOn(task, day)) return day;
    }
  }
  return task.scheduledDays.find((d) => d >= today) ?? null;
}

export function dueState(due: LocalDate, today: LocalDate): DueState {
  const diff = daysBetween(today, due);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return diff <= SOON_DAYS ? 'soon' : 'later';
}

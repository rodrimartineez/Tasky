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

export function dueState(due: LocalDate, today: LocalDate): DueState {
  const diff = daysBetween(today, due);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return diff <= SOON_DAYS ? 'soon' : 'later';
}

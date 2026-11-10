import type { LocalDate } from '../../core/model';

/**
 * Periodos de los hábitos como claves de calendario, nunca como instantes:
 * - diario: el propio día, "2026-11-10";
 * - semanal: "W" + el lunes de la semana (lunes–domingo), "W2026-11-09".
 * Toda la aritmética se hace sobre fechas de calendario (UTC a mediodía), así los cambios de hora
 * (días de 23 o 25 horas) no desplazan ningún periodo.
 */
export type Period = 'daily' | 'weekly';
export type PeriodKey = string;

const DAY_MS = 86_400_000;

const toUtc = (d: LocalDate) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), 12);
const fromUtc = (ms: number): LocalDate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: LocalDate, n: number): LocalDate => fromUtc(toUtc(d) + n * DAY_MS);

/** Días entre dos fechas (b − a). */
export const daysBetween = (a: LocalDate, b: LocalDate) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** Lunes de la semana de `d`. */
export function mondayOf(d: LocalDate): LocalDate {
  const weekday = (new Date(toUtc(d)).getUTCDay() + 6) % 7; // 0 = lunes … 6 = domingo
  return addDays(d, -weekday);
}

/** Fecha de calendario de un instante en una zona horaria IANA (p. ej. "Europe/Madrid"). */
export function dateInZone(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Zona horaria del dispositivo; UTC si el entorno no la conoce. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const periodKey = (period: Period, day: LocalDate): PeriodKey => (period === 'daily' ? day : `W${mondayOf(day)}`);

/** Primer día del periodo. */
export const periodStart = (key: PeriodKey): LocalDate => (key.startsWith('W') ? key.slice(1) : key);

/** Último día del periodo. */
export const periodEnd = (key: PeriodKey): LocalDate => (key.startsWith('W') ? addDays(key.slice(1), 6) : key);

export const periodOfKey = (key: PeriodKey): Period => (key.startsWith('W') ? 'weekly' : 'daily');

const nextPeriod = (key: PeriodKey): PeriodKey =>
  key.startsWith('W') ? `W${addDays(key.slice(1), 7)}` : addDays(key, 1);

export const previousPeriod = (key: PeriodKey): PeriodKey =>
  key.startsWith('W') ? `W${addDays(key.slice(1), -7)}` : addDays(key, -1);

/** Un periodo está cerrado cuando su último día ya ha pasado (a las 00:00 del día siguiente). */
export const isClosed = (key: PeriodKey, today: LocalDate) => periodEnd(key) < today;

/** Periodos desde `from` hasta `to`, ambos incluidos (vacío si `from` es posterior). */
export function periodsBetween(from: PeriodKey, to: PeriodKey): PeriodKey[] {
  const out: PeriodKey[] = [];
  for (let k = from; periodStart(k) <= periodStart(to); k = nextPeriod(k)) out.push(k);
  return out;
}

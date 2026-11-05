import type { LocalDate, Timestamp } from './model';

/** Instante actual en UTC (ISO 8601 con milisegundos). Única fuente de marcas temporales. */
export const now = (): Timestamp => new Date().toISOString();

/** Día actual en la zona horaria del dispositivo, como fecha de calendario "YYYY-MM-DD". */
export function today(date = new Date()): LocalDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

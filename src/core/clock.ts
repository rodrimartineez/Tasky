import type { Timestamp } from './model';

/** Instante actual en UTC (ISO 8601 con milisegundos). Única fuente de marcas temporales. */
export const now = (): Timestamp => new Date().toISOString();

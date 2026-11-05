import type { TaskyData } from './model';

/** Almacenamiento local del documento de datos. Cada plataforma aporta su implementación en adapters/. */
export interface Storage {
  /** Devuelve el contenido guardado sin validar, o null si todavía no existe. */
  load(): Promise<unknown | null>;
  save(data: TaskyData): Promise<void>;
}

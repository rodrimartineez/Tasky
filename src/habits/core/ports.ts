import type { HabitsData } from './model';
import type { HabitsRecords } from './sync';

/** Almacenamiento local del documento de Hábitos (independiente del de Proyectos). */
export interface HabitsStorage {
  /** Contenido guardado sin validar, o null si todavía no existe. */
  load(): Promise<unknown | null>;
  save(data: HabitsData): Promise<void>;
}

/** Tablas de Hábitos en el servidor. La sesión es la misma que la de Proyectos. */
export interface HabitsSyncBackend {
  onRemoteChange(listener: () => void): () => void;
  pull(since: number): Promise<{ records: HabitsRecords; cursor: number }>;
  /** Envía cambios y devuelve la versión del servidor de los que no se aceptaron (más recientes allí o ya existentes). */
  push(records: HabitsRecords): Promise<HabitsRecords>;
}

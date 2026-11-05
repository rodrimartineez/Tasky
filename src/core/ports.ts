import type { LocalDate, TaskyData } from './model';

export interface Backup {
  /** Identificador legible de la copia (nombre de archivo). */
  name: string;
  date: LocalDate;
  raw: unknown;
}

/** Almacenamiento local del documento de datos. Cada plataforma aporta su implementación en adapters/. */
export interface Storage {
  /** Devuelve el contenido guardado sin validar, o null si todavía no existe. */
  load(): Promise<unknown | null>;
  save(data: TaskyData): Promise<void>;

  // Copias de seguridad: solo en plataformas con sistema de archivos (escritorio).
  /** Copias disponibles, de la más reciente a la más antigua (contenido sin validar). */
  listBackups?(): Promise<Backup[]>;
  /** Guarda ahora una copia del archivo actual con una etiqueta (p. ej. antes de importar). */
  snapshot?(label: string): Promise<void>;
  /** Aparta el archivo principal ilegible para que no se pierda al restaurar. */
  quarantine?(): Promise<void>;
}

/** Acceso a archivos elegidos por el usuario, distinto en cada plataforma. */
export interface FileExport {
  /** Guarda un archivo de texto para el usuario y devuelve dónde ha quedado (texto legible). */
  exportText(fileName: string, text: string): Promise<string>;
}

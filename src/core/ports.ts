import type { LocalDate, TaskyData } from './model';
import type { SyncRecords } from './sync';

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

/** Sesión iniciada en el servidor de sincronización. */
export interface SyncSession {
  email: string;
}

/** Petición de un asistente (p. ej. Claude) para acceder a Tasky en nombre del usuario (OAuth). */
export interface AuthorizationRequest {
  clientName: string;
  /** Adónde vuelve el navegador tras decidir (se muestra para evitar engaños). */
  redirectUri: string;
  scope: string;
  email: string;
}

/** Servidor de sincronización (Supabase en adapters/). Ver TASKY_GUIDE §7.5. */
export interface SyncBackend {
  getSession(): Promise<SyncSession | null>;
  /** Avisa cuando la sesión empieza, termina o caduca. Devuelve la función para dejar de escuchar. */
  onSessionChange(listener: (session: SyncSession | null) => void): () => void;
  /** Lanza un Error con un mensaje para el usuario si no se puede iniciar sesión. */
  signIn(email: string, password: string): Promise<void>;
  /**
   * Cierra la sesión de este dispositivo (aunque no haya red). Con `everywhere`, revoca en el servidor
   * todas las sesiones de la cuenta (otros dispositivos y asistentes); si no se puede, lanza un Error y
   * la sesión sigue abierta.
   */
  signOut(everywhere?: boolean): Promise<void>;
  /**
   * Avisa (sin datos) en cuanto cambia algo en el servidor, venga de otro dispositivo o de un asistente,
   * para descargarlo al momento con pull. Devuelve la función para dejar de escuchar.
   */
  onRemoteChange(listener: () => void): () => void;
  /** Registros cambiados en el servidor después del cursor (0 = todos) y el nuevo cursor. */
  pull(since: number): Promise<{ records: SyncRecords; cursor: number }>;
  /**
   * Envía cambios locales. El servidor ignora los que son más antiguos que su versión;
   * de esos devuelve la versión del servidor para incorporarla.
   */
  push(records: SyncRecords): Promise<SyncRecords>;
  /**
   * Autorización de asistentes (§7.7). Devuelve la petición a confirmar, o directamente la URL de vuelta
   * si el usuario ya la había autorizado antes.
   */
  getAuthorizationRequest(id: string): Promise<AuthorizationRequest | { redirectUrl: string }>;
  /** Aprueba o deniega la petición y devuelve la URL a la que volver. */
  decideAuthorization(id: string, approve: boolean): Promise<string>;
}

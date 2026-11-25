/** Colaboración: personas, autoría y avisos de actividad en lo compartido. Ver supabase/schema.sql («Colaboración»). */

export type ActivityKind =
  | 'project_shared'
  | 'idea_shared'
  | 'project_unshared'
  | 'idea_unshared'
  | 'task_added'
  | 'task_updated'
  | 'task_done'
  | 'task_deleted'
  | 'idea_added'
  | 'idea_updated'
  | 'idea_deleted';

export interface ActivityItem {
  id: number;
  actorId: string;
  kind: ActivityKind;
  /** Nombre de la tarea, idea o proyecto afectado. */
  subject: string;
  /** Nombre del proyecto (vacío en ideas generales). */
  context: string;
  projectId: string | null;
  ideaId: string | null;
  /** Persona a la que va dirigido (compartir y dejar de compartir). */
  targetUserId: string | null;
  createdAt: string;
}

/** Quién creó cada registro, quién lo modificó por última vez y la versión (`updatedAt`) a la que corresponde. */
export type Authors = Record<string, { createdBy: string; updatedBy: string; version: string }>;

/** Estado de colaboración que descarga cada sincronización. */
export interface CollabSnapshot {
  /** id de usuario → nombre de usuario (el propio y los de quienes comparten algo conmigo). */
  profiles: Record<string, string>;
  /** Participantes (ids de usuario) de cada proyecto e idea compartidos. */
  shares: { project: Record<string, string[]>; idea: Record<string, string[]> };
  /** Creador de cada proyecto e idea compartidos (puede quitar a los demás). */
  owners: Record<string, string>;
  /** Solo el administrador puede crear cuentas nuevas. */
  isAdmin: boolean;
  activity: ActivityItem[];
  /** Último momento en que se abrió el panel de avisos. */
  seenAt: string;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
/** Email interno de las cuentas con nombre de usuario (el usuario nunca lo ve). */
export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@users.tasky.app`;

/** Texto del aviso: «María ha añadido una tarea al proyecto Viaje». */
export function describeActivity(item: ActivityItem, actor: string): string {
  const inProject = item.context ? ` del proyecto ${item.context}` : '';
  switch (item.kind) {
    case 'project_shared':
      return `${actor} ha compartido el proyecto «${item.subject}» contigo`;
    case 'idea_shared':
      return `${actor} ha compartido la idea «${item.subject}» contigo`;
    case 'project_unshared':
      return `${actor} ha dejado de compartir el proyecto «${item.subject}» contigo`;
    case 'idea_unshared':
      return `${actor} ha dejado de compartir la idea «${item.subject}» contigo`;
    case 'task_added':
      return `${actor} ha añadido la tarea «${item.subject}»${item.context ? ` al proyecto ${item.context}` : ''}`;
    case 'task_updated':
      return `${actor} ha modificado la tarea «${item.subject}»${inProject}`;
    case 'task_done':
      return `${actor} ha completado la tarea «${item.subject}»${inProject}`;
    case 'task_deleted':
      return `${actor} ha eliminado la tarea «${item.subject}»${inProject}`;
    case 'idea_added':
      return `${actor} ha añadido la idea «${item.subject}»${item.context ? ` al proyecto ${item.context}` : ' a una idea compartida'}`;
    case 'idea_updated':
      return `${actor} ha añadido contenido a la idea «${item.subject}»${inProject}`;
    case 'idea_deleted':
      return `${actor} ha eliminado la idea «${item.subject}»${inProject}`;
  }
}

/**
 * Proyectos e ideas a los que he perdido el acceso: su último aviso de compartir/dejar de compartir dirigido a mí es
 * «dejar de compartir». (Si después se volvió a compartir, el último aviso es «compartir» y se conservan.)
 */
export function lostAccess(activity: ActivityItem[], me: string): { projects: Set<string>; ideas: Set<string> } {
  const latest = new Map<string, ActivityItem>();
  for (const a of activity) {
    if (a.targetUserId !== me) continue;
    const key = a.kind.startsWith('project') ? `p:${a.projectId}` : `i:${a.ideaId}`;
    const seen = latest.get(key);
    if (!seen || a.id > seen.id) latest.set(key, a);
  }
  const lost = { projects: new Set<string>(), ideas: new Set<string>() };
  for (const a of latest.values()) {
    if (a.kind === 'project_unshared' && a.projectId) lost.projects.add(a.projectId);
    if (a.kind === 'idea_unshared' && a.ideaId) lost.ideas.add(a.ideaId);
  }
  return lost;
}

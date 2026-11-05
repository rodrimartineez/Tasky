/** Marca temporal ISO 8601 en UTC con milisegundos, p. ej. "2026-11-05T18:04:12.345Z". */
export type Timestamp = string;

export type ProjectStatus = 'active' | 'on_hold' | 'done';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface BaseRecord {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface Project extends BaseRecord {
  name: string;
  description: string;
  status: ProjectStatus;
}

export interface Task extends BaseRecord {
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  rank: string;
  completedAt: Timestamp | null;
}

export interface Idea extends BaseRecord {
  projectId: string;
  title: string;
  description: string;
}

export interface TaskyData {
  schemaVersion: number;
  projects: Project[];
  tasks: Task[];
  ideas: Idea[];
}
